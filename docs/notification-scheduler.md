# Independent application notification retries

Supabase Cron checks every minute. When queued work is due (or an hourly health
check is due), pg_net calls the production Next.js worker. It uses existing VAPID
and Supabase server credentials. No Vercel plan upgrade, new shared secret or
payment-provider integration is required; normal database/function quotas apply.

## Authentication and delivery

- Scheduler config and wake-up receipts are in the private schema, RLS enabled,
  with no direct browser or service-role table access. Only an operator may set
  the endpoint or wake the worker. The migration sets no environment-specific URL.
- Each request has a random 64-character token. Only its SHA-256 digest is stored
  in the receipt; the transient pg_net request carries the token over HTTPS.
  It expires after two minutes and can be consumed once through a service-only RPC.
  Tokens never appear in the URL, cron command, response or application logs.
- POST `/api/internal/application-push` rejects unauthorized requests. It awaits
  one batch of at most 20 database-leased jobs and returns aggregate counts only.
  Missing configuration, lease failures and acknowledgement errors return 503.
- Leases, retry backoff, opt-outs, withdrawn/expired offers and expired invitations
  are checked by the existing database workflow. Existing action-driven delivery
  remains active; overlapping workers cannot lease the same live job.
- Delivery is at-least-once: a crash after push-service acceptance but before
  acknowledgement may cause a retry. Stable notification tags reduce duplicate
  visible notifications; exactly-once device delivery is not promised.
- `accepted_by_service` is not evidence of display, reading, attendance or payment.

## Production activation (operator only, after deployment)

```sql
insert into private.application_push_scheduler(singleton,endpoint)
values(true,'https://smjena.vercel.app/api/internal/application-push')
on conflict(singleton) do update set endpoint=excluded.endpoint;
```

The next minute tick dispatches an initial health check, including when the queue
is empty. Do not seed fake subscriptions or marketplace activity to test delivery.

Inspect operational status without exposing tokens:

```sql
select jobname, schedule, active from cron.job
where jobname='smjena-application-push';
select r.status, r.start_time, r.end_time
from cron.job_run_details r join cron.job j on j.jobid=r.jobid
where j.jobname='smjena-application-push' order by r.start_time desc limit 5;
select w.created_at,w.consumed_at,r.status_code,r.timed_out,r.error_msg,r.content
from private.application_push_wakeups w
left join net._http_response r on r.id=w.request_id
order by w.created_at desc limit 5;
```

HTTP 200 with zero leased jobs confirms the scheduler-to-worker path, not real
device delivery. HTTP 503 needs a configuration/transport/database investigation;
cron SQL success alone does not prove the HTTP worker succeeded. pg_net keeps
responses for approximately six hours. Token receipts expire from storage after
one day; marketplace and delivery histories are not deleted. External alerting
is not yet configured, so these checks remain operator-visible, not proactive alerts.

Rollback: set this cron job inactive or remove its operator endpoint config. Do
not disable publishing or existing action-driven delivery. Fix forward; preserve
notification history. Keep `net` out of the Data API's exposed schemas and audit
extension permissions after upgrades.

Hosted security note: pg_net's tables/schema belong to `supabase_admin` and its
PUBLIC grants were not removed by the operator's REVOKE migration (the same SQL
does restrict the locally owned test fixture). Do not report hosted SQL-role queue
access as denied. The production REST probe with `Accept-Profile: net` returned
406/PGRST106: only `public` and `graphql_public` are exposed. No browser credentials
provide direct SQL connections. Never expose `net` or add a generic SQL RPC. Wake-up
tokens are short-lived, one-use, and authorize only a bounded delivery batch; no
VAPID key, service key, subscription or user data is sent in the wake-up request.
Supabase support/extension-owner intervention is needed to revoke these managed
grants. The advisor also flags pg_net's non-relocatable public extension metadata;
its network objects live in `net`. These limitations remain explicitly tracked.

Tests cover transport outcomes, authorization, replay/expiry, stale leases, and
clean/populated migrations. PGlite stubs only cron/network extension boundaries;
the deployed schedule and real HTTP response must also be observed. Actual phone
push delivery still requires a consenting real-user device test.

References: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart),
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
