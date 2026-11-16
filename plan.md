# Men in HR Connect: meeting library, AI notes, attendance, and certificates

## Objective and approved product direction

Extend the supplied Men in HR Connect React/Vite/TypeScript application. The first version follows the user-selected workflow: the coordinator records a session in Google Meet, obtains the completed Meet recording, and uploads it to the private Men in HR portal. The portal will support attendance, AI-assisted transcription and session notes, controlled sharing with participants, and participant-specific certificate downloads. This is not a Google Meet bot or a Meet add-on.

Keep the current public site, Supabase OTP administration, Netlify Functions, and Supabase PostgreSQL architecture. Do not replace the existing public pages or change hosting. The repository says Netlify has not been deployed and current service gates are off. Implementation and local tests must not contact or mutate the provisioned Supabase database, create real accounts, upload real media, enable registrations, push to `main`, or deploy.

## Implementation approach

### Session and attendance workflow

Extend the existing private Admin → Attendance workspace. Preserve the current session fields and its private Google Meet link. Implement the planned cohort roster import and attendance CSV preview/review/confirmation flow from `docs/attendance-management-design.md`: server-validate CSV files and row counts; match only exact normalized names; surface duplicate, ambiguous, and unmatched rows for human review; do not silently merge or mark absences before a coordinator confirms the import; keep import provenance and corrections auditable; export only necessary attendance fields. Avoid applying the draft attendance SQL to any database. Add reviewed SQL migrations on this branch only.

### Recording and AI notes

Add a coordinator-only recording library under a session. A coordinator uploads the completed Meet audio/video file to a **private** Supabase Storage bucket using an authorized signed upload so a large media body does not have to pass through a Netlify Function. Store only metadata, private object keys, processing state, consent/authorization attestation, and audit information in the database. Coordinators can preview or download media; the application does not emit public media URLs.

Provide an AI-processing adapter that is disabled by default and uses server-side provider settings only. It accepts supported audio input, returns a transcript, and generates a draft session summary and action items from that transcript. A coordinator must review and approve AI output before it is shared. Do not process or transmit real meeting media to any AI provider during development. Provider API keys and data-processing approvals are deployment configuration, never repository contents. Add clear failure states for missing provider configuration, unsupported media, and processing errors. Keep the interface modular so the provider can be selected/configured without exposing a key to the browser.

The current platform Speech API contract can accept audio files up to 100 MiB, while this user-provided application runs on Netlify and does not inherit Manus runtime credentials. Therefore do not assume that the platform API is callable from Netlify. The implementation must use an explicitly configured compatible server-side provider adapter or remain unavailable until that provider is configured. Video playback/storage and audio transcription are separate operations; large video may require an audio-only file for transcription. Set conservative, configurable upload limits and state them in the UI.

### Member access and certificates

Add a private member area using verified Supabase email OTP. The server checks each request against an active cohort membership; a signed-in account alone does not grant access. Do not expose application records, rosters, media object keys, or certificate records to the public site. Coordinators can assign a recording to an approved cohort or selected members and upload a certificate for a specific member. A member can list and download only recordings explicitly shared with their active membership and certificates assigned to their verified account. Use short-lived, server-authorized download URLs; never use a public bucket or permanent bearer link.

### Privacy, safety, and release controls

Require an explicit session-level coordinator attestation that recording notice/consent was obtained before a recording can be shared or AI-processed. Record the attestation and actor for audit; do not represent a UI checkbox as legal approval. Keep AI processing, member access, media uploads, certificate uploads, attendance changes, and application intake off unless each documented server-side gate is enabled. Unconfirmed retention policy must remain a launch blocker; do not invent automatic deletion timing. Provide coordinator-only revoke/unshare and delete workflow hooks, and do not claim physical object deletion until the configured storage API actually performs it.

All new tables must use Row Level Security, with direct `anon` and `authenticated` table access revoked; data access goes through Netlify Functions that verify Supabase Auth and server-side coordinator or membership authorization. New functions must validate exact Origin for mutations, request type/size, fields, and ownership, return generic errors, and avoid logging transcript, media, certificate, roster, or auth-token contents. Add a private object-key scheme that is random and non-guessable. Test with synthetic fixtures only.

## Project structure

- `src/components/AttendanceManagement.tsx`: session setup and attendance import/review; `src/components/SessionResources.tsx`: coordinator recording/certificate library, AI review, sharing and member invitations.
- `src/pages/MemberPortal.tsx` and `src/lib/admin-auth.ts`: verified-email member entry point, member-specific resource/certificate listing, and paged “Load more” interaction.
- `netlify/functions/`: separate authenticated functions for attendance imports, media upload authorization/metadata, processing, coordinator sharing, member resources, and certificate upload/download authorization.
- `netlify/lib/`: reusable server authorization, bounded file metadata validation, attendance CSV parsing/matching, storage signing, transcription provider adapter, and summary validation.
- `supabase/migrations/`: additive schema for cohort memberships, attendance imports/records/audit, media metadata/shares/consent attestations, generated transcript/summary metadata, assigned certificates, and a service-role-only `member_list_session_resources` RPC that returns active-member resources and assigned certificates in stable newest-first pages. SQL remains unapplied in this task.
- `tests/`: offline tests with mocked Supabase authorization/storage/AI endpoints and synthetic media or participant rows; CSV parse/preview/import/export and feature-gate coverage. No real participant/media data or provider calls.
- `docs/`: operator setup, AI/provider configuration, consent/retention gates, storage limits, access model, and release procedure.

