# PULSE final billing write fix

This package hard-writes billing_records when Admin sends billing from:
- Admin Home project modal
- Project Detail screen

Finance now has an actual billing_records row to read.

Run:
- app/supabase/final-mvp-stabilization.sql
- npm run build
- npm run dev
