# PULSE React - FAZA 2: Supabase read hydrate

Sta je dodato:

- React ClientStore pokusava da ucita `clients` iz Supabase aktivnog workspace-a.
- React ProjectStore pokusava da ucita `projects` iz Supabase aktivnog workspace-a.
- Ako Supabase nema podatke ili query padne, app nastavlja sa localStorage/mock podacima.
- Nema write sync-a u ovoj fazi. `+ Novi klijent` i `+ Novi projekat` za sada i dalje rade lokalno.

Test:

1. `.env.local` u `app/` folderu mora imati:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

2. Pokreni:

```bash
npm install
npm run dev
```

3. Idi na `Settings` i proveri `Workspace cloud`.

4. Ispod clanova workspace-a imas `Supabase read status`:

- `cloud` = povukao podatke iz Supabase-a
- `fallback` = Supabase radi, ali nema klijenata/projekata za workspace pa ostaje lokalni seed
- `error` = query nije prosao; najcesce tabela ili RLS policy nije spreman
- `local` = nema konfigurisanog/aktivnog workspace-a

Ako tabele ne postoje, pokreni `supabase/react-clients-projects-read-foundation.sql` u SQL editoru.