## Design

Reuse the existing editorial Men in HR identity for public pages. Keep the admin and member workspaces functional and low-bandwidth, using clear status blocks, semantic controls, readable tables/cards, and accessible upload/review states. Make sensitive access paths visually distinct from public pages. Do not add decorative or autoplay media.

- **Design Movement:** Editorial digital publishing, adapted to a restrained student-service workspace.
- **Core Principles:** clarity over density; explicit permission status; private by default; low-bandwidth interaction.
- **Color Philosophy:** retain the deep forest green and warm off-white for continuity; reserve a muted amber for review/consent warnings and restrained green for completed states.
- **Layout Paradigm:** single-column task flows for uploads and consent; side-by-side session metadata only where space allows; mobile-first cards instead of wide admin tables.
- **Signature Elements:** small session-number markers; clear draft/review/approved status chips; a subtle connection-line motif used only in public-facing site areas.
- **Interaction Philosophy:** every data-sharing action states who can access the item and requires an explicit coordinator action; uploads show progress/cancellation, while AI jobs report queued/processing/completed/failed state and can be retried after failure. Full-cohort sharing pages all active participants, reports the actual recipient count, and rejects a cohort over 5,000 rather than sharing partially. Member resource and certificate lists page 200 at a time and visibly signal their 5,000-item safety ceiling rather than silently truncating.
- **Animation:** minimal, short status transitions only; honor reduced-motion preferences; no autoplay, waveform flourish, or recording animation that obscures capture state.
- **Typography System:** preserve the repository's existing serif display headlines and clean sans-serif body/UI hierarchy; use the existing theme and type tokens rather than introducing remote fonts.
- **Brand Essence:** a practical, trusted mentorship workspace for the Men in HR community; welcoming, careful, student-centred.
- **Brand Voice:** direct and calm. Examples: “This recording is private until you share it.” “AI notes are a draft—review them before members can see them.”
- **Wordmark & Logo:** retain the current approved Men in HR Connect wordmark/mark; do not invent institutional endorsement.
- **Signature Brand Color:** the existing deep forest green.

## Constraints and open launch dependencies

The source repository is public, so no credentials, actual recordings, roster files, transcripts, certificates, or real student data may be committed. The user selected the upload-based workflow; automatic Google Meet capture and a Read AI-like in-meeting add-on are out of scope for this first version. The AI provider and its service credentials are not configured in this Netlify repository. The organization has not yet confirmed recording consent wording or media retention/deletion policy. GitHub was reconnected and repository read/push permission was verified; this task may update only `feature/meet-recordings-member-portal`, never `main`.

Do not merge to `main`, apply SQL, set production secrets, create real member accounts, enable processing/access gates, or deploy until the owner approves the relevant privacy, provider, retention, and release steps.


## Sources informing the capture boundary

- Read AI describes a Google Meet native integration that captures with explicit in-meeting consent and produces reports with summaries, transcripts, action items, and related insights: https://support.read.ai/hc/en-us/articles/42785087487251-Using-Read-s-Google-Meet-Native-Recording and https://support.read.ai/hc/en-us/articles/50883689095059-How-to-install-Read-s-add-on-for-Google-Meet
- Google Meet's own recording requires host permission, notifies participants when capture starts or stops, and saves the recording to the meeting organizer's Drive: https://support.google.com/meet/answer/9308681?hl=en
- Browser `getDisplayMedia()` requires a secure context and a fresh user permission prompt; availability and audio capture vary by browser: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia


## Verified large-upload and job behavior

Supabase recommends TUS resumable uploads for files over 6 MiB. Its signed-upload token is passed in `x-signature`; the TUS chunk size is 6 MiB, and individual signed upload URLs cannot be revoked before expiry. Large media uploads should use the project's direct storage host, with coordinator authorization handled before token creation. Source: https://supabase.com/docs/guides/storage/uploads/resumable-uploads

Netlify Background Functions can run for up to 15 minutes, return HTTP 202 before work finishes, and retry a failed invocation. AI-processing work therefore needs an idempotent job state and a separate client-visible status read. Source: https://docs.netlify.com/build/functions/background-functions/

Coordinator member-roster pages contain up to 200 people at a time. Whole-cohort shares use server-side pagination, return the exact recipient count, and fail with no partial grants if a cohort exceeds 5,000 active members.

Member libraries use the database RPC `member_list_session_resources` to merge active share grants and member-assigned certificates into stable timestamp/id ordering. Member API pages contain 200 resources, request one extra row to detect a further page, and surface a 5,000-item ceiling explicitly; the member identity and active assignment are checked in both the API authorization path and the service-role-only RPC.
