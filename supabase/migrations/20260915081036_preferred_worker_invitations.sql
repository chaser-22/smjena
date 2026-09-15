-- Preferred is a firm's private preference, not identity/attendance verification.
-- Invitations are not applications, offers, assignments or contact entitlements.
create index employer_posting_usage_grant_scope_idx on public.employer_posting_usage(grant_id,employer_id,kind);

create table public.invitation_preferences (
  user_id uuid primary key references public.worker_profiles(user_id) on delete cascade,
  allow_invitations boolean not null default true
);
alter table public.invitation_preferences enable row level security;
revoke all on public.invitation_preferences from public,anon,authenticated;
grant select,insert on public.invitation_preferences to authenticated;
grant update(allow_invitations) on public.invitation_preferences to authenticated;
create policy invitation_preferences_own on public.invitation_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.application_invitations (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(user_id) on delete restrict,
  invited_by uuid references public.profiles(id) on delete set null,
  worker_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  dismissed_at timestamptz,
  unique(shift_id,worker_id)
);
create index application_invitations_worker_idx on public.application_invitations(worker_id,created_at desc);
create index application_invitations_actor_idx on public.application_invitations(invited_by);
alter table public.application_invitations enable row level security;
revoke all on public.application_invitations from public,anon,authenticated;
grant select(id,shift_id,worker_id,worker_name,created_at,dismissed_at) on public.application_invitations to authenticated;
create policy application_invitations_participants on public.application_invitations for select to authenticated
using(worker_id=(select auth.uid()) or private.is_application_employer(shift_id));

create function private.is_invited_worker(target_shift uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.application_invitations i
    where i.shift_id=target_shift and i.worker_id=auth.uid());
$$;
revoke all on function private.is_invited_worker(uuid) from public,anon,authenticated;
grant execute on function private.is_invited_worker(uuid) to authenticated;
alter policy application_posts_participants on public.application_posts
using(private.is_employer_member(employer_id) or private.is_application_worker(shift_id) or private.is_invited_worker(shift_id));

create view public.application_invitation_inbox with(security_invoker=true) as
select i.id,i.shift_id,i.worker_id,i.worker_name,i.created_at,
  p.employer_name,p.role,p.city,p.location_area,p.starts_at,p.ends_at,p.pay_cents,
  case when exists(select 1 from public.shift_applications a where a.shift_id=i.shift_id and a.worker_id=i.worker_id) then 'applied'
    when i.dismissed_at is not null then 'dismissed'
    when p.status<>'open' then 'cancelled' when p.starts_at<=now() then 'expired' else 'invited' end as effective_status
from public.application_invitations i join public.application_posts p on p.shift_id=i.shift_id;
revoke all on public.application_invitation_inbox from public,anon,authenticated;
grant select on public.application_invitation_inbox to authenticated;

alter table public.marketplace_notifications drop constraint marketplace_notifications_kind_check;
alter table public.marketplace_notifications add constraint marketplace_notifications_kind_check
check(kind in ('applied','offered','accepted','declined','withdrawn','rejected','cancelled','expired','invited'));
alter policy marketplace_notifications_read on public.marketplace_notifications
using(recipient_id=(select auth.uid()) and (private.is_application_worker(shift_id) or private.is_application_employer(shift_id)
  or (kind='invited' and private.is_invited_worker(shift_id))));

