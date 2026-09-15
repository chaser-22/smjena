# Application marketplace migration

## Latest batch — preferred-worker invitations (2026-09-15)

Migration `20260915081036_preferred_worker_invitations.sql` is applied to the
owner-approved pre-launch production project. Marko/Cetinje publishing remains enabled.

Employers can save a worker as a private preference after the scheduled end of an
accepted application, remove that preference, and invite a preferred worker to a
new public advertisement. Existing `trusted_workers` records are retained. Saving
is neither a review nor proof that work occurred. There is no contact-directory
search or access to private phone/address data through preferred-worker RPCs.

Workers see invitations separately in `/applications`, can dismiss them, or disable
new invitations independently of application/offer updates. The invitation leads
to the public terms page; only the worker can create an application. Invitations
never hold capacity or bypass employer selection and worker acceptance. This batch
does not implement an exclusive crew-only advertising window.

Invitations are unique per post/worker, use recipient/firm rate limits (10 received
and 100 sent in 24 hours), and create one inbox event transactionally. Retries never
reopen dismissed invitations or emit another message. Push stays opt-in; dismissal,
opt-out, application, cancellation and expiry suppress stale queued invitations.
Current workspace membership is checked on reads and mutations. Notification and
invitation tables remain protected by RLS. The billing composite FK index warning
is addressed without altering billing data or enabling charges.

Verification: strict build, lint, 23 unit tests, 28 local public browser tests,
clean/populated PGlite suites and dependency audit (zero vulnerabilities) passed. Invitation tests include anonymous/
unrelated-user denial, revoked membership, no contact disclosure before acceptance,
opt-out, retry idempotency, dismissal, expiry, cancellation and recipient limits.
These sequential tests are not proof of simultaneous hosted PostgreSQL requests.
Authenticated invitation screens and real push delivery still require genuine
session/device verification; no production activity is manufactured for that purpose.
Hosted owner-role SQL verified empty authorized lists and enabled publishing; browser
roles cannot forge invitations, anonymous users cannot invite, and the service role
cannot bypass the stale-invitation filter. Advisors report no new security warnings;
the composite-FK index warning is resolved. The ten legacy definer warnings and
leaked-password setting remain as recorded below.
The guarded staging browser spec now includes invitation → terms → application →
offer → acceptance → contact, and distinguishes new default routes from explicit
legacy-history routes. It was type-checked and discovered by Playwright, **not run**
against an authenticated staging project. Invitation release `a543125` reached
Production deployment `6454552718` successfully at
`https://smjena-lg0th2o28-ivan-radonjics-projects.vercel.app`.

The preceding notification/navigation release (`6bd3d89`) reached Production
deployment `6447785258`, with 26 production public browser checks passing and two
local-only fault-injection tests skipped. Exact deployment:
`https://smjena-nx6d18t0y-ivan-radonjics-projects.vercel.app`.

## Notification release status — 2026-09-15 (Europe/Stockholm)

The owner confirmed the existing **Marko / Cetinje** workspace and authorized its
application pilot enablement. It is now enabled in production; no publishing gate
was turned off again. No accounts, shifts, applications, credits or reviews were
invented for production testing. The older phase notes below describe historical
implementation gates, not the current activation status.

The notification migration (`20260914223024_application_notifications.sql`) is
applied. Events create recipient-scoped inbox entries atomically; push is opt-in,
uses a private leased outbox, bounded retries, stale-offer suppression, and trusted
push-service endpoints. Browser roles cannot lease jobs or access endpoint keys
through the worker RPC. Acceptance by a push service is not delivery/read proof.
Preferences default off; enabling the marketplace does not grant notification consent.

This release adds `/notifications`, sends default authenticated navigation to the
application marketplace, preserves explicitly selected legacy views, and replaces
instant-claim promises on the homepage. Public database reads time out after four
seconds with an unavailable state, never a fabricated empty success state.

