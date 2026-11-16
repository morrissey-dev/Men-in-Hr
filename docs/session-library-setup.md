# Session library, attendance and member portal: operator guide

## Release state

This is v0.8 work on `feature/meet-recordings-member-portal`, not a production release. The original three migrations documented in the repository remain the only applied database migrations. The new `202611140001_private_session_library.sql` and `202611140002_attendance_import_transactions.sql` are review-only: they have not been run against staging or production. Netlify has not been deployed. No provider key, real roster, recording, transcript, certificate, or member account has been added.

Keep the sample and production switches off. Do not run `supabase db push`, set production secrets, provision members, or deploy as part of reviewing this branch. The public repository must contain no credentials or real participant files.

## What the workflow does

- A coordinator creates programme sessions and can import a cohort roster from a CSV file (maximum 500 KB and 1,000 rows). The file is held in memory for preview/confirmation; the original CSV is not stored. Email is optional in the roster. Duplicate or invalid rows must be corrected in the source CSV and previewed again.
- A coordinator uploads a tracker attendance CSV for a session. The UI previews server-parsed rows and exact normalized-name suggestions. The coordinator explicitly chooses a roster person or “Leave unmatched” for every valid row, then confirms the import. Duplicate names are visibly flagged; the same person cannot be counted twice. No row is automatically interpreted as an absence, and no absent records are created.
- A coordinator records a meeting using the existing Google Meet workflow, downloads the completed media file, then uploads that file to a **private** Supabase Storage bucket. The website does not join, capture, or record a live meeting. Resumable TUS uploads go directly to Supabase Storage; the API checks uploaded size and MIME metadata before marking a file ready. Recordings are limited to 500 MB; certificates are individual PDF files up to 10 MB.
- A recording can be processed only after its coordinator attests that the required participant notice and consent process occurred. The checkbox is an auditable operational attestation, not a legal/privacy approval or proof that every participant consented.
- A separately configured server-side AI provider can transcribe uploaded audio/video and return a draft transcript, summary, and action items. These remain private until a coordinator reviews and approves each item. The default AI limit is 100 MB; a provider may impose a lower limit or not accept a video container. The code does not extract/compress audio or split meetings into multiple chunks.
- Coordinators can share a ready recording or approved notes with a selected cohort or individual active members, then revoke access. Participants must have an invited, verified email account linked to an active cohort roster entry. Members can see only explicitly shared resources and certificates assigned to their account. Private downloads use a five-minute signed URL; an already issued URL may work until it expires after revocation.

## Explicit launch blockers

Before real data or live access is enabled, the responsible JKUAT HRSA authority must approve, in writing and for the actual service setup:

1. The data controller/contact, participant privacy notice, lawful/appropriate basis, audience and data fields.
2. Recording notice and consent wording, how a participant can decline or participate without being recorded, who may access the original media, and how the coordinator confirms consent before upload.
3. Retention, backup and deletion periods/processes for roster, attendance, recordings, transcripts, AI drafts, shares, certificates, auth accounts and backups. The app does not invent a retention duration or implement an automatic retention purge.
4. The specific AI provider, its service terms and data-processing/international-transfer conditions, key ownership/billing, and whether full media files may be sent there. Configuring an endpoint is not itself an approval.
5. Production Supabase Auth email delivery/redirect setup, an email OTP template that exposes the one-time code, private Storage bucket and access policy, a Storage CORS allowlist for the approved site origin, Netlify environment, DNS/site origin, server-side secrets, coordinator provisioning and security review.
6. Review and application of both new SQL migrations in an approved staging process, proof that direct `anon` and `authenticated` access is denied, and end-to-end testing with synthetic data before any production deployment.

The initial site copy says the new features are being prepared and disabled. Keep that disclosure accurate until all production checks are complete.

## Feature switches and dependencies

All feature switches in `.env.example` are `false`. Keep them that way until the review process is complete. The application also requires the existing `ADMIN_DASHBOARD_ENABLED=true` and server-side Supabase configuration before any coordinator endpoint can work.

