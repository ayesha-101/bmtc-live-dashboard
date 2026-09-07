# BMTC Live Dashboard

Real-time Quotation & LPO control for BMTC — a brand-new project built to
the project plan. **Next.js (App Router) + Neon (PostgreSQL) + Prisma**,
deployed on **Vercel**.

Security is the priority: every access decision is made on the server from
the live database, secrets live only in environment variables, and the
audit trail is append-only.

## What it does

- **Auth** — email + password (bcrypt, 12 rounds), signed **httpOnly**
  session cookie (JWT via `jose`, 8-hour expiry). No public sign-up.
- **Brute-force defenses** — per-IP rate limit on login **and** a
  DB-backed account lockout (5 failed attempts → 15 minutes). Login is
  constant-time and returns one generic error, so it can't be used to
  discover which emails are registered.
- **Forced first-login password change** for every account a manager
  creates.
- **RBAC**, enforced on the server in one place (`lib/permissions.ts`).
  Three roles with deliberately separate jobs:
  | Who | Sees / does |
  |---|---|
  | Employee (producing dept) | only the LPOs they created — **no margin** |
  | Employee (Sales Admin dept) | all `pending_invoice` LPOs, every dept — **no margin**; marks them Done |
  | **Manager** (the BM) | **read-only** dashboard + activity across all depts, incl. **margin**. No edits, no invoicing, no accounts. |
  | **Admin** | **accounts + security only**: creates every account (incl. the Manager), deactivates, resets passwords, unlocks lockouts. **Never** sees the dashboard, LPOs, margin, or invoices. |
- **LPO lifecycle** — `quoted → converted_lpo → pending_invoice →
  invoiced`, plus `lost`. Every transition is written to `audit_log` in
  the **same transaction** as the change.
- **Pending Invoices queue** (Sales Admin / Manager) — cross-department,
  no margin. Marking one **Done** is a single status-guarded update, so two
  people clicking at once can't both succeed; the loser is told it was
  already handled.
- **Manager dashboard** — company KPIs, a per-department breakdown for the
  four producing units, and a live recent-activity feed from `audit_log`.
- **Live updates** — the dashboard, My LPOs, and Pending Invoices refresh
  themselves every few seconds (`router.refresh()`), pausing while the tab
  is hidden.
- **Programmatic API** — `GET /api/manager/overview` (manager-only, 403
  otherwise) returns the same numbers as the dashboard.

## Local development

Requires Postgres (a Neon dev branch works).

```bash
npm install
cp .env.example .env      # set DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy # or: npx prisma migrate dev
npm run db:seed           # creates the first Manager, prints its one-time
                          # password once — set a real one at first login
npm run dev
```

## Deploying (Vercel + Neon)

1. Push to GitHub (this repo).
2. Vercel → New Project → import this repo.
3. Storage → add a **Neon** Postgres database (sets `DATABASE_URL`).
4. Add `AUTH_SECRET` as an environment variable —
   `openssl rand -base64 48`. **Never** reuse the `.env.example` value.
5. Deploy. Then run once against production:
   ```bash
   DATABASE_URL=<prod-url> npx prisma migrate deploy
   DATABASE_URL=<prod-url> npm run db:seed
   ```
   HTTPS/SSL is automatic on Vercel.

Secrets are **only** ever environment variables — never committed to the
repo, never in the code.

## Phase 6 — security checklist

- [x] Every API route / server action verifies session **and** role on the
      server (`lib/auth.ts` + `lib/permissions.ts`); middleware is a fast
      redirect layer only, never the trust boundary.
- [x] Every input is validated with `zod` before it reaches the database
      (`lib/validation.ts`).
- [x] A deactivated user loses access on their next request — guards
      re-read the live DB, not just the cookie.
- [x] Amounts recomputed/aggregated on the server; margin is never selected
      into a non-manager response.
- [x] "Open someone else's record by changing the URL" fails: ownership +
      status are pinned in the write's `WHERE`, so it affects zero rows.
- [x] Security headers set in `next.config.ts`; HTTPS via Vercel.
- [ ] **Neon**: create a dedicated application DB role **without `DELETE`
      or `UPDATE` on `audit_log`**, so the trail can't be rewritten even by
      a bug. Point the app's `DATABASE_URL` at that role. Example:
      ```sql
      REVOKE UPDATE, DELETE ON audit_log FROM app_role;
      ```
- [ ] **Neon**: enable Point-in-Time Restore (backups).

## Structure

