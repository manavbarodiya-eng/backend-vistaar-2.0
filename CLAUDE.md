# CLAUDE.md — working rules for this repo

**What this is:** the v2 backend for Vistaar 2.0 — the Krishi Sahayak partner
app and its HO portal screens. A rewrite, not a port: every collection this
service owns is a new `vistaar_v2_*` collection, and every route is `/api/v2`.
The old Vistaar (KSS app + `CRM-Backend`) keeps running on its own collections
(`vistaaragents`, `vistaarfarmers`), which this service never writes.

**The database is shared production data.** `CRM-Database` is used by ko-sales,
Stockship, prasar, franchise and others. Read anything; write only our own
`vistaar_v2_*` collections, and the shared identity records only through
ko-sales (see *Shared records* below).

Conventions follow `prasar-backend` (`CLAUDE.md` on its `beta` branch) and
`franchise-offline-hub`, so the HO portal can talk to all three the same way.

---

## Commands

```bash
pnpm start:dev     # watch mode
pnpm typecheck     # tsc --noEmit — must be 0 errors
pnpm lint          # eslint --fix, type-checked rules
pnpm test          # jest — unit specs
pnpm test:e2e      # jest --config test/jest-e2e.json — HTTP layer
pnpm build         # nest build → node dist/main
```

Run **`pnpm typecheck && pnpm lint && pnpm test`** before calling any change done.

---

## The four layers

```
Controller  →  Service  →  Repository  →  Schema
   HTTP        Business      Mongo         DB shape
```

| Layer | Does | Never does |
|---|---|---|
| **Controller** | Routing, DTO validation, guards, Swagger | Business logic. Mongoose. |
| **Service** | Business rules, calls other services | Touch a Mongoose model — **not even an import** |
| **Repository** | Queries, aggregations, `.lean()` reads | Business decisions. HTTP concepts. |
| **Schema** | Document shape, indexes, collection name | Logic |

Need another module's data? Inject its **service** — never its repository or
schema (lint-enforced).

```
src/
├── main.ts              bootstrap: Fastify, helmet, compress, ETag, CORS, /api/v2, Swagger
├── app.module.ts        root composition — every module is wired here
├── config/              env.schema.ts — the only place process.env is read
├── core/                runs by itself on every request: guards, filters, interceptors, http
├── common/              toolbox, runs only when imported: decorators, dto, errors, http, utils
├── database/            Mongo connection + IndexSyncService (vistaar_v2_* only)
└── modules/             one folder per business domain
```

Dependencies point one way: `modules → core → common`. Aliases `@core/*`,
`@common/*`, `@config/*`, `@database/*`, `@modules/*` across units; relative
`./` inside a module. Aliases live in `tsconfig.json`, `package.json` (jest)
and `eslint.config.mjs` — keep the three in agreement.

### Module layout

```
src/modules/<feature>/
├── controllers/<x>.controller.ts
├── services/<x>.service.ts
├── repositories/<x>.repository.ts
├── schemas/<x>.schema.ts            @Schema({ collection: 'vistaar_v2_…' })
├── dto/
├── <x>.domain.ts                    pure rules (stage moves, validators) — test these
└── <x>.module.ts
```

Add `guards/`, `providers/`, `utils/` only when the need is real. Read-only
aggregations for HO screens go in a `<x>.query-service.ts`.

---

## Non-negotiables

1. **Identity comes from the token, never the body.** A partner can read and
   write only their own records; nothing in a DTO says who the caller is.
2. **Auth is on by default.** A global guard protects every route; opt out with
   `@Public()` deliberately. HO routes live under `/admin/*` and check a
   capability, not a role name.
3. **One URI version: `/api/v2`.**
4. **One response envelope.** Return a plain value; `EnvelopeInterceptor` wraps
   it as `{ "success": true, "data": … }`. Lists return `PageResult<T>`:
   `{ items, page, limit, total, has_more }` inside `data`, `limit` clamped to
   200. Errors are `AllExceptionsFilter`'s job — throw through `apiError()` /
   `badRequest()` so `error.code` stays inside `API_ERROR_CODES`.
5. **Every env var is declared in `config/env.schema.ts`** (and `.env.example`).
6. **Collection names are always explicit.** Never rely on Mongoose pluralisation.
7. **No index declarations on shared collections.** `vistaar_v2_*` declare
   theirs on the schema; `IndexSyncService` builds them outside production, and
   every index is also listed in `docs/PROD-CHECKLIST.md` for production.

---

## Shared records (identity spine)

`piis`, `addresses`, `leads_v2` and `app_counters` belong to ko-sales. Vistaar
writes them **only through ko-sales `POST /leads/upsert`** — the same intake
every portal uses — and stores the returned `pii_id` / `lead_id` on its own
documents. `pii_id` (`PII-n`) is the true link to a person; we keep a copy of
name and phone only for fast search.

Our record is written first; the ko-sales call second. A failed call never
fails the partner's request — it is recorded on the partner and retried.

**Exception — `carts`** (owned by B2B Sales): the cart module writes its rows
there directly, by the user's decision (2026-10-08), always with
`source: 'vistaar'` and always filtering on `source` + `partner_id`. No index
is declared in code; the one it needs is in `docs/PROD-CHECKLIST.md`.

---

## Collections

| Domain | Collection | Note |
|---|---|---|
| cart | `carts` (shared, `source: 'vistaar'`) | Active cart `_id` derived from `partner_id`. See `docs/DATABASE.md` |

---

## Writing code here

- Comments explain *why*, never *what*.
- No `any` (lint error). Named exports, `type` imports, Swagger decorators on
  every route, `.lean()` on every read.
- Test the decisions, not the framework: domain rules and service branching.
- Docs ship with the code: `docs/<FEATURE>-APP.md` for the mobile app,
  `docs/<FEATURE>-HO.md` for the HO portal, plus `DATABASE.md` and
  `PROD-CHECKLIST.md` in the same branch.
- Git: one `feat/<module>` branch per module, PR into `beta`.
