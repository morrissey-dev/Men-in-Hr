# Men in HR Connect — mandatory go-live checklist

Do not switch on student registrations because a web page looks finished. Record the responsible person and a date for each item; leave unresolved tasks unchecked.

- [ ] Official initiative ownership, branding, and authority to host student data approved
- [ ] Official privacy contact and data controller confirmed and published
- [ ] Application eligibility/age requirements and safeguarding reviewed
- [ ] Collection purpose, consent/other lawful basis, deletion rights and cross-border provider use approved
- [ ] Retention duration and **working** retention/deletion procedure tested
- [ ] GitHub automated checks green; production build and accessibility reviewed
- [ ] Public site tested on a real low-bandwidth mobile connection and keyboard
- [ ] Staging Supabase migrations applied in order; RLS/grants verified on all private tables
- [ ] Netlify environment secrets added securely with NO secret in public source or VITE_* variables
- [ ] Cloudflare Turnstile site and server secret verified on the chosen hostname
- [ ] Rate limits, monitoring and abuse response tested
- [ ] Unauthenticated and unapproved-user admin access denied
- [ ] Admin audit trail tested using synthetic applications
- [ ] Netlify `/api/*` functions tested — not just Vite local dev
- [ ] Database backups, recovery plan and owner reviewed
- [ ] Real users informed of official launch date and support contact
- [ ] Written sign-off to enable applications is recorded

**Launch switches (last step, not first):** `APPLICATIONS_OPEN=true` AND correct database cohort's `applications_open=true`, with privacy and retention gates genuinely satisfied. Never leave sample emails/keys in production settings.
