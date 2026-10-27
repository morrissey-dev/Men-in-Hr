# v0.6.0 — Personal Session Management Workspace

## Scope and design choice

Extends **My Facilitation Desk** under `/admin`. The desk is visible only after the **server** verifies the signed-in platform owner's UUID against `FACILITATOR_USER_ID`. v0.6.0 does **not** create student accounts, public feedback forms, reminders sent through WhatsApp, or an external AI connection.

### Facilitator workflow

1. Choose one of the two preliminary engagements or eight weekly cohort meetings.
2. Generate a facilitator-led or guest-compatible 60-minute plan; edit as Markdown.
3. Review the previous session's **programme-level** commitment and optionally carry it into the next agenda.
4. Record a proposed meeting date if confirmed (leave blank otherwise); set the programme commitment and optional attendance **count** and aggregated feedback themes.
5. Click **Save on this device**; use **Load saved** later after refreshing. Changes to the editor are **not autosaved**.
6. Use the four read-only communication templates: WhatsApp reminder, **post-session** follow-up, optional guest brief and a short, optional feedback questionnaire. Copy and review before using. Follow-up copy is disabled until marking the session delivered.
7. Export a JSON backup and keep it private. Import backups after explicit confirmation (import **replaces** all stored records).
8. Use **Copy ChatGPT prompt** to improve the saved or newly generated plan in ChatGPT Plus without API billing or connecting the website to an AI provider.

## Data ownership and privacy boundaries

- v0.6.0 persistence uses **browser localStorage** scoped to the Netlify website origin and that browser profile. It is **not encrypted**, not synced to Supabase, not a reliable multi-device database, and should **not** be used on shared computers.
- Save **only public/approved programme material or anonymous aggregate themes**. Do not enter individual student names, attendance rosters, contact details, medical disclosures, private finances, identifiable feedback, or guest contact details.
- The website stores up to **10 session records**; each record includes the selected session and options, editable plan, a programme-level commitment, confirmed session date if any, status, optional **count-only** turnout, optional aggregate feedback themes and a save timestamp.
- A private browser window, site-data clearing or switching devices may erase saved drafts; **export a backup after updates** and avoid forwarding backups to others.
- The frontend code and templates are publicly downloadable assets. The server-verified owner gate protects display of the planning interface but **localStorage itself is not a private server vault**.
- Communication templates never call WhatsApp or email APIs. Feedback is questionnaire *text* only; collecting actual responses requires a separately approved secure process.
- No guest availability, institutional approval, live attendance, session date, participation outcome, or feedback result is inferred.

## Future server persistence

A follow-up release may add encrypted-in-transit, owner-only Supabase storage with role-checked Netlify endpoints, RLS and retention policies, after privacy review. Never implement remote persistence merely by exposing a service-role key to browser code.

## Tests

`npm run test:core`, `npm test`, and `npm run build` should succeed. Unit tests cover round-trip save/load, version validation, malformed and oversized backups, continuity, all ten sessions and non-automatic communication drafts. CI still runs with registration closed and no real student PII.