| Feature | Required additional server-side settings |
| --- | --- |
| Roster/attendance CSV | `SESSION_PORTAL_ENABLED=true`, `SESSION_PRIVACY_APPROVED=true`, `ATTENDANCE_IMPORTS_ENABLED=true`, and `ATTENDANCE_RETENTION_APPROVED=true` |
| Recording upload | `SESSION_PORTAL_ENABLED=true`, `SESSION_PRIVACY_APPROVED=true`, `MEDIA_UPLOADS_ENABLED=true`, `MEDIA_RETENTION_APPROVED=true`, and `RECORDING_CONSENT_APPROVED=true` |
| Certificate upload | Session privacy/media retention approval, plus `CERTIFICATES_ENABLED=true` |
| Member sign-in and downloads | Session privacy/media retention approval, `MEMBER_PORTAL_ENABLED=true`, `VITE_MEMBER_LOGIN_ENABLED=true`, and reviewed Auth email/redirect settings |
| Member invitations | Member feature settings above, plus `MEMBER_INVITES_ENABLED=true` |
| AI processing | Media, session privacy and recording-consent approval, plus `AI_PROCESSING_ENABLED=true`, `AI_DATA_PROCESSING_APPROVED=true`, and all provider settings below |

Feature switches are independent safety gates, not substitutes for approval, migration or end-to-end testing. Do not turn them on in a local `.env`, Netlify, or Supabase environment merely to make a preview appear functional. `VITE_MEMBER_LOGIN_ENABLED` is browser-visible and must never contain a key.

## AI provider contract

The implementation does not pick or activate a provider. It is a configurable, server-only, OpenAI-compatible adapter. Both URLs must be HTTPS and have no embedded credentials. The transcription endpoint must accept multipart form data with `model` and `file`, then return JSON containing a non-empty string property `text`. The chat-completions endpoint must accept a JSON request with `model` and `messages`, then return JSON with `choices[0].message.content` containing valid JSON shaped as `{ "summary": "...", "actionItems": [{ "task": "...", "owner": "...", "deadline": "..." }] }`. The same server-only bearer key is sent to each endpoint.

Set `AI_API_KEY`, `AI_TRANSCRIPTION_ENDPOINT`, `AI_TRANSCRIPTION_MODEL`, `AI_CHAT_COMPLETIONS_ENDPOINT`, and `AI_CHAT_MODEL` only in the approved server environment, never in `VITE_` variables, source control, logs, the browser, or screenshots. `AI_MAX_MEDIA_BYTES` defaults to 104857600 bytes; this implementation caps it at 100 MiB, and the chosen provider may require a smaller limit or an audio-only file. The original file is downloaded temporarily into the Netlify processing function and sent to the provider; that transfer must be explicitly approved. Background jobs use Netlify Background Functions and may fail or time out; operators must inspect status and avoid claiming completion when a job fails. No provider is configured in this branch.

## Technical safeguards and limitations

- New tables are protected by RLS and direct `anon`/`authenticated` grants are revoked; functions use the existing server-only Supabase service key after verifying an admin/member session and role/participant assignment.
- `SITE_ORIGIN` exact-origin validation protects mutations. Participant/media content and provider credentials must not be added to logs. Uploads use random private paths, a private bucket and short-lived signed download links; there are no public URLs.
- Supabase documents TUS resumable uploads for large objects, six-MiB chunks, and passing the signed-upload token in `x-signature`: [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). Netlify documents its background function lifecycle and retries: [Netlify Background Functions](https://docs.netlify.com/build/functions/background-functions/). AI-job polling marks queued/processing jobs that exceed conservative timeout thresholds as failed so they can be retried.
- The server prevents deleting a source recording while linked note drafts/approved notes or an active AI job remain. Delete dependent notes first. A coordinator deletion removes the underlying private object before its database row; if metadata cleanup fails, the record is marked for administrator review. No retention lifecycle rule or automatic cleanup job is provided.
- Member accounts are invitation-only. Existing or duplicate emails may need manual administrator review; roster emails must uniquely identify one active participant before an invitation can be assigned.
- Member resource listings page recordings, reviewed notes, and assigned certificates in stable newest-first batches of 200 through a server-only database function that rechecks the active member assignment. The API reports when it reaches its explicit 5,000-resource safety ceiling rather than silently suggesting the list is complete.
- The member route is excluded from `robots.txt` and sets `noindex,nofollow`; crawler settings are not a security boundary. Authorization is enforced by the API on every resource request.

## Safe review commands

With Node.js 22 and dependencies installed, run:

```bash
npm run verify:release
npm run test:core
npm test
npm run build
```

These checks are offline and use synthetic test data. They do not test a real Netlify deployment, apply a Supabase migration, verify production Storage CORS/Auth, or send media to an AI provider. Do not use real participant information for local acceptance testing.
