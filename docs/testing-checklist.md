# Quality & acceptance checklist

## Source review
- [x] All eight agreed topics stored in one data module and rendered in order.
- [x] No fake mentors, testimonials, confirmed events or made-up official contacts.
- [x] Applications clearly marked closed; prototype does not collect personal information.
- [x] Explicit EAT timezone handling for any future event data.
- [x] No environment secrets in the frontend or repository.
- [x] Keyboard-accessible navigation controls and focus styles included.
- [x] Prefers-reduced-motion styling included.

## To verify on a machine with Node dependencies installed
- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `npm run dev` and test in Chrome/Firefox.
- [ ] Mobile widths 360, 390, 768, 1024 and 1440 px; no clipping.
- [ ] Keyboard-only navigation, Escape closes mobile menu, skip link works.
- [ ] Screen reader labels and heading order.
- [ ] Lighthouse accessibility/performance review on a production build.
- [ ] Approve institutional name/logo use and public copy.
- [ ] Approve privacy/contact details and confirmed events before public launch.

## Milestone 2 conditions
- [ ] Agree minimum application fields, responsible data controller and retention policy.
- [ ] Implement server-side validation and anti-abuse controls.
- [ ] Confirm anonymous users cannot read or list applications.
- [ ] Test closed cohorts, duplicate submissions and safe error handling.

## Milestone 2 — Application service
- [x] Full validation of required fields, allowed interests, age confirmation, consent and size caps.
- [x] Closed-by-default behavior; privacy/retention approvals required before opening.
- [x] Cohort-specific open/closed lookup before accepting POST.
- [x] Invalid origin, invalid fields and invalid Turnstile rejected in offline tests.
- [x] Valid submission reaches only server-side Supabase REST, without token leakage.
- [x] Duplicate submission returns non-enumerating generic result.
- [x] Source files present; original seven pages preserved.
- [ ] Run `npm install && npm run build && npm run test` after npm registry connectivity is restored.
- [ ] Test real Netlify function routes against a non-production Supabase project.
- [ ] Verify Netlify rate-limiting configuration works in deployed environment.
- [ ] Confirm direct anonymous and authenticated DB access is denied, in a live database.
- [ ] Verify deletion operating procedure, data processing and transfer safeguards before live launch.
- [ ] Record approved responsible organisation, retention/contact information and privacy notice.
- [ ] Test end-to-end submission, duplicates, disabled cohort and CAPTCHA expiry.
- [ ] Review the form at mobile screen widths and using screen readers.

## Milestone 3 — Secure administration
- [x] `/admin` route added without navigation link from public header.
- [x] Both client and backend administration are opt-in and disabled by default.
- [x] JWT validated with Supabase Auth before any private query.
- [x] Database membership determines coordinator versus owner role.
- [x] Coordinator cannot create or open cohorts.
- [x] Application status decisions use atomic SQL update-and-audit function.
- [x] Both private table access and RPC access revoked from public/anon/authenticated roles.
- [x] Admin lists use fixed column selection, page size and validated filters.
- [x] New draft cohorts created with applications closed.
- [x] Opening configured cohort is blocked without registration approval gates.
- [x] Existing offline validation and security tests still pass (32 total).
- [ ] `npm install`, `npm run build`, `npm run test` in a network-enabled Node environment.
- [ ] Run both SQL migrations in order in an isolated test Supabase project.
- [ ] Configure Auth email template to send verification CODE (`{{ .Token }}`) instead of default magic link.
- [ ] Create one approved user in Supabase Auth dashboard and activate their UUID in `admin_members`.
- [ ] Validate coordinator sees private records and owner can change cohorts; unapproved Auth user sees 403.
- [ ] Confirm OTP email rate limits, MFA requirement (if institutional policy), domain and redirect rules.
- [ ] Validate RLS/revoked privileges with direct anon/authenticated Supabase queries and RPC attempts.
- [ ] Confirm SQL application decision + audit always roll back together on failure.
- [ ] Review CSRF/cross-origin protection, Content Security Policy and browser-session risk in deployed environment.
- [ ] Test mobile admin filters, OTP flow, keyboard-only controls, screen readers and empty/error states.
- [ ] Validate approved retention/deletion routine covers applications, any lawful records and audit events.
- [ ] Confirm registered students do not receive access to `/api/admin` merely because they have a Supabase account.
