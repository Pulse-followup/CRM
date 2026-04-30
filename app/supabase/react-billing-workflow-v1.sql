-- PULSE React - Billing Workflow V1
-- Run after workspace, clients/projects, and tasks SQL files.

create table if not exists public.billing_records (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  description text not null default '',
  amount numeric(12,2),
  currency text not null default 'RSD',
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'invoiced', 'overdue', 'paid', 'cancelled')),
  invoice_number text not null default '',
  total_labor_cost numeric(12,2) not null default 0,
  total_material_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoiced_at timestamptz,
  paid_at timestamptz
);

alter table public.billing_records add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.billing_records add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.billing_records add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.billing_records add column if not exists description text not null default '';
alter table public.billing_records add column if not exists amount numeric(12,2);
alter table public.billing_records add column if not exists currency text not null default 'RSD';
alter table public.billing_records add column if not exists due_date date;
alter table public.billing_records add column if not exists status text not null default 'draft';
alter table public.billing_records add column if not exists invoice_number text not null default '';
alter table public.billing_records add column if not exists total_labor_cost numeric(12,2) not null default 0;
alter table public.billing_records add column if not exists total_material_cost numeric(12,2) not null default 0;
alter table public.billing_records add column if not exists total_cost numeric(12,2) not null default 0;
alter table public.billing_records add column if not exists invoiced_at timestamptz;
alter table public.billing_records add column if not exists paid_at timestamptz;

create index if not exists idx_billing_records_workspace_id on public.billing_records(workspace_id);
create index if not exists idx_billing_records_project_id on public.billing_records(project_id);
create index if not exists idx_billing_records_client_id on public.billing_records(client_id);
create index if not exists idx_billing_records_status on public.billing_records(status);
create index if not exists idx_billing_records_due_date on public.billing_records(due_date);

alter table public.billing_records enable row level security;

drop trigger if exists trg_billing_records_updated_at on public.billing_records;
create trigger trg_billing_records_updated_at
before update on public.billing_records
for each row execute function public.set_updated_at();

drop policy if exists "billing_records_select_member" on public.billing_records;
create policy "billing_records_select_member" on public.billing_records
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "billing_records_insert_member" on public.billing_records;
create policy "billing_records_insert_member" on public.billing_records
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "billing_records_update_member" on public.billing_records;
create policy "billing_records_update_member" on public.billing_records
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- Optional helper for automatic overdue updates from SQL, useful before reports.
create or replace function public.mark_overdue_billing_records(target_workspace uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if not public.is_workspace_member(target_workspace) then
    raise exception 'not_workspace_member';
  end if;

  update public.billing_records
  set status = 'overdue'
  where workspace_id = target_workspace
    and status = 'invoiced'
    and due_date is not null
    and due_date < current_date;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

grant execute on function public.mark_overdue_billing_records(uuid) to authenticated;
