-- Privacy-conscious product events for marketplace funnel and reliability metrics.
-- No names, email addresses, free-form text, or device fingerprints are stored.

create type public.product_event_name as enum (
  'registration_completed',
  'availability_enabled',
  'notifications_enabled',
  'shift_claimed',
  'shift_checked_in',
  'shift_checked_out',
  'shift_cancelled',
  'shift_published',
  'shift_broadcast',
  'shift_pay_raised',
  'replacement_requested',
  'worker_rated'
);

create type public.product_event_source as enum ('dashboard', 'push', 'system');

create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_role public.app_role not null,
  employer_id uuid references public.employers (id) on delete cascade,
  event_name public.product_event_name not null,
  subject_id uuid,
  source public.product_event_source not null default 'dashboard',
  created_at timestamptz not null default now()
);

create index product_events_user_created_idx on public.product_events (user_id, created_at desc);
create index product_events_employer_created_idx on public.product_events (employer_id, created_at desc) where employer_id is not null;
create index product_events_name_created_idx on public.product_events (event_name, created_at desc);

alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;

create or replace function public.record_registration_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.product_events (user_id, actor_role, event_name, source)
  values (new.id, new.role, 'registration_completed', 'system');
  return new;
end;
$$;

create trigger profiles_record_registration_completed
  after insert on public.profiles
  for each row execute procedure public.record_registration_completed();

revoke all on function public.record_registration_completed() from public;
