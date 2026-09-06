-- Harden the core marketplace state machine without changing existing records.

-- New workers should explicitly choose to become available.
alter table public.worker_profiles alter column available set default false;

alter type public.product_event_name add value if not exists 'shift_cancelled_by_employer';
alter type public.product_event_name add value if not exists 'payment_authorized';
alter type public.product_event_name add value if not exists 'worker_marked_no_show';

-- Replace the security-definer view with a narrow, independently RLS-protected
-- projection. Legal name, tax ID and address remain only in public.employers.
drop view if exists public.employer_marketplace_profiles;

create table public.employer_marketplace_profiles (
  id uuid primary key references public.employers (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  city text not null check (char_length(city) between 2 and 80),
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_shifts integer not null default 0 check (completed_shifts >= 0),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.employer_marketplace_profiles (
  id, name, city, average_rating, rating_count, completed_shifts, verified_at, updated_at
)
select id, name, city, average_rating, rating_count, completed_shifts, verified_at, updated_at
from public.employers;

create or replace function private.can_view_employer_marketplace_profile(target_employer_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    private.is_employer_member(target_employer_id)
    or exists (
      select 1
      from public.shifts shift
      where shift.employer_id = target_employer_id
        and shift.status = 'published'
        and (
          shift.audience = 'public'
          or exists (
            select 1 from public.trusted_workers trusted
            where trusted.employer_id = target_employer_id
              and trusted.worker_id = (select auth.uid())
          )
        )
    )
    or exists (
      select 1
      from public.shift_assignments assignment
      join public.shifts shift on shift.id = assignment.shift_id
      where shift.employer_id = target_employer_id
        and assignment.worker_id = (select auth.uid())
    );
$$;

create or replace function private.sync_employer_marketplace_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.employer_marketplace_profiles (
    id, name, city, average_rating, rating_count, completed_shifts, verified_at, updated_at
  ) values (
    new.id, new.name, new.city, new.average_rating, new.rating_count,
    new.completed_shifts, new.verified_at, new.updated_at
  )
  on conflict (id) do update set
    name = excluded.name,
    city = excluded.city,
    average_rating = excluded.average_rating,
    rating_count = excluded.rating_count,
    completed_shifts = excluded.completed_shifts,
    verified_at = excluded.verified_at,
    updated_at = excluded.updated_at;
  return new;
end;
$$;

create trigger employers_sync_marketplace_profile
  after insert or update of name, city, average_rating, rating_count, completed_shifts, verified_at, updated_at
  on public.employers
  for each row execute procedure private.sync_employer_marketplace_profile();

alter table public.employer_marketplace_profiles enable row level security;
revoke all on public.employer_marketplace_profiles from anon, authenticated;
grant select on public.employer_marketplace_profiles to authenticated;
create policy employer_marketplace_profiles_select_authorized
  on public.employer_marketplace_profiles for select to authenticated
  using (private.can_view_employer_marketplace_profile(id));

revoke all on function private.can_view_employer_marketplace_profile(uuid) from public, anon;
grant execute on function private.can_view_employer_marketplace_profile(uuid) to authenticated;
revoke all on function private.sync_employer_marketplace_profile() from public, anon, authenticated;

-- A stable request ID makes retries safe after a client loses the response.
alter table public.shifts add column request_id uuid;
alter table public.shifts add column replacement_requested_at timestamptz;
create unique index shifts_employer_request_id_idx
  on public.shifts (employer_id, request_id)
  where request_id is not null;

create or replace function public.publish_shift(
  target_employer_id uuid,
  publish_request_id uuid,
  shift_role text,
  shift_area text,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_pay_cents integer,
  shift_bonus_cents integer,
  shift_workers_needed smallint,
  shift_requirements text[],
  shift_urgent boolean,
  shift_audience public.shift_audience
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_city text;
  new_shift_id uuid;
  cleaned_requirements text[];
begin
  if not private.is_employer_member(target_employer_id) then raise exception 'Not authorized'; end if;
  if publish_request_id is null then raise exception 'Missing request id'; end if;

  select id into new_shift_id
  from public.shifts
  where employer_id = target_employer_id and request_id = publish_request_id;
  if new_shift_id is not null then return new_shift_id; end if;

  if (
    select count(*) from public.shifts
    where employer_id = target_employer_id
      and created_at > now() - interval '1 hour'
  ) >= 12 then
    raise exception 'Shift publishing rate limit reached';
  end if;

  if char_length(trim(shift_role)) not between 2 and 80 then raise exception 'Invalid role'; end if;
  if char_length(trim(shift_area)) not between 2 and 200 then raise exception 'Invalid area'; end if;
  if shift_starts_at <= now() then raise exception 'Shift must start in the future'; end if;
  if shift_ends_at <= shift_starts_at or shift_ends_at > shift_starts_at + interval '24 hours' then raise exception 'Invalid shift duration'; end if;
  if shift_pay_cents not between 2000 and 500000 then raise exception 'Invalid pay'; end if;
  if shift_bonus_cents < 0 or shift_bonus_cents > shift_pay_cents - 2000 then raise exception 'Invalid bonus'; end if;
  if shift_workers_needed not between 1 and 50 then raise exception 'Invalid worker count'; end if;
  if coalesce(cardinality(shift_requirements), 0) > 8 then raise exception 'Too many requirements'; end if;
  if exists (
    select 1 from unnest(coalesce(shift_requirements, '{}'::text[])) item
    where char_length(trim(item)) not between 2 and 80
  ) then raise exception 'Invalid requirement'; end if;

  select coalesce(array_agg(trim(item)), '{}'::text[])
  into cleaned_requirements
  from unnest(coalesce(shift_requirements, '{}'::text[])) item;

  select city into selected_city from public.employers where id = target_employer_id;
  if selected_city is null then raise exception 'Employer not found'; end if;

  insert into public.shifts (
    employer_id, created_by, request_id, role, city, area, starts_at, ends_at,
    pay_cents, base_pay_cents, bonus_cents, workers_needed, requirements,
    urgent, audience, status, published_at
  ) values (
    target_employer_id, (select auth.uid()), publish_request_id, trim(shift_role), selected_city,
    trim(shift_area), shift_starts_at, shift_ends_at, shift_pay_cents,
    shift_pay_cents - shift_bonus_cents, shift_bonus_cents, shift_workers_needed,
    cleaned_requirements, shift_urgent, shift_audience, 'published', now()
  )
  on conflict (employer_id, request_id) where request_id is not null
  do update set request_id = excluded.request_id
  returning id into new_shift_id;

  return new_shift_id;
end;
$$;

-- Claims remain atomic. A late claim is possible only for an explicit
-- replacement request while the shift is still running, and a worker cannot
-- respond to the same shift twice after cancelling or being marked absent.
create or replace function public.claim_shift(target_shift_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_shift public.shifts%rowtype;
  active_count integer;
  assignment_id uuid;
begin
  if (select role from public.profiles where id = (select auth.uid())) is distinct from 'worker'::public.app_role then
    raise exception 'Only workers can claim shifts';
  end if;
  if not exists (
    select 1 from public.worker_profiles
    where user_id = (select auth.uid()) and available
  ) then raise exception 'Worker is not available'; end if;

  select * into selected_shift from public.shifts where id = target_shift_id for update;
  if selected_shift.id is null
    or selected_shift.status <> 'published'
    or selected_shift.ends_at <= now()
    or (selected_shift.starts_at <= now() and selected_shift.replacement_requested_at is null) then
    raise exception 'Shift is not available';
  end if;

  if exists (
    select 1 from public.shift_assignments
    where shift_id = target_shift_id and worker_id = (select auth.uid())
  ) then raise exception 'Worker already responded to shift'; end if;

  if exists (
    select 1
    from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    where assignment.worker_id = (select auth.uid())
      and assignment.status in ('claimed', 'checked_in')
      and tstzrange(shift.starts_at, shift.ends_at, '[)') && tstzrange(selected_shift.starts_at, selected_shift.ends_at, '[)')
  ) then raise exception 'Worker has an overlapping shift'; end if;

  if selected_shift.audience = 'crew' and not exists (
    select 1 from public.trusted_workers
    where employer_id = selected_shift.employer_id and worker_id = (select auth.uid())
  ) then raise exception 'Shift is limited to the trusted crew'; end if;

  select count(*) into active_count
  from public.shift_assignments
  where shift_id = target_shift_id and status in ('claimed', 'checked_in', 'completed');
  if active_count >= selected_shift.workers_needed then raise exception 'Shift is already full'; end if;

  insert into public.shift_assignments (shift_id, worker_id, pay_cents)
  values (target_shift_id, (select auth.uid()), selected_shift.pay_cents)
  returning id into assignment_id;

  if active_count + 1 >= selected_shift.workers_needed then
    update public.shifts
    set status = case when starts_at <= now() then 'in_progress'::public.shift_status else 'filled'::public.shift_status end,
        claimed_count = active_count + 1,
        filled_at = coalesce(filled_at, now()),
        replacement_requested_at = null,
        updated_at = now()
    where id = target_shift_id;
  else
    update public.shifts set claimed_count = active_count + 1, updated_at = now() where id = target_shift_id;
  end if;

  return assignment_id;
end;
$$;

create or replace function public.cancel_assignment(target_assignment_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift_id uuid;
  shift_starts_at timestamptz;
  score_penalty smallint;
begin
  update public.shift_assignments
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = left(reason, 500), updated_at = now()
  where id = target_assignment_id
    and worker_id = (select auth.uid())
    and status = 'claimed'
  returning shift_id into target_shift_id;

  if target_shift_id is null then raise exception 'Assignment cannot be cancelled'; end if;
  select starts_at into shift_starts_at from public.shifts where id = target_shift_id;
  score_penalty := case when shift_starts_at - now() < interval '24 hours' then 5 else 1 end;
  update public.worker_profiles
  set reliability_score = greatest(0, reliability_score - score_penalty), updated_at = now()
  where user_id = (select auth.uid());
  update public.shifts
  set status = 'published', urgent = true, audience = 'public',
      replacement_requested_at = now(), claimed_count = greatest(0, claimed_count - 1), updated_at = now()
  where id = target_shift_id;
end;
$$;

create or replace function public.request_shift_replacement(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_shift public.shifts%rowtype;
  active_count integer;
begin
  select * into selected_shift from public.shifts where id = target_shift_id for update;
  if selected_shift.id is null or not private.is_employer_member(selected_shift.employer_id) then
    raise exception 'Not authorized';
  end if;
  if not exists (
    select 1 from public.shift_assignments
    where shift_id = target_shift_id and status in ('cancelled', 'no_show')
  ) then raise exception 'No cancelled assignment'; end if;

  select count(*) into active_count from public.shift_assignments
  where shift_id = target_shift_id and status in ('claimed', 'checked_in', 'completed');
  if active_count >= selected_shift.workers_needed then raise exception 'No open replacement position'; end if;

  update public.shifts
  set status = 'published', urgent = true, audience = 'public',
      replacement_requested_at = now(), updated_at = now()
  where id = target_shift_id;
end;
$$;

-- Employers can cancel a future shift. Worker reliability is not changed.
create or replace function public.cancel_shift(target_shift_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_shift public.shifts%rowtype;
  affected_workers integer;
begin
  select * into selected_shift from public.shifts where id = target_shift_id for update;
  if selected_shift.id is null or not private.is_employer_member(selected_shift.employer_id) then
    raise exception 'Not authorized';
  end if;
  if selected_shift.status not in ('published', 'filled') or selected_shift.starts_at <= now() then
    raise exception 'Shift cannot be cancelled';
  end if;

  update public.shift_assignments
  set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = 'Poslodavac je otkazao smjenu', updated_at = now()
  where shift_id = target_shift_id and status = 'claimed';
  get diagnostics affected_workers = row_count;

  update public.shifts
  set status = 'cancelled', claimed_count = 0, updated_at = now()
  where id = target_shift_id;

  return affected_workers;
end;
$$;

-- A no-show can only be recorded after the scheduled start. If time remains,
-- the empty place immediately becomes a public replacement request.
create or replace function public.mark_assignment_no_show(target_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_assignment public.shift_assignments%rowtype;
  selected_shift public.shifts%rowtype;
  finalized_count integer;
  completed_count integer;
  remaining_active integer;
begin
  select * into selected_assignment
  from public.shift_assignments
  where id = target_assignment_id
  for update;

  if selected_assignment.id is null or selected_assignment.status <> 'claimed' then
    raise exception 'Assignment cannot be marked no show';
  end if;

  select * into selected_shift from public.shifts where id = selected_assignment.shift_id for update;
  if selected_shift.id is null or not private.is_employer_member(selected_shift.employer_id) then
    raise exception 'Not authorized';
  end if;
  if now() < selected_shift.starts_at then raise exception 'No show is not available yet'; end if;

  update public.shift_assignments
  set status = 'no_show', cancellation_reason = 'Poslodavac je evidentirao nedolazak',
      cancelled_at = now(), updated_at = now()
  where id = selected_assignment.id;

  select
    count(*) filter (where status in ('completed', 'no_show')),
    count(*) filter (where status = 'completed')
  into finalized_count, completed_count
  from public.shift_assignments
  where worker_id = selected_assignment.worker_id;

  update public.worker_profiles
  set reliability_score = greatest(0, reliability_score - 10),
      attendance_percent = case
        when finalized_count = 0 then 100
        else round(completed_count::numeric * 100 / finalized_count)::smallint
      end,
      updated_at = now()
  where user_id = selected_assignment.worker_id;

  select count(*) into remaining_active
  from public.shift_assignments
  where shift_id = selected_shift.id and status in ('claimed', 'checked_in');

  update public.shifts
  set claimed_count = (
        select count(*) from public.shift_assignments
        where shift_id = selected_shift.id and status in ('claimed', 'checked_in', 'completed')
      ),
      status = case when ends_at > now() then 'published'::public.shift_status else 'completed'::public.shift_status end,
      urgent = ends_at > now(),
      audience = case when ends_at > now() then 'public'::public.shift_audience else audience end,
      replacement_requested_at = case when ends_at > now() then now() else replacement_requested_at end,
      updated_at = now()
  where id = selected_shift.id;

  if selected_shift.status <> 'completed' and selected_shift.ends_at <= now() and remaining_active = 0 then
    update public.employers
    set completed_shifts = completed_shifts + 1, updated_at = now()
    where id = selected_shift.employer_id;
  end if;

  return selected_shift.id;
end;
$$;

-- Keep attendance derived from real completed/no-show assignment rows.
create or replace function public.check_out_assignment(target_assignment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_assignment public.shift_assignments%rowtype;
  selected_employer_id uuid;
  shift_ends_at timestamptz;
  finalized_count integer;
  completed_count integer;
begin
  select shift.ends_at into shift_ends_at
  from public.shift_assignments assignment
  join public.shifts shift on shift.id = assignment.shift_id
  where assignment.id = target_assignment_id
    and assignment.worker_id = (select auth.uid())
    and assignment.status = 'checked_in';

  if shift_ends_at is null then raise exception 'Assignment cannot be completed'; end if;
  if now() < shift_ends_at - interval '30 minutes' then raise exception 'Check-out is not available yet'; end if;

  update public.shift_assignments
  set status = 'completed', checked_out_at = now(), updated_at = now()
  where id = target_assignment_id
    and worker_id = (select auth.uid())
    and status = 'checked_in'
  returning * into selected_assignment;

  if selected_assignment.id is null then raise exception 'Assignment cannot be completed'; end if;

  select employer_id into selected_employer_id from public.shifts where id = selected_assignment.shift_id;

  insert into public.payment_ledger (assignment_id, employer_id, worker_id, amount_cents)
  values (selected_assignment.id, selected_employer_id, selected_assignment.worker_id, selected_assignment.pay_cents)
  on conflict (assignment_id) do nothing;

  select
    count(*) filter (where status in ('completed', 'no_show')),
    count(*) filter (where status = 'completed')
  into finalized_count, completed_count
  from public.shift_assignments
  where worker_id = selected_assignment.worker_id;

  update public.worker_profiles
  set completed_shifts = completed_count,
      attendance_percent = case
        when finalized_count = 0 then 100
        else round(completed_count::numeric * 100 / finalized_count)::smallint
      end,
      reliability_score = least(100, reliability_score + 1),
      premium_unlocked = premium_unlocked or reliability_score + 1 >= 97,
      updated_at = now()
  where user_id = selected_assignment.worker_id;

  if not exists (
    select 1 from public.shift_assignments
    where shift_id = selected_assignment.shift_id and status in ('claimed', 'checked_in')
  ) then
    update public.shifts set status = 'completed', updated_at = now() where id = selected_assignment.shift_id;
    update public.employers set completed_shifts = completed_shifts + 1, updated_at = now() where id = selected_employer_id;
  end if;

  return selected_assignment.pay_cents;
end;
$$;

-- Worker checkout records a claim. The employer separately authorizes that
-- obligation; neither state represents a bank transfer.
create or replace function public.authorize_assignment_payment(target_assignment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_ledger public.payment_ledger%rowtype;
begin
  select ledger.* into selected_ledger
  from public.payment_ledger ledger
  join public.shift_assignments assignment on assignment.id = ledger.assignment_id
  where ledger.assignment_id = target_assignment_id
    and assignment.status = 'completed'
  for update of ledger;

  if selected_ledger.id is null
    or not private.is_employer_member(selected_ledger.employer_id) then
    raise exception 'Not authorized';
  end if;
  if selected_ledger.status not in ('pending', 'authorized', 'paid') then
    raise exception 'Payment cannot be authorized';
  end if;

  if selected_ledger.status = 'pending' then
    update public.payment_ledger
    set status = 'authorized', updated_at = now()
    where id = selected_ledger.id;
  end if;

  return selected_ledger.amount_cents;
end;
$$;

-- Remove superseded mutation surfaces and expose only the audited operations.
revoke all on function public.create_shift(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, boolean, public.shift_audience) from anon, authenticated;
revoke all on function public.create_shift_with_details(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) from anon, authenticated;
revoke all on function public.request_shift_replacement(uuid) from anon, authenticated;
revoke all on function public.publish_shift(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) from public, anon;
revoke all on function public.cancel_shift(uuid) from public, anon;
revoke all on function public.mark_assignment_no_show(uuid) from public, anon;
revoke all on function public.authorize_assignment_payment(uuid) from public, anon;
grant execute on function public.publish_shift(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) to authenticated;
grant execute on function public.cancel_shift(uuid) to authenticated;
grant execute on function public.mark_assignment_no_show(uuid) to authenticated;
grant execute on function public.authorize_assignment_payment(uuid) to authenticated;

-- Supabase's automatic-RLS event-trigger helper should never be callable over
-- the Data API. Some projects do not have it, so keep this migration portable.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
