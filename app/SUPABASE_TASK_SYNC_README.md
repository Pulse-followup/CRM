# PULSE React - FAZA 2.2 Task sync

Ovaj ZIP dodaje osnovni Supabase sync za taskove:

- TaskProvider cita `public.tasks` po aktivnom workspace-u.
- Admin kreiranje taska radi `upsert` u Supabase.
- User Home cita iste cloud taskove i filtrira po `assigned_to_user_id`.
- User akcije `STAVI NA CEKANJE` / `ZAVRSI TASK` rade update u Supabase.
- Settings ima status i dugme `Osvezi taskove`.

## Obavezno u Supabase

Pokreni SQL fajl:

`supabase/react-tasks-sync-foundation.sql`

Ako tabela vec postoji iz legacy projekta, SQL samo dodaje kolone/policies koje fale.

## Test flow

1. Admin login.
2. Settings: proveri da su Klijenti/Projekti/Taskovi `cloud` ili `cloud-empty`.
3. Admin otvori karticu klijenta -> Nova aktivnost.
4. Dodeli task clanu iz workspace-a.
5. U drugom browseru login kao taj clan.
6. User Home treba da prikaže task.

Ako task ne postoji kod usera: Settings -> Osvezi taskove.
