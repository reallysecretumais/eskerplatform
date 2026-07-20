-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 17: publish EXTERNAL (resale) inventory to the website
-- Paste into Supabase → SQL Editor → Run. Idempotent. Runs in one transaction.
--
-- Esker resells apartments sourced from other owners (`external_properties`).
-- The CRM can now flag them public_listing / esker_exclusive (CRM phase45) and
-- caches owner iCal busy-ranges (CRM phase46 → `external_ical_busy`).
--
-- WHY A VIEW (not service-role reads): `external_properties` is staff-only in
-- RLS and holds `typical_cost` (what Esker pays the owner = our margin),
-- `owner_id` (supplier identity), `ical_url` and internal `notes`. Projecting a
-- fixed, safe column list through a security_invoker=false view makes leaking
-- any of those STRUCTURALLY IMPOSSIBLE, instead of a discipline problem in app
-- code. Same anon-only wall the rest of the public site already uses.
--
-- Guests must not be able to tell these apart from Esker-run stays (founder
-- decision), so external rows are UNIONed into the SAME two public windows and
-- carry a `source` discriminator the app uses only for availability + booking
-- logic — never for display.
--
-- NOTE: these views are DROPped and recreated rather than CREATE OR REPLACEd,
-- because we're appending a column and unioning a second table (replace can
-- only append identical-typed columns in the same order). Nothing on the CRM
-- side reads either view (verified), and the whole thing is one transaction, so
-- there is no window where the site sees a missing view.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ── WINDOW 1 — public_listings: Esker-run + published external inventory ────
-- NEVER expose from external_properties: typical_cost, owner_id, notes,
-- ical_url, ical_synced_at, availability, availability_checked_at.
-- `description` deliberately has NO fallback to `notes` (internal staff field).
drop view if exists public.public_listings;
create view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)         as title,
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
    p.public_facts,
    'esker'::text                            as source
  from public.properties p
  where p.public_listing = true

  union all

  select
    e.id,
    coalesce(e.public_title, e.name)          as title,
    l.name                                    as area,   -- no `area` text col here; comes via location_id
    e.kind                                    as category,
    null                                      as type,   -- external has no `type`; adopts p.type's type
    e.bedrooms,
    e.capacity,
    coalesce(e.public_price, e.typical_price) as price,
    e.public_description                      as description,
    e.amenities,
    e.photo_urls                              as photos,
    e.esker_exclusive,
    null                                      as public_facts,
    'external'::text                          as source
  from public.external_properties e
  left join public.locations l on l.id = e.location_id
  where e.public_listing = true
    and e.active = true;   -- retired stock is deactivated, not deleted

comment on view public.public_listings is
  'Public read window: safe listing fields for published Esker-run properties AND published external (resale) inventory. `source` = esker|external (app logic only, never shown). Exposed to anon.';

-- ── WINDOW 2 — public_availability: busy date ranges for both kinds ─────────
-- External units key on external_properties.id, which IS the listing id above,
-- so callers keep grouping by a single `property_id`.
drop view if exists public.public_availability;
create view public.public_availability
with (security_invoker = false) as
  -- Esker-run: real bookings (website unpaid holds auto-release after 18h)
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
    )
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or b.created_at > now() - interval '18 hours'
    )

  union all

  -- Esker-run: host date-blocks
  select
    k.property_id,
    k.start_date,
    k.end_date
  from public.property_blocks k
  join public.properties p on p.id = k.property_id
  where p.public_listing = true
    and k.end_date >= current_date

  union all

  -- External: bookings against the resale unit (property_id is NULL on these)
  select
    b.external_property_id as property_id,
    b.checkin::date        as start_date,
    b.checkout::date       as end_date
  from public.bookings b
  join public.external_properties e on e.id = b.external_property_id
  where e.public_listing = true
    and e.active = true
    and b.checkout >= current_date
    and coalesce(b.lost_reason, '') = ''
    and b.status in (
      'awaiting_payment', 'payment_collected', 'handed_over',
      'awaiting_checkin', 'currently_staying', 'needs_attention'
    )

  union all

  -- External: owner iCal busy-ranges cached by the CRM's sync cron.
  -- Included regardless of sync freshness — stale busy data is the SAFE side
  -- (it only ever hides dates). Freshness decides instant-book vs request-to-
  -- book, and that is an app-side call using ical_synced_at (never exposed).
  select
    x.external_property_id as property_id,
    x.starts::date         as start_date,
    x.ends::date           as end_date   -- `ends` is exclusive, like checkout
  from public.external_ical_busy x
  join public.external_properties e on e.id = x.external_property_id
  where e.public_listing = true
    and e.active = true
    and x.ends >= current_date;

comment on view public.public_availability is
  'Public read window: busy date ranges (no PII/amounts) for published Esker-run properties (bookings + host blocks) and external resale units (bookings + cached owner iCal).';

-- Base tables stay ungranted to anon; only these two windows are readable.
grant select on public.public_listings     to anon, authenticated;
grant select on public.public_availability to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (optional, after running):
--   select source, count(*) from public.public_listings group by source;
--   -- Confirm NOTHING sensitive leaked (should error / not exist as columns):
--   select * from public.public_listings limit 1;   -- eyeball the column list
--   -- Busy ranges for a given external unit:
--   select * from public.public_availability where property_id = '<external id>';
-- ─────────────────────────────────────────────────────────────────────────
