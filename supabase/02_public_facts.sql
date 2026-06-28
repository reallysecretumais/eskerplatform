-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 2: public-safe "facts" for the concierge
-- ADDITIVE ONLY. Adds one free-text field per property that the website
-- concierge can read to answer deep questions (parking, distance to landmarks,
-- family-friendly, check-in, public house rules). Keep it PUBLIC-SAFE — no
-- wifi passwords, access codes, owner/finance info, or anything internal.
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.properties
  add column if not exists public_facts text;

comment on column public.properties.public_facts is
  'Public-safe facts for the website concierge (parking, landmarks, family-friendly, check-in, public house rules). Never put wifi/access codes, finances, or internal info here.';

-- Re-create the public window to expose the new field (still public rows only).
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
  where p.public_listing = true;

grant select on public.public_listings to anon, authenticated;

commit;

-- Example of what to put in public_facts (fill per property in the CRM):
--   "Free covered parking for 2 cars. 7 min drive to Centaurus Mall. Family-
--    friendly, no parties. Check-in 2pm, check-out 12pm. Rooftop pool, towels
--    provided."
