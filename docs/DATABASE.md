# Database

Database: **`CRM-Database`** (shared with ko-sales, Stockship, prasar, franchise).

## Owned by this service (`vistaar_v2_*`)

None yet — each module adds its collection here with its fields and indexes.

## Shared — written only through ko-sales `/leads/upsert`

| Collection | Key | Use here |
|---|---|---|
| `piis` | `pii_id` (`PII-n`) | The person. Stored on our documents as the link |
| `addresses` | `address_id` (`ADDR-n`) | Created by the upsert, referenced from `piis.addresses[]` |
| `leads_v2` | `lead_id`, unique `pii_id` | One lead per person, org-wide |

## Shared — written by this service with `source: 'vistaar'`

### `carts` (owner: B2B Sales — its rows are `source: 'b2b' | 'retailer'`)

Every Vistaar row carries `source: 'vistaar'` and every query here filters on
it plus `partner_id`, so neither service reads or writes the other's carts.
Line fields follow B2B's naming.

| Field | Note |
|---|---|
| `_id` | **Active cart:** derived from the partner id (sha256 → ObjectId), so "one active cart per partner" holds on the `_id` index alone. **Saved:** a normal ObjectId |
| `source` | Always `vistaar` |
| `partner_id` | Owner, from the token |
| `status` | `active` (one per partner) · `saved` (one per partner per `customer_key`) |
| `customer_id`, `customer_name` | Who it is for; `null` = partner's own stock |
| `customer_key` | Saved only: `customer_id` or `self` |
| `items[]` | `sku`, `product_id` (bulk sku), `product_name`, `product_image`, `packaging_size`, `price`, `mrp`, `gst`, `quantity`, `total` — at most 100 lines, quantity ≤ 9999 |
| `item_count`, `subtotal`, `total` | Σ quantity, Σ line totals (`total` = `subtotal`) |
| `tax`, `discount` | `0`, kept for shape parity with B2B rows |
| `reminder_sent` | Saved only |
| `version` | Compare-and-set counter for active-cart writes |
| `created_at`, `updated_at` | Mongoose timestamps |

Indexes: see `PROD-CHECKLIST.md` — none are built from this service.

## Read-only, other apps

| Collection | Owner | Note |
|---|---|---|
| `vistaaragents`, `vistaarfarmers` | old Vistaar (CRM-Backend) | Still written by the old KSS app. Never modified here |

## External

| Source | Use |
|---|---|
| B2B Sales `GET /marketplace-products/v2` (`B2B_MARKETPLACE_CODE`) | Cart prices and stock. Fetched with the calling agent's B2B token (no server token — they expire). Cached in memory per instance (`CATALOG_CACHE_TTL_SECONDS`), shared across agents (prices are per marketplace), stale served up to 15 min while B2B is down. Page size must stay ≤ 100 — above it `avl_qty` is omitted |
