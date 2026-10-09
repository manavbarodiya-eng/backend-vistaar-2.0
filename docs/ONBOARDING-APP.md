# Onboarding — dynamic form (Vistaar app)

**Base URL:** `{API_BASE}/api/v2` · bearer = partner `access_token` (AUTH-APP.md), except the
three **public** reads (partner types, form, pincode) used by the Join wizard before login.

The form is **not hard-coded in the app**. HO designs it per partner type (cohort) in the
HO portal; the app downloads it and renders steps and fields from it. Everything the
partner types is saved with `PATCH /onboarding` after every step (any number of calls);
`POST /onboarding/submit` sends it for KYC review.

## 1. Flow — Join Vistaar as in the PRD and the app design

The signup wizard is filled **before** the OTP and verified **last** (PRD A2):
Who you are → Mobile → Personal → Location → Details → Review → OTP → KYC checklist → submit.

```
BEFORE LOGIN (public — no token)
  GET /onboarding/cohorts               → "Who you are": partner-type picker (+ sub_types for Other)
  GET /onboarding/config?cohort=<key>   → the form for that type; render its steps
                                          (cache it; send If-None-Match → 304)
  GET /onboarding/pincode/:pincode      → prefill state / district on the Location step
  … the app keeps every answer locally until the OTP is verified …

OTP (AUTH-APP.md §1, intent: "signup")
  POST /auth/otp/send   { phone, intent: "signup" }
  POST /auth/otp/verify { phone, otp, intent: "signup" }   → session

RIGHT AFTER VERIFY — one call saves the whole wizard
  PATCH /onboarding { cohort, step_id: "<last step shown>", data: { …every answer… } }
                                          (up to 100 fields per call; files are not in the wizard)

KYC CHECKLIST (logged in)
  POST /uploads?purpose=<field_key>     → for each document / photo (multipart `file`)
  PATCH /onboarding { step_id, data }   → save each checklist item as it is done
  POST /onboarding/submit               → stage kyc_review, form locked
  GET /me                               → status tracker
```

- Which fields belong to the wizard and which to the KYC checklist is the form's own steps:
  the steps without `document` / `file` fields are the wizard, the rest is the checklist
  (in the default forms: personal, location, details → wizard; kyc, agreement → checklist).
- A partner who closes the app mid-way logs in later (`intent: "login"`): `GET /me` says
  `complete_onboarding` and `GET /onboarding` returns everything already saved — resume there.
- OTP-first (verify, then fill each step with `PATCH /onboarding`) works too; same calls.
- A partner who has not been approved never lands on home.

## 2. Routes

| Method | Path | Auth | Answer |
|---|---|---|---|
| GET | `/onboarding/cohorts` | **public** | `[{ _id, label{en,hi…}, description, icon, sub_types, order }]` |
| GET | `/onboarding/config?cohort=` | **public** | `{ _id: "vistaar_agent@2", cohort, version, steps: [...] }` — active steps, in order |
| GET | `/onboarding/pincode/:pincode` | **public** | `{ pincode, state, district, taluk }` or `null` — prefill the location step |
| GET | `/onboarding` | bearer | my form (below), or `null` before the first save |
| PATCH | `/onboarding` | bearer | `{ cohort?, step_id?, data: { key: value } }` → my form |
| POST | `/onboarding/submit` | bearer | my form, `stage: kyc_review` |
| POST | `/uploads?purpose=<field_key>` | bearer | multipart `file` (≤ 10 MB; JPG/PNG/WEBP/HEIC/PDF) → `{ path, url, content_type, size }` |

Public routes allow 60 calls a minute per network (429 beyond).

## 3. The config

```jsonc
{ "step_id": "kyc", "order": 4, "title": { "en": "KYC documents", "hi": "केवाईसी दस्तावेज़" },
  "description": { "en": "…" }, "icon": "shield-check", "is_active": true,
  "fields": [
    { "key": "pan", "type": "document", "label": { "en": "PAN card" }, "required": true,
      "help": { "en": "Needed for TDS on commission." },
      "validation": { "max_items": 1, "number_required": true, "regex": "^[A-Z]{5}[0-9]{4}[A-Z]$" } }
  ] }
```

