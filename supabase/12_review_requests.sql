-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 12: post-stay review request marker
-- Additive + idempotent + CRM-SAFE. One nullable column on bookings so the
-- website's review-request dispatcher sends each completed stay a gentle nudge
-- exactly once. The CRM ignores it. Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.bookings
  add column if not exists review_requested_at timestamptz;

comment on column public.bookings.review_requested_at is
  'When the post-stay review nudge (email + queued WhatsApp) was sent. NULL = not yet.';

-- Speeds the dispatcher''s scan for freshly-completed, not-yet-nudged stays.
create index if not exists bookings_review_pending_idx
  on public.bookings (checkout)
  where review_requested_at is null;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select count(*) from public.bookings where review_requested_at is null;
-- ─────────────────────────────────────────────────────────────────────────
