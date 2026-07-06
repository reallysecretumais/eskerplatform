-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 11: guest-submitted reviews (fractional ratings + stay link)
-- Additive + idempotent + CRM-SAFE. Two changes to `reviews`:
--   1. rating int → numeric(3,2)  so guests can give 4.5 / 4.75 (still 1–5).
--   2. add booking_id + a one-review-per-stay unique index.
-- Guests never write through RLS — a validated service-role action inserts the
-- review only for a completed stay the account owns (same pattern as bookings).
-- Reviews publish instantly (source 'guest', status 'published'); staff can hide.
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- The view depends on rating, so drop it before the type change, then recreate.
drop view if exists public.public_reviews;

alter table public.reviews
  alter column rating type numeric(3, 2) using rating::numeric(3, 2);
-- (existing check `rating between 1 and 5` stays valid and now permits 4.75.)

alter table public.reviews
  add column if not exists booking_id uuid references public.bookings (id) on delete set null;

-- One review per stay (guest reviews carry a booking_id; curated ones are NULL).
create unique index if not exists reviews_booking_unique
  on public.reviews (booking_id) where booking_id is not null;

create or replace view public.public_reviews
with (security_invoker = false) as
  select id, property_id, author_name, author_location, rating, body, stayed_on, created_at
  from public.reviews
  where status = 'published';

grant select on public.public_reviews to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select column_name, data_type, numeric_scale from information_schema.columns
--     where table_name='reviews' and column_name='rating';   -- numeric, scale 2
-- ─────────────────────────────────────────────────────────────────────────
