# BMTC Live Dashboard

Real-time Quotation & LPO control for BMTC — a brand-new project built to
the project plan. **Next.js (App Router) + Neon (PostgreSQL) + Prisma**,
deployed on **Vercel**.

Security is the priority: every access decision is made on the server from
the live database, secrets live only in environment variables, and the
audit trail is append-only.

## What it does

- **Auth** — username + password (bcrypt, 12 rounds), signed **httpOnly**
  session cookie (JWT via `jose`, 8-hour expiry). No public sign-up.
- **Brute-force defenses** — per-IP rate limit on login **and** a
  DB-backed account lockout (5 failed attempts → 15 minutes). Login is
  constant-time and returns one generic error, so it can't be used to
  discover which usernames exist.
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
