-- ─────────────────────────────────────────────────────────────────────────
-- Esker Platform — 26: the AREA a stay is in, for the map before booking.
--
-- Esker OS phase97 adds each listing's exact point (latitude, longitude,
-- place_id, place_name, address) to properties + external_properties, set in
-- the CRM's Location card. Before a guest books, the app shows only an area:
-- a soft circle, never the building (founder, 26 Oct). 18 of 25 stays are
-- owner-listed, and the building lets a guest go around Esker.
--
-- This migration publishes only the area's CENTRE, `approx_lat` /
-- `approx_lng`, from phase97's `listing_approx_point()`: a fixed, salted
-- 120–300 m offset per listing, so the true point is always inside a 350 m
-- circle around it and the circle never moves. The exact columns are NEVER
-- selected here. The guest who booked gets the exact point from the trip API
-- (service role), once the trip is confirmed.
--
-- ⚠️ RUN ORDER: Esker OS `supabase/phase97_locations.sql` MUST run first: this
-- view reads p.latitude / e.latitude and calls listing_approx_point().
-- listing_approx_point is revoked from anon and authenticated; it works here
-- because this view runs as its owner (security_invoker = false).
--
-- The definition below is 21_listing_videos.sql's public_listings verbatim,
-- with `approx_lat` and `approx_lng` appended to BOTH branches of the union
-- (null until a location is set). Nothing else changes: same geography joins,
-- same security_invoker = false, same live/published gates, same mode-correct
-- price.
--
-- ⚠️ DROPPING A VIEW DROPS ITS GRANTS. The re-grant at the bottom is not
-- optional housekeeping — without it every anonymous visitor loses access
-- and the public site goes blank.
--
-- Safe to run more than once. Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

drop view if exists public.public_listings;
create view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)          as title,
    coalesce(l.name, p.area)                  as area,
    l.city                                     as city,
    m.name                                     as market,
    m.slug                                     as market_slug,
    p.kind                                     as category,
    coalesce(cm.mode, 'nightly')               as booking_mode,
    coalesce(cm.unit_label, 'night')           as price_unit,
    p.type,
    p.bedrooms,
    p.capacity,
    case coalesce(cm.mode, 'nightly')
      when 'blocks' then coalesce(s.min_price, p.public_price, p.nightly_rate)
      when 'hourly' then coalesce(p.hourly_price, p.public_price, p.nightly_rate)
      else               coalesce(p.public_price, p.nightly_rate)
    end                                        as price,
    p.public_description                       as description,
    p.amenities,
    p.photos,
    p.video_url,
    p.esker_exclusive,
    p.public_facts,
    'esker'::text                              as source,
    a.lat                                      as approx_lat,
    a.lng                                      as approx_lng
  from public.properties p
  left join public.locations      l  on l.id = p.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(p.kind))
  left join lateral (
    select min(ps.price) as min_price
    from public.property_slots ps
    where ps.property_id = p.id and ps.active
  ) s on true
  left join lateral public.listing_approx_point(p.id, p.latitude, p.longitude) a on true
  where p.public_listing = true
    and coalesce(p.listing_status, 'live') = 'live'

  union all

  select
    e.id,
    coalesce(e.public_title, e.name)           as title,
    l.name                                      as area,
    l.city                                      as city,
    m.name                                      as market,
    m.slug                                      as market_slug,
    e.kind                                      as category,
    coalesce(cm.mode, 'nightly')                as booking_mode,
    coalesce(cm.unit_label, 'night')            as price_unit,
    null                                        as type,
    e.bedrooms,
    e.capacity,
    coalesce(e.public_price, e.typical_price)   as price,
    e.public_description                        as description,
    e.amenities,
    e.photo_urls                                as photos,
    e.video_url,
    e.esker_exclusive,
    null                                        as public_facts,
    'external'::text                            as source,
    a.lat                                       as approx_lat,
    a.lng                                       as approx_lng
  from public.external_properties e
  left join public.locations      l  on l.id = e.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(e.kind))
  left join lateral public.listing_approx_point(e.id, e.latitude, e.longitude) a on true
  where e.public_listing = true
    and e.active = true;

comment on view public.public_listings is
  'Public read window: safe listing fields for published Esker-run + external inventory. Geography = market/city/area. booking_mode + price_unit come from category_modes so web and app cannot diverge. price is mode-correct (blocks = cheapest block). Gated on listing_status = live. video_url = optional walkthrough video. approx_lat/approx_lng = the AREA centre only (listing_approx_point; the true point is within 350 m); exact coordinates are never exposed. Exposed to anon.';

-- REQUIRED: the drop above removed this view's grants.
grant select on public.public_listings to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (run after):
--   select id, title, approx_lat, approx_lng from public.public_listings limit 5;
--   -- approx_* is null until a location is set in Esker OS, then 120–300 m
--   -- from the true point:
--   select pl.title,
--          round((6371000 * acos(least(1, cos(radians(p.latitude)) * cos(radians(pl.approx_lat))
--            * cos(radians(pl.approx_lng) - radians(p.longitude)) + sin(radians(p.latitude)) * sin(radians(pl.approx_lat)))))::numeric) as metres_off
--     from public.public_listings pl join public.properties p on p.id = pl.id
--    where p.latitude is not null;
--   -- and as an ANON client (or in an incognito browser hitting the site):
--   -- the listings grid must still load. If it 401s, the grant did not apply.
-- ─────────────────────────────────────────────────────────────────────────
