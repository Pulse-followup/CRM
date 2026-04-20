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
  role text not null check (role in ('admin', 'member')),
  status text not null check (status in ('invited', 'active')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
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

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

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
using (public.is_workspace_member(id));

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
