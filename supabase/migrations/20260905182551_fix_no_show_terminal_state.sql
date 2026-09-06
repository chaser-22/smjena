-- Keep a multi-worker shift active after one worker is marked as a no-show.
-- The previous implementation completed an ended shift even while another
-- worker still needed to check out or be marked as a no-show.
create or replace function public.mark_assignment_no_show(target_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_assignment public.shift_assignments%rowtype;
  selected_shift public.shifts%rowtype;
  finalized_count integer;
  completed_count integer;
  remaining_active integer;
begin
  select * into selected_assignment
  from public.shift_assignments
  where id = target_assignment_id
  for update;

  if selected_assignment.id is null or selected_assignment.status <> 'claimed' then
    raise exception 'Assignment cannot be marked no show';
  end if;

  select * into selected_shift from public.shifts where id = selected_assignment.shift_id for update;
  if selected_shift.id is null or not private.is_employer_member(selected_shift.employer_id) then
    raise exception 'Not authorized';
  end if;
  if now() < selected_shift.starts_at then raise exception 'No show is not available yet'; end if;

  update public.shift_assignments
  set status = 'no_show', cancellation_reason = 'Poslodavac je evidentirao nedolazak',
      cancelled_at = now(), updated_at = now()
  where id = selected_assignment.id;

  select
    count(*) filter (where status in ('completed', 'no_show')),
    count(*) filter (where status = 'completed')
  into finalized_count, completed_count
  from public.shift_assignments
  where worker_id = selected_assignment.worker_id;

  update public.worker_profiles
  set reliability_score = greatest(0, reliability_score - 10),
      attendance_percent = case
        when finalized_count = 0 then 100
        else round(completed_count::numeric * 100 / finalized_count)::smallint
      end,
      updated_at = now()
  where user_id = selected_assignment.worker_id;

  select count(*) into remaining_active
  from public.shift_assignments
  where shift_id = selected_shift.id and status in ('claimed', 'checked_in');

  update public.shifts
  set claimed_count = (
        select count(*) from public.shift_assignments
        where shift_id = selected_shift.id and status in ('claimed', 'checked_in', 'completed')
      ),
      status = case
        when ends_at > now() then 'published'::public.shift_status
        when remaining_active > 0 then 'in_progress'::public.shift_status
        else 'completed'::public.shift_status
      end,
      urgent = ends_at > now(),
      audience = case when ends_at > now() then 'public'::public.shift_audience else audience end,
      replacement_requested_at = case when ends_at > now() then now() else replacement_requested_at end,
      updated_at = now()
  where id = selected_shift.id;

  if selected_shift.status <> 'completed' and selected_shift.ends_at <= now() and remaining_active = 0 then
    update public.employers
    set completed_shifts = completed_shifts + 1, updated_at = now()
    where id = selected_shift.employer_id;
  end if;

  return selected_shift.id;
end;
$$;
