create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'finance', 'member')),
  status text not null check (status in ('invited', 'active')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'finance', 'member')),
  invited_by_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  plan text not null check (plan in ('free', 'trial', 'pro')),
  status text not null default 'active',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  client_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_workspace_subscriptions_updated_at on public.workspace_subscriptions;
create trigger trg_workspace_subscriptions_updated_at
before update on public.workspace_subscriptions
for each row
execute function public.set_updated_at();

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
  revenue_driver_primary text,
  lead_temperature text,
  budget_status text,
  urgency_level text,
  pilot_readiness text,
  relationship_strength text,
  last_action_note text,
  next_step_text text,
  next_step_type text,
  next_step_date date,
  deal_value numeric(12,2) default 0,
  deal_probability text,
  expected_decision_date date,
  business_type text,
  client_type text,
  international_flag text,
  revenue_focus_tags jsonb not null default '[]'::jsonb,
  revenue_detail text,
  retail_location_type text,
  retail_assortment_type text,
  retail_promo_potential text,
  pharmacy_focus text,
  pharmacy_locations text,
  pharmacy_centralization text,
  pharmacy_traffic text,
  pharmacy_suppliers text,
  stage text not null default 'new',
  last_action_at timestamptz,
  last_action_human text,
  payment jsonb not null default '{}'::jsonb,
  activity_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_workspace_id on public.clients(workspace_id);
create index if not exists idx_clients_owner_user_id on public.clients(owner_user_id);
create index if not exists idx_clients_next_step_date on public.clients(next_step_date);

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

create table if not exists public.client_activities (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id bigint not null references public.clients(id) on delete cascade,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  label text not null,
  note text,
  activity_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_activities_workspace_id on public.client_activities(workspace_id);
create index if not exists idx_client_activities_client_id on public.client_activities(client_id);
create index if not exists idx_client_activities_activity_at on public.client_activities(activity_at);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = 'admin'
  );
$$;

create or replace function public.has_pending_workspace_invite(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = target_workspace
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.clients enable row level security;
alter table public.client_activities enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_select_workspace_peers" on public.profiles;
create policy "profiles_select_workspace_peers"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members me
    join public.workspace_members peer
      on peer.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and peer.user_id = profiles.id
      and peer.status = 'active'
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (
  public.is_workspace_member(id)
  or owner_user_id = auth.uid()
);

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
on public.workspaces
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_update_admin"
on public.workspaces
for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_owner_or_admin" on public.workspace_members;
create policy "workspace_members_insert_owner_or_admin"
on public.workspace_members
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and role = 'admin'
    and status in ('invited', 'active')
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.owner_user_id = auth.uid()
    )
  )
  or public.is_workspace_admin(workspace_id)
  or (
    user_id = auth.uid()
    and status = 'active'
    and public.has_pending_workspace_invite(workspace_id)
  )
);

drop policy if exists "workspace_members_update_admin" on public.workspace_members;
create policy "workspace_members_update_admin"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_invites_select_admin" on public.workspace_invites;
create policy "workspace_invites_select_admin"
on public.workspace_invites
for select
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_invites_select_own_email" on public.workspace_invites;
create policy "workspace_invites_select_own_email"
on public.workspace_invites
for select
to authenticated
using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "workspace_invites_insert_admin" on public.workspace_invites;
create policy "workspace_invites_insert_admin"
on public.workspace_invites
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and invited_by_user_id = auth.uid()
);

drop policy if exists "workspace_invites_update_admin" on public.workspace_invites;
create policy "workspace_invites_update_admin"
on public.workspace_invites
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_invites_accept_own_email" on public.workspace_invites;
create policy "workspace_invites_accept_own_email"
on public.workspace_invites
for update
to authenticated
using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
with check (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "workspace_subscriptions_select_member" on public.workspace_subscriptions;
create policy "workspace_subscriptions_select_member"
on public.workspace_subscriptions
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_subscriptions_insert_admin" on public.workspace_subscriptions;
create policy "workspace_subscriptions_insert_admin"
on public.workspace_subscriptions
for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_subscriptions_update_admin" on public.workspace_subscriptions;
create policy "workspace_subscriptions_update_admin"
on public.workspace_subscriptions
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "clients_select_member" on public.clients;
create policy "clients_select_member"
on public.clients
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "clients_insert_member" on public.clients;
create policy "clients_insert_member"
on public.clients
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by_user_id = auth.uid()
);

drop policy if exists "clients_update_member" on public.clients;
create policy "clients_update_member"
on public.clients
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "clients_delete_member" on public.clients;
create policy "clients_delete_member"
on public.clients
for delete
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "client_activities_select_member" on public.client_activities;
create policy "client_activities_select_member"
on public.client_activities
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "client_activities_insert_member" on public.client_activities;
create policy "client_activities_insert_member"
on public.client_activities
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and (created_by_user_id is null or created_by_user_id = auth.uid())
);

drop policy if exists "client_activities_update_member" on public.client_activities;
create policy "client_activities_update_member"
on public.client_activities
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "client_activities_delete_member" on public.client_activities;
create policy "client_activities_delete_member"
on public.client_activities
for delete
to authenticated
using (public.is_workspace_member(workspace_id));
