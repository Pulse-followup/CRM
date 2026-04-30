# PULSE workspace / invites faza

Sta je dodato:

- Supabase client za React (`src/lib/supabaseClient.ts`)
- Cloud workspace store (`src/features/cloud/cloudStore.tsx`)
- Auth role mapping iz `workspace_members`
- Podesavanja ekran za:
  - login / signup
  - kreiranje workspace-a
  - pozivanje clanova tima
  - dodelu role i vrednosti radnog sata
  - prihvatanje invite linka
- SQL migration: `supabase/workspace-invites-foundation.sql`

## Test flow

1. U Supabase SQL editoru izvrsi `supabase/workspace-invites-foundation.sql`.
2. Napravi `.env.local` prema `.env.example`.
3. Pokreni:

```bash
npm install
npm run dev
```

4. Idi na Podesavanja.
5. Kreiraj nalog / login kao admin.
6. Kreiraj workspace.
7. Pozovi clana tima: email + rola + satnica.
8. Kopiraj invite link.
9. Otvori link u drugom browseru/incognito.
10. Clan se registruje/loguje istim emailom.
11. Klikne `Prihvati poziv u workspace`.
12. Home ekran se menja po roli iz workspace-a.

Napomena: ova faza uvodi workspace/auth/invite foundation. Jos ne migrira clients/projects/tasks/billing podatke u Supabase React store-ove.
