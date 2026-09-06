# SMJENA production product audit — 2026-09-05

This audit treats the interface, server actions, Postgres functions, grants and RLS policies as one product. Production contained one profile and no shifts, assignments or ledger rows when the audit began. No production data was created for testing.

## User-state matrix

| User state | Evidence before this batch | Required product behavior | Batch status |
| --- | --- | --- | --- |
| First-time visitor | `/` redirected to one combined auth form | Explicitly choose account creation; explain permanent role once | Implemented |
| Returning, logged out | Name, city and role were required again | Email-only login that cannot create an account | Implemented |
| Returning, logged in | Proxy and page redirected `/login` to `/dashboard` | Preserve session and avoid auth form | Preserved |
| New worker | Auth trigger created profile; availability defaulted to `true` | Start unavailable and let the worker opt in | Implemented for new records |
| Existing worker | One active assignment ID was rendered | Show every non-overlapping commitment supported by the database | Implemented |
| New employer | Minimal business profile could publish immediately | Stay explicitly unverified; protect publishing from retry duplicates and bursts | Implemented; external verification remains open |
| Existing employer | No future-shift cancellation, no no-show action, no payment approval | Provide consequential confirmations and precise resulting state | Implemented |
| Incomplete registration | Missing profile/member produced generic dashboard error | Dedicated, supportable recovery that does not trust editable user metadata | Open; requires support channel and recovery policy |
| Expired/reused magic link | Callback returned a clear error above the combined form | Return to email-only login with an easy resend/change-email path | Implemented |
| Wrong email / role | Registration metadata could be resubmitted for an existing permanent role | Returning login has no role input; new role choice is explicit and permanent | Implemented |
| Empty worker account | Default Score 80 looked earned | Show no Score or attendance until a completed/no-show record exists | Implemented |
| Empty employer account | Honest empty state existed | Keep one primary “New shift” action | Preserved |
| Account with active work | Check-in/out controls were actionable outside database windows | Match the database window before enabling each action | Implemented |
| Account with completed work | Only aggregate amounts were shown | Show itemized status and separate reported, approved and paid amounts | Implemented |
| Offline / lost response | Navigation fallback existed; a publish retry could duplicate a shift | Stable client request ID and unique database constraint | Implemented |
| Loading / slow network | Skeleton, pending bar and disabled actions existed | Preserve visible pending state and precise outcome copy | Preserved and refined |
| Server error | Segment/global recovery existed | Never claim a mutation succeeded without a confirmed result | Preserved |
| Small phone | Login promo hid; dashboard had bottom navigation | Keep 44px targets and remove misleading mobile labels | Implemented; visual re-test required after deployment |
| Tablet / desktop | Responsive two-column dashboard existed | Preserve readable hierarchy and form layout | Preserved |
| Keyboard | Native controls, skip link and dialog primitives existed | Logical focus order, visible focus and no keyboard-only dead control | Re-test required after deployment |
| Screen reader | Labels and live pending output existed | Precise state labels and no invented activity | Implemented; assistive-technology lab test remains open |

## Prioritized findings

| Priority | Evidence | Affected users | User / business impact | Trust or safety risk | Effort | Correction | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | Auth action always used `shouldCreateUser: true`; UI always requested role/name/city | Returning users | Login friction and role confusion | Existing role appears changeable when it is not | M | Split login and registration; login sends email only with account creation disabled | Browser snapshots, validation tests, magic-link staging E2E |
| P0 | Supabase advisor reported `security_definer_view` for employer marketplace identity | Workers and businesses | Safe public identity was implemented through a high-risk database primitive | Future columns could be exposed accidentally | M | Replace view with a narrow synchronized table protected by RLS | Security advisor and member/non-member RLS tests |
| P0 | Worker self-checkout created a pending ledger record; employer had no review action | Both roles | Disputed or remote attendance could look payable | Payment confusion and fraud | M | Separate worker-reported `pending`, employer-approved `authorized`, and externally settled `paid` | Database transition tests and two-role staging E2E |
| P1 | Employer could not cancel a future shift | Both roles | Stranded commitments and support burden | Workers may travel for cancelled work | M | Atomic employer cancellation; do not penalize workers; notify opted-in claimants | RPC tests, two-role staging E2E, push test |
| P1 | No-show enum existed but no real workflow did | Employers and reliable workers | Reliability metric could not reflect a key marketplace failure | Reputation gaming and staffing risk | M | Employer-only post-start no-show action; automatic replacement; recompute attendance from real rows | RPC boundary tests and staging clock-controlled E2E |
| P1 | Database allowed non-overlapping commitments; UI rendered only one | Workers | Hidden obligations and accidental no-shows | Material commitment could disappear | M | Render current and upcoming commitments; only block overlapping claims | Unit tests and worker staging E2E |
| P1 | Push disable had no visible control; crew sends did not check the preference | Workers | Unwanted notifications | Consent violation and spam | S | Reversible toggle; honor availability/preference for crew; exclude previous responders | Browser permission and push staging tests |
| P1 | Shift publishing was not idempotent or rate-limited | Employers and marketplace | Lost response could create duplicate jobs and pushes | Overbooking and spam | M | Per-attempt UUID, unique employer/request index, 12/hour ceiling | Concurrent RPC test and slow-network staging test |
| P1 | Viewer count was never incremented but UI showed “0 watching” | Workers | Artificial scarcity cue with no real measurement | False social proof | S | Remove viewer language | Snapshot/content assertion |
| P1 | Replacement UI appeared before any cancellation; `replacement_of` was never set | Employers | Dead action and invisible replacement state | Misleading operational status | M | Replacement timestamp; automatic transition after cancellation/no-show | RPC and dashboard state tests |
| P1 | Worker cancellation always reopened a shift, even after its scheduled end; replacement push was not sent | Both roles | Eligible replacements could miss real openings, while expired work could generate a useless alert | Attendance manipulation and notification misuse | M | Block cancellation after the scheduled end; resolve it through check-out/no-show; notify only when the resulting shift is genuinely published | Isolated RPC test and server-action inspection |
| P1 | Employer cancellation selected recipients before the atomic database cancellation | Claimed workers | A concurrent final claimant could be cancelled without receiving the cancellation push | Worker could travel for work that no longer exists | S | Query the committed cancelled assignments after the RPC before best-effort notification | Concurrency reasoning and staging push test |
| P1 | Check-in/out buttons invited guaranteed database errors outside time windows | Workers | Frustration at the moment of attendance | Ambiguous attendance record | S | Disable until the exact allowed time and explain when it opens | Unit boundary tests and clock-controlled UI test |
| P2 | Six foreign keys used by operational lookups had no covering index | Both roles at scale | Cancellation, payment and rating queries would degrade as records grew | Operational latency during urgent staffing | S | Add targeted indexes; retain currently unused indexes until real traffic exists | Supabase performance adviser |
| P2 | No verified business/identity provider or review workflow | Both roles | Lower marketplace trust and conversion | Impersonation and unsafe work | L / external | Select provider, evidence policy, dispute process and operational owner before showing verification | Provider sandbox and manual review test |
| P2 | No privacy/terms/support/account-deletion surfaces | All users | Launch and support friction | Legal and rights-management risk | M / legal | Obtain Montenegro counsel-approved texts and a monitored support channel | Legal approval and support runbook exercise |
| P2 | Production is the only configured end-to-end environment | Product team | Critical two-role paths cannot be tested safely | Test data could contaminate reputation and money states | M | Separate Supabase staging project plus Vercel preview environment | Full seeded staging suite, production smoke only |

