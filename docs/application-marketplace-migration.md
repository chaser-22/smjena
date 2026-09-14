# Application marketplace migration

## Phase 1: model isolation

Implementation: `20260913213702_isolate_marketplace_models.sql`.
This repository change does **not** enable applications or deploy a database
migration automatically. The current claim UI remains unchanged.

### Guarantees

- Existing shifts acquire `marketplace_model = legacy_claim`; no historical
  claim is relabelled as an employer offer or worker acceptance.
- The model cannot be changed after insertion, including by existing privileged
  RPCs. Its allowed future value is `application_v1`.
- A temporary database write fence rejects application-model insertion, update
  and deletion. There is deliberately no browser, environment or user-metadata
  flag that can bypass it.
- Separate permanent guards reject legacy assignment, rating and payment-ledger
  writes involving application-model shifts. Failed RPCs roll back their entire
  transaction, including reputation/counter side effects.
- No grants, RLS policies, personal information or public projections are added.
  Trigger functions are security-invoker, private, with an empty search path and
  no direct execution grants to anonymous/authenticated clients.
- Existing phone storage, publishing idempotency and legacy operations continue.

The temporary shift fence must be deliberately revised in a later migration
alongside new authorized RPCs and public/private projections. Do **not** simply
remove it or enable application writes in the old dashboard. The existing read
policies are still legacy policies, not the new marketplace privacy boundary.
The legacy-child guards must remain when new-model publishing becomes available.

## Verification

`npm run test:db` tests both:

1. All migrations on an empty disposable PGlite database, followed by the legacy
   regression suite and model-isolation tests.
2. The previous eight migrations with populated marketplace history, then this
   migration; all existing row values are compared before/after, excluding only
   the added model column. Compatibility and isolation checks then run again.

The isolation suite injects deliberately inconsistent application-model fixtures
by temporarily disabling triggers **inside disposable PGlite only**. It checks
authenticated legacy RPC calls, immutability, contact/grant regressions, rating
compatibility and complete rollback on errors. This fault injection is NOT an
operational enablement mechanism and must never be copied to a remote database.

PGlite is not proof of deployed Supabase permissions, PostgREST behaviour or
concurrent PostgreSQL transactions. Those require isolated staging verification.

Local verification on 2026-09-13: clean-install and populated-upgrade database
suites passed; preflight SQL ran against both schemas; lint, 15 unit tests and
the production build (including TypeScript) passed; npm audit reported zero
vulnerabilities. Supabase CLI lint/advisors were attempted with `--local` but
could not connect to PostgreSQL at 127.0.0.1:54322. No staging browser acceptance
or deployed-schema validation was performed in this batch. No production
database migration was applied.

## Deployment gate and recovery

Before applying this migration to production:

1. Reconcile the deployed migration history and schema with the eight baseline
   repository migrations. Check for manual SQL changes and function/policy drift.
2. Run `supabase/checks/marketplace-model-preflight.sql` read-only. Retain the
   aggregate results securely; inspect active legacy commitments and ledger
   statuses without exporting private contacts or applicant data.
3. Verify a usable backup and rehearse restoration in isolation.
4. Apply/test the migration in a separate staging Supabase project. Run database
   lint/advisors there and the existing legacy acceptance suite, including contact
   save, publish retry, claim and cancellation. Confirm the UI remains unchanged.
5. Schedule a short schema-change window. Adding the column and triggers needs
   table locks; avoid unbounded lock waits and apply the file transactionally.
6. Apply production only after those checks; rerun the aggregate inventory and
   verify the new column, four triggers, private function privileges and unchanged
   RLS. There must be zero application-model production rows in Phase 1.

No destructive down migration is provided. The old application is compatible
with the added column, so an application rollback can leave the migration intact.
If a guard causes a regression, investigate and use a reviewed forward fix; do
not bulk-convert rows or delete historical ledger records.

## Phase 2: account capabilities and safe public browsing

Implementation: `20260913214652_account_capabilities_and_public_listings.sql`.
This is a branch implementation, not a production cutover. Application-model
writes remain fenced off. No application or offer can be created yet.

### Account and route changes

- `/settings` lists the authenticated user's worker capability and every employer
  workspace. Users can enable their own worker profile or create a workspace;
  existing roles, memberships and historical data are not rewritten.
- `/dashboard?mode=worker` and `/dashboard?mode=employer&workspace=<uuid>` select
  explicit contexts. Only an unambiguous old link resolves automatically; dual
  capability and multi-workspace accounts choose from settings. Membership is
  rechecked server-side and by RLS; URL parameters never grant access.
