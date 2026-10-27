# Men in HR Connect — v0.4.0 deployment and verification runbook

**Status: Release-candidate code, NOT live student registration.** The public website can be deployed with the intake/admin flags off. No live provider account, legal approval, hosting account, secret, deployment, or DNS has been connected through this document.

## A. Verify and build before deployment

1. Use Node 22 LTS and the `main` branch. Install with `npm install` until the lockfile is created and committed. **Before a live production release, commit `package-lock.json` and switch CI/Netlify to `npm ci`.** Avoid automatically adopting unexpected upgrades.
2. Run `npm run verify:release`, `npm run test:core`, `npm test`, and `npm run build`. None of these require real student data or a database connection.
3. Inspect the GitHub Actions workflow `.github/workflows/ci.yml`: all checks must pass. Github Actions tests are NOT a production security audit.
4. Keep `APPLICATIONS_OPEN`, `ADMIN_DASHBOARD_ENABLED`, and all other enable flags set to `false`. Never create or commit a populated `.env`.

## B. Connect Netlify to GitHub (public website only)

1. Sign in to the institution-approved Netlify account. Select **Add new project → Import from Git → GitHub**. Choose `morrissey-dev/Men-in-Hr` and the `main` branch.
2. Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions` (defaults to that path). The file `netlify.toml` already defines the build and security headers.
3. Keep runtime/admin/registration flags **OFF**; do not supply a real Supabase secret yet. The public pages should load without a database.
4. Confirm the domain actually assigned by Netlify, and open `/`, `/about`, `/programme`, `/events`, `/apply`, `/admin`, and `/privacy` on mobile and desktop. Check deep links and keyboard navigation.
5. Verify the serverless function routes deploy on Netlify. `npm run dev` serves **only Vite**, and is NOT suitable for testing `/api/*`. Netlify functions use custom `config.path` routing in each `.mts` file.
6. Run `npm run smoke:staging -- https://ACTUAL-TEST-SITE.netlify.app` **only on a test deployment expected to stay closed**. It deliberately fails if registration is open, and submits no PII.

## C. Before touching real data

- Confirm with the authorised JKUAT/JKUAT HRSA operator: data controller, lawful basis, privacy wording, retention/deletion operation, participant age/safeguarding, approved email, official branding and hosting arrangements.
- Provision a **separate staging Supabase project** and test accounts. Apply migrations in chronological order; check that `anon`/`authenticated` cannot read or change student records. Inspect the Supabase Security Advisor.
- Configure only secure server-side Netlify environment values for `SUPABASE_SECRET_KEY` and `TURNSTILE_SECRET_KEY`; public Supabase publishable and Turnstile site keys are the only keys permitted in the frontend.
- If considering admin activation, use `docs/admin-setup.md`, create admin members manually, test unauthorized access and decisions/audit logging with **synthetic** applicants only.
- Establish actual deletion/retention routines *before* setting `RETENTION_PROCESS_ACTIVE=true`. The variable itself does not delete any records.
- Check Netlify and Supabase quotas/costs, backup/restore, incident contacts, and that test emails are not confused with actual invitations.

## D. Live application release gate — manual approval only

Check each item in `docs/go-live-checklist.md` and record authorised sign-off. Test wrong-origin denial (403), failed bot check (400), closed cohort denial (503), duplicate application generic response, private RLS, and valid synthetic application in staging. A deployment alone must NEVER open student registration.

## E. Rollback

To **immediately stop intake**, set `APPLICATIONS_OPEN=false` in Netlify environment settings, redeploy as required, AND set `public.cohorts.applications_open=false` for the relevant cohort. To stop admin access, set `ADMIN_DASHBOARD_ENABLED=false`; deactivate compromised `admin_members` records and revoke their Supabase Auth sessions. Preserve audit records per approved policy; do not delete real applications without authorised retention/incident review.

## F. Verification log

| Test | Result as of v0.4.0 development | Owner to verify |
| --- | --- | --- |
| Offline backend tests | 32 passed locally | Developer |
| Static release gate | Passed locally | Developer |
| Frontend unit tests | Awaiting npm dependencies | Developer / CI |
| Production build | Awaiting npm dependencies | Developer / CI |
| Netlify deploy | Not configured | Approved operator |
| Supabase integration | Not configured | Approved operator |
| End-to-end security tests | Not performed | Approved operator + reviewer |
| Live registration | Disabled | Approved operator |

Useful references: https://docs.netlify.com/build/functions/configuration/ , https://supabase.com/docs/guides/getting-started/api-keys .
