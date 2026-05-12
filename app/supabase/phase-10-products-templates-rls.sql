-- Phase 10: Products / templates RLS alignment for React cloud create/update/delete.

alter table if exists public.products enable row level security;
alter table if exists public.product_clients enable row level security;
alter table if exists public.process_templates enable row level security;
alter table if exists public.process_template_steps enable row level security;

create index if not exists idx_products_workspace_id on public.products(workspace_id);
create index if not exists idx_product_clients_product_id on public.product_clients(product_id);
create index if not exists idx_process_templates_workspace_id on public.process_templates(workspace_id);
create index if not exists idx_process_template_steps_template_id on public.process_template_steps(template_id);

drop policy if exists "products_select_member" on public.products;
create policy "products_select_member" on public.products
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "products_insert_member" on public.products;
create policy "products_insert_member" on public.products
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "products_update_member" on public.products;
create policy "products_update_member" on public.products
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "products_delete_member" on public.products;
create policy "products_delete_member" on public.products
for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "product_clients_select_member" on public.product_clients;
create policy "product_clients_select_member" on public.product_clients
for select to authenticated using (
  exists (
    select 1
    from public.products p
    where p.id = product_clients.product_id
      and public.is_workspace_member(p.workspace_id)
  )
);

drop policy if exists "product_clients_insert_member" on public.product_clients;
create policy "product_clients_insert_member" on public.product_clients
for insert to authenticated with check (
  exists (
    select 1
    from public.products p
    where p.id = product_clients.product_id
      and public.is_workspace_member(p.workspace_id)
  )
);

drop policy if exists "product_clients_delete_member" on public.product_clients;
create policy "product_clients_delete_member" on public.product_clients
for delete to authenticated using (
  exists (
    select 1
    from public.products p
    where p.id = product_clients.product_id
      and public.is_workspace_member(p.workspace_id)
  )
);

drop policy if exists "process_templates_select_member" on public.process_templates;
create policy "process_templates_select_member" on public.process_templates
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "process_templates_insert_member" on public.process_templates;
create policy "process_templates_insert_member" on public.process_templates
for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "process_templates_update_member" on public.process_templates;
create policy "process_templates_update_member" on public.process_templates
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "process_templates_delete_member" on public.process_templates;
create policy "process_templates_delete_member" on public.process_templates
for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "process_template_steps_select_member" on public.process_template_steps;
create policy "process_template_steps_select_member" on public.process_template_steps
for select to authenticated using (
  exists (
    select 1
    from public.process_templates t
    where t.id = process_template_steps.template_id
      and public.is_workspace_member(t.workspace_id)
  )
);

drop policy if exists "process_template_steps_insert_member" on public.process_template_steps;
create policy "process_template_steps_insert_member" on public.process_template_steps
for insert to authenticated with check (
  exists (
    select 1
    from public.process_templates t
    where t.id = process_template_steps.template_id
      and public.is_workspace_member(t.workspace_id)
  )
);

drop policy if exists "process_template_steps_delete_member" on public.process_template_steps;
create policy "process_template_steps_delete_member" on public.process_template_steps
for delete to authenticated using (
  exists (
    select 1
    from public.process_templates t
    where t.id = process_template_steps.template_id
      and public.is_workspace_member(t.workspace_id)
  )
);
