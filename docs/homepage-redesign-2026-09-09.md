# Public entrance redesign — 9 September 2026

## Evidence and priorities

| Priority | Evidence / affected users | Impact and correction | Effort / verification |
| --- | --- | --- | --- |
| P1 | `/` redirected logged-out visitors to an authentication form. | Visitors lacked an explanation or separate worker/business entrances. Add a real homepage; preserve authenticated dashboard redirects. | Medium; role-link browser tests, mobile/desktop review. |
| P1 | Registration defaulted to worker regardless of entry intent. | Businesses repeated a choice and could choose the wrong permanent role. Carry the entrance choice into registration; retain explicit role selection and warning. Returning login remains email-only. | Small; separate login and registration tests. |
| P1 | Uncontrolled fields could reset after server action errors; transport exceptions had no local recovery message. | Registration retries caused lost work and uncertainty. Keep entered values, show pending, catch transport failures, retain server validation. | Small; interrupted-request test and isolated local auth transport checks. |
| P2 | Public trust copy described implementation details; there was no public payment/contact explanation. | Explain actual reservation commitments, contact access, verification and ledger limitations without invented proof. | Small; source-to-copy review and keyboard FAQ test. |
| P2 | Generic rounded split-card styling and no homepage identity. | Use a navy street-sign/restaurant-ticket visual system, editorial type, warm paper and orange, finite entrance motion and tactile controls. | Medium; screenshots at 320, 390, 768 and 1440px; reduced-motion and axe checks. |

## Implementation boundaries

- Public content is server-rendered; motion is CSS-only. No runtime animation library or remote font added.
- Homepage artwork explains a process, not a fictional shift, worker or live activity feed.
- Authentication actions, callback, privileged operations and database/RLS are unchanged.
- Social sharing image is generated with the existing Next.js image API; no same-day payout promise in metadata.
- Test-only axe dependency adds automated accessibility regression coverage.

## Verification before release

- Lint, strict TypeScript production build, 15 unit/safety tests and all eight migrations/state-transition validation passed.
- Local public browser suite: 20 tests passed across desktop/mobile, including role handoff, callback without code, keyboard controls, 320px layout, reduced motion, pending/error recovery and automated WCAG A/AA scans.
- Isolated local Supabase transport stub: login sends `create_user: false`; employer registration sends the chosen role and company; success identifies the destination email; rate-limit errors preserve input. No production email or account was created. These are simulated transport checks, not proof of email delivery.
- Dependency audit: zero reported vulnerabilities.

## Production verification and final correction — 10 September

- Commit `8581cb7` deployed successfully; GitHub Quality CI passed.
- Production public suite: 18 passed, with two local-only interrupted-request tests intentionally skipped. Homepage browser runtime-error capture was empty; the generated sharing image metadata resolved to the production domain.
- Final screenshot review caught staggered ticket-row fades still enabled under reduced motion. Disabled those row animations and expanded the regression test to require all three rows to have no animation and full opacity. Both local production-build regression cases passed, as did the full code/build/database checks again.

## Limits and follow-up

- Actual inbox delivery and valid, expired or reused magic-link exchanges still need a controlled staging inbox and isolated Supabase project. A missing-code callback test does not prove those exchanges.
- No authenticated dashboard session or marketplace mutation was exercised for this public-only redesign.
- Automated accessibility scans and keyboard checks are not a full manual screen-reader certification. Core Web Vitals were not measured in the field.
- No production data mutations are permitted in the public browser suite.
