-- PULSE FINAL MVP STABILIZATION
-- Safe billing_records schema without incompatible FK between text client_id and bigint clients.id.

alter table if exists workspace_members
  add column if not exists hourly_rate numeric default 0;

alter table if exists workspace_members
  add column if not exists display_name text;

alter table if exists workspace_invites
  add column if not exists full_name text;

alter table if exists workspace_invites
  add column if not exists hourly_rate numeric default 0;

create table if not exists billing_records (
  id text primary key,
  workspace_id uuid,
  client_id text,
  project_id text,
  description text,
  amount numeric,
  currency text default 'RSD',
  due_date date,
  status text default 'ready',
  invoice_number text,
  total_labor_cost numeric default 0,
  total_material_cost numeric default 0,
  total_cost numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  invoiced_at timestamptz,
  paid_at timestamptz
);

alter table if exists billing_records
  add column if not exists task_count int default 0;
alter table if exists billing_records
  add column if not exists total_time_minutes numeric default 0;
alter table if exists billing_records
  add column if not exists margin_percent numeric default 0;
alter table if exists billing_records
  add column if not exists net_amount numeric default 0;
alter table if exists billing_records
  add column if not exists client_name text;
alter table if exists billing_records
  add column if not exists project_name text;
alter table if exists billing_records
  add column if not exists total_tasks int default 0;
alter table if exists billing_records
  add column if not exists total_time numeric default 0;
alter table if exists billing_records
  add column if not exists total_material numeric default 0;
alter table if exists billing_records
  add column if not exists margin numeric default 0;
alter table if exists billing_records
  add column if not exists total_with_margin numeric default 0;
alter table if exists billing_records
  add column if not exists invoice_description text;
alter table if exists billing_records
  add column if not exists invoice_amount numeric;
alter table if exists billing_records
  add column if not exists labor_cost numeric default 0;
alter table if exists billing_records
  add column if not exists suggested_invoice_amount numeric;
alter table if exists billing_records
  add column if not exists assigned_finance_user_id uuid;
alter table if exists billing_records
  add column if not exists source text default 'pulse';

alter table if exists tasks
  add column if not exists billing_record_id text;
alter table if exists tasks
  add column if not exists billing_state text;

update billing_records
set status = 'ready'
where status is null
   or status in ('draft', 'za_fakturisanje', 'za-fakturisanje', 'ready_for_invoice', 'sent_to_finance');

create index if not exists billing_records_workspace_status_idx
  on billing_records (workspace_id, status);
create index if not exists billing_records_project_idx
  on billing_records (project_id);
create index if not exists tasks_billing_record_idx
  on tasks (billing_record_id);

alter table if exists billing_records enable row level security;

drop policy if exists "billing_records_select_mvp" on billing_records;
drop policy if exists "billing_records_insert_mvp" on billing_records;
drop policy if exists "billing_records_update_mvp" on billing_records;
drop policy if exists "billing_records_delete_mvp" on billing_records;

create policy "billing_records_select_mvp"
on billing_records for select
using (true);

create policy "billing_records_insert_mvp"
on billing_records for insert
with check (true);

create policy "billing_records_update_mvp"
on billing_records for update
using (true)
with check (true);

create policy "billing_records_delete_mvp"
on billing_records for delete
using (true);


-- Billing status update compatibility:
-- Finance screen now prefers billing_records over legacy billing when duplicate IDs exist.
-- Keep both tables during MVP; billing_records is source of truth for invoice status.
