-- Existing pilot workspaces keep publishing without a credit requirement.
-- Only an operator can change this policy after commercial terms are agreed.
alter table private.application_pilot_workspaces add column require_posting_credit boolean not null default false;
alter table public.employer_posting_grants add column sos_duration_minutes integer
  check(sos_duration_minutes is null or (sos_duration_minutes between 1 and 10080 and kind='sos_promotion'));
grant select(sos_duration_minutes) on public.employer_posting_grants to authenticated;
create or replace view public.employer_credit_balances with(security_invoker=true) as
select g.id,g.employer_id,g.kind,g.source,g.units,g.starts_at,g.expires_at,g.revoked_at,
  (g.units-(select count(*) from public.employer_posting_usage u where u.grant_id=g.id))::integer as remaining_units,
  g.sos_duration_minutes
from public.employer_posting_grants g;

create function private.application_posting_terms(target_employer uuid)
returns table(enabled boolean,requires_credit boolean,can_publish boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  return query select coalesce(p.enabled,false),coalesce(p.require_posting_credit,false),
    coalesce(p.enabled,false) and (not coalesce(p.require_posting_credit,false) or private.is_billing_owner(target_employer))
    from public.employers e left join private.application_pilot_workspaces p on p.employer_id=e.id where e.id=target_employer;
end;
$$;
create function public.application_posting_terms(target_employer uuid)
returns table(enabled boolean,requires_credit boolean,can_publish boolean)
language sql stable security invoker set search_path='' as $$
  select * from private.application_posting_terms(target_employer);
$$;
revoke all on function private.application_posting_terms(uuid),public.application_posting_terms(uuid) from public,anon,authenticated;
grant execute on function private.application_posting_terms(uuid),public.application_posting_terms(uuid) to authenticated;

-- Preserve validation/publication, but remove direct access to the inner helper.
alter function private.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean)
  rename to publish_application_shift_base;
revoke all on function private.publish_application_shift_base(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean)
  from public,anon,authenticated,service_role;
create function private.publish_application_shift(target_employer uuid,request_key uuid,
  public_name text,job_role text,location_area text,exact_address text,starts_at timestamptz,ends_at timestamptz,
  pay_cents integer,places smallint,requirements text[],public_copy_confirmed boolean,credit_confirmed boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; credit_id uuid; requires_credit boolean;
begin
  if auth.uid() is null or not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  perform 1 from public.employers where id=target_employer for update;
  if not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  select id into result_id from public.shifts where employer_id=target_employer and request_id=request_key;
  -- Retried successful posts never consume another credit, even if policy changed.
  if result_id is null then
    select require_posting_credit into requires_credit from private.application_pilot_workspaces where employer_id=target_employer;
    if requires_credit then
      if not private.is_billing_owner(target_employer) then raise exception 'Billing owner required'; end if;
      if credit_confirmed is distinct from true then raise exception 'Posting credit confirmation required'; end if;
      select g.id into credit_id from public.employer_posting_grants g
        where g.employer_id=target_employer and g.kind='standard_post' and g.revoked_at is null
          and g.starts_at<=clock_timestamp() and g.expires_at>clock_timestamp()
          and g.units>(select count(*) from public.employer_posting_usage u where u.grant_id=g.id)
        order by g.expires_at,g.id limit 1 for update;
      if credit_id is null then raise exception 'Standard posting credit required'; end if;
    end if;
  end if;
  result_id:=private.publish_application_shift_base(target_employer,request_key,public_name,job_role,location_area,exact_address,
    starts_at,ends_at,pay_cents,places,requirements,public_copy_confirmed);
  if credit_id is not null then
    insert into public.employer_posting_usage(grant_id,employer_id,kind,shift_id,request_id)
      values(credit_id,target_employer,'standard_post',result_id,request_key);
  end if;
  return result_id;
end;
$$;
create or replace function public.publish_application_shift(target_employer uuid,request_key uuid,public_name text,job_role text,location_area text,exact_address text,
  starts_at timestamptz,ends_at timestamptz,pay_cents integer,places smallint,requirements text[],public_copy_confirmed boolean)
returns uuid language sql security invoker set search_path='' as $$
  select private.publish_application_shift(target_employer,request_key,public_name,job_role,location_area,exact_address,starts_at,ends_at,pay_cents,places,requirements,public_copy_confirmed);
$$;
create function public.publish_application_shift_with_credit(target_employer uuid,request_key uuid,public_name text,job_role text,location_area text,exact_address text,
  starts_at timestamptz,ends_at timestamptz,pay_cents integer,places smallint,requirements text[],public_copy_confirmed boolean,credit_confirmed boolean)
returns uuid language sql security invoker set search_path='' as $$
  select private.publish_application_shift(target_employer,request_key,public_name,job_role,location_area,exact_address,starts_at,ends_at,pay_cents,places,requirements,public_copy_confirmed,credit_confirmed);
$$;
revoke all on function private.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean,boolean),
  public.publish_application_shift_with_credit(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean,boolean) from public,anon,authenticated;
