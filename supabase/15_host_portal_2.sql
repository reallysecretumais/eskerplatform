-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 15: Host portal depth (drafts + date-blocks + payout)
-- Additive + idempotent + CRM-SAFE. Paste into Supabase → SQL Editor → Run.
--
-- Three pieces:
--   1. listing_status gains 'draft' — a host builds the full listing (photos,
--      info) privately, then submits → 'pending'. Drafts are invisible publicly
--      (public_listings requires 'live') and absent from the CRM queue
--      (which requires 'pending').
--   2. property_blocks — dates a host marks unavailable. public_availability is
--      recreated as bookings-busy UNION host blocks (same columns, same 18h
--      website-hold auto-release), so blocked dates grey out on the site.
--   3. accounts.payout_details — optional "how should we pay you" text.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Allow 'draft' in listing_status.
alter table public.properties drop constraint if exists properties_listing_status_check;
alter table public.properties
  add constraint properties_listing_status_check
  check (listing_status in ('draft', 'live', 'pending', 'rejected', 'paused'));

-- 2. Host date-blocks.
create table if not exists public.property_blocks (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date  date not null,
  end_date    date not null,           -- exclusive, like checkout
  note        text,
  created_at  timestamptz not null default now(),
  check (end_date > start_date)
);
create index if not exists property_blocks_property_idx on public.property_blocks (property_id, end_date);

alter table public.property_blocks enable row level security;
-- (No policies/grants → service-role only; writes go through owner-checked actions.)

-- Availability = real bookings (with the 18h website-hold auto-release from
-- step 5) UNION the host's blocks. Same three columns as the deployed view.
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
    )
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or b.created_at > now() - interval '18 hours'
    )
  union all
  select
    k.property_id,
    k.start_date,
    k.end_date
  from public.property_blocks k
  join public.properties p on p.id = k.property_id
  where p.public_listing = true
    and k.end_date >= current_date;

comment on view public.public_availability is
  'Public read window: busy date ranges (no PII/amounts) for public listings — real bookings (website unpaid holds auto-release after 18h) plus host date-blocks.';

grant select on public.public_availability to anon, authenticated;

-- 3. Optional payout preference on the website account.
alter table public.accounts
  add column if not exists payout_details text;

comment on column public.accounts.payout_details is
  'Optional: how the host wants to be paid (e.g. Easypaisa 03xx / bank + IBAN). Collected early; payouts start later.';

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select count(*) from public.public_availability;          -- ≥ previous count
--   insert a test block, confirm it appears, then delete it.
-- ─────────────────────────────────────────────────────────────────────────
