-- Phase 2. Capability onboarding is independent of the historical role column.
-- No existing profile, membership, claim or public listing is manufactured.
comment on column public.profiles.role is
  'Legacy onboarding preference, not worker/employer authorization. Admin is not self-service.';

alter table public.employers add column onboarding_request_id uuid;
create unique index employers_onboarding_request_idx
  on public.employers (owner_id, onboarding_request_id) where onboarding_request_id is not null;

create function private.enable_worker_profile()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Account profile not found'; end if;
  insert into public.worker_profiles (user_id, available) values (auth.uid(), false)
  on conflict (user_id) do nothing;
end;
$$;

create function public.enable_worker_profile()
returns void language sql security invoker set search_path = '' as $$
  select private.enable_worker_profile();
$$;

create function private.create_employer_workspace(request_id uuid, workspace_name text, workspace_city text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  -- Serializes retries and the per-account abuse limit, without trusting metadata.
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Account profile not found'; end if;
  if request_id is null then raise exception 'Missing request id'; end if;
  select id into result_id from public.employers
    where owner_id = auth.uid() and onboarding_request_id = request_id;
  if result_id is not null then
    if not private.is_employer_member(result_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
    return result_id;
  end if;
  if workspace_name is null or char_length(trim(workspace_name)) not between 2 and 120
     or workspace_city is null or char_length(trim(workspace_city)) not between 2 and 80 then
    raise exception 'Invalid workspace details';
  end if;
  if (select count(*) from public.employers where owner_id = auth.uid()
      and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Workspace creation rate limit reached';
  end if;
  insert into public.employers (owner_id, name, city, onboarding_request_id)
    values (auth.uid(), trim(workspace_name), trim(workspace_city), request_id) returning id into result_id;
  insert into public.employer_members (employer_id, user_id, member_role)
    values (result_id, auth.uid(), 'owner');
  return result_id;
end;
$$;

create function public.create_employer_workspace(request_id uuid, workspace_name text, workspace_city text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_employer_workspace(request_id, workspace_name, workspace_city);
$$;

revoke all on function private.enable_worker_profile(), public.enable_worker_profile(),
  private.create_employer_workspace(uuid,text,text), public.create_employer_workspace(uuid,text,text)
  from public, anon, authenticated;
grant execute on function private.enable_worker_profile(), public.enable_worker_profile(),
  private.create_employer_workspace(uuid,text,text), public.create_employer_workspace(uuid,text,text)
  to authenticated;

drop policy worker_contacts_insert_own on public.worker_contacts;
create policy worker_contacts_insert_own on public.worker_contacts for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.worker_profiles where user_id = (select auth.uid())
));

-- Defence in depth: the legacy feed cannot expose future application locations.
create policy shifts_model_read_boundary on public.shifts as restrictive for select to authenticated
using (marketplace_model = 'legacy_claim' or private.is_employer_member(employer_id));

create function private.has_legacy_contact(target_employer uuid, target_worker uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and (auth.uid() = target_worker or private.is_employer_member(target_employer))
    and exists (
      select 1 from public.shift_assignments assignment
      join public.shifts shift on shift.id = assignment.shift_id
      where shift.employer_id = target_employer and assignment.worker_id = target_worker
        and shift.marketplace_model = 'legacy_claim' and assignment.status in ('claimed', 'checked_in')
    );
$$;
revoke all on function private.has_legacy_contact(uuid,uuid) from public, anon, authenticated;
grant execute on function private.has_legacy_contact(uuid,uuid) to authenticated;

drop policy worker_contacts_select_authorized on public.worker_contacts;
create policy worker_contacts_select_authorized on public.worker_contacts for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.employer_members member where member.user_id = (select auth.uid())
    and private.has_legacy_contact(member.employer_id, worker_contacts.user_id)
));
drop policy employer_contacts_select_authorized on public.employer_contacts;
create policy employer_contacts_select_authorized on public.employer_contacts for select to authenticated
using (private.is_employer_member(employer_id) or private.has_legacy_contact(employer_id, (select auth.uid())));

create table public.shift_locations (
  shift_id uuid primary key references public.shifts(id) on delete cascade,
  exact_address text not null check (char_length(exact_address) between 2 and 200),
  updated_at timestamptz not null default now()
);
alter table public.shift_locations enable row level security;
revoke all on public.shift_locations from public, anon, authenticated;
grant select on public.shift_locations to authenticated;
create policy shift_locations_select_authorized on public.shift_locations for select to authenticated
using (exists (select 1 from public.shifts shift where shift.id = shift_locations.shift_id
  and (private.is_employer_member(shift.employer_id)
    or (shift.marketplace_model = 'legacy_claim'
      and exists (select 1 from public.shift_assignments assignment
        where assignment.shift_id = shift.id and assignment.worker_id = (select auth.uid())
          and assignment.status in ('claimed', 'checked_in'))))));

insert into public.shift_locations (shift_id, exact_address, updated_at)
select id, area, updated_at from public.shifts where marketplace_model = 'legacy_claim';

create function private.sync_legacy_shift_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.marketplace_model = 'legacy_claim' then
    insert into public.shift_locations (shift_id, exact_address, updated_at)
      values (new.id, new.area, new.updated_at)
    on conflict (shift_id) do update set exact_address = excluded.exact_address, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_legacy_shift_location() from public, anon, authenticated;
create trigger sync_legacy_shift_location after insert or update of area on public.shifts
for each row execute function private.sync_legacy_shift_location();

-- A curated projection, NOT a view over private shifts. Empty at migration.
-- Only the future publication transaction may populate it after public-copy
-- approval. Never backfill role/name/requirements/area from legacy free text.
create table public.public_shift_listings (
  shift_id uuid primary key references public.shifts(id) on delete cascade,
  role text not null check (char_length(role) between 2 and 80),
  employer_name text not null check (char_length(employer_name) between 2 and 120),
  city text not null check (char_length(city) between 2 and 80),
  location_area text not null check (char_length(location_area) between 2 and 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  pay_cents integer not null check (pay_cents > 0),
  workers_needed smallint not null check (workers_needed between 1 and 50),
  requirements text[] not null default '{}' check (cardinality(requirements) <= 8),
  source_updated_at timestamptz not null,
  approved_at timestamptz not null
);
create index public_shift_listings_feed_idx on public.public_shift_listings (city, starts_at, shift_id);
alter table public.public_shift_listings enable row level security;
revoke all on public.public_shift_listings from public, anon, authenticated;
grant select on public.public_shift_listings to anon, authenticated;

-- Public boolean eligibility only. No auth check is intentional: anonymous
-- browsing is the feature. Definer access avoids exposing the private base table.
create function private.is_public_listing_current(target_shift uuid, source_version timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shifts where id = target_shift
    and marketplace_model = 'application_v1' and status = 'published'
    and audience = 'public' and starts_at > now() and updated_at = source_version);
$$;
revoke all on function private.is_public_listing_current(uuid,timestamptz) from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.is_public_listing_current(uuid,timestamptz) to anon, authenticated;
create policy public_shift_listings_select_current on public.public_shift_listings
for select to anon, authenticated using (approved_at <= now()
  and private.is_public_listing_current(shift_id, source_updated_at));

-- No application writes, acceptance or new contact entitlement is enabled here.

-- Preserve the legacy flow for dual-capability accounts, with a worker lock
-- before the shift lock so simultaneous cross-shift claims cannot evade overlap.
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
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.worker_profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Worker profile is required'; end if;
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
