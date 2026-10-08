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

## Read-only, other apps

| Collection | Owner | Note |
|---|---|---|
| `vistaaragents`, `vistaarfarmers` | old Vistaar (CRM-Backend) | Still written by the old KSS app. Never modified here |
