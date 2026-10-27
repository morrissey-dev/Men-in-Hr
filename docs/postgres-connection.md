# Men in HR Connect — Connect PostgreSQL through Supabase (v0.7.0)

**Current state:** Source code is connected to GitHub, but NO live database has been connected, SQL migrations have not been applied, and Cloud Backup / Admin Login / Student Registration remain closed until setup is verified. A successful GitHub build is NOT proof of a working live database.

## Why Supabase?

Supabase provides managed PostgreSQL, Supabase Auth (email OTP), a SQL editor and REST APIs. This project connects to the API over HTTPS from Netlify serverless functions; **there is no need to expose a raw PostgreSQL connection string in the React browser**. Do NOT set the database password in Netlify for these routes.

## Operator walkthrough (do this in order)

1. Create a separate project at https://supabase.com/dashboard. Give it a name like `men-in-hr-connect-staging`; choose a nearby available region. Safeguard the database password in a password manager. Never share it in chat or commit it.
2. Wait until the database is ready. Open SQL Editor and apply these files **one at a time**, in this precise order:
   - `supabase/migrations/202610270001_applications.sql`
   - `supabase/migrations/202610280001_admin_dashboard.sql`
   - `supabase/migrations/202610280002_facilitation_cloud.sql`
3. In **Authentication → Users**, manually provision your own authorised admin user. In Authentication → Email Templates, set the Magic Link/OTP template to include `{{ .Token }}` for 6-digit sign-in codes. For testing, check that your email address is permitted by Supabase's default email sender restrictions; production use may require custom SMTP.
4. Copy **only your Supabase Auth user UUID** (the UUID shown for the new user, NOT your email or password). Then execute, replacing `<YOUR_AUTH_UUID>` in the SQL editor:

```sql
insert into public.admin_members (user_id, role, active)
values ('<YOUR_AUTH_UUID>', 'owner', true)
on conflict (user_id) do update set role=excluded.role, active=true;
```

5. In the Supabase project's **Connect / Settings → API Keys** screens, find the Project URL, publishable (`sb_publishable_...`) key and secret (`sb_secret_...`) key. **Never paste the secret key into ChatGPT, GitHub, Discord or screenshots.** The publishable key is used by the browser; secret goes only to Netlify's Functions-scope environment variables.
6. In Netlify site → **Project configuration → Environment variables**, add the following. Use your own values and actual Netlify HTTPS origin (no trailing slash). Set environment scope so server-only secrets are accessible to Functions. Then trigger a new Netlify deploy for the changes to take effect.

| Variable | Value | Exposure |
|---|---|---|
| `SUPABASE_URL` | Project URL | Server |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **Server only** |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Server |
| `SITE_ORIGIN` | Live Netlify HTTPS site URL | Server |
| `ADMIN_DASHBOARD_ENABLED` | `true` after testing | Server |
| `VITE_SUPABASE_URL` | Project URL | Public build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Public build |
| `VITE_ADMIN_LOGIN_ENABLED` | `true` after testing | Public build |
| `FACILITATOR_USER_ID` | Your approved Auth UUID | **Server only** |
| `FACILITATION_CLOUD_SYNC_ENABLED` | `false` until backup checks pass; then `true` | Server only |

**Keep `APPLICATIONS_OPEN=false`, `PRIVACY_APPROVED=false`, `RETENTION_PROCESS_ACTIVE=false`** until your institution's approved data-controller, privacy notice, retention/deletion process and Turnstile protections are configured and tested. Your administrator login does not require student intake to open.

7. Redeploy. At `/admin`, request a code, sign in, confirm `My Facilitation Desk` appears only for your UUID. After cloud-sync testing is approved, change the final sync flag to `true`, redeploy, then use **Check cloud copy → Upload local plans → Check cloud copy**. Do not use real student personal data in tests.
8. Security acceptance: without token → `401` on `/api/admin/session`; wrong user → `403`; admin but not facilitator → `403` on `/api/admin/facilitation-sync`; feature flag off → `503`; first empty cloud backup → version/revision 0; upload → revision 1; stale revision → `409`. All cloud restore/upload actions require explicit user confirmation. Verify a second device only after these checks.

## Queries for checking schema (read-only)

```sql
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('applications','admin_members','facilitation_workspaces');
select count(*) as student_applications from public.applications;
select count(*) as facilitation_backups from public.facilitation_workspaces;
```

## Limitations

- The SQL migrations and server code are PREPARED, not applied or integrated with your real project yet.
- Only the approved admin's cloud copy is supported; no shared facilitator library or student portal yet.
- Cloud backup is manual, not real-time auto-sync. Saving locally does not upload to Supabase.
- Cloud backups are programme-level notes only. Do not record names, individual comments, health/financial information, personal secrets or private student disclosures.
- SQL roles and production SMTP should be reviewed in your actual Supabase project before collecting real data.
- Run `npm run test:core`, `npm run test`, `npm run build` in GitHub CI, then use an approved staging deployment for live end-to-end tests.
