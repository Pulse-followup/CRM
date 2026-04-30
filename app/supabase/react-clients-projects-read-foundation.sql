-- PULSE React - FAZA 2 read foundation for clients + projects
-- Run only if your Supabase project does not already have public.clients/public.projects.

create table if not exists public.clients (
  id bigint primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  client_address text,
  client_city text,
  contact_person text,
  contact_role text,
  contact_phone text,
  contact_email text,
  company_size text,
  decision_model text,
  business_type text,
  relationship_strength text,
  pilot_readiness text,
  payment jsonb not null default '{}'::jsonb,
  activity_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists idx_clients_workspace_id on public.clients(workspace_id);
create index if not exists idx_projects_workspace_id on public.projects(workspace_id);
create index if not exists idx_projects_client_id on public.projects(client_id);

alter table public.clients enable row level security;
alter table public.projects enable row level security;

drop policy if exists "clients_select_member" on public.clients;
create policy "clients_select_member" on public.clients
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "clients_insert_member" on public.clients;
create policy "clients_insert_member" on public.clients
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "clients_update_member" on public.clients;
create policy "clients_update_member" on public.clients
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member" on public.projects
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "projects_insert_member" on public.projects;
create policy "projects_insert_member" on public.projects
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "projects_update_member" on public.projects;
create policy "projects_update_member" on public.projects
for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
