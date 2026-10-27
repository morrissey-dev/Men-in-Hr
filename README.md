# Men in HR Connect

**Version 0.4.0 — public website + gated student applications + gated coordinator dashboard** for the Men in HR mentorship initiative being developed within JKUAT HRSA.

## Milestone 4 — deployment readiness (new)

- GitHub Actions workflow for core tests, frontend unit tests, version/security-default checks, and production build.
- Dependency-free `npm run verify:release` checks API routes, migrations, closed-by-default flags, security headers and secret exclusions.
- Read-only staging checks via `npm run smoke:staging -- https://YOUR-TEST-SITE.netlify.app` (only on a closed staging site; no student information).
- Detailed [`deployment runbook`](docs/deployment-runbook.md) and [`go-live checklist`](docs/go-live-checklist.md).
- **NOT deployed:** Supabase, Netlify, retention controls and live authentication remain unconfigured.

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
- Thirty-two offline Node tests (17 new admin checks + 15 application checks) for validation and server logic. **Applications stay CLOSED by default**, including on static Vite previews.

## Important status

**This is implementation source code, not a live registration service; the full production build still needs verification after dependencies can be installed.** The application cannot store real student data until institutional approval, a Supabase project, a configured Netlify deployment and anti-abuse safeguards are in place. No database project, privacy email, verification keys or authorised coordinator was invented.

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

1. Get written confirmation of the programme's authorised operator, data controller, privacy contact, lawful basis/consent notice, approved collection fields, retention period, actual data deletion procedure and any necessary Kenya/institutional cross-border processing review.
2. Create a **dedicated** Supabase project. Run the file `supabase/migrations/202610270001_applications.sql` in the Supabase SQL editor. Verify cohorts and applications are PRIVATE and that anonymous and authenticated roles have no access. Keep the initial cohort's `applications_open = false`.
3. Configure Cloudflare Turnstile with the site's approved hostname. Obtain its site key and secret key. Server-side verification is mandatory.
4. Connect the repository to Netlify. Configure the server-side environment variables shown in `.env.example` using Netlify's environment settings (do not commit real values). Configure `SITE_ORIGIN` to exactly match the application's public HTTPS origin. Confirm Netlify functions are deployed at `/api/application-status` and `/api/applications`.
5. Run integration checks: malformed form -> 400, wrong Origin -> 403, invalid Turnstile -> 400, closed cohort -> 503, valid application -> generic 202, duplicate application -> generic 202, and direct anonymous Supabase reads -> denied. Review privacy notice and real mobile-device accessibility. Enable the approved retention/deletion operating process and document the person responsible.
6. Only **after** approvals and tests, update the cohort in Supabase with `update public.cohorts set applications_open = true where slug = 'cohort-1';`, set `PRIVACY_APPROVED=true`, `RETENTION_PROCESS_ACTIVE=true`, `APPLICATIONS_OPEN=true` in the Netlify server settings and redeploy as necessary. The public status endpoint should return `open: true`. Reverse either switch to close applications immediately.

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

No push to GitHub has been made. The GitHub remote and final stakeholder approvals are not yet configured.

## v0.5.0 — Personal Facilitation Desk

Inside `/admin`, the personal facilitator (identified by server-side `FACILITATOR_USER_ID` and approved `owner` role) can generate and edit 60-minute session plans for both preliminary engagements and all eight mentorship weeks. Plans support guest/no-guest alternatives, low-data participation, previous-commitment check-ins, Markdown export and a ChatGPT Plus-compatible enhancement prompt. The feature is **closed by default**, needs the live admin setup, has no AI API costs, and does not store session notes on the server. See `docs/facilitation-desk.md`.

## v0.6.0 — Personal session management

`/admin` → **My Facilitation Desk** (only the specifically authorised owner account) now includes locally saved plans, session-date and anonymous summary notes, guest briefs, copy-only WhatsApp reminders and follow-ups, feedback questions, and cross-week commitment reminders. This uses device-local browser storage, **not** a central database: export backups and do not enter student personal information. See `docs/session-management.md`. Registration and remote facilitator-storage are still disabled.
