-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 23: saved stays (the heart on every card, per account)
-- Paste into Supabase → SQL Editor → Run. Idempotent.
--
-- The guest app keeps hearts on the phone for signed-out guests; once a guest
-- signs in, they live here and follow the account to every device. One row per
-- (account, stay). `listing_id` has no foreign key on purpose: a saved stay may
-- be Esker's own (`properties`) or resold (`external_properties`), and a stay
-- that's later unpublished simply drops out of the Saved list rather than
-- failing a constraint.
--
-- A guest reads, adds and removes only their own rows (RLS); the app's routes
-- use the guest's own session, so no service role is involved.
-- ─────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.saved_stays (
  account_id uuid not null references public.accounts (id) on delete cascade,
  listing_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (account_id, listing_id)
);

create index if not exists saved_stays_recent_idx on public.saved_stays (account_id, created_at desc);

alter table public.saved_stays enable row level security;

grant select, insert, delete on public.saved_stays to authenticated;

drop policy if exists saved_stays_read_own on public.saved_stays;
create policy saved_stays_read_own on public.saved_stays
  for select to authenticated using (account_id = auth.uid());

drop policy if exists saved_stays_add_own on public.saved_stays;
create policy saved_stays_add_own on public.saved_stays
  for insert to authenticated with check (account_id = auth.uid());

drop policy if exists saved_stays_remove_own on public.saved_stays;
create policy saved_stays_remove_own on public.saved_stays
  for delete to authenticated using (account_id = auth.uid());

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: select count(*) from public.saved_stays;   -- 0 rows, no error
-- ─────────────────────────────────────────────────────────────────────────
