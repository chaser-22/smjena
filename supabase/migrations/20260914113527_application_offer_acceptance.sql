-- Phase 3: isolated pilot only. No production workspace is enabled by migration.
create table private.application_pilot_workspaces (
  employer_id uuid primary key references public.employers(id) on delete cascade,
  enabled boolean not null default false
);
alter table private.application_pilot_workspaces enable row level security;
revoke all on private.application_pilot_workspaces from public, anon, authenticated;

create function private.application_pilot_enabled(target_employer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from private.application_pilot_workspaces
    where employer_id=target_employer and enabled);
$$;
revoke all on function private.application_pilot_enabled(uuid) from public, anon, authenticated;
grant execute on function private.application_pilot_enabled(uuid) to authenticated;

-- Immutable application source rows cannot be changed by old boost/cancel RPCs.
-- Their operational state lives in application_posts, never legacy counters.
create or replace function private.guard_shift_marketplace_model()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP='UPDATE' and new.marketplace_model is distinct from old.marketplace_model then
    raise exception 'Shift marketplace model is immutable' using errcode='23514';
  end if;
  if TG_OP='DELETE' then
    if old.marketplace_model<>'legacy_claim' then raise exception 'Application source is immutable'; end if;
    return old;
  end if;
  if new.marketplace_model<>'legacy_claim' and (TG_OP<>'INSERT' or not private.application_pilot_enabled(new.employer_id)) then
    raise exception 'Application marketplace is not enabled' using errcode='23514';
  end if;
  return new;
end;
$$;

