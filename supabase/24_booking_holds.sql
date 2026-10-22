-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 24: the date hold is stamped on the booking (app REBUILD_PLAN D5)
-- Paste into Supabase → SQL Editor → Run. Idempotent; safe to re-run.
--
-- THE DECISION (founder, 2026-10-21): an unpaid booking holds its dates for
-- 30 MINUTES when the guest pays by card, 18 HOURS when they pay by bank
-- transfer. Until now every unpaid website booking held 18 hours, so a guest
-- who opened the card page and walked away kept the dates from everyone else
-- for most of a day.
--
-- HOW: each new unpaid booking carries `hold_until`, the moment its dates go
-- back on sale if no money has arrived. The durations live in ONE place, the
-- booking core (Platform lib/booking/hold.ts), which stamps the row; the
-- public availability windows below just read the stamp. Rows from before
-- this migration have no stamp and keep the old rule: 18 hours from creation.
--
-- WHAT EXPIRES: only unpaid WEBSITE bookings (status awaiting_payment, source
-- Website) — exactly as before. Staff holds, CRM bookings and anything paid
-- block until cancelled. When the CRM moves a booking out of awaiting_payment
-- (a payment verified, a card settled), its hold_until stops mattering.
--
-- The two views are reproduced byte-for-byte from their live definitions —
-- public_availability from the CRM's phase91 (the PKT owner-calendar fix) and
-- public_slot_availability from 19_bookable — with ONLY the hold clause
-- changed. Same columns, same grants, same security_invoker = false.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.bookings add column if not exists hold_until timestamptz;

comment on column public.bookings.hold_until is
  'Unpaid WEBSITE bookings only: when the dates go back on sale if no payment has arrived (30 min card, 18 h bank transfer — Platform lib/booking/hold.ts). NULL = the legacy rule, created_at + 18 hours. Ignored once the booking leaves awaiting_payment.';

-- ── public_availability (from phase91, hold clause changed) ──────────────
create or replace view public.public_availability
with (security_invoker = false) as
  -- Our own properties' live bookings. An unpaid WEBSITE hold whose time is
  -- up has released and no longer blocks.
  select
    b.property_id,
    b.checkin::date  as start_date,
    b.checkout::date as end_date
  from bookings b
    join properties p on p.id = b.property_id
  where p.public_listing = true
    and b.checkout >= current_date
    and coalesce(b.lost_reason, '') = ''
    and b.status = any (array['awaiting_payment','payment_collected','handed_over','awaiting_checkin','currently_staying','needs_attention'])
    and (b.status <> 'awaiting_payment' or coalesce(b.source, '') <> 'Website' or coalesce(b.hold_until, b.created_at + interval '18 hours') > now())

  union all
  -- Host-blocked dates on self-listed places.
  select
    k.property_id,
    k.start_date,
    k.end_date
  from property_blocks k
    join properties p on p.id = k.property_id
  where p.public_listing = true
    and k.end_date >= current_date

  union all
  -- Resale units we have already sold ourselves.
  select
    b.external_property_id as property_id,
    b.checkin::date  as start_date,
    b.checkout::date as end_date
  from bookings b
    join external_properties e on e.id = b.external_property_id
  where e.public_listing = true
    and e.active = true
    and b.checkout >= current_date
    and coalesce(b.lost_reason, '') = ''
    and b.status = any (array['awaiting_payment','payment_collected','handed_over','awaiting_checkin','currently_staying','needs_attention'])
    and (b.status <> 'awaiting_payment' or coalesce(b.source, '') <> 'Website' or coalesce(b.hold_until, b.created_at + interval '18 hours') > now())

  union all
  -- The owner's own calendar, mirrored from their iCal feed. Stored instants
  -- are PKT midnights, converted in Asia/Karachi (phase91).
  select
    x.external_property_id as property_id,
    (x.starts at time zone 'Asia/Karachi')::date as start_date,
    (x.ends   at time zone 'Asia/Karachi')::date as end_date
  from external_ical_busy x
    join external_properties e on e.id = x.external_property_id
  where e.public_listing = true
    and e.active = true
    and (x.ends at time zone 'Asia/Karachi')::date >= (now() at time zone 'Asia/Karachi')::date;

comment on view public.public_availability is
  'Busy date ranges for every published listing (no PII): our bookings, host blocks, resold stays, and owners'' mirrored iCal calendars. end_date is EXCLUSIVE. Owner-calendar instants are PKT midnights and are converted in Asia/Karachi (phase91). Unpaid website holds release at bookings.hold_until (30 min card, 18 h transfer), or 18 h after creation for rows without one (24).';

-- ── public_slot_availability (from 19_bookable, hold clause changed) ─────
create or replace view public.public_slot_availability
with (security_invoker = false) as
  select
    b.property_id,
    b.starts_at,
    b.ends_at,
    b.slot_id
  from public.bookings b
  join public.properties p on p.id = b.property_id
  where p.public_listing = true
    and coalesce(p.listing_status, 'live') = 'live'
    and b.starts_at is not null
    and b.ends_at is not null
    and b.ends_at >= now()
    and coalesce(b.lost_reason, '') = ''
    and b.status in (
      'awaiting_payment', 'payment_collected', 'handed_over',
      'awaiting_checkin', 'currently_staying', 'needs_attention'
    )
    -- Website's unpaid holds release at hold_until, same rule as the nightly window.
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or coalesce(b.hold_until, b.created_at + interval '18 hours') > now()
    );

comment on view public.public_slot_availability is
  'Public read window: busy TIME ranges (no PII/amounts) for slotted listings, so the app/site can dim taken blocks and hours. Unpaid website holds release at bookings.hold_until (24).';

grant select on public.public_availability      to anon, authenticated;
grant select on public.public_slot_availability to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (run after):
--   -- The column exists, and nothing has a stamp yet (the website starts
--   -- writing them once the code that reads this migration is deployed):
--   select count(*) filter (where hold_until is not null) as stamped,
--          count(*) filter (where status = 'awaiting_payment' and source = 'Website') as unpaid_website
--     from public.bookings;
--   -- The windows still answer, with the same columns as before:
--   select * from public.public_availability limit 3;
--   select * from public.public_slot_availability limit 3;
-- ─────────────────────────────────────────────────────────────────────────
