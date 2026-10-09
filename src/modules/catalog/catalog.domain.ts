/**
 * One sellable pack of the B2B marketplace catalogue — the unit a cart line is
 * keyed and priced by.
 */
export interface CatalogVariant {
  sku: string;
  /** The product's `bulk_sku` — what the app calls the product id. */
  product_id: string;
  product_name: string;
  product_image: string | null;
  /** `1 L`, or `1 L × 5` — the app keys its size picker by this label. */
  size_label: string;
  /** Dealer price: what the partner pays. */
  price: number;
  mrp: number;
  gst: number;
  available_qty: number;
}

/**
 * Turns one page item of `GET /marketplace-products/v2` into its sellable
 * variants. Mirrors the app's `MarketplaceProductModel.toEntity()` so a pack
 * label here is the same string the app shows: unpriced or zero-priced packs
 * are dropped, and a repeated label gets its sku appended.
 *
 * The payload is read field by field from `unknown`: it is another team's API,
 * and a renamed field must drop the pack, not crash the catalogue.
 */
export function variantsFromMarketplaceItem(item: unknown): CatalogVariant[] {
  if (!isRecord(item)) return [];

  const productId = str(item.bulk_sku);
  if (!productId) return [];

  const productImage = str(item.image) || null;
  const rawVariants = Array.isArray(item.variants) ? item.variants : [];

  const priced = rawVariants
    .filter(isRecord)
    .filter((v) => v.is_priced === true && num(v.dp) > 0 && str(v.sku));

  const seen = new Set<string>();

  return priced.map((v) => {
    const sku = str(v.sku);
    const pack = isRecord(v.variant) ? v.variant : {};
    const itemQty = Math.trunc(Number(v.item_qty)) || 1;
    const base = `${str(pack.value)} ${str(pack.uom)}`.trim();
    let label = itemQty > 1 ? `${base} × ${itemQty}` : base;

    if (seen.has(label)) label = `${label} (${sku})`;
    seen.add(label);

    const images = Array.isArray(v.images) ? v.images : [];
    const firstImage = images.find(
      (i): i is string => typeof i === 'string' && i.length > 0,
    );
    const stock = isRecord(v.avl_qty) ? num(v.avl_qty.available_qty) : 0;

    return {
      sku,
      product_id: productId,
      product_name: str(item.name) || str(v.display_name),
      product_image: productImage ?? firstImage ?? null,
      size_label: label,
      price: money(num(v.dp)),
      mrp: money(num(v.mrp)),
      gst: num(v.gst_rate ?? v.gst),
      available_qty: Math.max(0, Math.trunc(stock)),
    };
  });
}

/** Rupees to the paisa — floating-point sums drift past two decimals. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
