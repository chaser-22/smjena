-- A confirmed emergency shift must have a real, private contact path. Contact
-- data is separated from profiles so RLS can expire access with an assignment.

create table public.worker_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null check (phone ~ '^\+382[0-9]{8}$'),
  updated_at timestamptz not null default now()
);

create table public.employer_contacts (
  employer_id uuid primary key references public.employers (id) on delete cascade,
  phone text not null check (phone ~ '^\+382[0-9]{8}$'),
  updated_at timestamptz not null default now()
);

insert into public.worker_contacts (user_id, phone)
select id, phone from public.profiles
where role = 'worker' and phone ~ '^\+382[0-9]{8}$'
on conflict (user_id) do nothing;

insert into public.employer_contacts (employer_id, phone)
select employer.id, profile.phone
from public.employers employer
join public.profiles profile on profile.id = employer.owner_id
where profile.phone ~ '^\+382[0-9]{8}$'
on conflict (employer_id) do nothing;

alter table public.worker_contacts enable row level security;
alter table public.employer_contacts enable row level security;

revoke all on public.worker_contacts, public.employer_contacts from public, anon, authenticated;
grant select on public.worker_contacts, public.employer_contacts to authenticated;
grant insert (user_id, phone, updated_at) on public.worker_contacts to authenticated;
grant update (phone, updated_at) on public.worker_contacts to authenticated;
grant insert (employer_id, phone, updated_at) on public.employer_contacts to authenticated;
grant update (phone, updated_at) on public.employer_contacts to authenticated;

-- Remove browser access to the legacy mixed-purpose phone column. Its values
-- remain stored temporarily so this migration is recoverable during rollout.
revoke select on public.profiles from authenticated;
grant select (id, role, full_name, city, avatar_url, verified_at, created_at, updated_at) on public.profiles to authenticated;
revoke update (phone) on public.profiles from authenticated;

create policy worker_contacts_select_authorized on public.worker_contacts
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    join public.employer_members member on member.employer_id = shift.employer_id
    where assignment.worker_id = worker_contacts.user_id
      and assignment.status in ('claimed', 'checked_in')
      and member.user_id = (select auth.uid())
  )
);

create policy worker_contacts_insert_own on public.worker_contacts
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'worker'
  )
);

create policy worker_contacts_update_own on public.worker_contacts
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy employer_contacts_select_authorized on public.employer_contacts
for select to authenticated using (
  (select private.is_employer_member(employer_id))
  or exists (
    select 1
    from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    where assignment.worker_id = (select auth.uid())
      and assignment.status in ('claimed', 'checked_in')
      and shift.employer_id = employer_contacts.employer_id
  )
);

create policy employer_contacts_insert_members on public.employer_contacts
for insert to authenticated with check ((select private.is_employer_member(employer_id)));

create policy employer_contacts_update_members on public.employer_contacts
for update to authenticated
using ((select private.is_employer_member(employer_id)))
with check ((select private.is_employer_member(employer_id)));

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
  if not exists (
    select 1 from public.employer_contacts
    where employer_id = target_employer_id
  ) then raise exception 'Contact phone is required'; end if;
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
    select 1 from public.worker_contacts
    where user_id = (select auth.uid())
  ) then raise exception 'Contact phone is required'; end if;
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
  if not exists (
    select 1 from public.employer_contacts
    where employer_id = selected_shift.employer_id
  ) then raise exception 'Employer contact phone is required'; end if;

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

revoke all on function public.publish_shift(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) from public, anon;
revoke all on function public.claim_shift(uuid) from public, anon;
grant execute on function public.publish_shift(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) to authenticated;
grant execute on function public.claim_shift(uuid) to authenticated;
