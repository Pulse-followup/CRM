# PULSE UI rewrite notes

Implemented from `UI izmene 3004.txt` phase plan:

- Removed old sidebar-first UX from active layouts.
- Top shell is now logo + current role/user + hamburger with Podešavanja.
- User Home is task-focused: overdue / today / in progress.
- Finance Home is billing-focused: draft / invoiced / paid / overdue.
- Admin Home is command-center style: Hitno-Bitno, Moj tim, Naplata, Klijenti score card, Pretraga, create buttons.
- Added shared modal layer with close on X and click outside.
- User task detail and Finance billing detail now open as modals.
- Admin cards open contextual modals for task, billing, project, client.

Important:
- Supabase/store shapes/lifecycle/scoring/billing engines were not refactored.
- Create client/project buttons currently open modal placeholders; wire full forms in the next phase.
- Existing deep routes are still kept as fallback.
