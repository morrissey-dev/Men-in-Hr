# Architecture decision notes

1. **Phase 1 uses a static SPA.** It can be hosted cheaply, is straightforward to maintain and reduces the security surface compared with developing accounts on day one.
2. **Content is separate from views.** Topic and event data are held in `src/data/content.ts`; a future CMS/backend can replace this without overhauling every page.
3. **No real form until protected storage exists.** An unsecured or fake form would violate users' trust. The explicit 'not yet open' state is intentional.
4. **React + TypeScript + Vite.** Reusable UI and explicit types will make the later platform expansion easier; external packages are limited to routing and icons.
5. **Low-bandwidth by default.** No auto-playing media, remote fonts or photos; visual identity built with CSS rather than downloading heavy assets.
6. **No events without confirmation.** `publishedEvents` starts empty, and the visitor sees a meaningful empty state instead of fictional schedules.
7. **No public mentors without consent.** Mentor profile design is deferred to the content approval stage.
8. **No GitHub changes without checking destination.** Local project ZIP can be versioned and uploaded in the intended repository later.
