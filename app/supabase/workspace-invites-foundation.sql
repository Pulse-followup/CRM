-- PULSE React - Workspace + members + invites foundation
-- Run in Supabase SQL Editor before testing the React cloud workspace screen.

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

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'finance', 'member')),
  status text not null check (status in ('invited', 'active')),
  hourly_rate numeric(12,2),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('admin', 'finance', 'member')),
  hourly_rate numeric(12,2),
  invited_by_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table public.workspace_members add column if not exists hourly_rate numeric(12,2);
alter table public.workspace_invites add column if not exists full_name text;
alter table public.workspace_invites add column if not exists hourly_rate numeric(12,2);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

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

create or replace function public.accept_workspace_invite(invite_id uuid)
returns table(accepted_workspace_id uuid, accepted_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record record;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  current_email := lower(coalesce(auth.jwt()->>'email', ''));

  select wi.id, wi.workspace_id, wi.role, wi.hourly_rate, wi.full_name
  into invite_record
  from public.workspace_invites wi
  where wi.id = invite_id
    and wi.status = 'pending'
    and lower(wi.email) = current_email
  limit 1;

  if invite_record.id is null then
    raise exception 'invite_not_found_or_wrong_email';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(invite_record.full_name, ''), public.profiles.full_name),
      updated_at = now()
  where id = auth.uid();

  insert into public.workspace_members (workspace_id, user_id, role, status, hourly_rate, joined_at)
  values (invite_record.workspace_id, auth.uid(), invite_record.role, 'active', invite_record.hourly_rate, now())
  on conflict (workspace_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    hourly_rate = excluded.hourly_rate,
    joined_at = coalesce(public.workspace_members.joined_at, excluded.joined_at);

  update public.workspace_invites wi
  set status = 'accepted'
  where wi.id = invite_record.id;

  return query
  select invite_record.workspace_id::uuid, invite_record.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;

-- Profiles

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_select_workspace_peers" on public.profiles;
create policy "profiles_select_workspace_peers" on public.profiles
for select to authenticated using (
  exists (
    select 1
    from public.workspace_members self_member
    join public.workspace_members peer_member
      on peer_member.workspace_id = self_member.workspace_id
    where self_member.user_id = auth.uid()
      and self_member.status = 'active'
      and peer_member.user_id = profiles.id
      and peer_member.status = 'active'
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner" on public.workspaces
for insert to authenticated with check (owner_user_id = auth.uid());

drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_update_admin" on public.workspaces
for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

-- Members

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_owner_or_admin" on public.workspace_members;
create policy "workspace_members_insert_owner_or_admin" on public.workspace_members
for insert to authenticated with check (
  (
    user_id = auth.uid()
    and role = 'admin'
    and status in ('invited', 'active')
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  )
  or public.is_workspace_admin(workspace_id)
);

drop policy if exists "workspace_members_update_admin" on public.workspace_members;
create policy "workspace_members_update_admin" on public.workspace_members
for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

-- Invites

drop policy if exists "workspace_invites_select_admin" on public.workspace_invites;
create policy "workspace_invites_select_admin" on public.workspace_invites
for select to authenticated using (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_invites_select_own_email" on public.workspace_invites;
create policy "workspace_invites_select_own_email" on public.workspace_invites
for select to authenticated using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')));

drop policy if exists "workspace_invites_insert_admin" on public.workspace_invites;
create policy "workspace_invites_insert_admin" on public.workspace_invites
for insert to authenticated with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_invites_update_admin" on public.workspace_invites;
create policy "workspace_invites_update_admin" on public.workspace_invites
for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
