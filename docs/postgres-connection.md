# Men in HR Connect — PostgreSQL and Netlify setup (v0.7.0)

## Current verified state

- Supabase project: `men-in-hr-connect` (PostgreSQL 17, Europe/Paris).
- Project URL: `https://rcxxzgzwucgppoavguwl.supabase.co`.
- All three migrations have been applied: applications, admin dashboard/audit records, and private facilitation cloud backup.
- Row Level Security is enabled on all six application tables. Public/authenticated direct access is intentionally not granted; server functions use the server-side Supabase secret.
- Cohort `cohort-1` is closed. There are no student applications or cloud backups.
- One verified Supabase Auth user has the active `owner` role in `public.admin_members`.
- Netlify is **not deployed yet**. The website, OTP sign-in, and cloud backup have not passed live end-to-end testing.
- `ADMIN_DASHBOARD_ENABLED`, `VITE_ADMIN_LOGIN_ENABLED`, and `FACILITATION_CLOUD_SYNC_ENABLED` must remain off until the steps below are completed. Student registration remains closed.

A successful GitHub build does not prove a live Netlify/Supabase integration works.

## Step 1 — Deploy the public website to Netlify

1. Open https://app.netlify.com and sign in using GitHub.
2. Choose **Add new project** (or **Add new site**) → **Import an existing project** → **GitHub**.
3. Authorise Netlify to access the repository if prompted, then select `morrissey-dev/Men-in-Hr`.
4. Select production branch `main`.
5. Confirm build command `npm run build` and publish directory `dist`. The repository's `netlify.toml` already defines these settings and security headers; Netlify Functions are under `netlify/functions`.
6. Deploy the site. **For this first public-only deployment, do not add secret environment variables and do not enable any feature flags.** Public pages are designed to build without a live admin connection.
7. Once the deploy succeeds, copy the exact HTTPS site origin (for example, `https://your-site-name.netlify.app`, with no trailing slash). Keep the URL private if this is a staging site.

Verify `/`, `/about`, `/programme`, `/events`, `/apply`, `/admin`, and `/privacy` load on desktop and mobile. The `/apply` route must say applications are closed. The `/admin` route must not allow sign-in while the flags are off.

## Step 2 — Prepare Supabase email OTP

In Supabase **Authentication → Email Templates**, configure the Magic Link/email template to send the numerical OTP token using `{{ .Token }}`. The frontend verifies the code with Supabase `verifyOtp`; the default confirmation link alone is not the expected user flow. Check email delivery/rate limits before enabling the admin UI. The existing user is already created and allowlisted as `owner`; do not create another user unless needed.

The current Supabase security scan also reported leaked-password protection as disabled. The admin UI uses email OTP, but review and enable the appropriate Auth protections before any broader production rollout.

## Step 3 — Configure Netlify environment variables

Open the deployed Netlify site → **Project configuration / Site configuration → Environment variables** (labels can vary). Add these values from the Supabase dashboard. Do not paste secret keys into ChatGPT, GitHub, source files, screenshots, or any `VITE_*` variable.

### Server-side variables

| Variable | Value | Initial setting |
|---|---|---|
| `SUPABASE_URL` | `https://rcxxzgzwucgppoavguwl.supabase.co` | Set |
| `SUPABASE_SECRET_KEY` | Supabase secret key beginning `sb_secret_` | Set; server only |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key beginning `sb_publishable_` | Set |
| `SITE_ORIGIN` | Exact deployed Netlify HTTPS origin, no trailing slash | Set after first deploy |
| `FACILITATOR_USER_ID` | Your own Auth user UUID from Authentication → Users | Server only |
| `ADMIN_DASHBOARD_ENABLED` | `false` | Keep off during setup |
| `FACILITATION_CLOUD_SYNC_ENABLED` | `false` | Keep off during setup |
| `APPLICATIONS_OPEN` | `false` | Keep closed |
| `PRIVACY_APPROVED` | `false` | Keep closed |
| `RETENTION_PROCESS_ACTIVE` | `false` | Keep closed |

### Frontend build variables

| Variable | Value | Initial setting |
|---|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL | Set |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key beginning `sb_publishable_` | Set |
| `VITE_ADMIN_LOGIN_ENABLED` | `false` | Keep off during setup |

The publishable key is intended for the browser; it does not replace server-side authorisation. The `SUPABASE_SECRET_KEY` must never be put into frontend code. Set environment scope so server-only keys are available to Netlify Functions, not exposed to the browser.

Save changes and trigger a new deploy so the build-time `VITE_*` values are included.

## Step 4 — Enable and test owner login (only after the configuration is ready)

1. Confirm `SITE_ORIGIN` exactly matches the deployed origin.
2. Confirm Supabase email OTP delivers a numerical code and the Auth user email is verified.
3. Set `ADMIN_DASHBOARD_ENABLED=true` and `VITE_ADMIN_LOGIN_ENABLED=true`, then redeploy.
4. Open `/admin`, request a code, and sign in. Confirm the session endpoint authorises the account and that **My Facilitation Desk** appears only for the approved owner UUID.
5. Check `/api/admin/session` returns `401` without a token, rejects an unapproved user, and succeeds only for an active administrator.
6. If any check fails, turn both admin flags off and redeploy while debugging.

## Step 5 — Enable manual cloud backup only after its tests pass

Keep `FACILITATION_CLOUD_SYNC_ENABLED=false` until you verify the no-token response, owner-only authorisation, exact Origin validation, feature-off response, first empty cloud copy, successful upload, and stale-revision rejection. Then enable the server-side flag and redeploy. Use the explicit **Check cloud copy → Upload local plans → Check cloud copy** controls to test; the feature is manual, not automatic real-time sync.

Only store programme-level notes in the facilitator backup. Do not store student names, individual reflections, private disclosures, health/financial details, passwords or other sensitive personal data.

## Student registration stays closed

Do not set `APPLICATIONS_OPEN=true`, `PRIVACY_APPROVED=true`, or `RETENTION_PROCESS_ACTIVE=true` merely to test deployment. Before collecting real student data, obtain the institution's approval for the data controller, privacy notice/lawful basis, minimum fields, approved retention period and an actual tested deletion process. Configure Cloudflare Turnstile for the approved domain and test the entire intake flow using synthetic records. Enabling the retention flag alone does not delete records.

## Read-only verification queries

Run in the Supabase SQL editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select slug, applications_open
from public.cohorts;

select count(*) as student_applications from public.applications;
select count(*) as authorised_admins from public.admin_members where active = true;
select count(*) as facilitator_backups from public.facilitation_workspaces;
```

Expected before launch: `cohort-1` closed, zero applications, one active authorised owner, and zero backups until you perform the first explicit upload.
