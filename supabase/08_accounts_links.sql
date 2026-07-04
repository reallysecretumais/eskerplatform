-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 8: account ↔ property/owner links + relationship flags
-- Additive + idempotent. Paste into Supabase → SQL Editor → Run.
--
-- Groundwork for the owner/partner portals + the comms routing the chat needs.
-- Nothing here changes existing behaviour: every column defaults to the current
-- reality (Esker-owned, Esker-handled comms, already-live), so existing rows and
-- the CRM keep working untouched.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Link a website account to a CRM partner/investor deal record (admin sets it).
alter table public.owners
  add column if not exists account_id uuid references public.accounts (id) on delete set null;

-- 2. Property-side flags.
alter table public.properties
  -- The owner-account behind a managed or self-listed (host) listing.
  add column if not exists owner_account_id uuid references public.accounts (id) on delete set null,
  -- Relationship drives which portal + what data the owner sees. 'esker' = Esker-owned.
  add column if not exists owner_relationship text not null default 'esker'
    check (owner_relationship in ('esker', 'partner', 'managed', 'host')),
  -- Who handles guest comms for this listing. Only host listings default to 'owner'.
  add column if not exists comms_owner text not null default 'esker'
    check (comms_owner in ('esker', 'owner')),
  -- Host self-listings start 'pending' and go public only after admin approval.
  add column if not exists listing_status text not null default 'live'
    check (listing_status in ('live', 'pending', 'rejected', 'paused'));

create index if not exists properties_owner_account_idx on public.properties (owner_account_id);
create index if not exists owners_account_idx on public.owners (account_id);

comment on column public.properties.owner_relationship is
  'esker (Esker-owned) | partner (investor, Esker-comms) | managed (external, Esker-comms) | host (self-listed, owner-comms).';
comment on column public.properties.comms_owner is
  'Who replies to the guest: esker (staff) or owner (the host). Host listings = owner.';

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select owner_relationship, comms_owner, listing_status, count(*)
--     from public.properties group by 1,2,3;   -- all existing rows: esker/esker/live
-- ─────────────────────────────────────────────────────────────────────────
