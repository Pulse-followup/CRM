-- PULSE MVP enterprise flow support
-- Run in Supabase SQL Editor. Safe ALTERs where possible.

create extension if not exists pgcrypto;

-- Tasks: keep project/client/workspace links and execution/billing fields stable.
alter table if exists public.tasks add column if not exists workspace_id uuid;
alter table if exists public.tasks add column if not exists client_id text;
alter table if exists public.tasks add column if not exists project_id text;
alter table if exists public.tasks add column if not exists assigned_to_user_id uuid;
alter table if exists public.tasks add column if not exists assigned_to_label text default '';
alter table if exists public.tasks add column if not exists title text default '';
alter table if exists public.tasks add column if not exists description text default '';
alter table if exists public.tasks add column if not exists action_type text default 'drugo';
alter table if exists public.tasks add column if not exists due_date date;
alter table if exists public.tasks add column if not exists status text default 'dodeljen';
alter table if exists public.tasks add column if not exists time_spent_minutes integer default 0;
alter table if exists public.tasks add column if not exists labor_cost numeric default 0;
alter table if exists public.tasks add column if not exists material_cost numeric default 0;
alter table if exists public.tasks add column if not exists material_description text default '';
alter table if exists public.tasks add column if not exists billing_state text default 'not_billable';
alter table if exists public.tasks add column if not exists billable_status text default 'not_billable';
alter table if exists public.tasks add column if not exists billing_id text;
alter table if exists public.tasks add column if not exists archived boolean default false;
alter table if exists public.tasks add column if not exists completed_at timestamptz;
alter table if exists public.tasks add column if not exists stage_id text;
alter table if exists public.tasks add column if not exists created_at timestamptz default now();
alter table if exists public.tasks add column if not exists updated_at timestamptz default now();

-- Billing records: admin creates draft/za-fakturisanje from completed tasks; finance invoices it.
create table if not exists public.billing_records (
  id text primary key,
  workspace_id uuid not null,
  client_id text not null,
  project_id text not null,
  description text default '',
  amount numeric,
  currency text default 'RSD',
  due_date date,
  status text not null default 'draft',
  invoice_number text default '',
  task_count integer default 0,
  total_time_minutes integer default 0,
  total_labor_cost numeric default 0,
  total_material_cost numeric default 0,
  total_cost numeric default 0,
  margin_percent numeric default 0,
  net_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  invoiced_at timestamptz,
  paid_at timestamptz
);

alter table if exists public.billing_records add column if not exists task_count integer default 0;
alter table if exists public.billing_records add column if not exists total_time_minutes integer default 0;
alter table if exists public.billing_records add column if not exists total_labor_cost numeric default 0;
alter table if exists public.billing_records add column if not exists total_material_cost numeric default 0;
alter table if exists public.billing_records add column if not exists total_cost numeric default 0;
alter table if exists public.billing_records add column if not exists margin_percent numeric default 0;
alter table if exists public.billing_records add column if not exists net_amount numeric default 0;

create index if not exists idx_tasks_workspace_project on public.tasks(workspace_id, project_id);
create index if not exists idx_tasks_assigned_to_user on public.tasks(workspace_id, assigned_to_user_id);
create index if not exists idx_billing_workspace_project on public.billing_records(workspace_id, project_id);
create index if not exists idx_billing_workspace_status on public.billing_records(workspace_id, status);

alter table public.tasks enable row level security;
alter table public.billing_records enable row level security;

-- Dev/MVP policies: authenticated workspace members can work with records in their workspace.
drop policy if exists pulse_tasks_workspace_select on public.tasks;
drop policy if exists pulse_tasks_workspace_insert on public.tasks;
drop policy if exists pulse_tasks_workspace_update on public.tasks;
drop policy if exists pulse_billing_workspace_select on public.billing_records;
drop policy if exists pulse_billing_workspace_insert on public.billing_records;
drop policy if exists pulse_billing_workspace_update on public.billing_records;

create policy pulse_tasks_workspace_select on public.tasks
for select to authenticated
using (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy pulse_tasks_workspace_insert on public.tasks
for insert to authenticated
with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy pulse_tasks_workspace_update on public.tasks
for update to authenticated
using (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = tasks.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy pulse_billing_workspace_select on public.billing_records
for select to authenticated
using (exists (select 1 from public.workspace_members wm where wm.workspace_id = billing_records.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy pulse_billing_workspace_insert on public.billing_records
for insert to authenticated
with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = billing_records.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));

create policy pulse_billing_workspace_update on public.billing_records
for update to authenticated
using (exists (select 1 from public.workspace_members wm where wm.workspace_id = billing_records.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'))
with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = billing_records.workspace_id and wm.user_id = auth.uid() and wm.status = 'active'));
