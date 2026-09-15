# Phase 4B: posting-credit redemption and SOS

Standard publication and SOS are separate atomic operations. Neither changes the
worker's offered compensation or records a wage payment. No payment provider,
price, plan, grant or promotion is seeded by this migration.

- Existing pilot workspaces retain `enabled` and default to
  `require_posting_credit=false`. An operator may enable credit requirements only
  after commercial terms are approved. No client can change this setting.
- Credit-required publishing needs the workspace owner and explicit consent.
  Publication and one standard-credit usage commit together. Failed publication
  consumes nothing; the same successful publication request never consumes twice.
  Existing clients cannot bypass consent through the old publishing RPC.
- SOS requires an approved, current, unrevoked grant with an explicit duration.
  One activation consumes one SOS credit. The full duration must fit before shift
  start. Concurrent activation is serialized by post and grant locks; retries
  return the original promotion, even after it expires, without restarting it.
- Public SOS ranking uses an invoker view over the privacy-safe listing and RLS.
  Active promotions rank first, then start time and ID, within the city filter.
  The badge is promotional, not verification or a guarantee of applicants.
- Promotion expiry is evaluated on reads, independent of cron. Cancellation or
  removing public eligibility removes visibility. Visible pages refresh every
  20 seconds; an already-rendered screen can be briefly stale.
- Grant validity is checked at redemption. Later grant expiry/revocation does not
  undo a redeemed promotion; operators can stop the promotion explicitly.
  Automatic refunds are not implemented. These semantics need commercial/legal
  confirmation before selling credits. Workers remain free.

Verification: clean and populated disposable-PGlite migration suites cover credit
consent, old-client protection, rollback, retries, capacity/exhaustion, revoked and
expired grants, owner authorization, direct-write denial, public privacy, expiry,
cancellation and unchanged compensation. These are sequential SQL tests, not
simultaneous hosted PostgreSQL requests. Authenticated browser credit redemption
and promotion activation require a controlled test environment; no fake production
credits or ads are created to exercise them.

Deployment order: additive migration, permission and pilot-state checks, then app
deployment. Roll back app code if necessary; preserve credit usage/history and use
a forward migration for schema corrections. Never delete billing records.

## Verification record — 2026-09-15

- Migration applied to production as `20260915175154`. Confirmed pilot publishing
  remains enabled without a credit requirement; zero grants/promotions were created.
- Hosted checks confirm promotion RLS, invoker public feed, no anonymous activation
  or access to private credit-usage IDs. Local lint, 23 unit tests, clean/populated
  SQL suites, production build and 28 public desktop/mobile checks passed. npm audit:
  zero vulnerabilities. React review retained server-side authorization and parallel reads.
- Supabase advisors reported no new warnings. Existing legacy privileged RPC and
  leaked-password-protection warnings remain; internal deny-all tables are intentional.
  See [function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
  and [password protection](https://supabase.com/docs/guides/auth/password-security).
- Local browser run emitted an early-closed stream message during navigation and
  existing smooth-scroll warnings; all assertions passed. Do not equate that with
  a clean production-runtime log scan. Vercel runtime logs/drains remain unverified.
