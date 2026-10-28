# Men in HR Connect

**Version 0.7.0 — public website + gated student applications + administrator dashboard + private facilitation workspace** for the Men in HR mentorship initiative being developed within JKUAT HRSA.

## Milestone 4 — deployment readiness (new)

- GitHub Actions workflow for core tests, frontend unit tests, version/security-default checks, and production build.
- Dependency-free `npm run verify:release` checks API routes, migrations, closed-by-default flags, security headers and secret exclusions.
- Read-only staging checks via `npm run smoke:staging -- https://YOUR-TEST-SITE.netlify.app` (only on a closed staging site; no student information).
- Detailed [`deployment runbook`](docs/deployment-runbook.md) and [`go-live checklist`](docs/go-live-checklist.md).
- **Supabase is provisioned:** all three database migrations are applied; Cohort 1 is closed, and the approved owner account is allowlisted.
- **Netlify is not deployed yet.** Website hosting, live authentication, and cloud backup are not activated. Student registration remains closed.

## What works now

### Milestone 3: Administrator workspace (new)

- Private `/admin` route with email-code authentication for previously approved Supabase Auth users (`shouldCreateUser: false`).
- `/api/admin/session`, `/api/admin/applications`, `/api/admin/cohorts` protected Netlify endpoints. Every call verifies the Supabase Auth access token and checks an active database administrator membership.
- Private applications list (filter, page, review interests and motivation), allowed application decisions, locked withdrawals.
- Two roles: `coordinator` for reviewing applications and `owner` for draft cohort creation and safely gated opening/closing.
- Audited database RPCs commit status changes and their logs atomically.
- **Admin is OFF by default** until approved manual account provisioning, both SQL migrations and Netlify and Supabase configuration. See [`docs/admin-setup.md`](docs/admin-setup.md).

### Milestones 1 and 2

- The entire v0.1.0 site (Home, About, Programme, Events, Get Involved, Contact, Privacy, 404) remains in place.
- New `/apply` page with a mobile-responsive interest form, accessible labels and on-page validation.
- Students choose **1–3 of the eight approved programme topics**; no student account needed.
- Netlify GET `/api/application-status` checks if real applications are open; POST `/api/applications` securely handles submissions.
- Server-side validation, Cloudflare Turnstile verification, honeypot, exact Origin checking, request-size checks and Netlify function rate limiting.
- Supabase PostgreSQL migration for cohorts and applications. RLS enabled; anonymous and authenticated table privileges revoked; private secret stored server-side only.
- A duplicate email for the same cohort receives a generic confirmation rather than revealing whether it already exists.
- The Privacy page documents the current workflow and conditionally shows approved contact and retention information when registration is enabled.
- Forty-one backend core tests plus frontend unit tests run through GitHub Actions for validation and server logic. **Applications stay CLOSED by default**, including on static Vite previews.

## Important status

**The public website has not been deployed to Netlify yet.** The Supabase project is connected and its three migrations have been applied; one owner account is authorised. Live website hosting, OTP sign-in, cloud backup, and student registration still require Netlify setup and end-to-end verification. No real student applications or facilitator backups have been stored.

## Run website locally

Requires Node.js 20.19+ or Node 22.12+.

```bash
npm install
npm run dev
```

The site runs at `http://localhost:5173` by default. The `/apply` route opens and accurately displays **Applications are currently closed** without a configured Netlify backend.

```bash
npm run verify:release # dependency-free checks for release defaults
npm run build       # type-check + production build
npm run test        # existing Vitest content tests (requires npm install)
npm run test:core   # 32 offline registration/admin tests on Node 22+
```

## Activate secure student applications — NOT required for visual preview

1. Deploy the public website from the GitHub `main` branch to Netlify using `npm run build` and `dist`. No secrets are needed for this initial public-only deploy.
2. The dedicated Supabase project already has all three migrations applied. Verify that `public.cohorts` keeps `cohort-1` closed and that anonymous/authenticated direct table access is denied.
3. Keep `APPLICATIONS_OPEN=false`, `PRIVACY_APPROVED=false`, and `RETENTION_PROCESS_ACTIVE=false`. Student registration must not be enabled until the institution approves the privacy notice, data controller, collection fields, retention/deletion process and anti-abuse protections.
4. Configure Cloudflare Turnstile for the actual approved hostname before enabling intake. Set the site key and private secret in the correct frontend/server locations.
5. Run integration checks on a closed staging deployment: malformed form -> 400, wrong Origin -> 403, invalid Turnstile -> 400, closed cohort -> 503, and anonymous Supabase table reads -> denied. Review the privacy notice and mobile accessibility.
6. Only after formal approval and security testing, enable the database cohort and all required server-side gates together. Document the person responsible for deletion and test that process before collecting real applications.

