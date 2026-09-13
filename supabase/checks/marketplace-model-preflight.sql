-- Read-only aggregate inventory, safe before or after Phase 1.
-- No names, addresses, phones, emails, tax IDs or user-level records are output.
begin transaction read only;

select status, count(*) as shifts,
       count(*) filter (where ends_at > now()) as not_yet_ended
from public.shifts
group by status order by status;

select coalesce(to_jsonb(shift)->>'marketplace_model', 'column_not_deployed') as marketplace_model,
       count(*) as shifts
from public.shifts shift
group by 1 order by 1;

select status, count(*) as assignments from public.shift_assignments
group by status order by status;

select currency, status, count(*) as records, sum(amount_cents) as recorded_amount_cents
from public.payment_ledger group by currency, status order by currency, status;

select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public'
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

commit;
