# TODO

## 1. Session roster and attendance CSV workflow — Complete on feature branch
- Organiser uploads an approved cohort roster once; keep it separate from application records.
- Organiser creates sessions and uploads the attendance-tracker CSV report for a session.
- Validate uploaded CSVs on the server, preview rows before writes, suggest exact normalized-name matches, and visibly flag duplicates, ambiguous matches, and unmatched rows.
- Save or mark attendance only after an authorized coordinator confirms the reviewed import; do not infer or silently mark absences.
- Keep import provenance and coordinator corrections auditable, and export only necessary attendance fields.
- Coordinator confirms the exact members and any unmatched rows; no row is automatically treated as absent.
- Use synthetic fixtures only in development and tests; do not apply the draft attendance SQL to a database in this task.

## 2. Coordinator-only session media library — Complete on feature branch
- Add an authorized session recording library to the private administration area.
- Coordinator records the session using Google Meet, downloads the completed recording, and uploads it into private application storage.
- Enforce server-side authorization, bounded upload limits, private object keys, and recording metadata; large media bytes should not be routed through Netlify Functions.
- Coordinators can download recordings; do not issue public media URLs or expose private storage keys.
- Before sharing or AI processing, require an explicit coordinator attestation that recording notice/consent was obtained, and retain actor/time for audit.
- The site does not join Meet or record the live meeting.

## 3. AI transcription and draft notes — Complete on feature branch; provider remains disabled
- Offer a server-side OpenAI-compatible provider adapter for supported audio transcription and AI-generated draft session summaries/action items.
- Keep processing disabled until an explicit provider and required privacy/data-processing approvals are configured; do not send any real media to an AI provider during development.
- Keep provider credentials server-only and out of repository/source/client bundles.
- Require coordinator review and explicit approval before transcript, summary, or action items are shared with members.
- Handle missing provider configuration, unsupported format/size, transient failure, and permanent processing errors without claiming success or retrying invalid media indefinitely.
- Log no transcript, recording, certificate, roster, participant data, or authentication tokens.
- Offline tests use synthetic media and mocked Supabase Auth, private Storage, transcription, and chat endpoints.

## 4. Invite-only participant access — Complete on feature branch; member access remains disabled by default
- Provide a private member entry point using verified email authentication.
- The server must check the signed-in member against active cohort membership before authorizing any member resource; a successful sign-in alone grants no programme access.
- Do not expose cohort roster/application records, media keys, member assignments, or certificate records publicly.
- Each member sees and downloads only resources explicitly shared with their active membership and certificates assigned to their verified account.
- Use short-lived, server-authorized download URLs for private resources; no public bucket or permanent bearer URLs.
- Member resource listings page newest-first in batches of 200 across shared media, reviewed notes, and assigned certificates; show an explicit safety-limit notice at 5,000 items instead of silently hiding remaining entries.

## 5. Coordinator sharing and certificate workflow — Complete on feature branch; live access remains gated
- Allow a coordinator to share approved media or reviewed AI notes with an approved cohort or explicitly selected members.
- Allow coordinators to revoke/unshare access.
- Whole-cohort sharing paginates active members, reports the actual recipient count, and refuses cohorts over 5,000 without partial grants; individual selections are limited to 200 per request.
- Member-library paging checks the active assignment in both server authentication and its service-role-only database RPC; regression tests prove a 450-item library can be traversed without omissions.
- Allow a coordinator to upload and assign a certificate to a specific member; the verified member can download only certificates assigned to their account.
- Keep media and certificate bytes out of Git; retain only private storage object keys and necessary access/ownership metadata in the database.
- Do not claim physical object deletion unless the configured storage API actually performs it.

## 6. Database, storage, and API safeguards — Complete on feature branch; migrations unapplied
- Add reviewed, additive SQL migrations on this branch for membership, attendance imports/records/audit, media metadata/shares/consent attestations, reviewed AI output, and assigned certificates. Do not apply them to any database in this task.
- Enable RLS on new tables and revoke direct `anon` and `authenticated` access; route data access through Netlify Functions that verify Supabase Auth and server-side coordinator/member authorization.
- Mutations validate exact Origin, content type, upload size, fields, and resource ownership; use generic errors and non-guessable object keys.
- Fail closed when configuration is absent; keep existing application intake, administrator, facilitator-cloud, and all new media/member/AI features disabled by default.
- Add offline tests using mocked auth/storage/AI providers and synthetic participant records only.
- Do not add real recordings, roster files, transcripts, certificates, student data, credentials, or populated environment files to the public repository.

## 7. Operator documentation and release boundary — Documentation complete; production launch still blocked
- Document provider configuration, upload limits, consent/retention gates, membership/access model, and how to run the reviewed release process.
- Do not invent a retention duration or enable automatic deletion until an authorized retention policy exists.
- Develop and test locally on `feature/meet-recordings-member-portal`; do not modify or push `main`, apply migrations, enable production secrets/feature flags, create real member accounts, or deploy.
- Live use remains blocked until the authorized operator approves the data controller/privacy notice, recording consent and non-recorded participation options, retention/deletion policy, provider/data-processing terms and credentials, production storage/auth setup, and release checklist.
- The two new migrations remain unapplied. Tests/builds use synthetic data and mocks only; no live account, storage bucket, or AI-provider workflow has been configured or deployed.
