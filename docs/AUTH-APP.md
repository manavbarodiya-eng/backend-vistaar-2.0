# Login — phone + OTP (Vistaar app)

**Base URL:** `{API_BASE}/api/v2` · every response is `{ "success": true, "data": … }` or
`{ "success": false, "error": { "code", "message", "details" } }`.

Partners are not company staff: they sign in with a mobile number and an OTP, and this
API issues their session itself. The HO portal keeps using the company SSO login.

## 1. The flow

```
Phone screen ──POST /auth/otp/send──▶ partner record created (otp_verified: false)
                                      SMS sent (4-digit OTP)
OTP screen  ──POST /auth/otp/verify─▶ first time: VST-000001 given, person linked (pii_id)
                                      → access_token + refresh_token
App         ──GET /me───────────────▶ where the application stands → which screen to open
```

India (+91) numbers only for now.

## 2. Routes

| Method | Path | Auth | Body | Answer |
|---|---|---|---|---|
| POST | `/auth/otp/send` | public | `{ phone, country_code? }` | `{ sent: true, resend_after_seconds: 30 }` |
| POST | `/auth/otp/resend` | public | `{ phone, country_code? }` | same |
| POST | `/auth/otp/verify` | public | `{ phone, country_code?, otp }` | session (below) |
| POST | `/auth/refresh` | public | `{ refresh_token }` | a new session — **store the new refresh token** |
| POST | `/auth/logout` | bearer | `{ refresh_token }` | `{ signed_out: true }` — this device only |
| GET | `/me` | bearer | — | status (below) |

`phone` is 10 digits (`+91 98765 43210`, `09876543210` are accepted and cleaned).
`country_code` defaults to `+91`.

### Session

```jsonc
{
  "access_token": "eyJ…",          // Authorization: Bearer <access_token> on every call
  "refresh_token": "Qm9…",         // single use; rotated by /auth/refresh
  "token_type": "Bearer",
  "expires_in": 43200,             // seconds (12 h)
  "agent": { "agent_id": "VST-000001", "pii_id": "PII-1617919", "stage": "signed_up",
             "is_approved": false, "onboarding_id": null }
}
```

Refresh tokens live 30 days. Several devices may be signed in at once.
On `401` from any route: call `/auth/refresh` once; if that also fails, show the login screen.

### `GET /me` — the status / pending screen

```jsonc
{
  "agent_id": "VST-000001", "pii_id": "PII-1617919", "phone": "9691829003", "country_code": "+91",
  "stage": "kyc_review",
  "next_action": "wait_for_review",
  "is_approved": false,
  "ordering_unlocked": false,
  "rejection_reason": null,
  "onboarding": { "onboarding_id": "ffb3…", "cohort": "vistaar_agent", "completion_pct": 100,
                  "submitted_at": "2026-10-09T07:20:47.059Z", "fields_to_fix": 0 },
  "profile": null,                  // filled when approved
  "member_since": "2026-10-09T07:20:45.600Z"
}
```

| `next_action` | Show |
|---|---|
| `choose_cohort` | partner-type picker → onboarding |
| `complete_onboarding` | resume the form at `onboarding.current_step` (see ONBOARDING-APP) |
| `fix_requested_changes` | the form, only the flagged fields editable, with HO's notes |
| `wait_for_review` | status tracker: application with Katyayani |
| `approved` | home — ordering unlocked |
| `rejected` | rejection reason + contact support |
| `blocked` | blocked screen (login is refused too) |

## 3. Errors

| Code | HTTP | Meaning / what to show |
|---|---|---|
| `INVALID_PHONE` | 400 | not a 10-digit Indian mobile |
| `OTP_NOT_REQUESTED` | 400 | verify before send — go back to the phone screen |
| `OTP_INVALID` | 401 | wrong or expired OTP (message says which) |
| `OTP_LIMIT` | 429 | too many SMS (3 per 10 min) or tries (5 per 10 min); `details[0]` = `retry_after_seconds=N` |
| `OTP_UNAVAILABLE` | 503 | SMS service down — retry later |
| `IDENTITY_UNAVAILABLE` | 503 | could not create the account — retry |
| `ACCOUNT_BLOCKED` | 403 | blocked by Katyayani |
| `SESSION_INVALID` | 401 | refresh token spent/expired — log in again |
| `VALIDATION_FAILED` | 400 | body shape; `details` lists the fields |

## 4. Testing without an SMS

On non-production servers, numbers listed in `OTP_TEST_NUMBERS` skip the SMS and accept
`OTP_TEST_CODE`. Ask the backend dev for the current pair. Production refuses to boot with any.
