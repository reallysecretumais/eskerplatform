-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 5: auto-release unpaid WEBSITE holds after 18 hours
-- Additive + idempotent. Recreates ONLY the public_availability view.
-- Paste into Supabase → SQL Editor → Run.
--
-- Behaviour: a website booking blocks its dates the instant it's submitted
-- (status 'awaiting_payment', source 'Website'). If the team doesn't verify
-- payment within 18 hours, the hold automatically stops blocking — the dates
-- free up live, with NO scheduled job (it's computed in the view). The booking
-- row stays in the CRM so Finance/co-founders can still verify it (which moves
-- it to 'payment_collected', a status that blocks permanently) or cancel it.
-- Staff-created (non-website) awaiting_payment holds are NOT auto-released.
-- ─────────────────────────────────────────────────────────────────────────

begin;

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
    -- Website unpaid holds expire after 18h; everything else blocks as before.
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or b.created_at > now() - interval '18 hours'
    );

comment on view public.public_availability is
  'Public read window: busy date ranges (no PII/amounts) for public listings. Unpaid website holds (awaiting_payment + source Website) auto-release after 18h.';

grant select on public.public_availability to anon, authenticated;

commit;

-- VERIFY (optional):
--   select count(*) from public.public_availability;   -- busy ranges now
--   -- A website awaiting_payment booking older than 18h should NOT appear here.
