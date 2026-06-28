-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 1: Public data layer + security boundary
-- Shared database with the Esker OS CRM. ADDITIVE ONLY — nothing here renames,
-- drops, or changes existing CRM data or behaviour. Safe to run more than once.
-- Paste into Supabase → SQL Editor → Run.
--
-- Strategy: the base tables (properties, bookings, guests, …) stay COMPLETELY
-- locked to the public, exactly as they are today. The public website + guest
-- AI (the `anon` key) get ONLY two read-only "windows":
--   1. public_listings     — safe columns, only rows where public_listing = true
--   2. public_availability — free/busy dates for those public listings only
-- Everything else (financials, PII, payment proofs, caretakers, wifi/access,
-- internal notes, ops status) remains unreachable by the public.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Public-facing fields on properties (all default to OFF / null, so nothing
--    becomes public by accident — you switch each listing on deliberately).
alter table public.properties
  add column if not exists public_listing    boolean not null default false,
  add column if not exists esker_exclusive   boolean not null default false,
  add column if not exists public_title       text,
  add column if not exists public_description text,
  add column if not exists public_price        numeric,   -- public nightly price; falls back to nightly_rate
  add column if not exists capacity            integer;    -- how many guests it sleeps

comment on column public.properties.public_listing is
  'When true, this property is visible on the public Esker Stays website.';
comment on column public.properties.public_price is
  'Public nightly price shown on the website. If null, the listing view falls back to nightly_rate.';

-- 2. WINDOW 1 — public_listings: a safe projection of ONLY public-safe columns,
--    pre-filtered to public rows. The public never touches the base table.
create or replace view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)        as title,
    p.area,
    p.kind                                   as category,  -- Apartment / Penthouse / Farmhouse / Villa / Content Space …
    p.type,
    p.bedrooms,
    p.capacity,
    coalesce(p.public_price, p.nightly_rate) as price,
    p.public_description                     as description,
    p.amenities,
    p.photos,
    p.esker_exclusive
  from public.properties p
  where p.public_listing = true;

comment on view public.public_listings is
  'Public read window: safe listing fields for properties flagged public_listing = true. Exposed to the anon role.';

-- 3. WINDOW 2 — public_availability: only the busy DATE RANGES for public
--    listings, derived from bookings. No guest, no amount, no status detail —
--    just "these dates are taken" so the site can grey them out.
--    (The set of blocking statuses is business logic and can be tuned later.)
create or replace view public.public_availability
with (security_invoker = false) as
  select
    b.property_id,
    b.checkin::date  as start_date,
    b.checkout::date as end_date
  from public.bookings b
  join public.properties p on p.id = b.property_id
  where p.public_listing = true
    and b.checkout >= current_date
    and coalesce(b.lost_reason, '') = ''
    and b.status in (
      'awaiting_payment', 'payment_collected', 'handed_over',
      'awaiting_checkin', 'currently_staying', 'needs_attention'
    );

comment on view public.public_availability is
  'Public read window: busy date ranges (no PII/amounts) for public listings, so the website can block taken dates.';

-- 4. Grant read access on ONLY these two windows to the public + signed-in
--    roles. The base tables are NOT granted to anon — they stay locked.
grant select on public.public_listings    to anon, authenticated;
grant select on public.public_availability to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (optional — run these as a sanity check after the migration):
--   -- Should list ONLY columns we intend to expose, nothing internal:
--   select * from public.public_listings limit 1;
--   -- Should be empty until you switch a listing on:
--   select count(*) from public.public_listings;
-- To make ONE property public for testing (pick a real id):
--   update public.properties
--     set public_listing = true, esker_exclusive = true,
--         public_title = 'Studio Penthouse E-11',
--         public_description = 'Jacuzzi, bamboo terrace, Margalla views.',
--         capacity = 2
--     where name = 'Studio Penthouse E-11';
-- ─────────────────────────────────────────────────────────────────────────
