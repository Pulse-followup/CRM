create table if not exists public.projects (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  name text not null,
  type text,
  frequency text,
  estimated_value numeric(12,2),
  status text,
  billing_id text,
  billing_status text,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists hourly_rate numeric default 1500;

create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_projects_archived on public.projects(archived);
alter table public.projects add column if not exists billing_id text;
alter table public.projects add column if not exists billing_status text;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table if not exists public.tasks (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  sequence_number integer,
  action_type text,
  title text,
  description text,
  assigned_to_user_id uuid references public.profiles(id) on delete set null,
  assigned_to_label text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_label text,
  delegated_by_user_id uuid references public.profiles(id) on delete set null,
  delegated_by_label text,
  due_date date,
  status text not null default 'dodeljen',
  review_status text,
  time_spent_minutes numeric,
  labor_cost numeric,
  material_cost numeric,
  material_description text,
  billable_status text,
  included_in_cost boolean,
  non_billable_reason text,
  billing_id text,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists review_status text;
alter table public.tasks add column if not exists time_spent_minutes numeric;
alter table public.tasks add column if not exists labor_cost numeric;
alter table public.tasks add column if not exists material_cost numeric;
alter table public.tasks add column if not exists material_description text;
alter table public.tasks add column if not exists billable_status text;
alter table public.tasks add column if not exists included_in_cost boolean;
alter table public.tasks add column if not exists non_billable_reason text;
alter table public.tasks add column if not exists billing_id text;
alter table public.tasks add column if not exists archived boolean not null default false;
alter table public.tasks add column if not exists archived_at timestamptz;

create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);
create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assigned_to_user_id on public.tasks(assigned_to_user_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create table if not exists public.billing (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  description text,
  amount numeric default 0,
  currency text default 'RSD',
  due_date date,
  status text default 'draft',
  invoice_number text,
  total_labor_cost numeric default 0,
  total_material_cost numeric default 0,
  total_cost numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoiced_at timestamptz,
  paid_at timestamptz
);

create index if not exists idx_billing_workspace_id on public.billing(workspace_id);
create index if not exists idx_billing_client_id on public.billing(client_id);
create index if not exists idx_billing_project_id on public.billing(project_id);
create index if not exists idx_billing_status on public.billing(status);

drop trigger if exists trg_billing_updated_at on public.billing;
create trigger trg_billing_updated_at
before update on public.billing
for each row
execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.billing enable row level security;

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
on public.projects
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "projects_insert_member" on public.projects;
create policy "projects_insert_member"
on public.projects
for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member"
on public.projects
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects_delete_member" on public.projects;
create policy "projects_delete_member"
on public.projects
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member"
on public.tasks
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member"
on public.tasks
for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member"
on public.tasks
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_delete_member" on public.tasks;
create policy "tasks_delete_member"
on public.tasks
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "billing_select_member" on public.billing;
create policy "billing_select_member"
on public.billing
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "billing_insert_member" on public.billing;
create policy "billing_insert_member"
on public.billing
for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "billing_update_member" on public.billing;
create policy "billing_update_member"
on public.billing
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "billing_delete_member" on public.billing;
create policy "billing_delete_member"
on public.billing
for delete
to authenticated
using (public.is_workspace_member(workspace_id));
