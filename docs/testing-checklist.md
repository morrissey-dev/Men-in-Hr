# Quality & acceptance checklist

## Source review
- [x] All eight agreed topics stored in one data module and rendered in order.
- [x] No fake mentors, testimonials, confirmed events or made-up official contacts.
- [x] Applications clearly marked closed; prototype does not collect personal information.
- [x] Explicit EAT timezone handling for any future event data.
- [x] No environment secrets in the frontend or repository.
- [x] Keyboard-accessible navigation controls and focus styles included.
- [x] Prefers-reduced-motion styling included.

## To verify on a machine with Node dependencies installed
- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `npm run dev` and test in Chrome/Firefox.
- [ ] Mobile widths 360, 390, 768, 1024 and 1440 px; no clipping.
- [ ] Keyboard-only navigation, Escape closes mobile menu, skip link works.
- [ ] Screen reader labels and heading order.
- [ ] Lighthouse accessibility/performance review on a production build.
- [ ] Approve institutional name/logo use and public copy.
- [ ] Approve privacy/contact details and confirmed events before public launch.

## Milestone 2 conditions
- [ ] Agree minimum application fields, responsible data controller and retention policy.
- [ ] Implement server-side validation and anti-abuse controls.
- [ ] Confirm anonymous users cannot read or list applications.
- [ ] Test closed cohorts, duplicate submissions and safe error handling.