grant execute on function private.publish_application_shift(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean,boolean),
  public.publish_application_shift_with_credit(uuid,uuid,text,text,text,text,timestamptz,timestamptz,integer,smallint,text[],boolean,boolean) to authenticated;

create table public.shift_sos_promotions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  usage_id uuid not null unique references public.employer_posting_usage(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  stopped_at timestamptz
);
create index shift_sos_active_idx on public.shift_sos_promotions(shift_id,ends_at);
alter table public.shift_sos_promotions enable row level security;
revoke all on public.shift_sos_promotions from public,anon,authenticated;
grant select(id,shift_id,starts_at,ends_at,stopped_at) on public.shift_sos_promotions to anon,authenticated;
create policy shift_sos_public on public.shift_sos_promotions for select to anon
using(stopped_at is null and starts_at<=now() and ends_at>now() and exists(select 1 from public.public_shift_listings l where l.shift_id=shift_sos_promotions.shift_id));
create policy shift_sos_members on public.shift_sos_promotions for select to authenticated
using(private.is_application_employer(shift_id) or (stopped_at is null and starts_at<=now() and ends_at>now()
  and exists(select 1 from public.public_shift_listings l where l.shift_id=shift_sos_promotions.shift_id)));

-- Only curated public fields. Invoker mode retains source and promotion RLS.
create view public.public_shift_feed with(security_invoker=true) as
select l.shift_id,l.role,l.employer_name,l.city,l.location_area,l.starts_at,l.ends_at,l.pay_cents,l.workers_needed,l.requirements,
  exists(select 1 from public.shift_sos_promotions s where s.shift_id=l.shift_id and s.stopped_at is null and s.starts_at<=now() and s.ends_at>now()) as is_sos
from public.public_shift_listings l;
revoke all on public.public_shift_feed from public,anon,authenticated;
grant select on public.public_shift_feed to anon,authenticated;

create function private.activate_shift_sos(target_shift uuid,target_grant uuid,request_key uuid,expected_minutes integer,confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare post public.application_posts%rowtype; credit public.employer_posting_grants%rowtype; previous public.employer_posting_usage%rowtype;
  result_id uuid; usage_key uuid; decision_at timestamptz;
begin
  if auth.uid() is null or not private.is_application_employer(target_shift) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into post from public.application_posts where shift_id=target_shift for update;
  if not private.is_billing_owner(post.employer_id) then raise exception 'Billing owner required'; end if;
  if request_key is null or confirmed is distinct from true then raise exception 'SOS confirmation required'; end if;
  select * into previous from public.employer_posting_usage where request_id=request_key;
  if previous.id is not null then
    if previous.shift_id<>target_shift or previous.grant_id<>target_grant or previous.kind<>'sos_promotion' then raise exception 'Credit request mismatch'; end if;
    select id into result_id from public.shift_sos_promotions where usage_id=previous.id;
    if result_id is null then raise exception 'Credit request mismatch'; end if;
    return result_id;
  end if;
  select * into credit from public.employer_posting_grants where id=target_grant for update;
  decision_at:=clock_timestamp();
  if post.status<>'open' or post.starts_at<=decision_at or not private.application_pilot_enabled(post.employer_id)
    or not exists(select 1 from public.public_shift_listings l where l.shift_id=target_shift
      and private.is_public_listing_current(l.shift_id,l.source_updated_at)) then raise exception 'Shift unavailable'; end if;
  if credit.id is null or credit.employer_id<>post.employer_id or credit.kind<>'sos_promotion' or credit.sos_duration_minutes is null
    or credit.sos_duration_minutes is distinct from expected_minutes or credit.revoked_at is not null
    or credit.starts_at>decision_at or credit.expires_at<=decision_at then raise exception 'SOS credit unavailable'; end if;
  if post.starts_at<decision_at+make_interval(mins=>credit.sos_duration_minutes) then raise exception 'SOS duration exceeds time before shift'; end if;
  if exists(select 1 from public.shift_sos_promotions where shift_id=target_shift and stopped_at is null and ends_at>decision_at) then raise exception 'SOS already active'; end if;
  insert into public.employer_posting_usage(grant_id,employer_id,kind,shift_id,request_id)
    values(target_grant,post.employer_id,'sos_promotion',target_shift,request_key) returning id into usage_key;
  insert into public.shift_sos_promotions(shift_id,usage_id,starts_at,ends_at)
    values(target_shift,usage_key,decision_at,decision_at+make_interval(mins=>credit.sos_duration_minutes)) returning id into result_id;
  insert into private.application_events(shift_id,actor_id,event) values(target_shift,auth.uid(),'sos_activated');
  return result_id;
end;
$$;
create function public.activate_shift_sos(target_shift uuid,target_grant uuid,request_key uuid,expected_minutes integer,confirmed boolean)
returns uuid language sql security invoker set search_path='' as $$ select private.activate_shift_sos(target_shift,target_grant,request_key,expected_minutes,confirmed); $$;
revoke all on function private.activate_shift_sos(uuid,uuid,uuid,integer,boolean),public.activate_shift_sos(uuid,uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function private.activate_shift_sos(uuid,uuid,uuid,integer,boolean),public.activate_shift_sos(uuid,uuid,uuid,integer,boolean) to authenticated;