**Never** place `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, personal application data or `.env` values in frontend code, GitHub or screenshots.

### Local Netlify function testing

Install Netlify CLI separately when internet is available, then run `netlify dev` to exercise the real `/api/*` routes locally. The standard Vite `npm run dev` command does not run Netlify functions; closed status in Vite preview is expected. Check the Netlify CLI documentation for setting development environment variables. Locally set `SITE_ORIGIN` to the exact local Netlify dev origin if intentionally testing submissions with approved TEST data and valid Turnstile credentials.

## Design decisions and data minimisation

- Collect full name, email, institution, study level, 1–3 topics and optional motivation only.
- Require an adult-only confirmation in the initial prototype; applicants younger than 18 are not eligible via this form pending an approved safeguarding arrangement. The broader initiative eligibility is **not** being redefined by this software decision.
- No phone number, identification number, health information or password collected.
- No public application listing, mentor matching, public account creation or automated emails yet. Staff-only admin logins now require explicit manual provisioning; the dashboard remains disabled by default.
- The database insert uses a server-only secret key, which bypasses RLS. It must never be exposed to browser clients.
- Document and OPERATE deletion: `APPLICATION_RETENTION_DAYS` describes an approved maximum, **not** an automatic deletion task. `RETENTION_PROCESS_ACTIVE` must not be set without a real, tested deletion process.
- Cloudflare, Netlify and Supabase provider arrangements and international transfer safeguards need review before live collection.

## Project structure

```text
src/
  components/               # shared UI, including Turnstile
  data/content.ts           # editable programme topics & events
  lib/application-*.ts      # shared form validation and public status helper
  pages/Apply.tsx           # student registration page
  pages/Admin.tsx           # private, role-aware coordinator dashboard (off by default)
  lib/admin-auth.ts         # Supabase Auth sign-in and bearer-token API caller
  pages/                    # all original pages
  styles/global.css         # original stylesheet extended for form
netlify/
  functions/                # registration + authenticated admin endpoints
  lib/application-server.ts # trusted registration backend
  lib/admin-server.ts       # token verification + role-authorised admin actions
supabase/migrations/        # PostgreSQL tables + RLS/grants
spec and process: docs/
tests/application.test.mjs   # fast offline registration tests
tests/admin.test.mjs         # admin security and RBAC tests
```

## Admin dashboard — activation requires institutional approval

The dashboard is viewable at `/admin` but **disabled by default**. For its verified login, database migration, roles, audited decisions and test procedure, follow **[`docs/admin-setup.md`](docs/admin-setup.md)**. Never publish real applicant information to an unapproved environment.

## Git / preservation

This release **extends** the existing project; it does not regenerate or replace working pages. Compare `docs/source-checksums.txt` and `docs/development-log.md` to review changes. After review:

```bash
git add .
git commit -m "feat: add role-protected mentorship administration"
```

The project is maintained in `morrissey-dev/Men-in-Hr`; GitHub Actions verifies backend tests, frontend tests, release defaults and the production build. A successful CI build does not replace live Netlify/Supabase integration tests.

## v0.5.0 — Personal Facilitation Desk

Inside `/admin`, the personal facilitator (identified by server-side `FACILITATOR_USER_ID` and approved `owner` role) can generate and edit 60-minute session plans for both preliminary engagements and all eight mentorship weeks. Plans support guest/no-guest alternatives, low-data participation, previous-commitment check-ins, Markdown export and a ChatGPT Plus-compatible enhancement prompt. The feature is **closed by default**, needs the live admin setup, has no AI API costs, and does not store session notes on the server. See `docs/facilitation-desk.md`.

## v0.6.0 — Personal session management

`/admin` → **My Facilitation Desk** (only the specifically authorised owner account) now includes locally saved plans, session-date and anonymous summary notes, guest briefs, copy-only WhatsApp reminders and follow-ups, feedback questions, and cross-week commitment reminders. This uses device-local browser storage, **not** a central database: export backups and do not enter student personal information. See `docs/session-management.md`. Registration and remote facilitator-storage are still disabled.

## v0.7.0 — Supabase PostgreSQL setup + optional manual cloud backup

The third migration, owner-only private workspace table, and admin-only GET/PUT cloud-backup endpoint are deployed to the Supabase database; the hosting integration is still pending.
**The database is connected and all three migrations are applied. Netlify is not deployed yet, and cloud backup remains OFF** until the hosting configuration and security tests are complete.
Follow [PostgreSQL connection instructions](docs/postgres-connection.md). No database password, secret key, or student data belongs in GitHub.
