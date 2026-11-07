# Men in HR Connect — Attendance Management Design

**Status:** Draft for Cohort 1 prototype  
**Implementation branch:** `feature/attendance-management-v0.8.0`  
**Initial source:** Attendance report exported by the organiser's Google Meet attendance-tracker extension  
**Out of scope for this prototype:** Google account connection, Google Meet API access, meeting audio/video recording, participant self-service accounts, and automatic email monitoring.

## 1. Problem and intended outcome

Men in HR needs a dependable record of attendance for its virtual sessions. The organiser currently has an attendance-tracker extension that can produce a report after a Google Meet session. Men in HR Connect should turn that report into a verified cohort attendance register without requiring the facilitator to mark every participant manually.

The first release will use a **manual report upload with automatic processing**. The organiser downloads the extension's report and uploads it to the private admin dashboard. The application parses the report, matches attendees to the approved cohort register, calculates attendance, and presents exceptions for human review.

## 2. Users and permissions

- **Authorised owner/coordinator:** creates sessions, imports the participant register, uploads attendance reports, reviews unmatched rows, corrects records, and exports reports.
- **Participant:** no account or dashboard is required for the first release.
- **Public visitor:** has no access to participant names, email addresses, meeting links, attendance records, or uploaded reports.

All attendance operations must use the existing admin authentication flow. Browser-supplied role claims are never trusted.

## 3. Workflow

1. Import the approved Cohort 1 participant register from a Google Forms response export.
2. Create a session in the admin dashboard (topic, date/time, planned duration, optional private Meet link).
3. Run the meeting using the existing organiser account and attendance-tracker extension.
4. Export the extension's attendance report.
5. Upload the report to the session in Men in HR Connect.
6. Map report columns to the expected fields if the file headers are not recognised.
7. Match attendees to the cohort register using a normalised email address.
8. Aggregate multiple join intervals for the same email when the report format supports it.
9. Create attendance records for matched participants and flag unmatched attendees for review.
10. Review exceptions, confirm the session register, and export individual or cohort summaries.

The application must not mark the cohort register absent before a report has been imported and reviewed. An unmatched attendee is not automatically treated as an absent participant.

## 4. Functional requirements

### FR-01 — Participant register
- Import participant names and email addresses from a CSV export of the approved Google Forms response sheet.
- Allow mapping of the name and email columns.
- Normalise email addresses by trimming whitespace and converting to lowercase.
- Prevent duplicate participants within the same cohort by normalised email.
- Show import counts (new, updated, duplicate, invalid) before final confirmation.
- Do not import unrelated form answers unless they are explicitly required.

### FR-02 — Session management
- Create, list, and view sessions associated with a cohort.
- Capture session number, topic/title, scheduled start, planned duration, optional Google Meet URL, and status.
- Keep the Meet URL available only in the authenticated admin area.
- Prevent duplicate session numbers within a cohort.
- Allow a session to be marked planned, completed, or cancelled.

### FR-03 — Attendance report import
- Initial supported file format: CSV, subject to confirmation against a real sample export.
- Provide a column-mapping step for attendee name, email, join time, leave time, and/or duration.
- Validate file size, row count, header names, dates, and duration values.
- Do not execute formulas, macros, scripts, or embedded content.
- Do not retain the original report file by default; retain import metadata and the minimum normalised attendance data needed for the register.
- Detect repeated rows and multiple join intervals without double-counting.
- Make imports idempotent or require explicit confirmation before replacing a session's existing imported records.

### FR-04 — Matching and review
- Match attendees by normalised email, not display name alone.
- Flag missing or unknown email addresses as unmatched.
- Do not silently merge two different people because their names are similar.
- Show a review queue for unmatched or ambiguous rows.
- Allow an authorised coordinator to resolve a match or leave it unresolved.
- Preserve the source import and record who made any manual correction.

