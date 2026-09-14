-- Notifications are created in the same transaction as the application event.
-- No historical events are backfilled and no notification proves device delivery.
create function private.limit_push_subscriptions()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=new.user_id for update;
  if not exists(select 1 from public.push_subscriptions where user_id=new.user_id and endpoint=new.endpoint)
    and (select count(*) from public.push_subscriptions where user_id=new.user_id)>=10 then
    raise exception 'Too many notification devices';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_push_subscriptions() from public,anon,authenticated;
create trigger push_subscription_limit before insert on public.push_subscriptions
for each row execute function private.limit_push_subscriptions();
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  application_push boolean not null default false
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select,insert on public.notification_preferences to authenticated;
grant update(application_push) on public.notification_preferences to authenticated;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.marketplace_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_id bigint not null references private.application_events(id) on delete restrict,
  shift_id uuid not null references public.application_posts(shift_id) on delete restrict,
  kind text not null check(kind in ('applied','offered','accepted','declined','withdrawn','rejected','cancelled','expired')),
  destination text not null,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  unique(event_id,recipient_id)
);
create index marketplace_notifications_recipient_idx on public.marketplace_notifications(recipient_id,created_at desc);
create index marketplace_notifications_shift_idx on public.marketplace_notifications(shift_id);
alter table public.marketplace_notifications enable row level security;
revoke all on public.marketplace_notifications from public,anon,authenticated;
grant select(id,recipient_id,shift_id,kind,destination,created_at,read_at) on public.marketplace_notifications to authenticated;
grant update(read_at) on public.marketplace_notifications to authenticated;
create policy marketplace_notifications_read on public.marketplace_notifications for select to authenticated
using(recipient_id=(select auth.uid()) and (private.is_application_worker(shift_id) or private.is_application_employer(shift_id)));
create policy marketplace_notifications_mark_read on public.marketplace_notifications for update to authenticated
using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));

create table private.application_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.marketplace_notifications(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  state text not null default 'pending' check(state in ('pending','leased','accepted_by_service','skipped','failed')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  expires_at timestamptz not null,
  unique(notification_id,subscription_id)
);
create index application_push_subscription_idx on private.application_push_outbox(subscription_id);
create index application_push_pending_idx on private.application_push_outbox(next_attempt_at) where state in ('pending','leased');
alter table private.application_push_outbox enable row level security;
revoke all on private.application_push_outbox from public,anon,authenticated;

create function private.enqueue_application_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare worker uuid; firm uuid; deadline timestamptz;
begin
  if new.application_id is null or new.event not in ('applied','offered','accepted','declined','withdrawn','rejected','cancelled','expired') then return new; end if;
  select a.worker_id,p.employer_id,case when new.event='offered' then a.offer_expires_at else p.ends_at end
    into worker,firm,deadline from public.shift_applications a join public.application_posts p on p.shift_id=a.shift_id where a.id=new.application_id;
  if new.event in ('offered','rejected','cancelled','expired') then
    insert into public.marketplace_notifications(recipient_id,event_id,shift_id,kind,destination)
    values(worker,new.id,new.shift_id,new.event,'/applications') on conflict do nothing;
  else
    insert into public.marketplace_notifications(recipient_id,event_id,shift_id,kind,destination)
    select m.user_id,new.id,new.shift_id,new.event,'/employer/shifts/'||new.shift_id||'/applications'
    from public.employer_members m where m.employer_id=firm and m.user_id is distinct from new.actor_id on conflict do nothing;
  end if;
  insert into private.application_push_outbox(notification_id,subscription_id,expires_at)
  select n.id,s.id,least(deadline,clock_timestamp()+interval '24 hours')
  from public.marketplace_notifications n join public.notification_preferences pref on pref.user_id=n.recipient_id and pref.application_push
  join public.push_subscriptions s on s.user_id=n.recipient_id
  where n.event_id=new.id and deadline>clock_timestamp() on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_application_notification() from public,anon,authenticated;
create trigger application_event_notification after insert on private.application_events
for each row execute function private.enqueue_application_notification();

-- Only the server service role can lease jobs or see endpoint/key material.
create function private.lease_application_push()
returns table(job_id uuid,token uuid,notification_id uuid,kind text,destination text,endpoint text,p256dh text,auth_secret text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  update private.application_push_outbox q set state='skipped',lease_token=null,lease_until=null
  where q.state in ('pending','leased') and (q.expires_at<=clock_timestamp() or q.subscription_id is null
    or not exists(select 1 from public.marketplace_notifications n
      join public.notification_preferences p on p.user_id=n.recipient_id and p.application_push
      join public.application_posts post on post.shift_id=n.shift_id
      where n.id=q.notification_id and
      (n.destination='/applications' or exists(select 1 from public.employer_members m where m.employer_id=post.employer_id and m.user_id=n.recipient_id))));
  -- Stale offers must never be re-advertised after a response or cancellation.
  update private.application_push_outbox q set state='skipped'
  from public.marketplace_notifications n join private.application_events e on e.id=n.event_id
  join public.shift_applications a on a.id=e.application_id join public.application_posts p on p.shift_id=a.shift_id
  where q.notification_id=n.id and q.state in ('pending','leased') and n.kind='offered'
    and (a.status<>'offered' or p.status<>'open' or a.offer_expires_at<=clock_timestamp());
  update private.application_push_outbox set state='failed'
    where state='leased' and lease_until<=clock_timestamp() and attempts>=5;
  return query with candidates as (
    select q.id from private.application_push_outbox q where q.attempts<5 and q.next_attempt_at<=clock_timestamp()
    and (q.state='pending' or (q.state='leased' and q.lease_until<=clock_timestamp()))
    order by q.next_attempt_at,q.id limit 20 for update skip locked
  ), leased as (
    update private.application_push_outbox q set state='leased',attempts=q.attempts+1,
      lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
    from candidates c where q.id=c.id returning q.*
  ) select q.id,q.lease_token,n.id,n.kind,n.destination,s.endpoint,s.p256dh,s.auth_secret,q.expires_at
    from leased q join public.marketplace_notifications n on n.id=q.notification_id
    join public.push_subscriptions s on s.id=q.subscription_id;
end;
$$;
create function private.finish_application_push(target_job uuid,token uuid,outcome text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if outcome not in ('accepted_by_service','retry','skipped','failed') or outcome is null then raise exception 'Invalid delivery outcome'; end if;
  update private.application_push_outbox q set
    state=case when outcome='retry' then case when attempts>=5 then 'failed' else 'pending' end else outcome end,
    next_attempt_at=clock_timestamp()+interval '1 minute'*power(2,q.attempts),lease_token=null,lease_until=null
  where q.id=target_job and q.state='leased' and q.lease_token=token and q.lease_until>clock_timestamp();
end;
$$;
create function public.lease_application_push()
returns table(job_id uuid,token uuid,notification_id uuid,kind text,destination text,endpoint text,p256dh text,auth_secret text,expires_at timestamptz)
language sql security invoker set search_path='' as $$ select * from private.lease_application_push(); $$;
create function public.finish_application_push(target_job uuid,token uuid,outcome text)
returns void language sql security invoker set search_path='' as $$ select private.finish_application_push(target_job,token,outcome); $$;
revoke all on function private.lease_application_push(),public.lease_application_push(),
  private.finish_application_push(uuid,uuid,text),public.finish_application_push(uuid,uuid,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.lease_application_push(),public.lease_application_push(),
  private.finish_application_push(uuid,uuid,text),public.finish_application_push(uuid,uuid,text) to service_role;
