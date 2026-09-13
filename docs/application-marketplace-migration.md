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

## Remaining phases

2. Independent worker/workspace capabilities, explicit workspace authorization,
   private exact locations and an allowlisted public listing projection.
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
