# Cart — mobile app contract

The partner's cart and saved carts for the Flutter app's **Cart**, **Checkout**
and **Saved carts** screens. Replaces the in-memory `CartRepository` and the
on-device `vistaar.savedCarts` store.

All routes are under `/api/v2/cart` and answer `{ "success": true, "data": … }`. The partner comes from the headers below —
nothing in a path or body says whose cart it is.

## Headers on every call

| Header | Value | Why |
|---|---|---|
| `Authorization` | `Bearer <agent's B2B access token>` — the same token the app's `ApiClients.b2b` sends | The server prices the cart from the B2B catalogue with it. A 401 here means the token expired: renew it (as the B2B client already does) and retry |
| `x-partner-id` | The partner's id | **Temporary, until the login module** (server needs `TRUST_PARTNER_HEADER=true`). When login ships the app drops it — routes stay the same |

Missing either one → **401 `UNAUTHORIZED`**. Saved-cart list, reminder and
delete need only `x-partner-id`.

## Lines are packs (`sku`), priced live

A line is one **pack** (`sku`, e.g. `K-350`), not a product (`product_id` =
`bulk_sku`, e.g. `BK-629`). The app's cart id `BK-629::1 L` maps to
`product_id` + `size_label`.

Prices and stock come from the same B2B marketplace (`MKTP-1`) the Shop lists.
The server never trusts a price from the client; every response re-prices each
line from the catalogue (refreshed every 60 s, with the caller's B2B token):

| Field | Meaning |
|---|---|
| `price` / `line_total` | Today's dealer price × quantity |
| `available_qty` | Stock on hand for the pack |
| `available` | `false` = no longer sold, or stock below the cart quantity |
| `price_changed` | Price moved since the line was added — worth a toast |
| `has_issues` | Any line not `available` — block checkout |

Quantities are **capped** at stock, never rejected: asking for 1000 when 360
are in stock gives 360, as the app's `Cart.add()` does.

## Routes

| Method | Path | Body | Does |
|---|---|---|---|
| `GET` | `/cart` | — | The active cart (empty if none yet) |
| `POST` | `/cart/items` | `{ sku, quantity? = 1 }` | Adds to the line, capped at stock |
| `PATCH` | `/cart/items/:sku` | `{ quantity }` | Sets quantity; `0` removes |
| `DELETE` | `/cart/items/:sku` | — | Removes the line (no error if absent) |
| `PUT` | `/cart/customer` | `{ customer_id \| null, customer_name? }` | Who it is for; `null` = own stock |
| `DELETE` | `/cart` | — | Empties it and clears the customer |
| `POST` | `/cart/saved` | — | Saves a copy (one per customer); active cart kept |
| `GET` | `/cart/saved?page&limit` | — | Saved carts, newest first (`PageResult`) |
| `POST` | `/cart/saved/:id/restore` | — | Replaces the active cart, re-capped at stock |
| `POST` | `/cart/saved/:id/reminder` | — | Marks the WhatsApp reminder sent |
| `DELETE` | `/cart/saved/:id` | — | Deletes the saved cart |

Every active-cart route returns the whole cart, so the app replaces its state
with the response and never computes totals itself.

### Cart

```json
{
  "customer_id": "C-12", "customer_name": "Ramesh",
  "items": [{
    "sku": "K-217", "product_id": "BK-90", "product_name": "…",
    "product_image": "https://…", "size_label": "1 L",
    "price": 320, "mrp": 499, "quantity": 3, "line_total": 960,
    "available_qty": 360, "available": true, "price_changed": false
  }],
  "item_count": 3, "subtotal": 960, "has_issues": false,
  "updated_at": "2026-10-08T12:36:26.868Z"
}
```

Delivery fee, coins and commission stay in the app's `billFor()` for now and
are settled by the orders API.

### Saved cart

```json
{
  "id": "6ac78e4b7d64841549cb0a6e", "customer_id": "C-12", "customer_name": "Ramesh",
  "items": [{ "sku": "K-217", "product_id": "BK-90", "product_name": "…",
              "product_image": null, "size_label": "1 L", "quantity": 3 }],
  "item_count": 3, "subtotal": 960, "reminder_sent": false,
  "updated_at": "2026-10-08T12:36:26.868Z"
}
```

Saving again for the same customer (or for own stock) replaces that saved cart.

## Errors (`error.code`)

| Status | Code | When | App shows |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Bad sku, quantity outside 0–9999, bad id | `details[0]` |
| 401 | `UNAUTHORIZED` | Missing `x-partner-id`, or B2B token missing/expired | Renew B2B token and retry; else sign-in |
| 404 | `NOT_FOUND` | Pack not sold, line not in cart, saved cart gone | `message` |
| 409 | `OUT_OF_STOCK` | Nothing left to add | `message` |
| 409 | `CART_LIMIT_REACHED` | 100 different packs already in the cart | `message` |
| 409 | `CART_EMPTY` | Saving an empty cart | `message` |
| 409 | `CART_BUSY` | Lost repeated write races (rare) — re-`GET` and retry | `message` |
| 503 | `CATALOG_UNAVAILABLE` | B2B catalogue down with nothing cached | Retry later |