## End-to-end state traces

### Authentication

Visible intent → form state → `requestMagicLink` → `signInWithOtp` with `shouldCreateUser` matching intent → Supabase email/PKCE callback → auth trigger creates profile exactly once → proxy and server page validate the session → dashboard feedback.

The role is written only while creating a new auth user. Returning login sends no role metadata. Authorization never reads `user_metadata` after registration.

### Claim

Shift card → overlap/availability feedback → confirmation dialog → authenticated worker server action → `claim_shift` locks the shift → role, availability, prior response, overlap, audience and capacity checks → assignment insert and shift count/status update → product event → refreshed dashboard and toast.

### Publish

Employer dialog → local validation and stable request UUID → authenticated employer server action → membership lookup → `publish_shift` membership, rate, time, pay, capacity and requirement checks → unique employer/request insert → privacy-conscious event → opted-in eligible-worker push → refreshed fill state.

### Attendance and payment

Time-gated worker control → authenticated action → assignment-owner RPC → checked-in/completed assignment → pending ledger claim → employer sees itemized obligation → employer-only authorization RPC changes `pending` to `authorized` → UI still states that no bank transfer occurred. Only an external licensed settlement integration may set `paid`.

### Cancellation and no-show

Consequential confirmation → role-authenticated action → owner/member RPC → row lock and state validation → assignments and shift updated atomically → worker cancellation applies the displayed penalty; employer cancellation never penalizes the worker; no-show is available only after start and updates attendance from finalized rows → replacement is public only when a place genuinely opened.

### Notifications

Worker-controlled browser permission → Web Push subscription stored under own-user RLS → account preference stored → server-only service key selects eligible users → city/audience/availability/preference and prior-response filters → delivery → expired endpoints removed. Disabling first removes the database subscription, then unsubscribes the browser endpoint.

## Staging plan required for genuine E2E coverage

1. Create a separate Supabase staging project; apply the same migrations and SMTP/Web Push test credentials.
2. Map Vercel Preview variables only to staging. Never point previews at production.
3. Create clearly labelled staging worker and employer fixtures through the public registration flow.
4. Seed deterministic future, active and completed shifts only in staging, with a cleanup script scoped to the staging project reference.
5. Test two concurrent final-place claims, lost publish responses, overlapping shifts, early/on-time attendance, cancellation, no-show replacement, payment approval, push opt-out and expired links.
6. Keep production tests read-only except for actions the real account owner intentionally performs.

## External launch decisions

- A licensed payment/payout provider that supports the SMJENA legal entity and Montenegro.
- Business and worker identity verification policy/provider.
- Counsel-approved terms, privacy notice, cancellation/no-show policy, tax and employment classification.
- A monitored support and incident-response channel.
- Transactional email sender/domain and delivery monitoring.

## Verification completed for this batch

- `npm run lint`: passed.
- `npm test`: 10/10 authentication and marketplace helper tests passed.
- `npx tsc --noEmit --incremental false`: strict TypeScript passed.
- `npm run test:db`: all migrations applied to a fresh in-memory Postgres-compatible database; publish idempotency, capacity, overlap, cancellation, no-show, checkout, ledger authorization and RPC grants passed.
- `npm run build`: optimized Next.js 16 production build passed.
- `npm audit`: zero known vulnerabilities at verification time.
- Linked Supabase migration history matched the repository; production database lint reported no schema errors.
- Production remained at one profile and zero shifts, assignments and ledger rows after read-only verification. No production fixtures were created.
- Supabase security adviser no longer reports the former security-definer view or callable automatic-RLS helper. The remaining `SECURITY DEFINER` warnings are the intentional authenticated marketplace RPCs, each with explicit role, ownership and state checks. `product_events` intentionally has no client policy or client grants.
- Supabase performance adviser identified six missing foreign-key indexes; this batch added them. “Unused index” notices are expected before marketplace traffic exists and are not a reason to remove protective indexes yet.
