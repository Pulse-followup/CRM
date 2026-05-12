# PULSE - Cloud mode cleanup 2.1

Ovaj ZIP cisti mesanje lokalnih/mock podataka sa Supabase workspace-om.

## Sta je promenjeno

- Ako postoji aktivan Supabase workspace, `clients` i `projects` se pune samo iz Supabase-a.
- Ako Supabase vrati praznu listu, prikazuje se prazno stanje, ne mock/fake seed.
- Lokalni mock taskovi (`Marko`, `Jelena`, seed zadaci) se ne prikazuju kada je cloud workspace aktivan.
- Lokalni mock billing se ne prikazuje kada je cloud workspace aktivan.
- Admin Home filtrira taskove bez validne `clientId/projectId` veze, da ne prikazuje `Nepoznat klijent / Nepoznat projekat`.

## Sta ovo jos NIJE

Ovo nije full write-sync faza. U ovoj fazi jos ne upisujemo nove clients/projects/tasks/billing u Supabase kroz sve store-ove.

Sledeci korak:
- read/hydrate za tasks i billing iz Supabase-a
- zatim write actions: create client, create project, create task, update billing

## Test

1. Proveri da je `.env.local` u `app/` folderu.
2. Pokreni:

```bash
npm install
npm run dev
```

3. Uloguj se u Settings i osvezi workspace.
4. Admin Home ne sme vise da prikazuje mock Marko/Jelena taskove sa nepoznatim klijentima.