### FR-05 — Attendance calculation
- Store raw attendance duration in seconds where available.
- Calculate attendance percentage against the session's planned duration.
- Keep the present/partial/absent threshold and late-arrival threshold configurable.
- Initial proposal for discussion only: present at 75% or more; partial from 25% to below 75%; absent below 25%; late if first join is more than 10 minutes after the scheduled start.
- Late is an additional flag, not a replacement for the attendance classification.
- Excused status is an authorised manual decision and must record who approved it and why.
- Do not infer attendance duration if the report does not contain enough data; mark it for review.

### FR-06 — Reporting
- Show session totals: matched present, partial, absent, excused, and unmatched.
- Show each participant's attendance history and percentage across completed sessions.
- Export a CSV report for the cohort and an individual participant.
- Exclude unnecessary personal information from exports.

## 5. Non-functional and privacy requirements

- **Security:** RLS enabled on all attendance tables. Revoke direct `anon` and `authenticated` table access unless a specific policy is justified. All reads/writes go through authenticated Netlify admin functions using the server-side Supabase secret.
- **Authorisation:** verify the Supabase access token on every request and check the active `admin_members` row on the server.
- **Privacy:** do not connect to or read the association Gmail account during this prototype. Do not record meeting audio, video, transcripts, or chat.
- **Data minimisation:** store only participant name/email, session, attendance duration/timestamps where available, import metadata, and audit information needed for the programme.
- **Auditability:** retain who imported a report, who confirmed it, and who changed a status or match.
- **Reliability:** invalid or partially understood reports must fail safely and must not overwrite existing attendance.
- **Accessibility:** forms, column mapping, review states, and tables must work with keyboard navigation and mobile layouts.
- **Low bandwidth:** keep the upload workflow lightweight and avoid a separate client-side service or heavy third-party integration.

## 6. Proposed relational model

| Table | Purpose | Important relationships |
|---|---|---|
| `attendance_participants` | Approved external cohort roster imported from Google Forms | FK to `cohorts`; unique cohort + normalised email |
| `attendance_sessions` | Planned and completed virtual sessions | FK to `cohorts`; unique cohort + session number |
| `attendance_imports` | Import metadata and processing result | FK to `attendance_sessions`; imported by an admin |
| `attendance_records` | One session result per matched participant, plus unmatched attendee rows | FK to session, optional participant and import |
| `attendance_changes` | Manual corrections and review decisions | FK to attendance record; actor is an admin |

The exact schema and constraints will be finalised after reviewing the existing migration history and a sample of the tracker extension's report. No production database changes are part of this design document.

## 7. Initial API boundary

All routes are private and use the existing `/api/admin/*` server-side authentication pattern.

- `GET /api/admin/attendance/sessions` — list sessions and summary counts.
- `POST /api/admin/attendance/sessions` — create a session.
- `POST /api/admin/attendance/roster-import` — validate and import the cohort roster.
- `POST /api/admin/attendance/report-import` — validate, match, and import an attendance report.
- `PATCH /api/admin/attendance/records` — resolve a match or correct a status with a reason.
- `GET /api/admin/attendance/export` — export a permitted cohort/session report.

The server must validate every field, enforce a small upload/row limit appropriate for the cohort, and return generic errors that do not leak database credentials or raw participant data.

## 8. Release plan

### Increment 1 — Foundation
- Confirm the tracker report format and Google Forms roster export format.
- Finalise requirements, status rules, and the relational model.
- Add the attendance schema as a tracked migration only after reviewing the final SQL.
- Add session management to the existing admin dashboard.

### Increment 2 — Roster and report imports
- Add CSV column mapping and preview.
- Add participant roster import.
- Add report import, email matching, duplicate handling, and unmatched review.

### Increment 3 — Verification and reporting
- Add manual corrections with audit history.
- Add attendance calculations and configurable thresholds.
- Add cohort/individual CSV exports.
- Test security, invalid files, duplicate imports, missing emails, multiple joins, and partial reports.

### Release gate
Nothing is merged to `main`, applied to the live Supabase database, or deployed to the production site until the prototype passes tests and the user explicitly approves that release step.
