import { Injectable } from '@nestjs/common';

import { conflict, notFound } from '@common/errors/api-error';
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
  SetCartCustomerDto,
} from '../dto/cart-request.dto';
import type { CartView } from '../dto/cart-view.dto';
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
        current?.pii_id,
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
        current?.pii_id,
      ),
    );
  }

  removeItem(partnerId: string, token: string, sku: string): Promise<CartView> {
    return this.mutate(partnerId, token, (current) =>
      writeOf(applied(removeItem(current?.items ?? [], sku)), current?.pii_id),
    );
  }

  setCustomer(
    partnerId: string,
    token: string,
    dto: SetCartCustomerDto,
  ): Promise<CartView> {
    return this.mutate(partnerId, token, (current) =>
      writeOf(current?.items ?? [], dto.pii_id),
    );
  }

  /** AppContext `clearCart()`: empties the lines and clears the customer. */
  clear(partnerId: string, token: string): Promise<CartView> {
    return this.mutate(partnerId, token, () => writeOf([], null));
  }

  /**
   * The cart becomes these lines, for this customer — a draft order being
   * resumed. Re-priced and re-capped at today's stock; what is no longer
   * sold is left out.
   */
  async replace(
    partnerId: string,
    token: string,
    lines: readonly { sku: string; quantity: number }[],
    piiId: string | null,
  ): Promise<CartView> {
    const catalog = await this.catalog.variants(
      lines.map((l) => l.sku),
      token,
    );
    const restored = restoreLines(lines, catalog);

    return this.mutate(partnerId, token, () => writeOf(restored, piiId));
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /**
   * Read → change → write-if-unchanged. Queued per partner on this instance
   * (quick taps on one phone would otherwise lose writes to each other —
   * 6 of 20 in the beta smoke test), and guarded by the document's `__v`
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
        ? await this.carts.updateActive(partnerId, current.__v, next)
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
      | (Pick<CartRecord, 'items'> & {
          pii_id?: string | null;
          updated_at?: Date;
        })
      | null,
    token: string,
  ): Promise<CartView> {
    if (!cart || cart.items.length === 0) {
      return {
        pii_id: cart?.pii_id ?? null,
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
      pii_id: cart.pii_id ?? null,
      items: priced.map((l) => ({
        sku: l.sku,
        product_id: l.product_id,
        product_name: l.product_name,
        product_image: l.product_image ?? null,
        size_label: l.size_label,
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
  piiId: string | null | undefined,
): CartWrite {
  const { subtotal } = totalsOf(lines);

  return { items: lines, subtotal, total: subtotal, pii_id: piiId ?? null };
}
