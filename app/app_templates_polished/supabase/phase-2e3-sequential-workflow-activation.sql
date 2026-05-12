-- FAZA 2E.3 — Sequential workflow activation
-- Adds lightweight workflow sequencing fields to tasks.
-- Run in Supabase SQL Editor before testing cloud mode.

alter table public.tasks
add column if not exists sequence_order integer,
add column if not exists depends_on_task_id text,
add column if not exists activated_at timestamptz,
add column if not exists estimated_minutes integer;

create index if not exists idx_tasks_project_sequence_order
on public.tasks(project_id, sequence_order);

create index if not exists idx_tasks_depends_on_task_id
on public.tasks(depends_on_task_id);
