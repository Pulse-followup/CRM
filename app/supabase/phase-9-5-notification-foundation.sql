create table if not exists public.notifications (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text not null,
  entity_id text not null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_workspace_recipient_created_idx
  on public.notifications (workspace_id, recipient_user_id, created_at desc);

create index if not exists notifications_workspace_recipient_unread_idx
  on public.notifications (workspace_id, recipient_user_id, read_at);
