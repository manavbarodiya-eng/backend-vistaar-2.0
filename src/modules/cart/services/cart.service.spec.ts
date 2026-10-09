import { Types } from 'mongoose';

import type { CatalogVariant } from '@modules/catalog/catalog.domain';
import type { CatalogService } from '@modules/catalog/services/catalog.service';

import { lineFrom } from '../cart.domain';
import type { SavedCartsQueryDto } from '../dto/cart-request.dto';
import type {
  CartRepository,
  CartWrite,
} from '../repositories/cart.repository';
import type { CartRecord } from '../schemas/cart.schema';
import { CartService } from './cart.service';

const PARTNER = 'VA-1';
const TOKEN = 'agent-token';

function variant(
  sku = 'K-1',
  overrides: Partial<CatalogVariant> = {},
): CatalogVariant {
  return {
    sku,
    product_id: 'BK-1',
    product_name: 'Product',
    product_image: null,
    size_label: '1 L',
    price: 100,
    mrp: 150,
    gst: 0,
    available_qty: 10,
    ...overrides,
  };
}

function record(
  write: CartWrite,
  overrides: Partial<CartRecord> = {},
): CartRecord {
  return {
    _id: new Types.ObjectId(),
    source: 'vistaar',
    partner_id: PARTNER,
    status: 'active',
    customer_key: null,
    tax: 0,
    discount: 0,
    reminder_sent: false,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...write,
    ...overrides,
  };
}

