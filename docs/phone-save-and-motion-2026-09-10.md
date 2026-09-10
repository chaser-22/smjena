# Phone saving and continuous motion

## Confirmed phone-save defect

The server used merge-upsert for both contact tables. PostgREST's merge includes the ownership primary key in the UPDATE list, but production column grants deliberately allow UPDATE only on `phone` and `updated_at`. PostgreSQL rejects that statement even when the intended row is new.

Read-only production inspection confirmed the grants and ownership RLS. Local database regression tests reproduce the denied merge-upsert for both roles, verify first insertion and subsequent phone-only updates, and prove unrelated users cannot change the contact.

The server now inserts first and, on unique-key conflict only, updates the mutable columns using the authenticated owner filter. Update requires a returned row before reporting success. No secret/admin client, grants, RLS changes or migrations are needed. Save failures also appear inside the contact dialog instead of relying solely on a toast.

## Motion

A lightweight SVG/CSS illustration continuously cycles every seven seconds: business signal, transit, worker confirmation pulse. It is explicitly an explanatory illustration, not live marketplace activity. A 44px keyboard-accessible pause/resume button controls the cycle. Reduced-motion preferences show a static illustration. No animation dependency was added.

## Verification

- Lint, unit tests, migration/state-transition tests and strict TypeScript production build passed.
- Four local desktop/mobile browser checks passed for animation, pause/resume, reduced motion and narrow layouts.
- Local screenshots inspected; browser error capture empty; no horizontal overflow on the tested phone viewport.
- No production contact records were changed during testing. An actual signed-in production save still needs the account holder to retry after deployment.
