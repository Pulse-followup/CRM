-- PULSE React - Project + Task Sync Fix
-- Run after workspace-invites-foundation.sql and react-clients-projects-read-foundation.sql.
-- Purpose: make projects writable from React before task creation, so tasks do not fail FK checks.

alter table public.projects add column if not exists type text;
alter table public.projects add column if not exists frequency text;
alter table public.projects add column if not exists estimated_value numeric(12,2);
alter table public.projects add column if not exists status text;
alter table public.projects add column if not exists billing_id text;
alter table public.projects add column if not exists billing_status text;
alter table public.projects add column if not exists archived boolean not null default false;
alter table public.projects add column if not exists archived_at timestamptz;
alter table public.projects add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_projects_workspace_client on public.projects(workspace_id, client_id);

-- Keep policies explicit for MVP testing. RLS still requires authenticated workspace membership.
drop policy if exists "projects_insert_member" on public.projects;
create policy "projects_insert_member" on public.projects
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member" on public.projects
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- Task policies and columns required by React task sync.
alter table public.tasks add column if not exists client_id bigint references public.clients(id) on delete cascade;
alter table public.tasks add column if not exists project_id text references public.projects(id) on delete cascade;
alter table public.tasks add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.tasks add column if not exists assigned_to_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists assigned_to_label text;
alter table public.tasks add column if not exists action_type text;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists status text not null default 'dodeljen';
alter table public.tasks add column if not exists stage_id text;
alter table public.tasks add column if not exists billing_state text;
alter table public.tasks add column if not exists billing_id text;
alter table public.tasks add column if not exists archived boolean not null default false;

create index if not exists idx_tasks_workspace_project on public.tasks(workspace_id, project_id);
create index if not exists idx_tasks_workspace_assigned on public.tasks(workspace_id, assigned_to_user_id);

drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member" on public.tasks
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
