# PULSE - Task completion -> Billing flow fix

Ovaj update vraća izgubljeni workflow:

1. User otvara task modal.
2. Ako je task `dodeljen`, prvo ide `PREUZMI TASK` -> status `u_radu`.
3. Klik `ZAVRŠI TASK` ne zatvara task odmah, već otvara formu:
   - utrošeno vreme u minutima
   - trošak materijala
   - opis materijala
4. Potvrda završetka upisuje u task:
   - status `zavrsen`
   - `timeSpentMinutes`
   - `materialCost`
   - `materialDescription`
   - `laborCost` iz vrednosti radnog sata člana workspace-a
   - `billingState = ready_for_billing` ako postoji rad/materijal
5. Finance Home u sekciji `Za fakturisanje` prikazuje završene taskove sa `ready_for_billing`.
6. Finance klikom otvara modal za fakturu:
   - broj fakture
   - opis
   - iznos
   - valuta
   - rok plaćanja
7. Snimanje kreira billing nalog kao `Fakturisano` i task prebacuje na:
   - status `poslat_na_naplatu`
   - `billingState = sent_to_billing`

Napomena: billing record trenutno koristi postojeći BillingStore mehanizam. Sledeća faza treba da bude full Supabase persistence za billing tabelu.
