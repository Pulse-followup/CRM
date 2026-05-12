# PULSE Enterprise MVP final notes

This build follows the strict enterprise flow:

1. Admin creates workspace and invites members with: name, email, role, hourly rate.
2. Members accept invite and their profile display name is used in header, delegation dropdowns, task cards and billing summaries.
3. Admin creates clients/projects/tasks.
4. User accepts/holds/completes tasks. Completion captures time/material, but does not create billing automatically.
5. Admin opens project and initiates billing record from completed tasks.
6. System calculates billing summary: task count, labor cost from time x hourly rate, material cost, net amount, optional margin.
7. Finance receives billing record in "Za fakturisanje", enters invoice number/description/amount/currency/due date, then marks invoiced.
8. Finance marks paid; overdue invoiced records surface as late for Finance and Admin.

Run in Supabase SQL Editor if your DB already existed before this build:

- `supabase/react-user-display-name-invites.sql`
- `supabase/react-enterprise-billing-flow-final.sql`

For a fresh DB, run the foundation SQLs in order.
