-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 14: Host portal (self-listing + host chat + host ID)
-- Additive + idempotent + CRM-SAFE. Paste into Supabase → SQL Editor → Run.
--
-- Four pieces:
--   1. Harden public_listings: a listing is public ONLY when public_listing=true
--      AND listing_status='live' — so a pending / paused / rejected host listing
--      can never leak, and pausing works without touching public_listing.
--   2. Host chat RLS: a host can READ conversations (and their messages) where
--      conversations.owner_account_id = their account — powers the host inbox's
--      session reads AND realtime. Writes stay service-role-only via actions.
--   3. Host identity: accounts.id_front_url/id_back_url/id_verified_at — the
--      CNIC a host verifies before they can list (files in guest-docs, private).
--   4. properties.review_note — the admin's note on reject/pause, shown to the
--      host in their portal.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Recreate the public window with the listing_status gate (defense-in-depth).
--    Column list MUST match the deployed view exactly (02 appended public_facts;
--    create-or-replace cannot drop/reorder columns) — only the WHERE changes.
create or replace view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)        as title,
    p.area,
    p.kind                                   as category,
    p.type,
    p.bedrooms,
    p.capacity,
    coalesce(p.public_price, p.nightly_rate) as price,
    p.public_description                     as description,
    p.amenities,
    p.photos,
    p.esker_exclusive,
    p.public_facts
  from public.properties p
  where p.public_listing = true
    and coalesce(p.listing_status, 'live') = 'live';

comment on view public.public_listings is
  'Public read window: safe listing fields for properties with public_listing = true AND listing_status = live. Exposed to the anon role.';

grant select on public.public_listings to anon, authenticated;

-- 2. Host chat RLS — additive SELECT policies (OR-ed with the existing
--    guest/account policies; staff service-role access is unaffected).
drop policy if exists conversations_select_owner on public.conversations;
create policy conversations_select_owner on public.conversations
  for select to authenticated using (owner_account_id = auth.uid());

drop policy if exists messages_select_owner on public.messages;
create policy messages_select_owner on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.owner_account_id = auth.uid()
    )
  );

-- Host-side unread marker (mirror of guest_last_read_at on the other side).
alter table public.conversations
  add column if not exists owner_last_read_at timestamptz;

-- 3. Host ID verification (CNIC) on the website account.
alter table public.accounts
  add column if not exists id_front_url   text,
  add column if not exists id_back_url    text,
  add column if not exists id_verified_at timestamptz;

comment on column public.accounts.id_verified_at is
  'When the account''s CNIC passed the AI check (required before hosting). Files live in the private guest-docs bucket.';

-- 4. Admin note to the host on reject / pause.
alter table public.properties
  add column if not exists review_note text;

comment on column public.properties.review_note is
  'Staff note shown to the host when their listing is rejected or paused.';

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   -- A pending row must NOT appear even if public_listing were true:
--   --   (all current rows default listing_status='live', so count is unchanged)
--   select count(*) from public.public_listings;
--   select policyname from pg_policies where tablename in ('conversations','messages');
-- ─────────────────────────────────────────────────────────────────────────
