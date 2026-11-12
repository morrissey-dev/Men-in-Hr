# Men in HR Connect — Attendance Management Design

**Status:** Draft for Cohort 1 implementation  
**Implementation branch:** `feature/attendance-management-v0.8.0`  
**Attendance source:** CSV exported by the organiser's Google Meet attendance-tracker extension  
**Roster source:** Approved Google Forms response export  
**Out of scope:** Google account connection, Google Meet API access, meeting audio/video recording, participant self-service accounts, and Gmail monitoring.

## 1. Problem and intended outcome

Men in HR needs a dependable record of attendance for its virtual sessions. The organiser downloads a report from the attendance-tracker extension after a Google Meet session. Men in HR Connect should turn that report into a verified attendance register for the approved cohort.

The first release uses **manual CSV upload with server-side validation and human-reviewed matching**. The organiser uploads the approved cohort roster once, creates sessions, then uploads each session's attendance report. The application previews the rows, suggests exact name matches, flags exceptions, and saves attendance only after an authorised coordinator confirms the review.

The public website's application records are not assumed to be the Men in HR Cohort 1 register. The Google Forms roster is imported into a separate private attendance-participant table so that the attendance workflow does not silently mix two different registration processes.

## 2. Confirmed source-file behaviour

The 4 November 2026 attendance report sample had these columns:

- `SNo`
- `Participant Name`
- `Attendance Started at`
- `Joined at(beta)`
- `Attendance Stopped at`
- `Attended Duration`
- `Meeting code`

The sample did **not** contain participant email addresses. The `Attendance Stopped at` value was the same for every row, so it must not be treated as each participant's individual leave time. `Attended Duration` is the supported source for attended time. `Joined at(beta)` may be retained as a source value for review, but automatic late-arrival calculations must wait until its date/time format and timezone are verified.

Do not assume that repeated rows for the same display name are separate join intervals. They may represent a reconnect or different people with the same name, so duplicates must be flagged for human review rather than silently summed.

## 3. Users and permissions

- **Authorised owner/coordinator:** imports the cohort roster, creates sessions, uploads reports, reviews suggested matches, resolves exceptions, confirms imports, and exports reports.
- **Participant:** no account or dashboard is required for the first release.
- **Public visitor:** has no access to participant names, email addresses, meeting links, attendance records, or import details.

All attendance operations use the existing admin authentication flow. Browser-supplied role claims are never trusted. The server verifies the Supabase access token and active `admin_members` row for every request.

## 4. Workflow

1. Export the approved Cohort 1 register from Google Forms.
2. Upload the roster CSV in the private admin dashboard and map the full-name column. Map email only if the export contains it and it is needed for duplicate-roster detection; email is not used to match Meet rows.
3. Review the roster preview (new, duplicate, ambiguous, invalid) and explicitly confirm the import.
4. Create a session in the admin dashboard (cohort, session number, topic, scheduled start, planned duration, optional private Meet link).
5. Run the meeting using the existing organiser account and attendance-tracker extension.
6. Export the extension's attendance report and upload it to the relevant session.
7. Map or confirm the report columns. Participant name and attended duration are required; joined-at is optional. The stopped-at column is not used as an individual leave time.
8. The server normalises names and suggests a match only when there is one exact normalised-name candidate. It does not use fuzzy matching or email matching.
9. Review every suggested match. Duplicate names, repeated report rows, and names with no roster candidate remain in a review queue until resolved or left unmatched.
10. Confirm the reviewed import. Only then can the cohort/session summary identify participants with no attendance record.
11. Export a cohort or session report when needed.

An unmatched attendee is not automatically treated as absent. The application must not mark the cohort register absent before a report has been reviewed and confirmed.

## 5. Functional requirements

### FR-01 — Participant register
- Import participant names from a CSV export of the approved Google Forms response sheet.
- Provide column mapping for full name and optional email; do not import unrelated form answers.
- Normalise names by trimming, collapsing repeated whitespace, and case-folding.
- If email is present, normalise it and use it only to detect duplicate roster entries; never use it to match Meet attendance rows because the tracker export does not contain emails.
- Do not enforce unique names: two students may share a name.
- Show import counts (new, updated, duplicate, ambiguous, invalid) before final confirmation.
- Re-imports must not silently create duplicate participants. Rows that cannot be safely deduplicated must be presented for review.

### FR-02 — Session management
- Create, list, and view sessions associated with a cohort.
- Capture session number, topic/title, scheduled start, planned duration, optional Google Meet URL, and status.
- Keep the Meet URL available only in the authenticated admin area.
- Prevent duplicate session numbers within a cohort.
- Allow a session to be marked planned, completed, or cancelled.

### FR-03 — Attendance report import
- Support CSV only for the first release.
- Provide column mapping for participant name and attended duration; joined-at is optional.
- Validate file size, row count, header names, row values, and duration values on the server.
- Parse quoted fields and escaped quotes correctly. Never execute formulas, macros, scripts, or embedded content.
- Do not retain the original report file by default; retain only import metadata and the minimum normalised row data needed for review and audit.
- Ignore the sample's repeated `Attendance Stopped at` value for individual leave-time calculations.
- Detect repeated or duplicate names and require review before combining rows.
- Make imports idempotent or require explicit confirmation before replacing a session's existing confirmed import.