Field keys: `key`, `type`, `label`, `placeholder?`, `help?`, `required`, `options?` (select),
`validation?`, `visible_if?`, `fields?` (groups). Labels are `{ en, hi, mr, gu, … }` — show the
user's language, fall back to `en`.

`visible_if: { field, op: eq|ne|in|filled, value }` — hide the field unless the rule holds
against the values entered so far. A hidden required field is not required.

### Field types → value to send

| `type` | Send in `data` | Notes |
|---|---|---|
| `text`, `textarea` | `"string"` | trimmed; `validation.min_length/max_length/regex` |
| `number` | `12` | `validation.min/max` |
| `boolean` | `true` / `false` | `validation.must_accept: true` → only `true` is accepted (agreements) |
| `date` | `"2026-10-09"` | |
| `phone` | `"9876543210"` | |
| `email` | `"a@b.com"` | |
| `pincode` | `"462026"` | |
| `select` | `"option_value"` | one of `options[].value` |
| `multi_select` | `["a","b"]` | |
| `file` | `{ "path": "<from /uploads>" }` | |
| `document` | `{ "files": ["<path>", …], "number": "ABCDE1234F" }` | KYC document HO verifies; `max_items` files; `number_required` |
| `location` | `{ "lat": 23.25, "lng": 77.41, "accuracy": 12, "captured_at": "ISO" }` | **device GPS**, India only — optional; without it the nearby-network check is skipped |
| `object` | `{ "sub_key": value, … }` | sub-fields in `fields` |
| `object_list` | `[{ … }, { … }]` | repeatable group, `max_items` rows |

`null` for a key clears it. Only the keys you send change — other steps are never overwritten.
Files must be uploaded by this partner (`/uploads` → `KO-documents/<your pii_id>/…`); anyone else's path is refused.

## 4. My form (`GET /onboarding`, and every PATCH/submit answer)

```jsonc
{
  "onboarding_id": "ffb3…", "cohort": "vistaar_agent", "config_id": "vistaar_agent@1", "config_version": 1,
  "stage": "onboarding",
  "editable_fields": null,            // null = all; [] = locked; ["pan"] = only these (changes requested)
  "raw_data": { "full_name": "…", "pan": { "files": ["…"], "number": "…", "urls": ["https://signed…"] } },
  "current_step": "kyc", "completed_steps": ["personal", "location"], "completion_pct": 72,
  "missing_required": ["selfie", "partner_agreement"],
  "documents_review": { "pan": { "status": "rejected", "reason": "Photo is blurred", "by": "…", "at": "…" } },
  "remarks": { "pan": "Photo is blurred" },        // HO's notes when changes are requested
  "submitted_at": null, "submit_count": 0, "updated_at": "…"
}
```

File values come back with signed `url` / `urls` (valid 1 hour) for previews.

Before the first submit the form follows the latest published version (values for removed
fields are dropped) and the partner may switch cohort by sending a different `cohort`.
After submitting, both are fixed.

## 5. Errors

| Code | HTTP | Meaning |
|---|---|---|
| `COHORT_REQUIRED` | 400 | first save without `cohort` |
| `COHORT_NOT_FOUND` | 400 | unknown or inactive partner type |
| `CONFIG_NOT_PUBLISHED` | 409 | that type has no published form yet |
| `UNKNOWN_FIELD` | 400 | `details` = keys not on the form |
| `VALIDATION_FAILED` | 400 | `details` = one sentence per bad value — show `details[0]` |
| `FIELD_NOT_EDITABLE` | 409 | changes requested: only `editable_fields` may change |
| `ONBOARDING_LOCKED` | 409 | already submitted / approved |
| `REQUIRED_FIELDS_MISSING` | 400 | submit with empty required fields; `details` = keys |
| `VERSION_CONFLICT` | 409 | two saves collided — retry |
| `UPLOADS_NOT_CONFIGURED` | 503 | file storage not set up on this server |
| `FILE_REQUIRED`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE` | 400 / 413 | upload problems |
| `ACCOUNT_BLOCKED` | 403 | |
