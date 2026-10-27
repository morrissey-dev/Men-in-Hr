# Milestone 3: Men in HR Connect administration — operator setup

This dashboard is **not live by default**. It has no demo credentials. Before using it with real student records, obtain written approval from the initiative's designated operator and configure secure hosting, privacy, retention, individual administrator access, and a test deployment. Follow applicable JKUAT rules and Kenya data protection obligations with a qualified institutional adviser where necessary.

## 1. What each role can do

| Permission | Coordinator | Owner |
|--|--|--|
| Sign in through pre-approved email OTP | Yes | Yes |
| Read private cohort applications | Yes | Yes |
| Change pending/approved/declined outcomes (audited) | Yes | Yes |
| Reactivate a withdrawn application | No | No |
| View list of cohorts | Yes | Yes |
| Create CLOSED draft cohort | No | Yes |
| Open/close configured cohort | No | Yes, guarded |
| Publish events, invite mentors, edit programme topics | Not yet available | Not yet available |

No account self-registration, student/mentor dashboard or public record export exists in this version.

## 2. Local smoke test without private services

Run `npm install`, then `npm run dev`. Visit `/admin` and verify **Administration not configured**. Run `npm run test:core` for 32 tests. The plain Vite dev command serves frontend files; it does **not** start Netlify's backend functions.

## 3. Database setup

1. Create a dedicated Supabase test project controlled by the approved operator.
2. Apply `supabase/migrations/202610270001_applications.sql` FIRST, then `202610280001_admin_dashboard.sql` using the Supabase SQL editor. Confirm RLS and revoked privileges.
3. In the Supabase Authentication dashboard, create one user manually with the approved institution email, verifying ownership/consent. DO NOT place passwords or personal info in version control.
4. Get that account's `auth.users.id` UUID from the auth dashboard. Grant the appropriate role in the SQL editor (replace only the UUID):

```sql
insert into public.admin_members (user_id, role, active)
values ('REPLACE-WITH-REAL-AUTH-USER-UUID', 'owner', true)
on conflict (user_id) do update set role=excluded.role, active=excluded.active;
```

5. To appoint another approved coordinator, provision a separate Supabase Auth user and insert their UUID with `role='coordinator'`, `active=true`. Revoke access quickly with `update public.admin_members set active=false where user_id='...'` and revoke Auth sessions as needed.
6. Verify that neither `anon` nor `authenticated` can directly read `admin_members`, `applications`, `application_decisions`, or invoke any `admin_*` RPC. The server secret remains restricted to server-side functions.

### Email verification template

In Supabase Authentication email templates, configure the **Magic Link** template to send a numerical OTP with `{{ .Token }}` rather than the default Magic Link confirmation URL. This site's admin sign-in verifies the code using `supabase.auth.verifyOtp({email, token, type:'email'})`. Check Auth email rate limits and production delivery capability. `signInWithOtp` uses `shouldCreateUser:false`, so unprovisioned emails do not create new accounts. Enable the institutional policy's MFA requirements before a real deployment if needed.

## 4. Environment variables

For the Netlify site backend:

```text
ADMIN_DASHBOARD_ENABLED=true
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REPLACE_IN_NETLIFY_ONLY
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_IN_NETLIFY_ONLY
SITE_ORIGIN=https://YOUR-APP-DOMAIN
```

For the Vite frontend, set these **public** variables in Netlify build environment (build-time values):

```text
VITE_ADMIN_LOGIN_ENABLED=true
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_IN_NETLIFY_ONLY
```

The two separate enable switches mean a frontend build alone cannot grant database access. `SUPABASE_SECRET_KEY` must **never** appear in `VITE_*`, frontend source, repository, or screenshots. Setup of secure student intake remains a separate process described in `README.md`; simply enabling admin access does not enable registrations.

To allow owner-controlled cohort opening later, complete and enable the **existing** application approvals: `APPLICATIONS_OPEN=true`, `PRIVACY_APPROVED=true`, `RETENTION_PROCESS_ACTIVE=true` (only when a real deletion process is operational), valid Turnstile configuration, approved privacy contact/controller and days, Supabase connection, exact `SITE_ORIGIN`. Only `APPLICATION_COHORT_SLUG` is eligible for opening; other cohorts are drafts, and they need their own future application implementation.

## 5. Test before rollout

- Deploy to an approved private/staging hostname with a test project and only synthetic student applications.
- Confirm `/api/admin/session` responds 401 without a bearer token; 403 for an authenticated account not in `admin_members`; 200 for an enabled member.
- Confirm owner and coordinator access differs. Invalid Origin must block all write requests even with a valid token.
- Apply a student status decision and inspect `application_decisions`. Verify the old status, new status, actor UUID and timestamp. Remove any synthetic PII afterward.
- Verify an account with role `coordinator` cannot create or open cohorts. Drafts must stay closed.
- Confirm registrations remain CLOSED until all security, privacy and retention gates have been formally approved.
- Confirm Netlify function rules, rate limiting, email OTP limits, access logs (no PII), and mobile keyboard navigation.
- Review browser session storage, XSS controls, Content Security Policy and administrator device safety with an authorised security reviewer. The SDK keeps the login session in browser storage; administrative devices should be trusted and access should be revoked immediately when roles change.

## 6. Source of truth and limitations

- Admin membership is **manually** provisioned; the public page does not create admins.
- The service is configured to verify an access token on EACH request, then query membership on the trusted server.
- SQL functions insert an audit record in the same transaction as status updates and cohort opening/closing.
- Supabase RLS is enabled, and public/authenticated direct privileges are removed from private tables and RPCs.
- No real deployment, credentials, database integration, end-to-end validation, or production build has yet been performed.
- Opening intake and setting retention policies require governance decisions outside of this codebase.
