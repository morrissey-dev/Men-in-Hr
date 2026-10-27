# Development log

## Milestone 1 — Public interface (27 October 2026)

**Completed:** React + TypeScript + Vite project; modular pages and shared layout; mobile header; eight working Cohort 1 topics; empty-state events, contacts and application state; privacy approach; low-bandwidth design with no external fonts, trackers or large images.

**Not yet implemented:** Registration submission API, PostgreSQL database, authentication, mentors, admin dashboard, confirmed event publishing.

**Product decisions:**
- Explicitly show application as not open until secure processing and approval exist.
- Keep unknown contact details unpublished rather than inventing official information.
- Only confirmed public events appear in the events list.
- Separate student and mentor pathways while preserving inclusive eligibility language until formally decided.
- Store topics centrally so the content can be updated without changing visual components.

**Next:** Stakeholder review, UI testing and secure registration requirements.

## Milestone 2 — Student application foundation (27 October 2026)

**Implemented:** A dedicated `/apply` page, shared client/server validation, programme interest selectors, privacy/eligibility affirmations, contact and retention notice when open; serverless status and submission API; secure database migration with RLS and explicit privilege revocation; captcha verification; request rate limiting; same-origin restriction; payload bounds; duplicate-safe response; offline tests.

**Fail-closed dependencies:** APPLICATIONS_OPEN, PRIVACY_APPROVED, RETENTION_PROCESS_ACTIVE, approved privacy controller/contact, retention days, Turnstile site/secret, Supabase URL/server secret, exact origin AND `cohorts.applications_open = true`. All must be available for applications to open.

**Development reality:** No Supabase project, secrets, approved contact, retention process or production deployment are connected. Therefore real registration remains closed. The dedicated consent and data retention provisions require review by the responsible institution and an operational deletion process.

**Tests:** 15 Node built-in automated checks passed. `npm install` was attempted but the package registry returned DNS failure (EAI_AGAIN), so the complete Vite typecheck/build and Vitest suite still require verification on a machine with npm access.

**Later milestones:** Authorised admin dashboard, applicant outcomes, mentor/participant accounts, session attendance and communications. Do not use the service key in the frontend.
