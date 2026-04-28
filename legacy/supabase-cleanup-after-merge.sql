-- Safe cleanup after workspace merge
-- Zadrzava kanonski workspace i aktivne klijente:
--   workspace_id = f9f60d6b-3eb0-4f73-b28d-2ec84349c1af
--   users = ddoslo@gmail.com, dragan@retailmediacenter.com
--
-- Pokreni tek kada potvrdis da oba naloga vide:
--   - Extra Care doo
--   - Galena Lab

begin;

-- 1. Provera da aktivni workspace i dalje ima 2 klijenta.
do $$
begin
  if (
    select count(*)
    from public.clients
    where workspace_id = 'f9f60d6b-3eb0-4f73-b28d-2ec84349c1af'::uuid
  ) < 2 then
    raise exception 'Cleanup stop: kanonski workspace nema ocekivan broj klijenata.';
  end if;
end $$;

-- 2. Obrisi stare duplikate workspace-a za ova dva usera.
create temp table old_rmc_workspaces as
select distinct w.id
from public.workspaces w
join public.workspace_members wm on wm.workspace_id = w.id
where w.name = 'RMC core'
  and wm.user_id in (
    '2a756572-078f-454a-855d-933cdd8530fd'::uuid,
    'b24a9843-752a-4043-973e-b6b55932e445'::uuid
  )
  and w.id <> 'f9f60d6b-3eb0-4f73-b28d-2ec84349c1af'::uuid;

delete from public.workspaces
where id in (select id from old_rmc_workspaces);

-- 3. Odrzi cist active membership samo u kanonskom workspace-u.
delete from public.workspace_members
where user_id in (
  '2a756572-078f-454a-855d-933cdd8530fd'::uuid,
  'b24a9843-752a-4043-973e-b6b55932e445'::uuid
)
and workspace_id <> 'f9f60d6b-3eb0-4f73-b28d-2ec84349c1af'::uuid;

-- 4. Ocisti stare user-level tragove iz legacy app_state.
delete from public.app_state
where user_id in (
  '2a756572-078f-454a-855d-933cdd8530fd'::uuid,
  'b24a9843-752a-4043-973e-b6b55932e445'::uuid
);

commit;

-- Post-check:
-- select count(*) from public.clients where workspace_id = 'f9f60d6b-3eb0-4f73-b28d-2ec84349c1af'::uuid;
-- select email, workspace_id, status from public.workspace_members wm join auth.users u on u.id = wm.user_id order by email;
