# Cloud auth + task assignment fix

Ovaj ZIP radi dve stvari:

1. Stabilizuje cloud auth/workspace hydrate:
   - auth listener više ne pokreće isti workspace load iznova za istog usera
   - sprečava login/logout treperenje izazvano ponovnim `getSession`/`onAuthStateChange` krugovima

2. Čisti delegaciju taskova u cloud modu:
   - `CreateTaskForm` više ne koristi lokalne mock korisnike (`Marko`, `Jelena`, `Finansije`)
   - dropdown `Dodeljeno` koristi korisnike iz `AuthStore`, a u cloud modu to su Supabase `workspace_members`
   - ako cloud workspace nema članove, dropdown prikazuje `Nema clanova workspace-a`

Napomena:
Ako konzola i dalje vraća `ERR_INSUFFICIENT_RESOURCES` za `profiles` ili `workspace_members`, to je RLS/policy problem u Supabase tabelama, ne UI dropdown problem.
