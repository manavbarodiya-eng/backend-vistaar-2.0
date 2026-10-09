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

The active cart is read by `_id` and needs nothing. Saved carts need:

```js
db.carts.createIndex(
  { partner_id: 1, status: 1, updated_at: -1 },
  {
    name: "vistaar_partner_status_updated",
    partialFilterExpression: { source: "vistaar" },
  },
)
```

Partial on `source: 'vistaar'`, so it costs B2B's rows nothing. Without it the
saved-carts list and save are collection scans — fine on beta, not at scale.

**At scale (millions of partners):** if `carts` is sharded, shard on
`{ partner_id: "hashed" }`. Every Vistaar query carries `partner_id`, so each
one routes to a single shard.

## Cart — before switching on

- [ ] Login module's auth guard live and `PartnerHeaderGuard` deleted — until then any caller can act as any partner via `x-partner-id`
- [ ] `carts` index above built
- [ ] B2B Sales team told `source: 'vistaar'` rows exist in `carts`, and that their own queries must filter on `source`

## Run

Build `pnpm install --frozen-lockfile && pnpm build`, start `node dist/main`.