create function private.preferred_workers(target_employer uuid)
returns table(worker_id uuid,worker_name text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  return query select t.worker_id,p.full_name from public.trusted_workers t join public.profiles p on p.id=t.worker_id
    join public.worker_profiles w on w.user_id=t.worker_id where t.employer_id=target_employer order by p.full_name,t.worker_id limit 200;
end;
$$;
create function private.set_preferred_worker(target_employer uuid,target_worker uuid,preferred boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  if preferred is null then raise exception 'Invalid preference'; end if;
  perform 1 from public.worker_profiles where user_id=target_worker for update;
  if not found then raise exception 'Worker unavailable'; end if;
  if not private.is_employer_member(target_employer) then raise exception 'Not authorized' using errcode='42501'; end if;
  if preferred then
    if not exists(select 1 from public.trusted_workers where employer_id=target_employer and worker_id=target_worker)
      and not exists(select 1 from public.shift_applications a join public.application_posts p on p.shift_id=a.shift_id
        where p.employer_id=target_employer and a.worker_id=target_worker and a.status='accepted' and p.status='open' and p.ends_at<=clock_timestamp()) then
      raise exception 'Previous accepted shift required';
    end if;
    insert into public.trusted_workers(employer_id,worker_id) values(target_employer,target_worker) on conflict do nothing;
  else
    delete from public.trusted_workers where employer_id=target_employer and worker_id=target_worker;
  end if;
end;
$$;

create function private.invite_preferred_worker(target_shift uuid,target_worker uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare post public.application_posts%rowtype; invitation uuid; event_key bigint; notice uuid; decision_at timestamptz;
begin
  if auth.uid() is null or not private.is_application_employer(target_shift) then raise exception 'Not authorized' using errcode='42501'; end if;
  -- Same worker -> post ordering as application/acceptance. Worker lock also
  -- serializes cross-workspace recipient limits; firm lock serializes firm limits.
  perform 1 from public.worker_profiles where user_id=target_worker for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  select * into post from public.application_posts where shift_id=target_shift for update;
  perform 1 from public.employers where id=post.employer_id for update;
  decision_at:=clock_timestamp();
  if not private.is_employer_member(post.employer_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select id into invitation from public.application_invitations where shift_id=target_shift and worker_id=target_worker;
  if invitation is not null then return invitation; end if;
  if post.status<>'open' or post.starts_at<=decision_at or not private.application_pilot_enabled(post.employer_id) then raise exception 'Shift unavailable'; end if;
  if not exists(select 1 from public.trusted_workers where employer_id=post.employer_id and worker_id=target_worker)
    or exists(select 1 from public.invitation_preferences where user_id=target_worker and not allow_invitations)
    or exists(select 1 from public.employer_members where employer_id=post.employer_id and user_id=target_worker)
    or exists(select 1 from public.shift_applications where shift_id=target_shift and worker_id=target_worker) then raise exception 'Invitation unavailable'; end if;
  if (select count(*) from public.application_invitations where worker_id=target_worker and created_at>decision_at-interval '24 hours')>=10
    or (select count(*) from public.application_invitations i join public.application_posts p on p.shift_id=i.shift_id where p.employer_id=post.employer_id and i.created_at>decision_at-interval '24 hours')>=100 then
    raise exception 'Invitation rate limit';
  end if;
  insert into public.application_invitations(shift_id,worker_id,invited_by,worker_name)
    select target_shift,target_worker,auth.uid(),full_name from public.profiles where id=target_worker returning id into invitation;
  insert into private.application_events(shift_id,actor_id,event) values(target_shift,auth.uid(),'invited') returning id into event_key;
  insert into public.marketplace_notifications(recipient_id,event_id,shift_id,kind,destination)
    values(target_worker,event_key,target_shift,'invited','/applications') returning id into notice;
  insert into private.application_push_outbox(notification_id,subscription_id,expires_at)
    select notice,s.id,least(post.starts_at,decision_at+interval '24 hours') from public.push_subscriptions s
    join public.notification_preferences pref on pref.user_id=s.user_id and pref.application_push
    where s.user_id=target_worker;
  return invitation;
end;
$$;
create function private.dismiss_application_invitation(target_invitation uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.application_invitations set dismissed_at=coalesce(dismissed_at,clock_timestamp())
    where id=target_invitation and worker_id=auth.uid();
  if not found then raise exception 'Not authorized' using errcode='42501'; end if;
end;
$$;

create function public.preferred_workers(target_employer uuid) returns table(worker_id uuid,worker_name text)
language sql stable security invoker set search_path='' as $$ select * from private.preferred_workers(target_employer); $$;
create function public.set_preferred_worker(target_employer uuid,target_worker uuid,preferred boolean) returns void
language sql security invoker set search_path='' as $$ select private.set_preferred_worker(target_employer,target_worker,preferred); $$;
create function public.invite_preferred_worker(target_shift uuid,target_worker uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.invite_preferred_worker(target_shift,target_worker); $$;
create function public.dismiss_application_invitation(target_invitation uuid) returns void
language sql security invoker set search_path='' as $$ select private.dismiss_application_invitation(target_invitation); $$;
revoke all on function private.preferred_workers(uuid),public.preferred_workers(uuid),
  private.set_preferred_worker(uuid,uuid,boolean),public.set_preferred_worker(uuid,uuid,boolean),
  private.invite_preferred_worker(uuid,uuid),public.invite_preferred_worker(uuid,uuid),
  private.dismiss_application_invitation(uuid),public.dismiss_application_invitation(uuid) from public,anon,authenticated;
grant execute on function private.preferred_workers(uuid),public.preferred_workers(uuid),
  private.set_preferred_worker(uuid,uuid,boolean),public.set_preferred_worker(uuid,uuid,boolean),
  private.invite_preferred_worker(uuid,uuid),public.invite_preferred_worker(uuid,uuid),
  private.dismiss_application_invitation(uuid),public.dismiss_application_invitation(uuid) to authenticated;

-- Retain the service-only worker and filter stale/declined invitations before leasing.
alter function private.lease_application_push() rename to lease_application_push_base;
create function private.lease_application_push()
returns table(job_id uuid,token uuid,notification_id uuid,kind text,destination text,endpoint text,p256dh text,auth_secret text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  update private.application_push_outbox q set state='skipped',lease_token=null,lease_until=null
    from public.marketplace_notifications n
    where q.notification_id=n.id and n.kind='invited' and q.state in ('pending','leased')
    and (exists(select 1 from public.invitation_preferences pref where pref.user_id=n.recipient_id and not pref.allow_invitations)
      or not exists(select 1 from public.application_invitations i join public.application_posts p on p.shift_id=i.shift_id
        where i.shift_id=n.shift_id and i.worker_id=n.recipient_id and i.dismissed_at is null and p.status='open' and p.starts_at>clock_timestamp())
      or exists(select 1 from public.shift_applications a where a.shift_id=n.shift_id and a.worker_id=n.recipient_id));
  return query select * from private.lease_application_push_base();
end;
$$;
-- Replace the public body explicitly: a renamed function may retain dependencies.
create or replace function public.lease_application_push()
returns table(job_id uuid,token uuid,notification_id uuid,kind text,destination text,endpoint text,p256dh text,auth_secret text,expires_at timestamptz)
language sql security invoker set search_path='' as $$ select * from private.lease_application_push(); $$;
revoke all on function private.lease_application_push(),private.lease_application_push_base() from public,anon,authenticated,service_role;
grant execute on function private.lease_application_push() to service_role;