- Phone saving and shift publishing target the selected workspace, not the first
  membership. Personal and business phones remain separate. New worker push
  links explicitly select the worker context. Previously delivered ambiguous
  notification links may still require choosing the worker profile in settings.
- Worker capability creation and workspace creation are transactional and
  idempotent. A stable per-form request ID prevents duplicate firms on retries.
  Workspace creation has an abuse ceiling of five owned firms per 24 hours;
  this is not a pricing tier, billing entitlement or business verification.
- Login/callback preserve allowlisted internal destinations. New-account copy
  explains that an email is not permanently restricted to one role.

### Data and privacy boundaries

- `shift_locations` separates exact addresses. The only backfill copies legacy
  addresses privately and retains `shifts.area` for compatibility; it is not a
  claim that legacy authenticated feeds have been retroactively made private.
  Members can read their firm's locations. Legacy workers can read the new
  table only for their specific active claimed/checked-in assignment, not every
  shift of the same employer. Cancellation revokes that entitlement.
- `public_shift_listings` starts empty. No legacy role, company name, address or
  requirements free text is automatically republished. Anonymous clients can
  select only this curated projection, never base shifts, contacts or applicants.
  Source changes, cancellation, crew-only visibility and elapsed starts invalidate
  a projection immediately through RLS. New-model raw shifts are restricted to
  workspace members even for authenticated legacy-feed readers.
- `/shifts` and `/shifts/[id]` use an anonymous server-side client with an explicit
  field allowlist. They display offered compensation and advertised capacity,
  not earnings, payments or invented remaining places. Empty, unavailable and
  missing-listing states are distinct. Application intake is explicitly unavailable.
- Phase 3 must implement transactional publication of curated public fields,
  source-version refresh, public-copy privacy checks, accepted-contact rules and
  the complete application/offer/acceptance lifecycle before lifting the fence.
  `approved_at` is publication approval, not verified business/attendance/payment.

### Verification and deployment gate

Local checks on 2026-09-14: 19 unit/safety tests, 26 desktop/mobile public browser
checks (including automated WCAG A/AA scans), clean-install and populated-upgrade
PGlite suites, lint, production build/strict TypeScript and dependency audit passed
(zero reported vulnerabilities). The public shifts unavailable layout was visually
inspected on desktop and phone. All database fixtures were disposable and local.
Browser checks used local-only dummy Supabase configuration: they cover the public
UI, anonymous auth guards and connection failure, not hosted Supabase integration.

The staging acceptance spec now covers adding worker capability to an employer,
creating two workspaces as a worker, explicit workspace navigation, distinct contact
storage and unauthorized workspace rejection. **It has not been run against staging.**
Real magic-link delivery, authenticated dashboards over PostgREST, populated public
listing rendering, concurrent PostgreSQL requests and push delivery remain staging
gates. Local Supabase lint/advisors remain unavailable without the local PostgreSQL
service; PGlite does not substitute for them.

Apply Phases 1 and 2 in order to an isolated staging database before deploying this
branch there. Reuse the drift inventory/backup gates above, run Supabase database
lint/advisors, then `npm run test:e2e:staging` using the documented staging guard
configuration. Confirm Supabase accepts magic-link callback URLs with the `next`
query parameter. Confirm Data API privileges and anonymous projection filtering
through real HTTP requests, not only SQL. Do not enable fake production listings
to make the public page look populated. No production schema change or merge to
the production branch is included in Phase 2.

Application rollback can leave the additive schema intact, but the old UI cannot
reliably represent accounts which have gained multiple capabilities/workspaces.
Disable new capability onboarding and assess those accounts before rolling the app
back; prefer a forward fix. Never delete new profiles or firms to force a rollback.

## Remaining phases

3. Complete staging journey: publish → apply → employer offer → worker acceptance
   → reciprocal contact. Include all rejection/withdrawal/expiry/cancellation paths.
4. Workspace posting entitlements, separate timed SOS, invitations, notification
   outbox and transition-based analytics. No payment provider or fictional payments.
5. Counsel/commercial approval, controlled production intake and matching copy,
   navigation, PWA and notification changes.
6. Approved legacy run-off, restricted historical access and optional mutual reviews.

## Decisions still required before public cutover

The architectural plan is approved. Legal and commercial values are not implied
by that approval. Confirm: offer hold duration; legal meaning of acceptance;
accepted cancellation policy; reapplication; phone and contact-retention rules;
self-application by workspace members; manager billing privileges; posting/SOS
prices, expiry and refunds; invitation-only periods; review moderation; and legacy
run-off. All employer-responsibility legal copy requires Montenegro counsel review.

Reference: [Supabase trigger documentation](https://supabase.com/docs/guides/database/postgres/triggers)
and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
