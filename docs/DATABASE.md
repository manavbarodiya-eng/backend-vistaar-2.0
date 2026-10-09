# Database

Database: **`CRM-Database`** (shared with ko-sales, Stockship, prasar, franchise).
Vistaar owns only `vistaar_v2_*`. It never touches `leads_v2`, `contacts_v2`, `customers`,
`addresses` or `agents_v2` — a partner is not a customer.

## Owned (`vistaar_v2_*`)

| Collection | One row per | Key fields |
|---|---|---|
| `vistaar_v2_agents` | phone that asked for an OTP | `_id` UUID (token `sub`), `agent_id` `VST-000001` (at OTP verify), `pii_id`, `user_role` `USR-1040`, `phone` + `country_code`, `otp_verified`, `stage`, `stage_history[]`, `blocked_from`, `onboarding_id`, `cohort`, `preview{name,district,state,pincode}`, `owner_agent_id`, `is_approved`, `decided_by/at`, `rejection_reason`, `profile{…}` + `location` (mapped at approval), `is_active`, `created_by/updated_by`, timestamps |
| `vistaar_v2_onboarding_data` | partner (`vistar_onboarding_data`) | `agent_ref`, `agent_id`, `pii_id`, `cohort`, `config_id` + `config_version`, **`raw_data{}`**, `current_step`, `completed_steps`, `completion_pct`, `documents_review{key:{status,reason,by,at,sig}}`, `remarks{}`, `location`, `submitted_at`, `submit_count`, `updated_data[]` (HO edits, last 200), `source`, `created_by/updated_by`, `version` (optimistic lock) |
| `vistaar_v2_onboarding_configs` | cohort × version | `_id` `<cohort>@<version>`, `status` draft/published/archived, `steps[]`, `published_at/by` |
| `vistaar_v2_cohorts` | partner type | `_id` key, `label{}`, `description{}`, `icon`, `sub_types[]`, `order`, `is_active` |
| `vistaar_v2_sessions` | signed-in device | `_id` = SHA-256 of the refresh token, `agent_ref`, `expires_at` (TTL) |
| `vistaar_v2_settings` | — (`_id: vistaar`) | `default_owner_agent_id`, `conflict_radius_km` |
| `vistaar_v2_counters` | id series | `_id: agent_id`, `seq` |

### Indexes (declared on the schemas; listed in PROD-CHECKLIST)

- agents: `{phone, country_code}` unique · `{agent_id}` unique partial (string) · `{pii_id}` unique partial (string) · `{otp_verified, stage, updated_at:-1}` · `{owner_agent_id, stage}` · `{location: 2dsphere}`
- onboarding_data: `{agent_ref}` unique · `{location: 2dsphere}`
- onboarding_configs: `{cohort, version:-1}` unique · `{cohort, status}` unique partial `status: draft` (one draft per cohort)
- sessions: `{agent_ref}` · `{expires_at}` TTL 0

## Shared — written
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

| Collection | What | When |
|---|---|---|
| `piis` | find by phone (oldest first); **insert** a new person only if none holds the phone (`pii_id`, `phone_number[]`, `country_code`, empty `addresses` / `gst_numbers`; never `referral_id`) | first OTP verify |
| `piis` | `$set documents.<org_document>` = `{ id, image, back_image?, is_verified, validity: null, source: 'vistaar', verified_at }` — only if the slot is empty or ours; reject sets our `is_verified: false` | HO verifies / rejects a KYC document |
| `app_counters` | `$inc` on `_id: piis` — same as ko-sales | when a PII is inserted |

## Shared — read only

| Collection | Why |
|---|---|
| `agents_v2` | HO role (`user_role`) and owner names |
| `pincode_map_v2` | pincode → state / district (cached 6 h) |
| `franchises`, `prasar_v2_retailers`, `vistaaragents` | nearby-network warning at approval. ⚠️ `vistaaragents.latestCoordinates.coordinates` is stored `[lat, lng]` (swapped) — matched with a box, not a geo query |

## Checks

```js
db.vistaar_v2_agents.aggregate([{ $group: { _id: { s: '$stage', v: '$otp_verified' }, n: { $sum: 1 } } }])
db.vistaar_v2_onboarding_configs.find({ status: 'published' }, { steps: 0 })
db.vistaar_v2_agents.find({ agent_id: { $type: 'string' }, pii_id: null })   // must be empty
```

## Seed

`node dist/scripts/seed-onboarding.js [--apply]` — the five PRD cohorts and a first form each
(`src/scripts/default-forms.ts`). Insert-only; dry run by default. Applied on beta 2026-10-09.
| `vistaaragents`, `vistaarfarmers` | old Vistaar (CRM-Backend) | Still written by the old KSS app. Never modified here |

## External

| Source | Use |
|---|---|
| B2B Sales `GET /marketplace-products/v2` (`B2B_MARKETPLACE_CODE`) | Cart prices and stock. Fetched with the calling agent's B2B token (no server token — they expire). Cached in memory per instance (`CATALOG_CACHE_TTL_SECONDS`), shared across agents (prices are per marketplace), stale served up to 15 min while B2B is down. Page size must stay ≤ 100 — above it `avl_qty` is omitted |
