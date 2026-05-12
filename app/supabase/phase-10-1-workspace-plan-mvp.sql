alter table if exists public.workspaces
add column if not exists plan_type text not null default 'FREE';

update public.workspaces
set plan_type = 'FREE'
where plan_type is null or trim(plan_type) = '';

alter table if exists public.workspaces
drop constraint if exists workspaces_plan_type_check;

alter table if exists public.workspaces
add constraint workspaces_plan_type_check
check (plan_type in ('FREE', 'PRO'));
