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

## Indexes

None yet — each module adds its own here.

## Run

Build `pnpm install --frozen-lockfile && pnpm build`, start `node dist/main`.
