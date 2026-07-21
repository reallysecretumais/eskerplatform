-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 18: apply the 18h unpaid-hold auto-release to EXTERNAL units
-- Paste into Supabase → SQL Editor → Run. Idempotent. One transaction.
--
-- Migration 17 unioned external (resale) bookings into public_availability but
-- only the Esker-run branch carried the "website unpaid holds auto-release after
-- 18h" rule. Without it, a guest who starts a website booking on an external
-- unit and never pays would block those dates FOREVER — worse for resale stock,
-- because Esker doesn't control that calendar and the owner keeps selling it.
--
-- Website bookings on external units are stamped source = 'Website' (the CHANNEL)
-- and is_external = true (the resale marker), so the exact same predicate works
-- on both branches. Staff-made holds (any other source) still never auto-release.
--
-- Only the availability view changes; public_listings from 17 is untouched.
-- ─────────────────────────────────────────────────────────────────────────

begin;

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

  -- External: bookings against the resale unit (property_id is NULL on these).
  -- SAME 18h auto-release as Esker-run — this is the fix in this migration.
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
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or b.created_at > now() - interval '18 hours'
    )

  union all

  -- External: owner iCal busy-ranges cached by the CRM's sync cron. Kept even
  -- when stale — stale busy data only ever HIDES dates (the safe direction).
  -- Freshness (external_properties.ical_synced_at) decides instant-book vs
  -- request-to-book app-side, and is never exposed publicly.
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
  'Public read window: busy date ranges (no PII/amounts) for published Esker-run properties (bookings + host blocks) and external resale units (bookings + cached owner iCal). Unpaid website holds auto-release after 18h on BOTH internal and external bookings.';

grant select on public.public_availability to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (optional):
--   select count(*) from public.public_availability;
--   -- An external website hold older than 18h and still awaiting_payment
--   -- should NOT appear:
--   select * from public.public_availability where property_id = '<external id>';
-- ─────────────────────────────────────────────────────────────────────────
