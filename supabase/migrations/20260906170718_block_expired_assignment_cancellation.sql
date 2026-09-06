-- Do not turn an already-ended commitment back into a public replacement.
-- After the scheduled end, attendance must be resolved by check-out or by the
-- employer's no-show flow so the reputation record remains auditable.
create or replace function public.cancel_assignment(target_assignment_id uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_assignment public.shift_assignments%rowtype;
  selected_shift public.shifts%rowtype;
  score_penalty smallint;
begin
  select * into selected_assignment
  from public.shift_assignments
  where id = target_assignment_id
    and worker_id = (select auth.uid())
    and status = 'claimed'
  for update;

  if selected_assignment.id is null then raise exception 'Assignment cannot be cancelled'; end if;

  select * into selected_shift
  from public.shifts
  where id = selected_assignment.shift_id
  for update;

  if selected_shift.id is null or selected_shift.ends_at <= now() then
    raise exception 'Assignment cannot be cancelled';
  end if;

  update public.shift_assignments
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = left(reason, 500), updated_at = now()
  where id = selected_assignment.id;

  score_penalty := case when selected_shift.starts_at - now() < interval '24 hours' then 5 else 1 end;
  update public.worker_profiles
  set reliability_score = greatest(0, reliability_score - score_penalty), updated_at = now()
  where user_id = (select auth.uid());

  update public.shifts
  set status = 'published', urgent = true, audience = 'public',
      replacement_requested_at = now(), claimed_count = greatest(0, claimed_count - 1), updated_at = now()
  where id = selected_shift.id;
end;
$$;