### FR-04 — Matching and review
- Match by exact normalised display name only.
- A single exact roster candidate may be suggested, but an authorised coordinator must confirm it.
- If multiple roster participants share the same normalised name, mark the row ambiguous and require manual selection.
- If there is no exact candidate, mark the row unmatched.
- Do not use fuzzy matching or silently merge people because their names look similar.
- Allow an authorised coordinator to resolve a match or leave it unresolved.
- Record who confirmed the import and who made each manual correction.

### FR-05 — Attendance calculation
- Store attended duration in seconds when the report provides a valid duration.
- Calculate an attendance percentage against the session's planned duration.
- Do not label participants present, partial, absent, or late until the programme owner approves the thresholds and the source timestamp format/timezone is verified.
- The previously discussed proposal (present at 75% or more; partial from 25% to below 75%; absent below 25%; late if first join is more than 10 minutes after scheduled start) remains **unapproved** and must not be silently activated.
- Do not infer duration from the sample's `Attendance Stopped at` column.
- Excused status, if later introduced, is an authorised manual decision and must record who approved it and why.
- If a duration cannot be parsed reliably, mark the row for review rather than estimating it.

### FR-06 — Reporting
- Show session totals for confirmed matches, unresolved rows, and participants with no attendance record after import confirmation.
- Show each participant's attendance history and recorded duration/percentage across confirmed sessions.
- Export a CSV report for a cohort or session.
- Exclude unnecessary personal information from exports.

## 6. Non-functional and privacy requirements

- **Security:** enable RLS on every attendance table. Revoke direct `anon` and `authenticated` access. All reads/writes go through authenticated Netlify admin functions using the server-only Supabase secret.
- **Authorisation:** verify the Supabase access token on every request and check the active `admin_members` row on the server.
- **Privacy:** do not connect to or read the association Gmail account. Do not record meeting audio, video, transcripts, or chat.
- **Data minimisation:** store only the participant name, optional roster email where justified, session, duration/source timestamp, import metadata, and audit information needed for the programme.
- **Auditability:** retain who imported and confirmed a report and who changed a match or attendance record.
- **Reliability:** invalid or partially understood reports must fail safely and must not overwrite existing attendance.
- **Accessibility:** upload, mapping, review states, and tables must work with keyboard navigation and mobile layouts.
- **Low bandwidth:** keep the workflow lightweight and process CSV files in memory; do not add a third-party file-processing service.

## 7. Proposed relational model

| Table | Purpose | Important relationships |
|---|---|---|
| `attendance_participants` | Approved external cohort roster imported from Google Forms | FK to `cohorts`; optional normalised email for safe roster deduplication; names are not unique |
| `attendance_sessions` | Planned and completed virtual sessions | FK to `cohorts`; unique cohort + session number |
| `attendance_imports` | Roster/report import metadata and review state | FK to cohort or session; imported/confirmed by an admin |
| `attendance_import_rows` | Normalised report rows and their match-review state | FK to import; optional FK to participant |
| `attendance_records` | Confirmed attendance for a participant in a session | FK to session, participant, and import; unique session + participant |
| `attendance_changes` | Manual match/correction audit history | FK to attendance record or import; actor is an admin |

The final constraints and SQL will be reviewed against the live schema before any migration is applied. No production database changes are part of this design document.

## 8. Initial API boundary

All routes are private and use the existing `/api/admin/*` server-side authentication pattern.

- `GET /api/admin/attendance/sessions` — list sessions and summary counts.
- `POST /api/admin/attendance/sessions` — create a session.
- `POST /api/admin/attendance/roster-preview` — validate a roster CSV and return a preview.
- `POST /api/admin/attendance/roster-import` — confirm and import the reviewed roster.
- `POST /api/admin/attendance/report-preview` — validate a report CSV and return suggested matches.
- `POST /api/admin/attendance/report-import` — confirm the reviewed report and save attendance.
- `PATCH /api/admin/attendance/records` — resolve a match or correct a record with a reason.
- `GET /api/admin/attendance/export` — export a permitted cohort/session report.

The server must validate every field, enforce a small upload/row limit appropriate for the cohort, and return generic errors that do not leak database credentials or raw participant data.

## 9. Release plan

### Increment 1 — Foundation (implemented on the feature branch)
- Add session management to the existing admin dashboard.
- Add a private sessions endpoint and a draft schema for sessions.
- Automated feature-branch CI passed. The SQL remains unapplied.

### Increment 2 — Roster and report imports
- Confirm the Google Forms roster export headers using a redacted sample.
- Build CSV parsing, column mapping, preview, and safe roster deduplication.
- Build report preview using the confirmed tracker headers and duration parser.
- Add exact-name suggestions, duplicate/ambiguous review, and explicit confirmation.

### Increment 3 — Verification and reporting
- Finalise and review the schema migration.
- Add audit history, attendance summaries, and CSV exports.
- Test security, invalid files, duplicate imports, missing names, repeated names, malformed durations, and re-import behaviour.

### Release gate
Nothing is merged to `main`, applied to the live Supabase database, or deployed to the production site until the full workflow passes tests and the user explicitly approves that release step.
