# PULSE MVP - Billing workflow V1

## Flow

1. Admin creates project and tasks.
2. User accepts/works task.
3. User clicks `Završi task` and enters:
   - spent time
   - material cost
   - material description
4. Task becomes `zavrsen` only. It is NOT sent directly to Finance.
5. Admin opens project details and reviews completed, unbilled tasks.
6. Admin clicks `Pošalji na naplatu`.
7. App creates a `billing_records` row with status `draft` and marks included tasks as `sent_to_billing`.
8. Finance sees the draft in `Za fakturisanje`.
9. Finance enters invoice number, amount, currency, and due date, then marks it `Fakturisano`.
10. Finance marks it `Plaćeno` after payment.
11. If due date passes while status is `Fakturisano`, app treats it as `Kasni`; Admin sees it in `Hitno – Bitno` and `Naplata`.

## Supabase SQL

Run this new SQL file after the previous workspace/client/project/task SQL files:

```text
app/supabase/react-billing-workflow-v1.sql
```

## Notes

- User completion data is stored on `tasks`.
- Billing orders are stored in `billing_records`.
- Finance no longer invoices raw tasks directly.
- This is V1 final-project billing. Partial/mid-project billing can be added later.
