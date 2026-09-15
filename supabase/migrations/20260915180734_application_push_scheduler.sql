-- Config is operator-only and intentionally empty until the endpoint is deployed.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table private.application_push_scheduler (
  singleton boolean primary key default true check(singleton),
  endpoint text not null check(endpoint ~ '^https://[a-z0-9.-]+/api/internal/application-push$'),
  last_dispatched_at timestamptz
);
create table private.application_push_wakeups (
  token_hash bytea primary key,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '2 minutes',
  consumed_at timestamptz,
  request_id bigint
);
create index application_push_wakeups_created_idx on private.application_push_wakeups(created_at);
alter table private.application_push_scheduler enable row level security;
alter table private.application_push_wakeups enable row level security;
revoke all on private.application_push_scheduler,private.application_push_wakeups from public,anon,authenticated,service_role;

create function private.consume_application_push_wakeup(wake_token text)
returns boolean language plpgsql security definer set search_path='' as $$
declare matched integer;
begin
  if wake_token is null or wake_token !~ '^[a-f0-9]{64}$' then return false; end if;
  update private.application_push_wakeups set consumed_at=clock_timestamp()
    where token_hash=sha256(convert_to(wake_token,'UTF8')) and consumed_at is null and expires_at>clock_timestamp();
  get diagnostics matched=row_count;
  return matched=1;
end;
$$;
create function public.consume_application_push_wakeup(wake_token text)
returns boolean language sql security invoker set search_path='' as $$ select private.consume_application_push_wakeup(wake_token); $$;
revoke all on function private.consume_application_push_wakeup(text),public.consume_application_push_wakeup(text) from public,anon,authenticated;
grant execute on function private.consume_application_push_wakeup(text),public.consume_application_push_wakeup(text) to service_role;

create function private.wake_application_push_worker()
returns bigint language plpgsql security definer set search_path='' as $$
declare config private.application_push_scheduler%rowtype; wake_token text; request_key bigint; instant timestamptz;
begin
  select * into config from private.application_push_scheduler where singleton for update;
  instant:=clock_timestamp();
  -- Operational receipts only; no marketplace or delivery history is deleted.
  delete from private.application_push_wakeups where created_at<instant-interval '1 day';
  if config.endpoint is null or config.last_dispatched_at>instant-interval '30 seconds' then return null; end if;
  -- Avoid paid function invocations while idle, except one hourly health check.
  if config.last_dispatched_at>instant-interval '1 hour' and not exists(
    select 1 from private.application_push_outbox where next_attempt_at<=instant
      and (state='pending' or (state='leased' and lease_until<=instant))
  ) then return null; end if;
  wake_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into private.application_push_wakeups(token_hash) values(sha256(convert_to(wake_token,'UTF8')));
  request_key:=net.http_post(url:=config.endpoint,body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','x-smjena-wakeup',wake_token),timeout_milliseconds:=55000);
  update private.application_push_wakeups set request_id=request_key where token_hash=sha256(convert_to(wake_token,'UTF8'));
  update private.application_push_scheduler set last_dispatched_at=instant where singleton;
  return request_key;
end;
$$;
revoke all on function private.wake_application_push_worker() from public,anon,authenticated,service_role;
select cron.schedule('smjena-application-push','* * * * *','select private.wake_application_push_worker();');
