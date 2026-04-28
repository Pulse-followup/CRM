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
