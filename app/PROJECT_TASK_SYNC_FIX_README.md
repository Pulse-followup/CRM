# Project + Task Sync Fix

Ovaj ZIP rešava slučaj gde se projekat kreira lokalno, a task se zatim pokušava upisati u Supabase sa `project_id` koji ne postoji u bazi.

## Šta je promenjeno

- `addProject` sada u cloud modu prvo upisuje projekat u Supabase.
- Tek sačuvan projekat ulazi u React state.
- `addTask` koristi novi jedinstveni ID i radi `insert` umesto `upsert`.
- Dodan je tip projekta `Prodaja`.
- Client create/update takođe ide u Supabase u cloud modu, da ne nastaju lokalni klijenti bez baze.

## Obavezno pokrenuti u Supabase SQL Editoru

```sql
app/supabase/react-project-task-sync-fix.sql
```

## Test

1. Admin kreira klijenta ili koristi postojećeg.
2. Admin kreira projekat tipa `Prodaja`.
3. Otvori karticu klijenta → projekti → novi projekat se vidi posle refresh-a.
4. Admin kreira task na tom projektu.
5. Task ne sme da vrati 409 conflict.
6. User kojem je task dodeljen treba da ga vidi na User Home.
