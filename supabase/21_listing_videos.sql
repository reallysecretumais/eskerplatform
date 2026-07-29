-- ─────────────────────────────────────────────────────────────────────────
-- Esker Platform — 21: show a listing's walkthrough video on the website.
--
-- Esker OS phase66 adds `video_url` to properties + external_properties
-- (one optional video per listing, uploaded straight to the property-videos
-- bucket by a founder in the CRM or by a host in the host portal). This
-- migration is the website's half: it re-opens the public read window so
-- the listing page can play it.
--
-- ⚠️ RUN ORDER: Esker OS `supabase/phase66.sql` MUST run first — this view
-- selects p.video_url / e.video_url and will fail without those columns.
--
-- The definition below is 19_bookable.sql's public_listings verbatim, with
-- `video_url` appended to BOTH branches of the union. Nothing else changes:
-- same geography joins, same security_invoker = false, same live/published
-- gates, same mode-correct price. It is repeated in full because a view
-- cannot be altered to add a column — it can only be dropped and recreated.
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
    'esker'::text                              as source
  from public.properties p
  left join public.locations      l  on l.id = p.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(p.kind))
  left join lateral (
    select min(ps.price) as min_price
    from public.property_slots ps
    where ps.property_id = p.id and ps.active
  ) s on true
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
    'external'::text                            as source
  from public.external_properties e
  left join public.locations      l  on l.id = e.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(e.kind))
  where e.public_listing = true
    and e.active = true;

comment on view public.public_listings is
  'Public read window: safe listing fields for published Esker-run + external inventory. Geography = market/city/area. booking_mode + price_unit come from category_modes so web and app cannot diverge. price is mode-correct (blocks = cheapest block). Gated on listing_status = live. video_url = optional walkthrough video. Exposed to anon.';

-- REQUIRED: the drop above removed this view's grants.
grant select on public.public_listings to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (run after):
--   select id, title, video_url from public.public_listings limit 5;
--   -- and as an ANON client (or in an incognito browser hitting the site):
--   -- the listings grid must still load. If it 401s, the grant did not apply.
-- ─────────────────────────────────────────────────────────────────────────
