# Men in HR Connect — Personal Facilitation Desk (v0.5.0)

## Purpose

Facilitator-first session preparation for Men in HR. This feature was designed for **one named, approved facilitator**, not as a public AI chatbot or general mentor portal.

## User flow

1. An approved **owner** signs into `/admin` using the existing Supabase email OTP system.
2. `/api/admin/session` verifies the Supabase user token and active admin role; it returns `canFacilitate: true` ONLY if `FACILITATOR_USER_ID` matches the authenticated user's UUID and the user's role is `owner`.
3. The **My Facilitation Desk** tab appears for that user only.
4. Select either preliminary engagement or one of the eight weekly sessions, guest status, discussion/practical balance and attendance.
5. Optional: provide a *non-identifying* summary of the previous session's commitment.
6. Generate and edit the structured 60-minute draft, then copy, download as Markdown or copy a prompt for ChatGPT.

## Privacy and access limitations

- The planner runs entirely in the browser. It does not collect, store or transmit participant names or facilitator drafts to a server.
- Drafts are not automatically saved and will be lost on refresh. **Download** before leaving the page.
- The module code and general templates are static frontend assets and are not secrets; the **private interface is gated** by the server-verified `canFacilitate` capability. Do not store confidential participant data in the template content or client code.
- Set `FACILITATOR_USER_ID` **only** in Netlify's server environment to the precise UUID from your provisioned Supabase Auth account; never as a `VITE_` variable.
- Having the `owner` role alone does **not** give access to the desk. Leaving the UUID unset disables it.
- Additional server authorization is required before any future persistent plan storage, external AI calls, or messaging integration.
- All session titles and activities are working proposals, not confirmed speaker or participant records.

## Using ChatGPT Plus without an API key

Choose **Copy prompt for ChatGPT** in the desk, paste the prompt into an ordinary ChatGPT conversation or dedicated Men in HR Project, and ask for refinements. Review responses against programme facts and real session constraints. **A ChatGPT Plus subscription does not itself provide API credits for integrating a model into the deployed website.** This version avoids paid API requests entirely.

## Session pedagogy

Each session includes a goal, 60-minute agenda, non-intrusive icebreaker, four progressively deeper discussion questions, a live practical activity, optional guest prompts, a no-guest fallback, a concrete commitment with a next-session check-in, and facilitator guidance. The goal is peer learning with low data usage and no forced disclosure.

## Next possible improvements

- Save reviewed plans to a private, server-authorised table (owner-only; no student PII).
- Versions/approvals for session plans and guest question packs.
- Reusable WhatsApp reminder and feedback templates, manually approved before sharing.
- Opt-in external AI integration after evaluating cost, security, user consent and data minimisation.
