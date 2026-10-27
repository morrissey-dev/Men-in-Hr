# Architecture decision notes

1. **Phase 1 uses a static SPA.** It can be hosted cheaply, is straightforward to maintain and reduces the security surface compared with developing accounts on day one.
2. **Content is separate from views.** Topic and event data are held in `src/data/content.ts`; a future CMS/backend can replace this without overhauling every page.
3. **No real form until protected storage exists.** An unsecured or fake form would violate users' trust. The explicit 'not yet open' state is intentional.
4. **React + TypeScript + Vite.** Reusable UI and explicit types will make the later platform expansion easier; external packages are limited to routing and icons.
5. **Low-bandwidth by default.** No auto-playing media, remote fonts or photos; visual identity built with CSS rather than downloading heavy assets.
6. **No events without confirmation.** `publishedEvents` starts empty, and the visitor sees a meaningful empty state instead of fictional schedules.
7. **No public mentors without consent.** Mentor profile design is deferred to the content approval stage.
8. **No GitHub changes without checking destination.** Local project ZIP can be versioned and uploaded in the intended repository later.

9. **Milestone 2 uses a closed-by-default application form and trusted API.** Student data is transmitted only if Netlify runtime, the approved privacy process, database and Turnstile are ready.
10. **No unnecessary identifiers.** Only name, email, institution, study level, topics, optional motivation, and affirmative acknowledgements are required. Initial intake is restricted to applicants affirming they are adults until safeguards for minors are approved.
11. **No client access to application records.** No anonymous/authenticated role can read the private applications table. Only the server uses elevated credentials, and those credentials remain outside the built browser assets.
12. **Retention is an operational duty, not a label.** No scheduled deletion has been implemented; the operator must approve, operate and audit an actual deletion process before enabling real submissions.
13. **Release gates are independent.** Runtime environment approvals AND an `applications_open` flag for the selected database cohort are mandatory, and both must be checked again for each submission.
