-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 4: website bookings link to the guest account
-- ADDITIVE + CRM-SAFE. Adds one nullable column to bookings and one ADDITIVE
-- RLS policy so a logged-in guest can read ONLY their own website bookings.
-- The website never INSERTs through RLS — bookings are written by a validated,
-- server-side service-role action. Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- Link a website booking to its guest account (the CRM ignores this column).
alter table public.bookings
  add column if not exists account_id uuid references public.accounts (id);

-- Additive: a signed-in guest can SELECT only their own bookings (powers
-- "My bookings"). Staff policies are untouched; RLS policies are OR-ed, so staff
-- still see everything and guests see only rows where account_id = their id.
drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings
  for select to authenticated using (account_id = auth.uid());

commit;
