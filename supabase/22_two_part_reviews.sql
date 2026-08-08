-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 22: two-part reviews (booking experience · the stay)
--
-- The founder's incentive framework splits a guest's verdict in two:
--   "How was the booking experience?" → credits whoever CLOSED the booking
--   "How was your stay?"              → credits the GRM who ran the stay
-- Both quarter-step 1–5, like the existing rating. `rating` stays the overall
-- shown on the site and is set = stay_rating on new submissions, so nothing
-- about public display or averages changes shape. Old reviews keep the two new
-- columns null (the CRM's incentive engine treats a lone `rating` as the stay
-- rating).
--
-- Additive + idempotent + CRM-safe. Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.reviews
  add column if not exists booking_experience_rating numeric,
  add column if not exists stay_rating numeric;

-- Same bounds the app enforces (quarter steps are app-side; bounds are DB-side).
alter table public.reviews drop constraint if exists reviews_booking_experience_rating_check;
alter table public.reviews
  add constraint reviews_booking_experience_rating_check
  check (booking_experience_rating is null or (booking_experience_rating >= 1 and booking_experience_rating <= 5));

alter table public.reviews drop constraint if exists reviews_stay_rating_check;
alter table public.reviews
  add constraint reviews_stay_rating_check
  check (stay_rating is null or (stay_rating >= 1 and stay_rating <= 5));

-- Expose both on the public view. `create or replace view` maps columns by
-- position and can only APPEND — the two new columns go at the END.
create or replace view public.public_reviews
with (security_invoker = false) as
  select id, property_id, author_name, author_location, rating, body, stayed_on, created_at, host_reply, source,
         booking_experience_rating, stay_rating
  from public.reviews
  where status = 'published';

grant select on public.public_reviews to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select column_name from information_schema.columns
--     where table_name='reviews' and column_name in ('stay_rating','booking_experience_rating');
--   -- expect 2 rows
-- ─────────────────────────────────────────────────────────────────────────
