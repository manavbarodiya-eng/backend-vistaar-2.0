import { Injectable } from '@nestjs/common';

import { conflict, notFound } from '@common/errors/api-error';
import { PageResult } from '@common/http/page-result';
import { KeyedSerialQueue } from '@common/utils/keyed-serial-queue';
import type { CatalogVariant } from '@modules/catalog/catalog.domain';
import { CatalogService } from '@modules/catalog/services/catalog.service';

import {
  addItem,
  MAX_LINES,
  priceLines,
  removeItem,
  restoreLines,
  setQuantity,
  totalsOf,
  type CartChange,
  type CartLineData,
} from '../cart.domain';
import type {
  AddCartItemDto,
  SavedCartsQueryDto,
  SetCartCustomerDto,
} from '../dto/cart-request.dto';
import type { CartView, SavedCartView } from '../dto/cart-view.dto';
import {
  CartRepository,
  type CartWrite,
} from '../repositories/cart.repository';
import type { CartRecord } from '../schemas/cart.schema';

/**
 * Compare-and-set attempts before a write gives up. Within one instance a
 * partner's writes are already queued, so a conflict means a request for the
 * same cart landed on another instance — a retry or two settles it.
 */
const MAX_WRITE_ATTEMPTS = 6;

/**
 * Upper bound of the random pause before retry n (× n), so instances that
 * lost a race together do not re-read and collide again in step.
 */
const RETRY_JITTER_MS = 15;

type ActiveChange = (current: CartRecord | null) => CartWrite;

@Injectable()
export class CartService {
  /** One partner's cart writes, one at a time, on this instance. */
  private readonly writes = new KeyedSerialQueue();

  constructor(
    private readonly carts: CartRepository,
    private readonly catalog: CatalogService,
  ) {}

  // ── Active cart ───────────────────────────────────────────────────────

  async get(partnerId: string, token: string): Promise<CartView> {
    return this.view(await this.carts.findActive(partnerId), token);
  }

  async addItem(
    partnerId: string,
    token: string,
    dto: AddCartItemDto,
  ): Promise<CartView> {
    const variant = await this.sellable(dto.sku, token);

    return this.mutate(partnerId, token, (current) =>
      writeOf(
        applied(addItem(current?.items ?? [], variant, dto.quantity)),
        current,
      ),
    );
  }

  async updateItem(
    partnerId: string,
    token: string,
    sku: string,
    quantity: number,
  ): Promise<CartView> {
    const variant =
      quantity > 0 ? await this.catalog.variant(sku, token) : null;

    return this.mutate(partnerId, token, (current) =>
      writeOf(
        applied(setQuantity(current?.items ?? [], sku, quantity, variant)),
        current,
      ),
    );
  }

  removeItem(partnerId: string, token: string, sku: string): Promise<CartView> {
    return this.mutate(partnerId, token, (current) =>
      writeOf(applied(removeItem(current?.items ?? [], sku)), current),
    );
  }

  setCustomer(
    partnerId: string,
    token: string,
    dto: SetCartCustomerDto,
  ): Promise<CartView> {
    return this.mutate(partnerId, token, (current) =>
      writeOf(current?.items ?? [], {
        customer_id: dto.customer_id,
        customer_name:
          dto.customer_id === null ? null : (dto.customer_name ?? null),
      }),
    );
  }

  /** AppContext `clearCart()`: empties the lines and clears the customer. */
  clear(partnerId: string, token: string): Promise<CartView> {
    return this.mutate(partnerId, token, () => writeOf([], null));
  }

  // ── Saved carts ───────────────────────────────────────────────────────

  /**
   * Cart.tsx `saveForLater`: a copy of the active cart, one per customer. The
   * active cart is left as it is, as on the phone.
   */
  async save(partnerId: string, token: string): Promise<SavedCartView> {
    const current = await this.carts.findActive(partnerId);

    if (!current || current.items.length === 0) {
      throw conflict('CART_EMPTY', 'Add a product before saving the cart.');
    }

    // Saved at today's prices: the saved list shows what the order is worth now.
    const catalog = await this.catalog.variants(
      current.items.map((l) => l.sku),
      token,
    );
    const lines = priceLines(current.items, catalog).map(stripView);

    const saved = await this.carts.upsertSaved(
      partnerId,
      current.customer_id ?? 'self',
      writeOf(lines, current),
    );

    return savedView(saved);
  }

  async listSaved(
    partnerId: string,
    query: SavedCartsQueryDto,
  ): Promise<PageResult<SavedCartView>> {
    const [rows, total] = await this.carts.listSaved(
      partnerId,
      query.skip,
      query.limit,
    );
    return new PageResult(rows.map(savedView), total, query);
  }

  /**
   * SavedCarts `_resume`: the saved lines replace the active cart, re-capped
   * at today's stock. The saved cart stays, as on the phone.
   */
  async restore(
    partnerId: string,
    token: string,
    id: string,
  ): Promise<CartView> {
    const saved = await this.carts.findSaved(partnerId, id);
    if (!saved) throw notFound('This saved cart no longer exists.');

    const catalog = await this.catalog.variants(
      saved.items.map((l) => l.sku),
      token,
    );
    const lines = restoreLines(saved.items, catalog);

    return this.mutate(partnerId, token, () => writeOf(lines, saved));
  }

