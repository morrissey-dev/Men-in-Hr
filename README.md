# Men in HR Connect

**Phase 1 — Public website prototype** for the Men in HR mentorship initiative, being developed within JKUAT HRSA.

## What's implemented

- Responsive, accessible React/TypeScript website, designed for mobile users.
- Pages: Home, About, Programme, Events, Get Involved, Contact, Privacy, plus a 404 page.
- All eight proposed Cohort 1 topics in one editable data file.
- Event display supports East Africa Time (EAT), but **no events are published until confirmed**.
- Clear application status: **not yet open**. This release does **not** collect personal information.
- No student logins, database, application form or admin dashboard yet. Those are later milestones.

## Run locally

Requires Node.js 20.19+ (or Node 22.12+), and npm.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

```bash
npm run build     # type-check and create production dist/
npm run preview   # preview the production build
npm run test      # run basic automated tests
```

## Where to edit content

- Programme topics and approved events: `src/data/content.ts`
- Home page: `src/pages/Home.tsx`
- Other pages: `src/pages/`
- Shared header/footer: `src/components/`
- Visual styles: `src/styles/global.css`
- Architecture/requirements: `docs/requirements-and-system-design.md`

**Do not publish** private meeting links, participant information, unofficial contact details, unapproved photos, or unapproved institutional logos in any frontend file.

## Planned next steps

1. Confirm copy, branding and official contact method with coordinators.
2. Review mobile UI and accessibility using real student devices.
3. Agree cohort application questions, retention, and authorised data owners.
4. Implement secure registration: private PostgreSQL tables, server-side API validation, anti-abuse and privacy review.
5. Expand into an authorised admin dashboard and later participant/mentor portals.

## Git workflow

Create a repository and commit the prototype after reviewing it:

```bash
git init
git add .
git commit -m "feat: build Men in HR public website prototype"
```

Do not commit `.env`, database secrets, or participant information. No GitHub push has been performed.

## Project notes

Names, programme descriptions and initiative details are working content, awaiting appropriate stakeholder sign-off before an official public launch. No imaginary mentor profiles, impacts, testimonials or confirmed event dates are used in this version.
