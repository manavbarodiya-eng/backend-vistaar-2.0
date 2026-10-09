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
| `VISTAAR_JWT_SECRET` | 32+ random characters, unique to this service (`openssl rand -base64 48`) |
| `OTP_TEST_NUMBERS` / `OTP_TEST_CODE` | **must be empty** (boot refuses otherwise) |
| `OTP_API_URL` | `https://utils.ko-tech.in` — DLT template for the Vistaar SMS confirmed with the utils owner |
| `SSO_JWKS_URL` | `https://sso.ko-tech.in/.well-known/jwks.json` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET` | KYC uploads: the org bucket (ko-sales', `micro-dealer.appspot.com`), private objects under `KO-documents/<pii_id>/`, signed URLs on read. Without them `POST /uploads` answers 503 |

## Indexes (create by hand on prod)

```js
db.vistaar_v2_agents.createIndex({ phone: 1, country_code: 1 }, { unique: true })
db.vistaar_v2_agents.createIndex({ agent_id: 1 }, { unique: true, partialFilterExpression: { agent_id: { $type: 'string' } } })
db.vistaar_v2_agents.createIndex({ pii_id: 1 }, { unique: true, partialFilterExpression: { pii_id: { $type: 'string' } } })
db.vistaar_v2_agents.createIndex({ otp_verified: 1, stage: 1, updated_at: -1 })
db.vistaar_v2_agents.createIndex({ owner_agent_id: 1, stage: 1 })
db.vistaar_v2_agents.createIndex({ location: '2dsphere' })
db.vistaar_v2_onboarding_data.createIndex({ agent_ref: 1 }, { unique: true })
db.vistaar_v2_onboarding_data.createIndex({ location: '2dsphere' })
db.vistaar_v2_onboarding_configs.createIndex({ cohort: 1, version: -1 }, { unique: true })
db.vistaar_v2_onboarding_configs.createIndex({ cohort: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'draft' } })
db.vistaar_v2_sessions.createIndex({ agent_ref: 1 })
db.vistaar_v2_sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
```

⚠️ **Beta (2026-10-09): none of these exist** — the beta Mongo host is out of disk and every
build timed out at boot. Code that must stay correct without them: phone upsert re-reads on a
race; onboarding create re-reads on a race; sessions are deleted on refresh (no TTL on beta).

## Data

- Run `node dist/scripts/seed-onboarding.js --apply` once (or create cohorts/forms in the portal).
- `PUT /admin/settings { default_owner_agent_id }` — the HO person who owns new signups.
- Role **USR-1040 "Vistaar Partner"** in `userroles` (`{ UserRoleId, role_name, agent_categories: [], __v: 0 }`) — by the ko-sales owner (`POST /api/v1/agents/roles` takes max+1, so check the max is USR-1039 first). Not on beta yet either.
- Forms published before 2026-10-09 by the seed: `seed-onboarding.js --apply --republish` (12-digit Aadhaar, `org_document`).

## Owed by other teams

- SMS template / DLT for Vistaar on the utilities OTP service.
- Firebase service account for uploads (same project as ko-sales, or a new one).

## Run

Build `pnpm install --frozen-lockfile && pnpm build`, start `node dist/main`. One process
(the OTP rate limits are in memory).
