-- PULSE React - FAZA 2.2 task sync foundation
-- Run in Supabase SQL Editor after workspace + clients/projects schema.

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
  stage_id text,
  review_status text,
  time_spent_minutes numeric,
  labor_cost numeric,
  material_cost numeric,
  material_description text,
  billable_status text,
  billing_state text,
  included_in_cost boolean,
  non_billable_reason text,
  billing_id text,
  completed_at timestamptz,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists sequence_number integer;
alter table public.tasks add column if not exists action_type text;
alter table public.tasks add column if not exists assigned_to_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists assigned_to_label text;
alter table public.tasks add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists created_by_label text;
alter table public.tasks add column if not exists delegated_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists delegated_by_label text;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists stage_id text;
alter table public.tasks add column if not exists review_status text;
alter table public.tasks add column if not exists time_spent_minutes numeric;
alter table public.tasks add column if not exists labor_cost numeric;
alter table public.tasks add column if not exists material_cost numeric;
alter table public.tasks add column if not exists material_description text;
alter table public.tasks add column if not exists billable_status text;
alter table public.tasks add column if not exists billing_state text;
alter table public.tasks add column if not exists included_in_cost boolean;
alter table public.tasks add column if not exists non_billable_reason text;
alter table public.tasks add column if not exists billing_id text;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists archived boolean not null default false;
alter table public.tasks add column if not exists archived_at timestamptz;

create index if not exists idx_tasks_workspace_id on public.tasks(workspace_id);
create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assigned_to_user_id on public.tasks(assigned_to_user_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

alter table public.tasks enable row level security;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member" on public.tasks
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member" on public.tasks
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_delete_member" on public.tasks;
create policy "tasks_delete_member" on public.tasks
for delete to authenticated using (public.is_workspace_member(workspace_id));
