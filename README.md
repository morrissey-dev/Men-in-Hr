# Men in HR Connect

**Version 0.2.0 — public website + closed-by-default student application system** for the Men in HR mentorship initiative being developed within JKUAT HRSA.

## What works now

- The entire v0.1.0 site (Home, About, Programme, Events, Get Involved, Contact, Privacy, 404) remains in place.
- New `/apply` page with a mobile-responsive interest form, accessible labels and on-page validation.
- Students choose **1–3 of the eight approved programme topics**; no student account needed.
- Netlify GET `/api/application-status` checks if real applications are open; POST `/api/applications` securely handles submissions.
- Server-side validation, Cloudflare Turnstile verification, honeypot, exact Origin checking, request-size checks and Netlify function rate limiting.
- Supabase PostgreSQL migration for cohorts and applications. RLS enabled; anonymous and authenticated table privileges revoked; private secret stored server-side only.
- A duplicate email for the same cohort receives a generic confirmation rather than revealing whether it already exists.
- The Privacy page documents the current workflow and conditionally shows approved contact and retention information when registration is enabled.
- Fifteen offline Node tests for validation and server logic. **Applications stay CLOSED by default**, including on static Vite previews.

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
npm run build       # type-check + production build
npm run test        # existing Vitest content tests (requires npm install)
npm run test:core   # 15 offline validation/security tests on Node 22+
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
- No public application listing, mentor matching, admin accounts or automated emails yet.
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
  pages/                    # all original pages
  styles/global.css         # original stylesheet extended for form
netlify/
  functions/                # GET status & POST application endpoints
  lib/application-server.ts # trusted backend integration
supabase/migrations/        # PostgreSQL tables + RLS/grants
spec and process: docs/
tests/application.test.mjs   # fast offline server tests
```

## Git / preservation

This release **extends** the existing project; it does not regenerate or replace working pages. Compare `docs/source-checksums.txt` and `docs/development-log.md` to review changes. After review:

```bash
git add .
git commit -m "feat: add secure gated student cohort applications"
```

No push to GitHub has been made. The GitHub remote and final stakeholder approvals are not yet configured.
