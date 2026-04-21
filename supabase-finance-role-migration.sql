-- Pulse CRM: allow the workspace role used by the billing workflow.
-- Run once in Supabase SQL Editor if inviting a "Finansije" user fails because
-- of an old role check constraint.

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'workspace_members'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.workspace_members drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.workspace_members
  drop constraint if exists workspace_members_role_chk;

alter table public.workspace_members
  add constraint workspace_members_role_chk
  check (role in ('admin', 'finance', 'member'));

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'workspace_invites'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.workspace_invites drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.workspace_invites
  drop constraint if exists workspace_invites_role_chk;

alter table public.workspace_invites
  add constraint workspace_invites_role_chk
  check (role in ('admin', 'finance', 'member'));
