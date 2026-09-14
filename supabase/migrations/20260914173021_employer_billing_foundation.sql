-- Phase 4A: read-only commercial foundation. No prices, grants, purchases,
-- subscriptions, debits, promotions or payment-provider calls are created here.
-- Credit redemption must be added atomically with publication/promotion in 4B.
create table private.posting_plans (
  code text primary key check (char_length(code) between 2 and 80),
  name text not null check (char_length(name) between 2 and 120),
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  standard_posts integer not null check (standard_posts >= 0),
  sos_promotions integer not null default 0 check (sos_promotions >= 0),
  validity_days integer not null check (validity_days > 0),
  created_at timestamptz not null default now()
);
alter table private.posting_plans enable row level security;
revoke all on private.posting_plans from public,anon,authenticated;

create function private.is_billing_owner(target_employer uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.employer_members
    where employer_id=target_employer and user_id=auth.uid() and member_role='owner'
  );
$$;
revoke all on function private.is_billing_owner(uuid) from public,anon,authenticated;
grant execute on function private.is_billing_owner(uuid) to authenticated;

create table public.employer_posting_grants (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  kind text not null check (kind in ('standard_post','sos_promotion')),
  source text not null check (source in ('manual','posting_credit','plan')),
  plan_code text references private.posting_plans(code) on delete restrict,
  reference_key uuid not null unique,
  units integer not null check (units between 1 and 100000),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > starts_at),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((source='plan') = (plan_code is not null)),
  unique(id,employer_id,kind)
);
create index employer_posting_grants_owner_idx on public.employer_posting_grants(employer_id,kind,expires_at);
create index employer_posting_grants_plan_idx on public.employer_posting_grants(plan_code);
alter table public.employer_posting_grants enable row level security;
revoke all on public.employer_posting_grants from public,anon,authenticated;
-- Internal reconciliation/reference keys are not exposed even to owners.
grant select(id,employer_id,kind,source,units,starts_at,expires_at,revoked_at,created_at)
  on public.employer_posting_grants to authenticated;
create policy posting_grants_owner_read on public.employer_posting_grants for select to authenticated
using (private.is_billing_owner(employer_id));

create table public.employer_posting_usage (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null,
  employer_id uuid not null,
  kind text not null,
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  request_id uuid not null unique,
  used_at timestamptz not null default clock_timestamp(),
  foreign key(grant_id,employer_id,kind) references public.employer_posting_grants(id,employer_id,kind) on delete restrict
);
create index employer_posting_usage_grant_idx on public.employer_posting_usage(grant_id);
create index employer_posting_usage_employer_idx on public.employer_posting_usage(employer_id);
create index employer_posting_usage_shift_idx on public.employer_posting_usage(shift_id);
create unique index employer_standard_post_once_idx on public.employer_posting_usage(shift_id) where kind='standard_post';
alter table public.employer_posting_usage enable row level security;
revoke all on public.employer_posting_usage from public,anon,authenticated;
grant select(id,grant_id,employer_id,kind,shift_id,used_at) on public.employer_posting_usage to authenticated;
create policy posting_usage_owner_read on public.employer_posting_usage for select to authenticated
using (private.is_billing_owner(employer_id));

-- Defence for future operator-side writes: serialize credit consumption and
-- reject expired/revoked/exhausted grants and cross-workspace debits.
create function private.guard_posting_credit_usage()
returns trigger language plpgsql security definer set search_path='' as $$
declare credit public.employer_posting_grants%rowtype; decision_at timestamptz;
begin
  if TG_OP<>'INSERT' then raise exception 'Credit usage is immutable'; end if;
  select * into credit from public.employer_posting_grants where id=new.grant_id for update;
  decision_at := clock_timestamp();
  if credit.id is null or credit.employer_id<>new.employer_id or credit.kind<>new.kind
    or credit.revoked_at is not null or credit.starts_at>decision_at or credit.expires_at<=decision_at then
    raise exception 'Posting credit unavailable';
  end if;
  if not exists(select 1 from public.application_posts p where p.shift_id=new.shift_id and p.employer_id=new.employer_id) then
    raise exception 'Credit workspace mismatch';
  end if;
  if (select count(*) from public.employer_posting_usage where grant_id=new.grant_id)>=credit.units then
    raise exception 'Posting credit exhausted';
  end if;
  new.used_at := decision_at;
  return new;
end;
$$;
revoke all on function private.guard_posting_credit_usage() from public,anon,authenticated;
create trigger posting_credit_usage_guard before insert or update or delete on public.employer_posting_usage
for each row execute function private.guard_posting_credit_usage();

-- Invoker view retains owner RLS and does not imply payment or SOS activation.
create view public.employer_credit_balances with (security_invoker=true) as
select g.id,g.employer_id,g.kind,g.source,g.units,g.starts_at,g.expires_at,g.revoked_at,
  (g.units-(select count(*) from public.employer_posting_usage u where u.grant_id=g.id))::integer as remaining_units
from public.employer_posting_grants g;
revoke all on public.employer_credit_balances from public,anon,authenticated;
grant select on public.employer_credit_balances to authenticated;

-- Aggregate before PostgREST pagination so many grants cannot undercount a firm.
create view public.employer_credit_totals with (security_invoker=true) as
select employer_id,kind,sum(remaining_units)::bigint as remaining_units
from public.employer_credit_balances
where revoked_at is null and starts_at<=now() and expires_at>now()
group by employer_id,kind;
revoke all on public.employer_credit_totals from public,anon,authenticated;
grant select on public.employer_credit_totals to authenticated;