describe('CartService', () => {
  let active: CartRecord | null;
  let repo: jest.Mocked<CartRepository>;
  let catalog: Map<string, CatalogVariant>;
  let service: CartService;

  beforeEach(() => {
    active = null;
    catalog = new Map([
      ['K-1', variant()],
      ['K-2', variant('K-2')],
    ]);

    repo = {
      findActive: jest.fn(() => Promise.resolve(active)),
      insertActive: jest.fn((_p: string, data: CartWrite) => {
        active = record(data);
        return Promise.resolve(true);
      }),
      updateActive: jest.fn((_p: string, version: number, data: CartWrite) => {
        if (!active || active.version !== version)
          return Promise.resolve(false);
        active = record(data, { version: version + 1 });
        return Promise.resolve(true);
      }),
      upsertSaved: jest.fn((_p: string, key: string, data: CartWrite) =>
        Promise.resolve(record(data, { status: 'saved', customer_key: key })),
      ),
      listSaved: jest.fn(),
      findSaved: jest.fn(),
      markReminderSent: jest.fn(),
      deleteSaved: jest.fn(),
    } as unknown as jest.Mocked<CartRepository>;

    const catalogService = {
      variant: (sku: string) => Promise.resolve(catalog.get(sku) ?? null),
      variants: (skus: Iterable<string>) =>
        Promise.resolve(
          new Map(
            [...skus].flatMap((s) =>
              catalog.has(s) ? [[s, catalog.get(s)!]] : [],
            ),
          ),
        ),
    } as unknown as CatalogService;

    service = new CartService(repo, catalogService);
  });

  describe('addItem', () => {
    it('creates the cart on the first add, then updates it', async () => {
      await service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 2 });
      const view = await service.addItem(PARTNER, TOKEN, {
        sku: 'K-1',
        quantity: 3,
      });

      expect(repo.insertActive).toHaveBeenCalledTimes(1);
      expect(repo.updateActive).toHaveBeenCalledTimes(1);
      expect(view).toMatchObject({
        item_count: 5,
        subtotal: 500,
        has_issues: false,
      });
      expect(active?.total).toBe(500);
    });

    it('retries when another device wrote in between', async () => {
      await service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 1 });

      // The other device adds K-2 right after this request reads the cart.
      const realFind = repo.findActive.getMockImplementation()!;
      repo.findActive.mockImplementationOnce(async (p) => {
        const snapshot = await realFind(p);
        active = record(
          {
            ...active!,
            items: [...active!.items, lineFrom(variant('K-2'), 1)],
          },
          { version: active!.version + 1 },
        );
        return snapshot;
      });

      const view = await service.addItem(PARTNER, TOKEN, {
        sku: 'K-1',
        quantity: 1,
      });

      expect(repo.updateActive).toHaveBeenCalledTimes(2);
      expect(view.items.map((l) => [l.sku, l.quantity])).toEqual([
        ['K-1', 2],
        ['K-2', 1],
      ]);
    });

    it('gives up as CART_BUSY after repeated lost races', async () => {
      active = record({
        items: [],
        item_count: 0,
        subtotal: 0,
        total: 0,
        customer_id: null,
        customer_name: null,
      });
      repo.updateActive.mockResolvedValue(false);

      await expect(
        service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 1 }),
      ).rejects.toMatchObject({
        status: 409,
        response: { error: 'CART_BUSY' },
      });
      expect(repo.updateActive).toHaveBeenCalledTimes(6);
    });

    it('answers 404 for a pack not sold here, OUT_OF_STOCK for a sold-out one', async () => {
      await expect(
        service.addItem(PARTNER, TOKEN, { sku: 'K-x', quantity: 1 }),
      ).rejects.toMatchObject({ status: 404 });

      catalog.set('K-1', variant('K-1', { available_qty: 0 }));
      await expect(
        service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 1 }),
      ).rejects.toMatchObject({
        status: 409,
        response: { error: 'OUT_OF_STOCK' },
      });
      expect(repo.insertActive).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('is an empty cart before anything was added, without writing', async () => {
      await expect(service.get(PARTNER, TOKEN)).resolves.toMatchObject({
        items: [],
        item_count: 0,
        subtotal: 0,
      });
      expect(repo.insertActive).not.toHaveBeenCalled();
    });

    it("prices at today's catalogue and flags a delisted pack", async () => {
      await service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 2 });
      await service.addItem(PARTNER, TOKEN, { sku: 'K-2', quantity: 1 });
      catalog.set('K-1', variant('K-1', { price: 120 }));
      catalog.delete('K-2');

      const view = await service.get(PARTNER, TOKEN);

      expect(
        view.items.map((l) => [l.sku, l.price, l.available, l.price_changed]),
      ).toEqual([
        ['K-1', 120, true, true],
        ['K-2', 100, false, false],
      ]);
      expect(view.has_issues).toBe(true);
    });
  });

  describe('setCustomer', () => {
    it('drops the name when the cart goes back to own stock', async () => {
      await service.setCustomer(PARTNER, TOKEN, {
        customer_id: 'C-1',
        customer_name: 'Ramesh',
      });
      const view = await service.setCustomer(PARTNER, TOKEN, {
        customer_id: null,
        customer_name: 'Ramesh',
      });

      expect(view).toMatchObject({ customer_id: null, customer_name: null });
    });
  });

  describe('save', () => {
    it('refuses an empty cart', async () => {
      await expect(service.save(PARTNER, TOKEN)).rejects.toMatchObject({
        response: { error: 'CART_EMPTY' },
      });
    });

    it('saves one cart per customer, `self` for own stock, and keeps the active cart', async () => {
      await service.addItem(PARTNER, TOKEN, { sku: 'K-1', quantity: 2 });

      const saved = await service.save(PARTNER, TOKEN);

      expect(repo.upsertSaved).toHaveBeenCalledWith(
        PARTNER,
        'self',
        expect.objectContaining({ item_count: 2, subtotal: 200 }),
      );
      expect(saved).toMatchObject({
        item_count: 2,
        subtotal: 200,
        reminder_sent: false,
      });
      expect(active?.items).toHaveLength(1);
    });
  });

  describe('restore', () => {
    it('404s a saved cart that is gone', async () => {
      repo.findSaved.mockResolvedValue(null);

      await expect(service.restore(PARTNER, TOKEN, 'x')).rejects.toMatchObject({
        status: 404,
      });
    });

    it("replaces the active cart, re-capped at today's stock", async () => {
      await service.addItem(PARTNER, TOKEN, { sku: 'K-2', quantity: 1 });
      repo.findSaved.mockResolvedValue(
        record(
          {
            items: [
              lineFrom(variant('K-1'), 50),
              lineFrom(variant('K-gone'), 1),
            ],
            item_count: 51,
            subtotal: 5100,
            total: 5100,
            customer_id: 'C-1',
            customer_name: 'Ramesh',
          },
          { status: 'saved' },
        ),
      );

      const view = await service.restore(PARTNER, TOKEN, 'id');

      expect(view.items.map((l) => [l.sku, l.quantity])).toEqual([['K-1', 10]]);
      expect(view).toMatchObject({
        customer_id: 'C-1',
        customer_name: 'Ramesh',
      });
    });
  });

  describe('listSaved', () => {
    it('pages the saved carts', async () => {
      repo.listSaved.mockResolvedValue([[], 0]);
      const query = { page: 2, limit: 10, skip: 10 } as SavedCartsQueryDto;

      const page = await service.listSaved(PARTNER, query);

      expect(repo.listSaved).toHaveBeenCalledWith(PARTNER, 10, 10);
      expect(page).toMatchObject({
        items: [],
        page: 2,
        limit: 10,
        has_more: false,
      });
    });
  });
});
