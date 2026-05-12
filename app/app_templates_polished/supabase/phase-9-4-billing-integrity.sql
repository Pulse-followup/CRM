-- FAZA 9.4 — Billing integrity
-- Purpose:
-- 1) project billing must not duplicate for the same active project
-- 2) invoice status follows due date
-- 3) paid billing closes the financial lifecycle

-- Safe diagnostics first: find projects with multiple non-cancelled billing records.
select
  project_id,
  count(*) as non_cancelled_records
from public.billing_records
where project_id is not null
  and coalesce(status, '') <> 'cancelled'
group by project_id
having count(*) > 1;

-- Optional cleanup before creating the index:
-- Keep the newest record per project and cancel older duplicates.
-- Review diagnostics above first. Uncomment only if the diagnostics show duplicates you want auto-cancelled.
-- with ranked as (
--   select
--     id,
--     project_id,
--     row_number() over (partition by project_id order by created_at desc nulls last, updated_at desc nulls last) as rn
--   from public.billing_records
--   where project_id is not null
--     and coalesce(status, '') <> 'cancelled'
-- )
-- update public.billing_records br
-- set status = 'cancelled', updated_at = now()
-- from ranked r
-- where br.id = r.id and r.rn > 1;

-- Enforce one non-cancelled billing record per project going forward.
create unique index if not exists billing_records_one_open_record_per_project
on public.billing_records (project_id)
where project_id is not null and coalesce(status, '') <> 'cancelled';

-- Runtime overdue guard for existing invoices.
update public.billing_records
set status = 'overdue', updated_at = now()
where status = 'invoiced'
  and due_date is not null
  and due_date < current_date;

-- Optional: same protection for legacy billing table, if still used by the app.
update public.billing
set status = 'overdue', updated_at = now()
where status = 'invoiced'
  and due_date is not null
  and due_date < current_date;