Local verification: 28 desktop/mobile browser tests, 23 unit tests, clean and
populated database suites, service-worker checks, lint and strict production build
passed. Dependency audit returned zero vulnerabilities. Real authenticated browser
journeys and actual push delivery are not verified by these checks. Hosted SQL
confirmed one enabled workspace, zero seeded activity, and service-only push RPCs.

Delivery currently runs after application mutations and inbox visits. The queue is
durable, but no independent periodic worker is configured: delayed retries need
subsequent traffic. Reliable unattended offer delivery remains unfinished. Pricing,
SOS redemption, preferred-worker invitations, optional mutual reviews and legal
approval also remain outstanding; this is not a claim that every phase is complete.

Hosted advisors retain ten legacy authenticated definer-function warnings and
disabled leaked-password protection. Internal deny-all tables intentionally have
no client policies. One pre-existing composite billing-usage foreign key needs a
covering index; unused-index notices are expected in this empty pilot.
See [database linter guidance](https://supabase.com/docs/guides/database/database-linter)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Deployment record — 2026-09-14

The owner authorized deployment to the existing pre-launch production environment.
Phases 1–3 were applied to Supabase `deshfuafmxzdfvpobyyp` and commit `221030f`
was pushed to `main`. The new public routes are live at `https://smjena.vercel.app`.
Production read-only browser verification: 26 desktop/mobile tests passed, two
local-only fault-injection cases skipped. The initial inventory contained two
profiles, one employer, and zero shifts, assignments or payment records. Before/
after fingerprints of existing profiles, employers and contact rows matched.
No database backup/restore was performed or claimed; these were additive migrations.

The remote migration tool assigned execution-time versions. Local SQL files were
renamed to those recorded versions without changing their SQL; production migration
history was **not** edited. Do not reapply the old filenames from earlier commits.

At this earlier checkpoint, pilot enablement was pending confirmation of the existing workspace
(`Marko`, Cetinje). A combined history-repair/pilot-enablement SQL request was rejected
by safety review; a read-only check confirmed zero enabled workspaces. No authenticated
pilot fixtures or public test ads were created. Separate staging remains supported,
but is no longer a mandatory infrastructure choice for this owner-approved pilot.

Vercel's connector returned 403 and listed no teams. Deployment used the existing
GitHub integration; Vercel build logs, exact deployment ID, runtime error scan and
drain configuration are not available through that connection. Public behavior was
verified independently. Supabase security advisors reported legacy authenticated
definer RPC warnings, intentional deny-all internal-table RLS notices, and disabled
leaked-password protection. These are not a clean security certification.

## Phase 4A: billing foundation

Migration `20260914173021_employer_billing_foundation.sql` was applied to the
same pre-launch production database. Hosted read-only owner-role verification
returned zero credit rows and confirmed authenticated users cannot insert grants
or usage. Passed locally: lint, strict TypeScript/production build, unit tests,
both database upgrade suites, 28 public desktop/mobile browser tests, and dependency
audit (zero vulnerabilities). Actual authenticated billing browser states remain
untested; database owner/worker/manager/anonymous access was exercised in PGlite.

This batch adds an owner-only `/employer/billing?workspace=...` read-only screen;
private plan definitions; separate standard-post and SOS grant types; expiring and
revocable grants; immutable usage records; and RLS-preserving balance/total views.
No plans, credits, usage, purchases or promotions are seeded. No price is assumed.
Managers and workers cannot see billing; manager access awaits a product decision.
No billing/credit write is exposed to browser roles. Posting still uses the pilot
gate and does not debit credits; the UI explicitly distinguishes these concepts.

Usage guards serialize on the grant, check its validity and workspace, reject
over-consumption, and prevent duplicate standard-post debits. They are a foundation,
not a public redemption workflow. Phase 4B must add idempotent atomic redemption
inside publishing/promotion transactions, approved pricing/refund rules, plan grant
approval, timed SOS activation and ranking, plus real PostgreSQL concurrent tests.
Never call a debit alone and then publish in a separate transaction. SOS usage does
not alter `pay_cents`; no wage ledger or payment-provider integration is added.

Remaining Phase 4 work: transactional notification outbox/delivery, trusted-worker
invitations to apply, timed SOS entitlements, and privacy-conscious funnel reporting.
General public launch still requires authenticated acceptance/contact verification,
reliable offer delivery, commercial/legal decisions and navigation/copy cutover.

## Phase 1: model isolation

Implementation: `20260914171829_isolate_marketplace_models.sql` (production-recorded version).
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

Implementation: `20260914171835_account_capabilities_and_public_listings.sql` (production-recorded version).
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

## Phase 3 implementation: application → offer → acceptance

Implemented on the migration branch, **not approved for production activation**.
Migration: `20260914171841_application_offer_acceptance.sql` (production-recorded version).

### Scope and architecture

- `/shifts/[id]` distinguishes logged-out visitors, accounts without worker
  capability, first-time applicants and existing applicants. An application is
  free, requires no CV and does not reserve capacity.
- `/applications` shows real effective states, offer deadlines, explicit acceptance,
  decline/withdrawal and accepted contacts. Personal phone entry is available here;
  no earnings, attendance or payment controls are introduced in this journey.
- `/employer/shifts?workspace=<uuid>` publishes an immutable advertisement using
  an idempotent request key and an explicitly selected workspace. Employer contacts
  and form state are keyed to the workspace so switching firms cannot reuse values.
- `/employer/shifts/[id]/applications` shows exact database counts for applications,
  offers awaiting response and acceptances. Employer offers, rejection, revocation
  and whole-post cancellation are separate decisions. No worker is assigned automatically.
- The existing `shifts` row is an immutable source record for the new model.
  `application_posts` holds its operational open/cancelled state and safe terms.
  Legacy dashboards explicitly exclude application-model sources. The source's
  old `status`/`claimed_count` are NOT application availability or fill metrics.
  Legacy mutation/assignment/ledger guards remain; new lifecycle operations never
  write worker reputation, attendance, assignments or wage-ledger records.
- `shift_applications` stores applications; `application_inbox` is a security-invoker
  view which computes effective expiry on every read. Raw status can lag elapsed
  time; API/UI readers must use `effective_status`, not raw `status`, for current state.
- New API functions are security-invoker wrappers over narrowly authorized private
  functions. Public tables have RLS and SELECT only; browsers cannot directly write
  application states, counters or the pilot configuration. No service key in UI code.
- PWA shell caching no longer precaches `/`, which can redirect an authenticated
  installation to private content. Cache v2 invalidates the old shell cache and
  includes only the public offline page and icon; application data is never precached.

### Provisional pilot rules — require product/counsel approval before launch

1. Active offers hold a place for 30 minutes, capped at shift start. The sum of
   accepted applications and unexpired offers cannot exceed advertised capacity.
   Applying never changes that sum. All capacity transitions lock the post row.
2. Acceptance locks the worker first, then post/application, and checks overlapping
   accepted applications and legacy active claims. A legacy-assignment trigger also
   checks accepted application commitments. Real concurrent PostgreSQL tests remain
   required: sequential PGlite tests do not prove concurrent behaviour.
   Deadline decisions capture wall-clock time after acquiring locks; a regression
   test rejects acceptance when a transaction began before expiry but acts after it.
3. Each worker can apply once per post. Retries return the same application; terminal
   applications are not revived. Reapplication and revised offers need a later decision.
4. Workers may withdraw and employers may revoke an offer/acceptance before start.
   Whole-post cancellation revokes all active applications. No automatic penalties.
   These actions are not represented as terminating a separately agreed contract.
5. The accepted worker receives the employer phone and exact address; current firm
   members receive that worker's phone. `application_contact` authorizes every read
   by application, identity, membership, state and time. Access ends on withdrawal,
   revocation, cancellation or scheduled shift end. Information already disclosed
   cannot be recalled from someone's device; retention rules require counsel approval.
6. Members cannot apply to their own workspace. Adding membership before acceptance
   is checked again; account metadata is never an authorization claim.
7. Public area, role and requirements use controlled choices; exact address has its
   own private field. Public business display name requires deliberate publication
   confirmation, length validation and rejection of obvious contact/link strings.
   This is not identity verification or automated proof that every string is safe.
8. Abuse ceilings: 20 new posts per firm/day and 50 applications per worker/day.
   These are not commercial posting entitlements. Paid posting, plans and separate
   SOS promotion remain Phase 4 and must precede general production intake.

State transitions:

| Current state | Worker action | Employer action | Time |
| --- | --- | --- | --- |
| applied | withdrawn | offered / rejected | expired at start |
| offered | accepted / declined / withdrawn | cancelled (revoked) | expired at deadline |
| accepted | withdrawn before start | cancelled before start | remains accepted history, not completed work |
| declined / withdrawn / expired / rejected / cancelled | no revival | no revival | terminal |

### Pilot gate, events and limits

`private.application_pilot_workspaces` is empty after migration. Without explicit
database-operator enablement for a specific isolated test firm, posting/applying/
offering/accepting are disabled. Disabling the pilot hides its public listings and
blocks new commitments; withdrawal/revocation/cancellation remain available. It
does not automatically cancel previously accepted commitments or remove their
authorized contact window. Do not use this gate to bypass legal/commercial readiness.

`private.application_events` records successful transitions atomically with actor,
application/post identifiers and timestamp. Retries do not invent another success
event. No phone, address, CV or free-form analytics payload is recorded. These are
real transition records, not fabricated product metrics. Time-derived expiry can be
visible before an expiry event is materialized by a mutation; analytics must account
for deadlines rather than simply counting event rows.

Screens refresh every 20 seconds while visible, with a manual refresh control. New
offer/acceptance push or email delivery is **not implemented in this phase**; do not
claim a worker has been notified. Pilot testers must keep their inbox screens open.
The reliable notification outbox remains Phase 4. Existing legacy push is preserved.

Current list limits are explicit: 200 newest applications and 100 newest employer
posts. Employer summary counts cover all records. Pagination, mutual reviews,
term amendments, compensation increases and invitation-specific intake remain
follow-up work, not hidden functional promises.

### Verification status (2026-09-14)

- Passed: lint, strict TypeScript/production build, 22 unit/safety tests, 28 public
  desktop/mobile Playwright checks and dependency audit (zero vulnerabilities).
- Passed in disposable PGlite: clean and populated upgrades, retained legacy
  history, pilot gate, public projection/privacy, idempotent publishing/applying,
  pre-offer acceptance rejection, capacity holds/release, expiry including retries,
  accepted contact disclosure, overlap rejection, rejection, decline, withdrawal,
  revocation, whole-post cancellation, membership revocation and no legacy assignment.
- Prepared but **not executed**: authenticated two-role staging browser test. It uses
  an explicitly enabled `E2E ` workspace and retains immutable test history only in
  the isolated staging database. See `staging-setup.md` for setup and cleanup policy.
- Not verified: authenticated screen layouts/accessibility in real Supabase sessions,
  hosted PostgREST permissions, simultaneous requests, SMTP, and actual notification
  delivery. Supabase local lint/advisors could not connect to 127.0.0.1:54322.
- The initial local verification above preceded deployment. See the deployment
  record at the top for current production status and remaining verification gaps.

General public intake is blocked on authenticated pilot verification, counsel/commercial
decisions, reliable offer notifications and controlled cutover. Additive schema rollback is not
data deletion: retain application histories and use a reviewed forward fix.

## Decisions still required before public cutover

The architectural plan is approved. Legal and commercial values are not implied
by that approval. Confirm: offer hold duration; legal meaning of acceptance;
accepted cancellation policy; reapplication; phone and contact-retention rules;
self-application by workspace members; manager billing privileges; posting/SOS
prices, expiry and refunds; invitation-only periods; review moderation; and legacy
run-off. All employer-responsibility legal copy requires Montenegro counsel review.

Reference: [Supabase trigger documentation](https://supabase.com/docs/guides/database/postgres/triggers)
and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
