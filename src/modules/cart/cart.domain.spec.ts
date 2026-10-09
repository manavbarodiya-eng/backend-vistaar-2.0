import type { CatalogVariant } from '@modules/catalog/catalog.domain';

import {
  addItem,
  lineFrom,
  MAX_LINES,
  MAX_QUANTITY,
  priceLines,
  removeItem,
  restoreLines,
  setQuantity,
  totalsOf,
} from './cart.domain';

function variant(overrides: Partial<CatalogVariant> = {}): CatalogVariant {
  return {
    sku: 'K-350',
    product_id: 'BK-629',
    product_name: '2IN1',
    product_image: null,
    size_label: '1 L',
    price: 1895,
    mrp: 3829,
    gst: 18,
    available_qty: 12,
    ...overrides,
  };
}

describe('addItem', () => {
  it('adds a new line priced from the catalogue', () => {
    const change = addItem([], variant(), 2);

    expect(change).toEqual({ ok: true, lines: [lineFrom(variant(), 2)] });
    expect(change.ok && change.lines[0].total).toBe(3790);
  });

  it('adds to the line already there', () => {
    const start = [lineFrom(variant(), 3)];
    const change = addItem(start, variant(), 4);

    expect(change.ok && change.lines.map((l) => l.quantity)).toEqual([7]);
  });

  it('caps at the stock on hand instead of failing', () => {
    const change = addItem([lineFrom(variant(), 10)], variant(), 5);

    expect(change.ok && change.lines[0].quantity).toBe(12);
  });

  it('caps at MAX_QUANTITY whatever the stock', () => {
    const big = variant({ available_qty: 1_000_000 });
    const change = addItem([], big, MAX_QUANTITY + 5);

    expect(change.ok && change.lines[0].quantity).toBe(MAX_QUANTITY);
  });

  it('fails as OUT_OF_STOCK when nothing is left', () => {
    expect(addItem([], variant({ available_qty: 0 }), 1)).toEqual({
      ok: false,
      reason: 'OUT_OF_STOCK',
    });
  });

  it('refuses a new line past MAX_LINES but still tops up an existing one', () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) =>
      lineFrom(variant({ sku: `K-${i}` }), 1),
    );

    expect(addItem(full, variant({ sku: 'K-new' }), 1)).toEqual({
      ok: false,
      reason: 'CART_LIMIT_REACHED',
    });
    expect(addItem(full, variant({ sku: 'K-0' }), 1).ok).toBe(true);
  });
});

describe('setQuantity', () => {
  const start = [lineFrom(variant(), 2)];

  it('sets and caps the quantity', () => {
    const change = setQuantity(start, 'K-350', 50, variant());

    expect(change.ok && change.lines[0].quantity).toBe(12);
  });

  it('removes the line at 0, even when the pack is no longer sold', () => {
    expect(setQuantity(start, 'K-350', 0, null)).toEqual({
      ok: true,
      lines: [],
    });
  });

  it('fails as NOT_IN_CART for a sku the cart does not hold', () => {
    expect(setQuantity(start, 'K-1', 1, variant({ sku: 'K-1' }))).toEqual({
      ok: false,
      reason: 'NOT_IN_CART',
    });
  });

  it('fails as OUT_OF_STOCK when the pack is gone or sold out', () => {
    expect(setQuantity(start, 'K-350', 1, null)).toEqual({
      ok: false,
      reason: 'OUT_OF_STOCK',
    });
    expect(
      setQuantity(start, 'K-350', 1, variant({ available_qty: 0 })),
    ).toEqual({ ok: false, reason: 'OUT_OF_STOCK' });
  });
});

describe('removeItem', () => {
  it('is idempotent', () => {
    expect(removeItem([], 'K-350')).toEqual({ ok: true, lines: [] });
  });
});

describe('restoreLines', () => {
  it('re-prices, re-caps and drops packs no longer sold', () => {
    const catalog = new Map([
      ['K-350', variant({ price: 2000, available_qty: 3 })],
    ]);

    const lines = restoreLines(
      [
        { sku: 'K-350', quantity: 5 },
        { sku: 'K-gone', quantity: 1 },
      ],
      catalog,
    );

    expect(lines).toEqual([
      lineFrom(variant({ price: 2000, available_qty: 3 }), 3),
    ]);
  });
});

describe('priceLines', () => {
  it("prices at today's catalogue and flags what moved", () => {
    const stored = [
      lineFrom(variant(), 2),
      lineFrom(variant({ sku: 'K-2' }), 20),
      lineFrom(variant({ sku: 'K-gone' }), 1),
    ];
    const catalog = new Map([
      ['K-350', variant({ price: 1900 })],
      ['K-2', variant({ sku: 'K-2' })],
    ]);

    const priced = priceLines(stored, catalog);

    expect(
      priced.map((l) => [l.sku, l.price, l.available, l.price_changed]),
    ).toEqual([
      ['K-350', 1900, true, true],
      ['K-2', 1895, false, false],
      ['K-gone', 1895, false, false],
    ]);
    expect(priced[0].total).toBe(3800);
  });
});

describe('totalsOf', () => {
  it('sums quantities and money to the paisa', () => {
    const lines = [
      lineFrom(variant({ price: 0.1 }), 1),
      lineFrom(variant({ sku: 'K-2', price: 0.2 }), 1),
    ];

    expect(totalsOf(lines)).toEqual({ item_count: 2, subtotal: 0.3 });
  });
});
