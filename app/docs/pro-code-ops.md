# PRO Code Ops

## Redosled migracija

1. `supabase/phase-10-1-workspace-plan-mvp.sql`
2. `supabase/phase-10-2-pro-codes.sql`

## Kreiranje novog PRO koda

Pokreni u Supabase SQL Editor-u:

```sql
select *
from public.issue_pro_code(
  p_label => 'Kupac ACME / maj 2026',
  p_assigned_email => 'admin@acme.rs',
  p_assigned_workspace_id => null,
  p_expires_at => now() + interval '30 days',
  p_max_activations => 1
);
```

## Primer koda vezanog za konkretan workspace

```sql
select *
from public.issue_pro_code(
  p_label => 'ACME workspace only',
  p_assigned_email => 'admin@acme.rs',
  p_assigned_workspace_id => 'WORKSPACE_UUID_HERE',
  p_expires_at => now() + interval '30 days',
  p_max_activations => 1
);
```

## Pregled izdatih kodova

```sql
select
  code,
  label,
  status,
  used_count,
  max_activations,
  assigned_email,
  assigned_workspace_id,
  activated_workspace_id,
  expires_at,
  created_at
from public.pro_codes
order by created_at desc;
```

## Opoziv koda

```sql
update public.pro_codes
set status = 'revoked',
    updated_at = now()
where code = 'PULSE-PRO-XXXX-XXXX-XXXX';
```