create table public.application_posts (
  shift_id uuid primary key references public.shifts(id) on delete restrict,
  employer_id uuid not null references public.employers(id) on delete restrict,
  status text not null default 'open' check(status in ('open','cancelled')),
  role text not null,
  employer_name text not null,
  city text not null,
  location_area text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pay_cents integer not null,
  workers_needed smallint not null,
  requirements text[] not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index application_posts_employer_idx on public.application_posts(employer_id,created_at desc);
create table public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(user_id) on delete restrict,
  worker_name text not null,
  status text not null default 'applied' check(status in ('applied','offered','accepted','declined','withdrawn','expired','rejected','cancelled')),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shift_id,worker_id),
  check (status not in ('offered','accepted') or (offered_at is not null and offer_expires_at is not null)),
  check (status<>'accepted' or accepted_at is not null)
);
create index shift_applications_worker_idx on public.shift_applications(worker_id,created_at desc);
create index shift_applications_capacity_idx on public.shift_applications(shift_id,status,offer_expires_at);
create table private.application_events (
  id bigint generated always as identity primary key,
  application_id uuid references public.shift_applications(id) on delete restrict,
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event text not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index application_events_application_idx on private.application_events(application_id);
create index application_events_shift_idx on private.application_events(shift_id);
create index application_events_actor_idx on private.application_events(actor_id);
alter table private.application_events enable row level security;
revoke all on private.application_events from public, anon, authenticated;
alter table public.application_posts enable row level security;
alter table public.shift_applications enable row level security;
revoke all on public.application_posts, public.shift_applications from public, anon, authenticated;
grant select on public.application_posts, public.shift_applications to authenticated;

create function private.is_application_employer(target_shift uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.application_posts p
    where p.shift_id=target_shift and private.is_employer_member(p.employer_id));
$$;
create function private.is_application_worker(target_shift uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.shift_applications a
    where a.shift_id=target_shift and a.worker_id=auth.uid());
$$;
revoke all on function private.is_application_employer(uuid), private.is_application_worker(uuid) from public, anon, authenticated;
grant execute on function private.is_application_employer(uuid), private.is_application_worker(uuid) to authenticated;
create policy application_posts_participants on public.application_posts for select to authenticated
using(private.is_employer_member(employer_id) or private.is_application_worker(shift_id));
create policy applications_participants on public.shift_applications for select to authenticated
using(worker_id=(select auth.uid()) or private.is_application_employer(shift_id));

-- Effective expiry is evaluated on every read, not dependent on a scheduler.
create view public.application_inbox with (security_invoker=true) as
select a.*, case when a.status in ('applied','offered') and
  (p.starts_at<=now() or (a.status='offered' and a.offer_expires_at<=now())) then 'expired'
  else a.status end as effective_status
from public.shift_applications a join public.application_posts p on p.shift_id=a.shift_id;
revoke all on public.application_inbox from public,anon,authenticated;
grant select on public.application_inbox to authenticated;

create or replace function private.is_public_listing_current(target_shift uuid, source_version timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.shifts s join public.application_posts p on p.shift_id=s.id
    join private.application_pilot_workspaces pilot on pilot.employer_id=p.employer_id and pilot.enabled
    where s.id=target_shift and s.marketplace_model='application_v1' and s.status='published'
      and s.audience='public' and s.updated_at=source_version and p.status='open' and p.starts_at>now());
$$;

create function private.publish_application_shift(target_employer uuid, request_key uuid,
  public_name text, job_role text, location_area text, exact_address text,
  starts_at timestamptz, ends_at timestamptz, pay_cents integer, places smallint,
  requirements text[], public_copy_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare result_id uuid; business public.employers%rowtype;
begin
  if auth.uid() is null or not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  -- Membership and workspace creation/publishing serialize on the business row.
  select * into business from public.employers where id=target_employer for update;
  if not private.application_pilot_enabled(target_employer) then raise exception 'Pilot not enabled'; end if;
  select id into result_id from public.shifts where employer_id=target_employer and request_id=request_key;
  if result_id is not null then
    if not exists(select 1 from public.application_posts where shift_id=result_id) then raise exception 'Request belongs to legacy shift'; end if;
    return result_id;
  end if;
  if request_key is null or public_copy_confirmed is distinct from true
    or public_name is null or char_length(trim(public_name)) not between 2 and 120
    or public_name ~* '(@|https?://|www\.|[0-9][0-9 ()+.-]{5,}[0-9])'
    or job_role is null or job_role not in ('Konobar','Šanker','Kuvar','Pomoćni radnik','Recepcioner','Sobarica')
    or location_area is null or location_area not in ('Centar','Stari grad','Obala','Širi centar','Drugi dio grada')
    or exact_address is null or char_length(trim(exact_address)) not between 2 and 200
    or starts_at is null or starts_at<=clock_timestamp() or starts_at>clock_timestamp()+interval '90 days'
    or ends_at is null or ends_at<=starts_at or ends_at>starts_at+interval '24 hours'
    or pay_cents is null or pay_cents not between 2000 and 500000 or places is null or places not between 1 and 50
    or requirements is null or cardinality(requirements)>8 or array_position(requirements,null) is not null
    or not requirements <@ array['Iskustvo u ugostiteljstvu','Rad sa POS kasom','Engleski jezik','Crna košulja','Bijela košulja','Zatvorena obuća']::text[] then
    raise exception 'Invalid public shift details';
  end if;
  if not exists(select 1 from public.employer_contacts where employer_id=target_employer) then raise exception 'Employer contact phone is required'; end if;
  if (select count(*) from public.application_posts where employer_id=target_employer and created_at>now()-interval '24 hours')>=20 then raise exception 'Posting rate limit'; end if;
  insert into public.shifts(employer_id,created_by,request_id,role,city,area,starts_at,ends_at,pay_cents,base_pay_cents,
    workers_needed,requirements,status,published_at,marketplace_model)
  values(target_employer,auth.uid(),request_key,job_role,business.city,location_area,starts_at,ends_at,pay_cents,pay_cents,
    places,requirements,'published',now(),'application_v1') returning id into result_id;
  insert into public.application_posts(shift_id,employer_id,role,employer_name,city,location_area,starts_at,ends_at,pay_cents,workers_needed,requirements)
    values(result_id,target_employer,job_role,trim(public_name),business.city,location_area,starts_at,ends_at,pay_cents,places,requirements);
  insert into public.shift_locations(shift_id,exact_address) values(result_id,trim(exact_address));
  insert into public.public_shift_listings(shift_id,role,employer_name,city,location_area,starts_at,ends_at,pay_cents,workers_needed,requirements,source_updated_at,approved_at)
    select result_id,job_role,trim(public_name),business.city,location_area,starts_at,ends_at,pay_cents,places,requirements,s.updated_at,now()
    from public.shifts s where s.id=result_id;
  insert into private.application_events(shift_id,actor_id,event) values(result_id,auth.uid(),'shift_published');
  return result_id;
end;
$$;

create function private.apply_to_shift(target_shift uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare post public.application_posts%rowtype; result_id uuid; applicant_name text;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  perform 1 from public.worker_profiles where user_id=auth.uid() for update;
  if not found then raise exception 'Worker profile is required'; end if;
  select * into post from public.application_posts where shift_id=target_shift for update;
  if post.shift_id is null then raise exception 'Shift unavailable'; end if;
  select id into result_id from public.shift_applications where shift_id=target_shift and worker_id=auth.uid();
  if result_id is not null then return result_id; end if;
  if post.status<>'open' or post.starts_at<=clock_timestamp() or not private.application_pilot_enabled(post.employer_id) then raise exception 'Shift unavailable'; end if;
  if private.is_employer_member(post.employer_id) then raise exception 'Cannot apply to own workspace'; end if;
  if (select count(*) from public.shift_applications where worker_id=auth.uid() and created_at>now()-interval '24 hours')>=50 then raise exception 'Application rate limit'; end if;
  select full_name into applicant_name from public.profiles where id=auth.uid();
  insert into public.shift_applications(shift_id,worker_id,worker_name) values(target_shift,auth.uid(),applicant_name) returning id into result_id;
  insert into private.application_events(application_id,shift_id,actor_id,event) values(result_id,target_shift,auth.uid(),'applied');
  return result_id;
end;
$$;

create function private.transition_application(target_application uuid, decision text)
returns text language plpgsql security definer set search_path='' as $$
declare application public.shift_applications%rowtype; post public.application_posts%rowtype; result_status text; worker_action boolean; decision_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  worker_action := decision in ('accept','decline','withdraw');
  select * into application from public.shift_applications where id=target_application;
  if application.id is null or (worker_action and application.worker_id<>auth.uid())
    or (not worker_action and not private.is_application_employer(application.shift_id)) then raise exception 'Not authorized' using errcode='42501'; end if;
  -- Global lock order: worker (worker actions), post, application. All capacity
  -- mutations share the post lock; accept and legacy claim share the worker lock.
  if worker_action then perform 1 from public.worker_profiles where user_id=auth.uid() for update; end if;
  select * into post from public.application_posts where shift_id=application.shift_id for update;
  select * into application from public.shift_applications where id=target_application for update;
  -- now() is transaction start, so a request waiting for a lock could otherwise
  -- accept after its real deadline. Capture wall time only after acquiring locks.
  decision_at := clock_timestamp();
  if decision not in ('offer','reject','revoke','accept','decline','withdraw') or decision is null then raise exception 'Invalid decision'; end if;
  result_status := case decision when 'offer' then 'offered' when 'accept' then 'accepted' when 'decline' then 'declined'
    when 'withdraw' then 'withdrawn' when 'reject' then 'rejected' else 'cancelled' end;
  if application.status in ('applied','offered') and (post.starts_at<=decision_at or
      (application.status='offered' and application.offer_expires_at<=decision_at)) then
    update public.shift_applications set status='expired',updated_at=decision_at where id=target_application;
    insert into private.application_events(application_id,shift_id,actor_id,event) values(target_application,post.shift_id,auth.uid(),'expired');
    return 'expired';
  end if;
  if application.status=result_status then return result_status; end if;
  if post.status<>'open' then raise exception 'Shift cancelled'; end if;
  if decision='offer' then
    if not private.application_pilot_enabled(post.employer_id) then raise exception 'Pilot not enabled'; end if;
    if application.status<>'applied' then raise exception 'Invalid application state'; end if;
    if (select count(*) from public.shift_applications where shift_id=post.shift_id and
        (status='accepted' or (status='offered' and offer_expires_at>decision_at)))>=post.workers_needed then raise exception 'No offer capacity'; end if;
    update public.shift_applications set offered_at=decision_at,offer_expires_at=least(decision_at+interval '30 minutes',post.starts_at) where id=target_application;
  elsif decision='accept' then
    if not private.application_pilot_enabled(post.employer_id) then raise exception 'Pilot not enabled'; end if;
    if application.status<>'offered' then raise exception 'Invalid application state'; end if;
    if not exists(select 1 from public.worker_contacts where user_id=auth.uid()) then raise exception 'Worker contact phone is required'; end if;
    if private.is_employer_member(post.employer_id) then raise exception 'Cannot apply to own workspace'; end if;
    if (select count(*) from public.shift_applications where shift_id=post.shift_id and status='accepted')>=post.workers_needed then raise exception 'No offer capacity'; end if;
    if exists(select 1 from public.shift_applications a join public.application_posts p on p.shift_id=a.shift_id
        where a.worker_id=auth.uid() and a.status='accepted' and p.status='open'
        and tstzrange(p.starts_at,p.ends_at,'[)') && tstzrange(post.starts_at,post.ends_at,'[)'))
      or exists(select 1 from public.shift_assignments a join public.shifts s on s.id=a.shift_id
        where a.worker_id=auth.uid() and a.status in ('claimed','checked_in')
        and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(post.starts_at,post.ends_at,'[)')) then raise exception 'Overlapping commitment'; end if;
    update public.shift_applications set accepted_at=decision_at where id=target_application;
  elsif decision='decline' and application.status<>'offered' then raise exception 'Invalid application state';
  elsif decision='withdraw' and (application.status not in ('applied','offered','accepted') or post.starts_at<=decision_at) then raise exception 'Invalid application state';
  elsif decision='reject' and application.status<>'applied' then raise exception 'Invalid application state';
  elsif decision='revoke' and (application.status not in ('offered','accepted') or post.starts_at<=decision_at) then raise exception 'Invalid application state';
  end if;
  update public.shift_applications set status=result_status,updated_at=decision_at where id=target_application;
  insert into private.application_events(application_id,shift_id,actor_id,event) values(target_application,post.shift_id,auth.uid(),result_status);
  return result_status;
end;
$$;

create function private.cancel_application_post(target_shift uuid)
returns void language plpgsql security definer set search_path='' as $$
declare post public.application_posts%rowtype;
begin
  if auth.uid() is null or not private.is_application_employer(target_shift) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into post from public.application_posts where shift_id=target_shift for update;
  if post.status='cancelled' then return; end if;
  if post.starts_at<=clock_timestamp() then raise exception 'Shift already started'; end if;
  update public.application_posts set status='cancelled',cancelled_at=now() where shift_id=target_shift;
  with changed as (update public.shift_applications set status='cancelled',updated_at=now()
    where shift_id=target_shift and status in ('applied','offered','accepted') returning id)
  insert into private.application_events(application_id,shift_id,actor_id,event) select id,target_shift,auth.uid(),'cancelled' from changed;
  insert into private.application_events(shift_id,actor_id,event) values(target_shift,auth.uid(),'shift_cancelled');
end;
$$;

-- Contact disclosure is an authenticated, per-application read. It never grants
-- broad employer/worker table access. No phone is returned for offers alone.
create function private.application_contact(target_application uuid)
returns table(phone text, exact_address text) language plpgsql stable security definer set search_path='' as $$
declare application public.shift_applications%rowtype; post public.application_posts%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into application from public.shift_applications where id=target_application;
  if application.id is null or (application.worker_id<>auth.uid() and not private.is_application_employer(application.shift_id)) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into post from public.application_posts where shift_id=application.shift_id;
  if application.status<>'accepted' or post.status<>'open' or post.ends_at<=now() then return; end if;
  if application.worker_id=auth.uid() then
    return query select c.phone,l.exact_address from public.employer_contacts c join public.shift_locations l on l.shift_id=post.shift_id where c.employer_id=post.employer_id;
  else
    return query select c.phone,null::text from public.worker_contacts c where c.user_id=application.worker_id;
  end if;
end;
$$;

create function private.prevent_cross_model_overlap()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('claimed','checked_in') then
    perform 1 from public.worker_profiles where user_id=new.worker_id for update;
    if exists(select 1 from public.shift_applications a join public.application_posts p on p.shift_id=a.shift_id
      join public.shifts s on s.id=new.shift_id where a.worker_id=new.worker_id and a.status='accepted' and p.status='open'
      and tstzrange(p.starts_at,p.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')) then raise exception 'Overlapping commitment'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_cross_model_overlap() from public,anon,authenticated;
create trigger assignments_cross_model_overlap before insert or update of status on public.shift_assignments
for each row execute function private.prevent_cross_model_overlap();

create function public.publish_application_shift(target_employer uuid,request_key uuid,public_name text,job_role text,location_area text,exact_address text,
  starts_at timestamptz,ends_at timestamptz,pay_cents integer,places smallint,requirements text[],public_copy_confirmed boolean)
returns uuid language sql security invoker set search_path='' as $$
  select private.publish_application_shift(target_employer,request_key,public_name,job_role,location_area,exact_address,starts_at,ends_at,pay_cents,places,requirements,public_copy_confirmed);
$$;
create function public.apply_to_shift(target_shift uuid) returns uuid language sql security invoker set search_path='' as $$ select private.apply_to_shift(target_shift); $$;
create function public.application_pilot_access(target_employer uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select private.is_employer_member(target_employer) and private.application_pilot_enabled(target_employer);
$$;
revoke all on function public.application_pilot_access(uuid) from public,anon,authenticated;
grant execute on function public.application_pilot_access(uuid) to authenticated;
create function public.transition_application(target_application uuid,decision text) returns text language sql security invoker set search_path='' as $$ select private.transition_application(target_application,decision); $$;
create function public.cancel_application_post(target_shift uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_application_post(target_shift); $$;
create function public.application_contact(target_application uuid) returns table(phone text,exact_address text) language sql stable security invoker set search_path='' as $$ select * from private.application_contact(target_application); $$;

revoke all on function private.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean),
  public.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean),
  private.apply_to_shift(uuid),public.apply_to_shift(uuid),private.transition_application(uuid,text),public.transition_application(uuid,text),
  private.cancel_application_post(uuid),public.cancel_application_post(uuid),private.application_contact(uuid),public.application_contact(uuid)
  from public,anon,authenticated;
grant execute on function private.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean),
  public.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean),
  private.apply_to_shift(uuid),public.apply_to_shift(uuid),private.transition_application(uuid,text),public.transition_application(uuid,text),
  private.cancel_application_post(uuid),public.cancel_application_post(uuid),private.application_contact(uuid),public.application_contact(uuid)
  to authenticated;
