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

A Vistaar row is **a B2B cart row** — the same fields, names and types as the
rows already there (checked 2026-10-09), nothing Vistaar-only. Only the values
say whose it is. Every query filters on `source` + `user_id`, so neither
service reads or writes the other's carts. One cart per partner; there are no
saved / draft carts here.

| Field | Vistaar value |
|---|---|
| `_id` | Derived from the partner id (sha256 → ObjectId), so "one cart per partner" holds on the `_id` index alone |
| `source` | Always `vistaar` |
| `user_id` | The partner (`x-partner-id` until login) |
| `pii_id` | The customer the cart is for (`PII-n`); **absent** = partner's own stock |
| `items[]` | B2B's line: `_id`, `product_id` (bulk sku), `sku` (pack), `product_name`, `product_image` (absent if none), `price`, `quantity`, `total`, `gst`, `moq`, `packaging_size` (pack weight as a string, `"0.92"`), `packaging_type` `""`, `uom` (`kg`/`l`/…), `requested_weight` `0`, `item_type` `bulk`, `packaging_sku` `null`, `is_custom_packaging` `false`. At most 100 lines, quantity ≤ 9999 |
| `subtotal`, `total` | Σ line totals (`total` = `subtotal`) |
| `tax`, `discount` | `0`, as on B2B's rows |
| `created_at`, `updated_at` | Mongoose timestamps (UTC `Date`) |
| `__v` | Mongoose version key, as on B2B's rows; Vistaar writes also use it as the compare-and-set counter |

Not stored (B2B's rows have no field for them): MRP, the pack label and the
item count — the API reads them from the catalogue / works them out.

Indexes: see `PROD-CHECKLIST.md` — none are built from this service.

## Shared — written by this service with `entry_path: 'vistaar'`

### `draft_orders` (writers: B2B order portal `deal` / `customer`, Sankalp `sankalp`)

A Vistaar draft is **the same document** the other writers make (shape checked
on beta, 2026-10-09). Only `entry_path: 'vistaar'` and the partner in
`agent_id` say whose it is; every query filters on both plus
`status: 'draft'`. One open draft per partner per customer.

| Field | Vistaar value |
|---|---|
| `draft_order_id` | `DFT-n` from `app_counters._id = 'draft_orders'` (the same `$inc` the other writers make; unique index) |
| `agent_id` | The partner (`x-partner-id` until login) |
| `deal_id` | `null` |
| `contact_id` | `contacts_v2.contact_id` (`C0-n`) of the customer's `pii_id`, or `null` (own stock, or no contact) |
| `customer_name` | `leads_v2` first + last name of the `pii_id`; `null` = own stock |
| `contact_number` | `piis.phone_number[0]`; `null` = own stock |
| `status` | `draft` (set to `converted` by checkout, later) |
| `order_id` | `null` |
| `entry_path` | Always `vistaar` |
| `form_data` | The `customer` path's camelCase form: `customerType` (`farmer` / `null`), `leadId`, `customerName`, `businessName`, `contactNumber`, empty addresses / customization / payment, and `products[]` = `{ id, productName, variant, sku, quantity, unitPrice, mrp, gstPercent, discount 0, total, weight 0, inStock, _source 'products', imageUrl? }` at the prices of the save |
| `grand_total` | Σ `products[].total` |
| `reminder_sent` | **Vistaar-only** (user's decision, 2026-10-09): WhatsApp reminder sent. Reset to `false` on every save |
| `created_at`, `updated_at`, `__v` | Mongoose timestamps and version key, as on the other rows |

"This customer's draft" = same `contact_number` + `customer_name` (both
`null` for own stock): `draft_orders` has no `pii_id`, so a restore finds the
person again through `contact_id` → `contacts_v2.pii_id`, else
`contact_number` → `piis.phone_number`.

### `app_counters` — one row, `_id: 'draft_orders'`

`$inc: { count: 1 }` + `updated_at` on save of a new draft, never upserted.
Nothing else in `app_counters` is touched.

## Read-only, shared identity

| Collection | Read by | Index used |
|---|---|---|
| `piis` | draft orders: phone of a `pii_id`; `pii_id` of a phone | `pii_id`, `phone_number` |
| `leads_v2` | draft orders: customer name, `lead_id` | `pii_id` |
| `contacts_v2` | draft orders: `contact_id` ↔ `pii_id` | `pii_id`, `contact_id` |

## Read-only, other apps

| Collection | Owner | Note |
|---|---|---|
| `vistaaragents`, `vistaarfarmers` | old Vistaar (CRM-Backend) | Still written by the old KSS app. Never modified here |

## External

| Source | Use |
|---|---|
| B2B Sales `GET /marketplace-products/v2` (`B2B_MARKETPLACE_CODE`) | Cart prices and stock. Fetched with the calling agent's B2B token (no server token — they expire). Cached in memory per instance (`CATALOG_CACHE_TTL_SECONDS`), shared across agents (prices are per marketplace), stale served up to 15 min while B2B is down. Page size must stay ≤ 100 — above it `avl_qty` is omitted |
