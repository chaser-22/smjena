-- Phase 1 only: preserve instant-claim records without inventing application
-- consent. Application intake stays disabled until the complete new flow ships.
-- No historical rows, statuses, amounts, contacts or grants are rewritten.
alter table public.shifts
  add column marketplace_model text not null default 'legacy_claim'
  constraint shifts_marketplace_model_check
    check (marketplace_model in ('legacy_claim', 'application_v1'));

comment on column public.shifts.marketplace_model is
  'Immutable origin. Legacy claims are not evidence of employer selection or worker acceptance.';

create function private.guard_shift_marketplace_model()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' then
    if new.marketplace_model is distinct from old.marketplace_model then
      raise exception 'Shift marketplace model is immutable' using errcode = '23514';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if old.marketplace_model <> 'legacy_claim' then
      raise exception 'Application marketplace is not enabled' using errcode = '23514';
    end if;
    return old;
  end if;

  if new.marketplace_model <> 'legacy_claim' then
    raise exception 'Application marketplace is not enabled' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shifts_guard_marketplace_model
before insert or update or delete on public.shifts
for each row execute function private.guard_shift_marketplace_model();

-- Durable boundary: even after application intake is enabled, its shifts must
-- never acquire legacy assignments, attendance penalties, ratings or wages.
-- Check both references on UPDATE so records cannot be moved out of the fence.
create function private.guard_legacy_marketplace_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  referenced_ids uuid[] := '{}';
  target_id uuid;
  target_model text;
begin
  if TG_TABLE_NAME = 'shift_assignments' then
    if TG_OP <> 'INSERT' then referenced_ids := array_append(referenced_ids, old.shift_id); end if;
    if TG_OP <> 'DELETE' then referenced_ids := array_append(referenced_ids, new.shift_id); end if;
  else
    if TG_OP <> 'INSERT' then referenced_ids := array_append(referenced_ids, old.assignment_id); end if;
    if TG_OP <> 'DELETE' then referenced_ids := array_append(referenced_ids, new.assignment_id); end if;
  end if;

  foreach target_id in array referenced_ids loop
    if TG_TABLE_NAME = 'shift_assignments' then
      select marketplace_model into target_model from public.shifts where id = target_id;
    else
      select shift.marketplace_model into target_model
      from public.shift_assignments assignment
      join public.shifts shift on shift.id = assignment.shift_id
      where assignment.id = target_id;
    end if;

    -- A parent can already be absent during a legitimate legacy cascade delete.
    -- Inserts/updates fail closed if RLS hides it; FK checks still apply normally.
    if target_model is distinct from 'legacy_claim'
       and not (TG_OP = 'DELETE' and target_model is null) then
      raise exception 'Legacy records require a legacy-claim shift' using errcode = '23514';
    end if;
  end loop;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger assignments_guard_marketplace_model
before insert or update or delete on public.shift_assignments
for each row execute function private.guard_legacy_marketplace_record();

create trigger ratings_guard_marketplace_model
before insert or update or delete on public.ratings
for each row execute function private.guard_legacy_marketplace_record();

create trigger ledger_guard_marketplace_model
before insert or update or delete on public.payment_ledger
for each row execute function private.guard_legacy_marketplace_record();

revoke all on function private.guard_shift_marketplace_model() from public, anon, authenticated;
revoke all on function private.guard_legacy_marketplace_record() from public, anon, authenticated;
