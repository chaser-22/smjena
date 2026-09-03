-- SMJENA production marketplace schema.
-- Apply with `supabase db push` or paste into the Supabase SQL editor once.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.app_role as enum ('worker', 'employer', 'admin');
create type public.shift_status as enum ('draft', 'published', 'filled', 'in_progress', 'completed', 'cancelled');
create type public.shift_audience as enum ('crew', 'public');
create type public.assignment_status as enum ('claimed', 'checked_in', 'completed', 'cancelled', 'no_show');
create type public.ledger_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text,
  city text not null default 'Budva',
  avatar_url text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.worker_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reliability_score smallint not null default 80 check (reliability_score between 0 and 100),
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_shifts integer not null default 0 check (completed_shifts >= 0),
  attendance_percent smallint not null default 100 check (attendance_percent between 0 and 100),
  available boolean not null default true,
  notifications_enabled boolean not null default false,
  radius_km smallint not null default 20 check (radius_km between 1 and 200),
  premium_unlocked boolean not null default false,
  skills text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  legal_name text,
  tax_id text,
  city text not null default 'Budva',
  address text,
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_shifts integer not null default 0 check (completed_shifts >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_members (
  employer_id uuid not null references public.employers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (employer_id, user_id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  role text not null check (char_length(role) between 2 and 80),
  city text not null check (char_length(city) between 2 and 80),
  area text not null check (char_length(area) between 2 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pay_cents integer not null check (pay_cents between 2000 and 500000),
  base_pay_cents integer not null check (base_pay_cents between 0 and 500000),
  bonus_cents integer not null default 0 check (bonus_cents between 0 and 500000),
  workers_needed smallint not null check (workers_needed between 1 and 50),
  claimed_count smallint not null default 0 check (claimed_count >= 0 and claimed_count <= workers_needed),
  urgent boolean not null default false,
  tips_expected boolean not null default false,
  audience public.shift_audience not null default 'public',
  requirements text[] not null default '{}',
  status public.shift_status not null default 'draft',
  notified_count integer not null default 0 check (notified_count >= 0),
  viewer_count integer not null default 0 check (viewer_count >= 0),
  published_at timestamptz,
  filled_at timestamptz,
  replacement_of uuid references public.shifts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  check (pay_cents = base_pay_cents + bonus_cents)
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete restrict,
  status public.assignment_status not null default 'claimed',
  pay_cents integer not null check (pay_cents >= 0),
  claimed_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index shift_assignments_active_worker_shift_idx
  on public.shift_assignments (shift_id, worker_id)
  where status in ('claimed', 'checked_in', 'completed');

create table public.trusted_workers (
  employer_id uuid not null references public.employers (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employer_id, worker_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.shift_assignments (id) on delete cascade,
  employer_id uuid not null references public.employers (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  score smallint not null check (score between 1 and 5),
  want_again boolean not null default false,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.shift_assignments (id) on delete restrict,
  employer_id uuid not null references public.employers (id) on delete restrict,
  worker_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'EUR' check (currency = 'EUR'),
  status public.ledger_status not null default 'pending',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- The base employer table contains legal and tax fields and is only readable by
-- members of that employer. This deliberately narrow view is the marketplace
-- identity that authenticated workers can read.
create view public.employer_marketplace_profiles
with (security_barrier = true)
as
select id, name, city, average_rating, rating_count, completed_shifts, verified_at
from public.employers;

create index profiles_role_idx on public.profiles (role);
create index worker_profiles_available_idx on public.worker_profiles (available) where available;
create index employers_owner_id_idx on public.employers (owner_id);
create index employer_members_user_id_idx on public.employer_members (user_id);
create index shifts_employer_id_idx on public.shifts (employer_id);
create index shifts_feed_idx on public.shifts (status, city, starts_at) where status = 'published';
create index shift_assignments_worker_id_idx on public.shift_assignments (worker_id);
create index shift_assignments_shift_status_idx on public.shift_assignments (shift_id, status);
create index trusted_workers_worker_id_idx on public.trusted_workers (worker_id);
create index payment_ledger_worker_id_idx on public.payment_ledger (worker_id);

create or replace function private.is_employer_member(target_employer_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.employer_members
    where employer_id = target_employer_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_profile(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    target_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.shift_assignments assignment
      join public.shifts shift on shift.id = assignment.shift_id
      join public.employer_members member on member.employer_id = shift.employer_id
      where assignment.worker_id = target_profile_id
        and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.has_assignment_for_shift(target_shift_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.shift_assignments
    where shift_id = target_shift_id and worker_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_assignment(target_shift_id uuid, target_worker_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    target_worker_id = (select auth.uid())
    or exists (
      select 1
      from public.shifts shift
      join public.employer_members member on member.employer_id = shift.employer_id
      where shift.id = target_shift_id and member.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_rate_assignment(target_assignment_id uuid, target_employer_id uuid, target_worker_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    join public.employer_members member on member.employer_id = shift.employer_id
    where assignment.id = target_assignment_id
      and assignment.worker_id = target_worker_id
      and assignment.status = 'completed'
      and shift.employer_id = target_employer_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.app_role;
  new_employer_id uuid;
  company_name text;
begin
  selected_role := case
    when new.raw_user_meta_data ->> 'role' = 'employer' then 'employer'::public.app_role
    else 'worker'::public.app_role
  end;

  insert into public.profiles (id, role, full_name, city)
  values (
    new.id,
    selected_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 'Budva')
  );

  if selected_role = 'worker' then
    insert into public.worker_profiles (user_id) values (new.id);
  else
    company_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''), 'Novi poslodavac');
    insert into public.employers (owner_id, name, city)
    values (new.id, company_name, coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 'Budva'))
    returning id into new_employer_id;

    insert into public.employer_members (employer_id, user_id, member_role)
    values (new_employer_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_shift(
  target_employer_id uuid,
  shift_role text,
  shift_area text,
  shift_starts_at timestamptz,
  shift_ends_at timestamptz,
  shift_pay_cents integer,
  shift_bonus_cents integer,
  shift_workers_needed smallint,
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
begin
  if not private.is_employer_member(target_employer_id) then raise exception 'Not authorized'; end if;
  if char_length(trim(shift_role)) not between 2 and 80 then raise exception 'Invalid role'; end if;
  if char_length(trim(shift_area)) not between 2 and 200 then raise exception 'Invalid area'; end if;
  if shift_starts_at <= now() then raise exception 'Shift must start in the future'; end if;
  if shift_ends_at <= shift_starts_at or shift_ends_at > shift_starts_at + interval '24 hours' then raise exception 'Invalid shift duration'; end if;
  if shift_pay_cents not between 2000 and 500000 then raise exception 'Invalid pay'; end if;
  if shift_bonus_cents < 0 or shift_bonus_cents > shift_pay_cents - 2000 then raise exception 'Invalid bonus'; end if;
  if shift_workers_needed not between 1 and 50 then raise exception 'Invalid worker count'; end if;

  select city into selected_city from public.employers where id = target_employer_id;
  if selected_city is null then raise exception 'Employer not found'; end if;

  insert into public.shifts (
    employer_id, created_by, role, city, area, starts_at, ends_at,
    pay_cents, base_pay_cents, bonus_cents, workers_needed, urgent,
    audience, status, published_at
  ) values (
    target_employer_id, (select auth.uid()), trim(shift_role), selected_city, trim(shift_area),
    shift_starts_at, shift_ends_at, shift_pay_cents, shift_pay_cents - shift_bonus_cents,
    shift_bonus_cents, shift_workers_needed, shift_urgent, shift_audience, 'published', now()
  ) returning id into new_shift_id;

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
    select 1 from public.worker_profiles
    where user_id = (select auth.uid()) and available
  ) then
    raise exception 'Worker is not available';
  end if;

  select * into selected_shift
  from public.shifts
  where id = target_shift_id
  for update;

  if selected_shift.id is null or selected_shift.status <> 'published' or selected_shift.starts_at <= now() then
    raise exception 'Shift is not available';
  end if;

  if exists (
    select 1
    from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    where assignment.worker_id = (select auth.uid())
      and assignment.status in ('claimed', 'checked_in')
      and tstzrange(shift.starts_at, shift.ends_at, '[)') && tstzrange(selected_shift.starts_at, selected_shift.ends_at, '[)')
  ) then
    raise exception 'Worker has an overlapping shift';
  end if;

  if selected_shift.audience = 'crew' and not exists (
    select 1 from public.trusted_workers
    where employer_id = selected_shift.employer_id and worker_id = (select auth.uid())
  ) then
    raise exception 'Shift is limited to the trusted crew';
  end if;

  select count(*) into active_count
  from public.shift_assignments
  where shift_id = target_shift_id and status in ('claimed', 'checked_in', 'completed');

  if active_count >= selected_shift.workers_needed then
    raise exception 'Shift is already full';
  end if;

  insert into public.shift_assignments (shift_id, worker_id, pay_cents)
  values (target_shift_id, (select auth.uid()), selected_shift.pay_cents)
  returning id into assignment_id;

  if active_count + 1 >= selected_shift.workers_needed then
    update public.shifts
    set status = 'filled', claimed_count = active_count + 1, filled_at = now(), updated_at = now()
    where id = target_shift_id;
  else
    update public.shifts set claimed_count = active_count + 1, updated_at = now() where id = target_shift_id;
  end if;

  return assignment_id;
end;
$$;

create or replace function public.check_in_assignment(target_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_shift_id uuid;
  shift_starts_at timestamptz;
  shift_ends_at timestamptz;
begin
  select shift.id, shift.starts_at, shift.ends_at
  into target_shift_id, shift_starts_at, shift_ends_at
  from public.shift_assignments assignment
  join public.shifts shift on shift.id = assignment.shift_id
  where assignment.id = target_assignment_id
    and assignment.worker_id = (select auth.uid())
    and assignment.status = 'claimed';

  if target_shift_id is null then raise exception 'Assignment cannot be checked in'; end if;
  if now() < shift_starts_at - interval '60 minutes' or now() > shift_ends_at then
    raise exception 'Check-in is outside the allowed time window';
  end if;

  update public.shift_assignments
  set status = 'checked_in', checked_in_at = now(), updated_at = now()
  where id = target_assignment_id
    and worker_id = (select auth.uid())
    and status = 'claimed'
  returning shift_id into target_shift_id;

  update public.shifts
  set status = 'in_progress', updated_at = now()
  where id = target_shift_id and status in ('published', 'filled');
end;
$$;

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
begin
  select shift.ends_at into shift_ends_at
  from public.shift_assignments assignment
  join public.shifts shift on shift.id = assignment.shift_id
  where assignment.id = target_assignment_id
    and assignment.worker_id = (select auth.uid())
    and assignment.status = 'checked_in';

  if shift_ends_at is null then raise exception 'Assignment cannot be completed'; end if;
  if now() < shift_ends_at - interval '30 minutes' then
    raise exception 'Check-out is not available yet';
  end if;

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

  update public.worker_profiles
  set completed_shifts = completed_shifts + 1,
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
  set status = 'published', urgent = true, claimed_count = greatest(0, claimed_count - 1), updated_at = now()
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

  select count(*) into active_count from public.shift_assignments
  where shift_id = target_shift_id and status in ('claimed', 'checked_in', 'completed');

  if active_count >= selected_shift.workers_needed then
    raise exception 'No open replacement position';
  end if;

  update public.shifts
  set status = 'published', urgent = true, audience = 'public', updated_at = now()
  where id = target_shift_id;
end;
$$;

create or replace function public.raise_shift_pay(target_shift_id uuid, increment_cents integer default 1000)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_employer_id uuid;
begin
  if increment_cents < 100 or increment_cents > 10000 then raise exception 'Invalid pay increment'; end if;
  select employer_id into selected_employer_id from public.shifts where id = target_shift_id and status = 'published' for update;
  if selected_employer_id is null or not private.is_employer_member(selected_employer_id) then raise exception 'Not authorized'; end if;
  update public.shifts
  set pay_cents = pay_cents + increment_cents,
      bonus_cents = bonus_cents + increment_cents,
      urgent = true,
      audience = 'public',
      updated_at = now()
  where id = target_shift_id;
end;
$$;

create or replace function public.broadcast_shift(target_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_employer_id uuid;
begin
  select employer_id into selected_employer_id from public.shifts where id = target_shift_id and status = 'published' for update;
  if selected_employer_id is null or not private.is_employer_member(selected_employer_id) then raise exception 'Not authorized'; end if;
  update public.shifts set audience = 'public', updated_at = now() where id = target_shift_id;
end;
$$;

create or replace function public.update_rating_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.worker_profiles
  set average_rating = (select round(avg(score)::numeric, 2) from public.ratings where worker_id = new.worker_id),
      rating_count = (select count(*) from public.ratings where worker_id = new.worker_id),
      updated_at = now()
  where user_id = new.worker_id;

  if new.want_again then
    insert into public.trusted_workers (employer_id, worker_id)
    values (new.employer_id, new.worker_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger ratings_update_worker_totals
  after insert or update on public.ratings
  for each row execute procedure public.update_rating_totals();

alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.employers enable row level security;
alter table public.employer_members enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.trusted_workers enable row level security;
alter table public.ratings enable row level security;
alter table public.payment_ledger enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, city, avatar_url, updated_at) on public.profiles to authenticated;
grant select on public.worker_profiles to authenticated;
grant update (available, notifications_enabled, radius_km, updated_at) on public.worker_profiles to authenticated;
grant select on public.employers to authenticated;
grant update (name, legal_name, tax_id, city, address, updated_at) on public.employers to authenticated;
revoke all on public.employer_marketplace_profiles from anon, authenticated;
grant select on public.employer_marketplace_profiles to authenticated;
grant select on public.employer_members to authenticated;
grant select on public.shifts to authenticated;
grant select on public.shift_assignments to authenticated;
grant select on public.trusted_workers to authenticated;
grant select, insert on public.ratings to authenticated;
grant update (score, want_again, note) on public.ratings to authenticated;
grant select on public.payment_ledger to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy profiles_select_authorized on public.profiles for select to authenticated
  using (private.can_view_profile(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy worker_profiles_select_authorized on public.worker_profiles for select to authenticated
  using (private.can_view_profile(user_id));
create policy worker_profiles_update_own on public.worker_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy employers_select_members on public.employers for select to authenticated
  using (private.is_employer_member(id));
create policy employers_update_members on public.employers for update to authenticated
  using (private.is_employer_member(id)) with check (private.is_employer_member(id));

create policy employer_members_select_own on public.employer_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_employer_member(employer_id));

create policy shifts_select_authorized on public.shifts for select to authenticated
  using (
    private.is_employer_member(employer_id)
    or private.has_assignment_for_shift(id)
    or (
      status = 'published'
      and (
        audience = 'public'
        or exists (select 1 from public.trusted_workers where employer_id = shifts.employer_id and worker_id = (select auth.uid()))
      )
    )
  );
create policy assignments_select_authorized on public.shift_assignments for select to authenticated
  using (private.can_view_assignment(shift_id, worker_id));

create policy trusted_workers_select_authorized on public.trusted_workers for select to authenticated
  using (worker_id = (select auth.uid()) or private.is_employer_member(employer_id));
create policy ratings_select_authorized on public.ratings for select to authenticated
  using (worker_id = (select auth.uid()) or private.is_employer_member(employer_id));
create policy ratings_insert_members on public.ratings for insert to authenticated
  with check (created_by = (select auth.uid()) and private.can_rate_assignment(assignment_id, employer_id, worker_id));
create policy ratings_update_members on public.ratings for update to authenticated
  using (private.can_rate_assignment(assignment_id, employer_id, worker_id))
  with check (created_by = (select auth.uid()) and private.can_rate_assignment(assignment_id, employer_id, worker_id));

create policy ledger_select_authorized on public.payment_ledger for select to authenticated
  using (worker_id = (select auth.uid()) or private.is_employer_member(employer_id));

create policy push_select_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_update_own on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

revoke all on function public.claim_shift(uuid) from public;
revoke all on function public.create_shift(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, boolean, public.shift_audience) from public;
revoke all on function public.check_in_assignment(uuid) from public;
revoke all on function public.check_out_assignment(uuid) from public;
revoke all on function public.cancel_assignment(uuid, text) from public;
revoke all on function public.request_shift_replacement(uuid) from public;
revoke all on function public.raise_shift_pay(uuid, integer) from public;
revoke all on function public.broadcast_shift(uuid) from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.update_rating_totals() from public;
revoke all on function private.is_employer_member(uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;
revoke all on function private.has_assignment_for_shift(uuid) from public;
revoke all on function private.can_view_assignment(uuid, uuid) from public;
revoke all on function private.can_rate_assignment(uuid, uuid, uuid) from public;
grant execute on function public.claim_shift(uuid) to authenticated;
grant execute on function public.create_shift(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, boolean, public.shift_audience) to authenticated;
grant execute on function public.check_in_assignment(uuid) to authenticated;
grant execute on function public.check_out_assignment(uuid) to authenticated;
grant execute on function public.cancel_assignment(uuid, text) to authenticated;
grant execute on function public.request_shift_replacement(uuid) to authenticated;
grant execute on function public.raise_shift_pay(uuid, integer) to authenticated;
grant execute on function public.broadcast_shift(uuid) to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_employer_member(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.has_assignment_for_shift(uuid) to authenticated;
grant execute on function private.can_view_assignment(uuid, uuid) to authenticated;
grant execute on function private.can_rate_assignment(uuid, uuid, uuid) to authenticated;

alter table public.shifts replica identity full;
alter table public.shift_assignments replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shifts') then
    alter publication supabase_realtime add table public.shifts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_assignments') then
    alter publication supabase_realtime add table public.shift_assignments;
  end if;
end;
$$;
