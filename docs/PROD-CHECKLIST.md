# Production checklist

What must exist in production before the matching feature is switched on.
`IndexSyncService` builds indexes outside production only.

## Environment

| Variable | Note |
|---|---|
| `NODE_ENV` | `production` — otherwise index builds run at boot |
| `MONGODB_URI` | Production `CRM-Database` |
| `CORS_ORIGINS` | HO portal hosts only, never `*` |
| `SWAGGER_ENABLED` | `false` unless the team wants `/docs` public |
| `B2B_API_URL` | Production B2B Sales API — required, boot fails without it. No token: each request brings the agent's |
| `B2B_MARKETPLACE_CODE` | `MKTP-1` unless the partner marketplace changes |
| `CATALOG_CACHE_TTL_SECONDS` | `60` default |

## Indexes

### `carts` (shared, owned by B2B Sales — build with their sign-off)

Nothing to build: every Vistaar read and write is by `_id` (derived from the
partner id) plus `source` + `user_id`.

**At scale (millions of partners):** if `carts` is sharded, shard on
`{ _id: "hashed" }` or `{ user_id: "hashed" }` — every Vistaar query carries
both, so each one routes to a single shard.

### `draft_orders` (shared — B2B order portal, Sankalp)

Nothing to build. The collection already has `draft_order_id` (unique),
`agent_id` and `status`; every Vistaar query starts from `agent_id` (a
partner's handful of drafts) or `draft_order_id`.

### `piis`, `leads_v2`, `contacts_v2` (read-only)

Nothing to build: the lookups use the existing `pii_id`, `phone_number` and
`contact_id` indexes.

## Draft orders — before switching on

- [ ] `app_counters` has the `_id: 'draft_orders'` row in production (the API answers 503 `DRAFT_ID_UNAVAILABLE` without it — it never creates it)
- [ ] B2B order-portal and Sankalp teams told `entry_path: 'vistaar'` rows exist in `draft_orders`, carry an extra `reminder_sent`, and take ids from the shared `DFT-n` series — their lists must filter on `entry_path` if they should not show them

## Cart — before switching on

- [ ] Login module's auth guard live and `PartnerHeaderGuard` deleted — until then any caller can act as any partner via `x-partner-id`
- [ ] B2B Sales team told `source: 'vistaar'` rows exist in `carts` (their shape, partner in `user_id`), and that their own queries must filter on `source`

## Run

Build `pnpm install --frozen-lockfile && pnpm build`, start `node dist/main`.
