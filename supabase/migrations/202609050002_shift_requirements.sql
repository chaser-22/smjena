-- Add a backward-compatible shift creator that stores worker-visible requirements
-- in the same transaction as publishing the shift.

create or replace function public.create_shift_with_details(
  target_employer_id uuid,
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
  if char_length(trim(shift_role)) not between 2 and 80 then raise exception 'Invalid role'; end if;
  if char_length(trim(shift_area)) not between 2 and 200 then raise exception 'Invalid area'; end if;
  if shift_starts_at <= now() then raise exception 'Shift must start in the future'; end if;
  if shift_ends_at <= shift_starts_at or shift_ends_at > shift_starts_at + interval '24 hours' then raise exception 'Invalid shift duration'; end if;
  if shift_pay_cents not between 2000 and 500000 then raise exception 'Invalid pay'; end if;
  if shift_bonus_cents < 0 or shift_bonus_cents > shift_pay_cents - 2000 then raise exception 'Invalid bonus'; end if;
  if shift_workers_needed not between 1 and 50 then raise exception 'Invalid worker count'; end if;
  if coalesce(cardinality(shift_requirements), 0) > 8 then raise exception 'Too many requirements'; end if;
  if exists (select 1 from unnest(coalesce(shift_requirements, '{}'::text[])) item where char_length(trim(item)) not between 2 and 80) then
    raise exception 'Invalid requirement';
  end if;

  select coalesce(array_agg(trim(item)), '{}'::text[])
  into cleaned_requirements
  from unnest(coalesce(shift_requirements, '{}'::text[])) item;

  select city into selected_city from public.employers where id = target_employer_id;
  if selected_city is null then raise exception 'Employer not found'; end if;

  insert into public.shifts (
    employer_id, created_by, role, city, area, starts_at, ends_at,
    pay_cents, base_pay_cents, bonus_cents, workers_needed, requirements,
    urgent, audience, status, published_at
  ) values (
    target_employer_id, (select auth.uid()), trim(shift_role), selected_city, trim(shift_area),
    shift_starts_at, shift_ends_at, shift_pay_cents, shift_pay_cents - shift_bonus_cents,
    shift_bonus_cents, shift_workers_needed, cleaned_requirements,
    shift_urgent, shift_audience, 'published', now()
  ) returning id into new_shift_id;

  return new_shift_id;
end;
$$;

revoke all on function public.create_shift_with_details(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) from public;
grant execute on function public.create_shift_with_details(uuid, text, text, timestamptz, timestamptz, integer, integer, smallint, text[], boolean, public.shift_audience) to authenticated;