```
app/
  login/ account/change-password/     auth + forced reset
  lpos/                               My LPOs (list + create + transitions)
  invoices/                          Pending Invoices queue (Done button)
  dashboard/                        manager dashboard
  admin/users/                     manager-only user management
  api/manager/overview/           programmatic overview (manager-only)
  components/                     app shell + LivePoll
lib/
  auth.ts permissions.ts session.ts  access control
  db.ts validation.ts audit.ts       data + input + audit helpers
  password.ts ratelimit.ts reference.ts overview.ts format.ts
prisma/
  schema.prisma  migrations/  seed.ts
```

## CRM feed (Abu Dhabi LPOs)

The dashboard can take its LPOs straight from the CRM instead of the in-app
form. The link is **one-way**: the CRM pushes records in, and nothing in
this codebase ever writes back to or modifies the CRM.

### How it works

```
LPO saved in the CRM
   │  the CRM's webhook fires          (1–2 s)
   ▼
POST /api/crm/lpo
   │  signature checked, Abu Dhabi filter, routed to the salesperson
   ▼
deals table  ──►  employee's page, manager's dashboard, audit log
   │  the pages already poll for changes   (3–5 s)
   ▼
on screen, under 10 seconds end to end
```

Because the CRM opens the connection outwards, this works even when the CRM
sits on a server inside the company network — no inbound firewall rule.

### Setting it up

1. Generate a secret and set it as `CRM_WEBHOOK_SECRET` (Vercel →
   Settings → Environment Variables):

   ```
   openssl rand -hex 32
   ```

   Until it is set, the endpoint refuses every request rather than standing
   open.

2. In the CRM, add an outgoing webhook on "LPO created / updated" pointing
   at `https://<your-domain>/api/crm/lpo`, method POST, JSON body.

3. Have it authenticate in one of two ways:

   - **HMAC signature (preferred).** Header `x-bmtc-signature:
     sha256=<hex>`, an HMAC-SHA256 of the exact request body keyed with the
     secret. This also proves the body wasn't altered on the way.
   - **Bearer token.** Header `Authorization: Bearer <secret>`, for CRMs
     whose webhook screen can only add a fixed header.

4. Optionally set `x-bmtc-source: zoho` (or whatever it is) so the CRM Feed
   page shows where each record came from.

### What it accepts

One record, or an array, optionally wrapped in `data` / `records` /
`items` / `results`. Field names are matched loosely — case and punctuation
are ignored, and the usual synonyms are accepted (`amount` / `value` /
`grand_total`; `owner` / `sales_person` / `assigned_to`), including the
nested `{ "name": ... }` objects Zoho, Salesforce and Dynamics use for
lookups. See `lib/crm.ts` for the full alias list.

```bash
curl -X POST https://<your-domain>/api/crm/lpo \
  -H "Authorization: Bearer $CRM_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
        "id": "5187000000123456",
        "po_number": "PO-2026-0091",
        "quotation_number": "BMTC-JIH-202601-7783",
        "customer": "Spaceage General Cont.",
        "project_name": "Atrium Tower",
        "sales_person": "Nelson",
        "department": "Electrical",
        "brand": "BAHRA",
        "location": "Mussafah, Abu Dhabi",
        "amount": "118,313.16",
        "gp_value": "14,197.58",
        "lpo_date": "2026-01-16"
      }'
```

### The two rules that decide an LPO's fate

**Abu Dhabi only.** The location is classified three ways, not two. A
recognised Abu Dhabi location (the emirate, `AUH`, or a town inside it —
Mussafah, Al Ain, KIZAD, Ruwais…) is accepted. A recognised other emirate
is skipped. Anything *unrecognised* is neither: it is held back and listed
on the CRM Feed page, because silently dropping it would lose real work and
silently accepting it would inflate the numbers. Adding a missing place
name is one line in `ABU_DHABI` in `lib/crm.ts`.

**The salesperson owns the row.** Records are matched to an account by
email first, then by full name. There is no catch-all fallback account on
purpose — attributing one person's LPO to another would corrupt the exact
thing this system measures — so an unmatched name is held back until the
account exists.

Every record, accepted or not, is written to `crm_sync_log` with its
reason and its original payload, visible at **/sync**. The manager sees the
customer and value columns there; the admin sees the health of the feed
without the business figures, consistent with the rest of the system.

Re-sending a record is safe: the CRM's own id is UNIQUE on the deal, so a
retry or an edit updates the existing row instead of creating a second one.
An LPO already taken into billing by Sales Admin has its figures updated
but is never dragged back to an earlier stage.