  async markReminderSent(
    partnerId: string,
    id: string,
  ): Promise<SavedCartView> {
    const saved = await this.carts.markReminderSent(partnerId, id);
    if (!saved) throw notFound('This saved cart no longer exists.');
    return savedView(saved);
  }

  async deleteSaved(partnerId: string, id: string): Promise<{ deleted: true }> {
    const deleted = await this.carts.deleteSaved(partnerId, id);
    if (!deleted) throw notFound('This saved cart no longer exists.');
    return { deleted: true };
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Read → change → write-if-unchanged. Queued per partner on this instance
   * (quick taps on one phone would otherwise lose writes to each other —
   * 6 of 20 in the beta smoke test), and guarded by the document's `version`
   * across instances. No database locks or transactions: each write touches
   * one document, so carts scale with the partner count.
   */
  private mutate(
    partnerId: string,
    token: string,
    change: ActiveChange,
  ): Promise<CartView> {
    return this.writes.run(partnerId, () =>
      this.writeActive(partnerId, token, change),
    );
  }

  private async writeActive(
    partnerId: string,
    token: string,
    change: ActiveChange,
  ): Promise<CartView> {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      if (attempt > 0) await pause(Math.random() * RETRY_JITTER_MS * attempt);

      const current = await this.carts.findActive(partnerId);
      const next = change(current);

      const written = current
        ? await this.carts.updateActive(partnerId, current.version, next)
        : await this.carts.insertActive(partnerId, next);

      if (written) {
        return this.view({ ...next, updated_at: new Date() }, token);
      }
    }

    throw conflict(
      'CART_BUSY',
      'Your cart was changed on another device. Please try again.',
    );
  }

  /** A pack that is sold here, or 404. */
  private async sellable(sku: string, token: string): Promise<CatalogVariant> {
    const variant = await this.catalog.variant(sku, token);
    if (!variant) throw notFound('This product is not sold here any more.');
    return variant;
  }

  private async view(
    cart:
      | (Pick<CartRecord, 'items' | 'customer_id' | 'customer_name'> &
          Partial<Pick<CartRecord, 'updated_at'>>)
      | null,
    token: string,
  ): Promise<CartView> {
    if (!cart || cart.items.length === 0) {
      return {
        customer_id: cart?.customer_id ?? null,
        customer_name: cart?.customer_name ?? null,
        items: [],
        item_count: 0,
        subtotal: 0,
        has_issues: false,
        updated_at: cart?.updated_at ?? null,
      };
    }

    const catalog = await this.catalog.variants(
      cart.items.map((l) => l.sku),
      token,
    );
    const priced = priceLines(cart.items, catalog);
    const totals = totalsOf(priced);

    return {
      customer_id: cart.customer_id,
      customer_name: cart.customer_name,
      items: priced.map((l) => ({
        sku: l.sku,
        product_id: l.product_id,
        product_name: l.product_name,
        product_image: l.product_image,
        size_label: l.packaging_size,
        price: l.price,
        mrp: l.mrp,
        quantity: l.quantity,
        line_total: l.total,
        available_qty: l.available_qty,
        available: l.available,
        price_changed: l.price_changed,
      })),
      item_count: totals.item_count,
      subtotal: totals.subtotal,
      has_issues: priced.some((l) => !l.available),
      updated_at: cart.updated_at ?? null,
    };
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Domain failures as the HTTP errors the app branches on. */
function applied(change: CartChange): CartLineData[] {
  if (change.ok) return change.lines;

  switch (change.reason) {
    case 'OUT_OF_STOCK':
      throw conflict('OUT_OF_STOCK', 'This pack is out of stock.');
    case 'CART_LIMIT_REACHED':
      throw conflict(
        'CART_LIMIT_REACHED',
        `A cart can hold up to ${MAX_LINES} products.`,
      );
    case 'NOT_IN_CART':
      throw notFound('This pack is not in the cart.');
  }
}

function writeOf(
  lines: CartLineData[],
  customer: Pick<CartRecord, 'customer_id' | 'customer_name'> | null,
): CartWrite {
  const totals = totalsOf(lines);

  return {
    items: lines,
    item_count: totals.item_count,
    subtotal: totals.subtotal,
    total: totals.subtotal,
    customer_id: customer?.customer_id ?? null,
    customer_name: customer?.customer_name ?? null,
  };
}

function stripView({
  available_qty: _q,
  available: _a,
  price_changed: _p,
  ...line
}: ReturnType<typeof priceLines>[number]): CartLineData {
  return line;
}

function savedView(cart: CartRecord): SavedCartView {
  return {
    id: String(cart._id),
    customer_id: cart.customer_id,
    customer_name: cart.customer_name,
    items: cart.items.map((l) => ({
      sku: l.sku,
      product_id: l.product_id,
      product_name: l.product_name,
      product_image: l.product_image,
      size_label: l.packaging_size,
      quantity: l.quantity,
    })),
    item_count: cart.item_count,
    subtotal: cart.subtotal,
    reminder_sent: cart.reminder_sent,
    updated_at: cart.updated_at,
  };
}
