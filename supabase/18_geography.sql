-- ─────────────────────────────────────────────────────────────────────────
-- Esker — 18: GEOGRAPHY (markets) + two verified bug fixes
-- Paste into Supabase → SQL Editor → Run. Idempotent. One transaction.
--
-- WHY MARKETS, NOT CITIES (founder decision 2026-07-26):
-- Islamabad + Rawalpindi are ONE market to a guest — someone browsing
-- Islamabad expects a Bahria Phase 7 stay 25 minutes away, and that stay is in
-- Rawalpindi. Lahore and Karachi arrive soon and must NEVER bleed into
-- Islamabad results. So the hierarchy is market → city → area:
--   • market — the only level a guest selects  (Islamabad · Rawalpindi)
--   • city   — the truth-teller, shown in every label, never a filter
--   • area   — the fine filter inside a market  (E-11, Bahria Phase 7)
-- Adding Lahore later = insert one market row + its areas. No code, no deploy.
--
-- THIS MIGRATION ALSO FIXES TWO BUGS, both verified against this database on
-- 2026-07-26 (not inferred from source):
--
--   BUG 1 — LIVE NOW: CRM-created listings publish with a BLANK area.
--   `phase5e` (CRM) retired the free-text properties.area column and the CRM
--   stopped writing it (it writes location_id only), but public_listings still
--   reads p.area. Verified: "Al-Mustufa Apartment" has location_id set and
--   area = NULL, and ships to the public with no area at all. This is the root
--   cause of the long-standing "Al-Mustufa has no area" symptom.
--   FIX: the view reads locations (l.name as area) and stops trusting the text
--   column. Nothing writes properties.area anymore, so it cannot drift again.
--
--   BUG 2 — LATENT, fires on the first host pause: public_listings lost its
--   listing_status = 'live' gate. `14_host_portal.sql` added it as
--   defense-in-depth; `17_external_listings.sql` recreated the view and dropped
--   it. app/host/actions.ts setListingStatus() changes ONLY listing_status and
--   never public_listing — so the first host who pauses a listing would stay
--   publicly bookable. Verified nothing is leaking today (no public listing sits
--   in a non-live state). FIX: restore the gate.
--
-- Views are DROP + CREATE (not CREATE OR REPLACE) because we are adding columns
-- in the middle of the column list. Nothing on the CRM side reads these views
-- (verified), and it is one transaction, so the site never sees a missing view.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. Markets ──────────────────────────────────────────────────────────────
create table if not exists public.markets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,          -- 'Islamabad · Rawalpindi'
  slug       text not null unique,           -- 'isb-rwp'  (stable app/URL key)
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.markets is
  'A metro a guest would happily travel within. The ONLY geography level a guest selects. Contains one or more cities (Islamabad + Rawalpindi are one market). Adding a market is a data insert, never a release.';

alter table public.markets enable row level security;

-- Everyone may read markets (they are public catalogue data, like locations);
-- only admins may write.
drop policy if exists markets_select_all on public.markets;
create policy markets_select_all on public.markets
  for select to anon, authenticated using (true);

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write on public.markets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.markets to anon, authenticated;

-- Seed the launch market (idempotent).
insert into public.markets (name, slug, sort_order)
values ('Islamabad · Rawalpindi', 'isb-rwp', 1)
on conflict (slug) do nothing;

-- ── 2. Areas belong to a market ─────────────────────────────────────────────
alter table public.locations
  add column if not exists market_id uuid references public.markets(id) on delete set null;

comment on column public.locations.market_id is
  'The market this area belongs to. Guests filter by market; the area is the fine filter within it.';

create index if not exists locations_market_id_idx on public.locations (market_id);

-- Attach every existing area to the launch market. Safe to re-run: only fills
-- rows that have no market yet, so a later manual re-assignment is never undone.
update public.locations
   set market_id = (select id from public.markets where slug = 'isb-rwp')
 where market_id is null;

-- ── 3. City correction (founder-confirmed 2026-07-26) ───────────────────────
-- Every area was seeded city='Islamabad'. The Bahria Town phases are really
-- Rawalpindi. They STAY in the same market, so nothing disappears from search —
-- the market keeps them visible, the city keeps them honest.
-- (Gulberg Greens, Near Airport, E-11, F-10/F-11, B-17 remain Islamabad.)
update public.locations
   set city = 'Rawalpindi'
 where name in ('Bahria Town (Phase 1-4)', 'Bahria Town (Phase 7-8)')
   and city <> 'Rawalpindi';

-- ── 4. The guest's home market ──────────────────────────────────────────────
alter table public.accounts
  add column if not exists home_market text;   -- markets.slug; null = not chosen yet

comment on column public.accounts.home_market is
  'markets.slug the guest last browsed. The app leads with it; the guest changes it from the Explore header.';

-- ── 5. WINDOW 1 — public_listings: + market, market_slug, city ──────────────
-- Area now comes from `locations` for BOTH branches (fixes BUG 1). The external
-- branch already joined locations and simply discarded l.city.
-- NEVER expose from external_properties: typical_cost, owner_id, notes,
-- ical_url, ical_synced_at, availability, availability_checked_at.
drop view if exists public.public_listings;
create view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)         as title,
    -- BUG 1 FIX: read the normalized location, fall back to the legacy text
    -- column only for any row that predates location_id.
    coalesce(l.name, p.area)                 as area,
    l.city                                   as city,
    m.name                                   as market,
    m.slug                                   as market_slug,
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
  left join public.locations l on l.id = p.location_id
  left join public.markets   m on m.id = l.market_id
  where p.public_listing = true
    -- BUG 2 FIX: restore the defense-in-depth gate dropped by migration 17.
    and coalesce(p.listing_status, 'live') = 'live'

  union all

  select
    e.id,
    coalesce(e.public_title, e.name)          as title,
    l.name                                    as area,   -- no `area` text col here
    l.city                                    as city,
    m.name                                    as market,
    m.slug                                    as market_slug,
    e.kind                                    as category,
    null                                      as type,   -- external has no `type`
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
  left join public.markets   m on m.id = l.market_id
  where e.public_listing = true
    and e.active = true;   -- retired stock is deactivated, not deleted

comment on view public.public_listings is
  'Public read window: safe listing fields for published Esker-run properties AND published external (resale) inventory. Geography = market (guest-selectable) + city (label truth) + area (fine filter). `source` = esker|external (app logic only, never shown). Gated on listing_status = live. Exposed to anon.';

grant select on public.public_listings to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (run after):
--   -- Every public listing now has an area + city + market (no blanks):
--   select title, area, city, market from public.public_listings order by city, area;
--   -- Al-Mustufa specifically (BUG 1 — should now show its area, not null):
--   select title, area, city from public.public_listings where title ilike '%mustufa%';
--   -- Areas grouped by city inside the one market (BUG-free geography):
--   select m.name as market, l.city, count(*) as areas
--     from public.locations l join public.markets m on m.id = l.market_id
--    group by 1, 2 order by 2;
--   -- BUG 2 — a paused listing must vanish from the public window:
--   --   (do this on a scratch listing only, then set it back to 'live')
--   -- update public.properties set listing_status='paused' where id='<id>';
--   -- select count(*) from public.public_listings where id='<id>';  -- expect 0
--
-- ADDING A NEW MARKET LATER (no deploy, no code):
--   insert into public.markets (name, slug, sort_order) values ('Lahore','lahore',2);
--   insert into public.locations (name, city, market_id, sort_order)
--     values ('DHA Phase 5', 'Lahore', (select id from public.markets where slug='lahore'), 1);
-- ─────────────────────────────────────────────────────────────────────────
