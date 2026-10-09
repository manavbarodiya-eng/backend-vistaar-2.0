# Database

Database: **`CRM-Database`** (shared with ko-sales, Stockship, prasar, franchise).
Vistaar owns only `vistaar_v2_*`. It never touches `leads_v2`, `contacts_v2`, `customers`,
`addresses` or `agents_v2` — a partner is not a customer.

## Owned (`vistaar_v2_*`)

| Collection | One row per | Key fields |
|---|---|---|
| `vistaar_v2_agents` | phone that asked for an OTP | `_id` UUID (token `sub`), `agent_id` `VST-000001` (at OTP verify), `pii_id`, `phone` + `country_code`, `otp_verified`, `stage`, `stage_history[]`, `blocked_from`, `onboarding_id`, `cohort`, `preview{name,district,state,pincode}`, `owner_agent_id`, `is_approved`, `decided_by/at`, `rejection_reason`, `profile{…}` + `location` (mapped at approval), `is_active`, `created_by/updated_by`, timestamps |
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

| Collection | What | When |
|---|---|---|
| `piis` | find by phone (oldest first); **insert** a new person only if none holds the phone (`pii_id`, `phone_number[]`, `country_code`, empty `addresses` / `gst_numbers`; never `referral_id`) | first OTP verify |
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
