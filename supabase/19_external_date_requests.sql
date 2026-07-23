-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 19: track a guest's request-to-book so we can tell them the
-- owner's answer, and let them book the moment it's "available".
-- Paste into Supabase → SQL Editor → Run. Idempotent.
--
-- When a signed-in guest requests dates on a resale (external) unit, the CRM
-- fires the owner WhatsApp ask and returns a checkId. We record that here so:
--   1. when the CRM pings /api/platform/availability-replied, we know WHICH guest
--      to message (checkId → account), and
--   2. an "available" answer for the EXACT dates authorises an instant booking
--      for 48h — an owner's tap isn't an iCal sync, so without this the guest
--      would loop back into another request.
-- The row is the durable record of the request + its outcome.
-- ─────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.external_date_requests (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.accounts (id) on delete cascade,
  external_property_id uuid not null,                 -- the resale listing id (external_properties)
  checkin              date not null,
  checkout             date not null,
  check_id             uuid,                           -- the CRM external_availability_checks id
  status               text not null default 'pending'
                         check (status in ('pending', 'available', 'unavailable', 'expired')),
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,                    -- when the owner's answer landed
  notified_at          timestamptz                     -- when we told the guest
);

-- Fast "did this account get an available answer for these exact dates?" (booking
-- authorisation) and checkId lookups (the CRM ping).
create index if not exists edr_account_prop_idx on public.external_date_requests (account_id, external_property_id, status);
create index if not exists edr_check_idx        on public.external_date_requests (check_id);

alter table public.external_date_requests enable row level security;

-- A guest may READ their own requests (drives the booking gate + any UI). All
-- writes go through the service role (the request flow + the CRM ping), never
-- the browser — same posture as phone_otps.
grant select on public.external_date_requests to authenticated;
drop policy if exists edr_select_own on public.external_date_requests;
create policy edr_select_own on public.external_date_requests
  for select to authenticated using (account_id = auth.uid());

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select column_name from information_schema.columns where table_name='external_date_requests';
--   -- As a signed-in guest, this returns only your own rows; anon returns none.
-- ─────────────────────────────────────────────────────────────────────────
