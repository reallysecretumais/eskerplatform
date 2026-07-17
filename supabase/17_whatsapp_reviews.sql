-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 17: reviews from WhatsApp bookings (tokened, no login)
--
-- Guests who booked by messaging us have no website account, so the review
-- dispatcher used to skip them entirely. Now each such booking mints a
-- `review_token` and the WhatsApp nudge links to /review/<token> — a public
-- page where the guest rates their completed stay. Those reviews publish
-- instantly (same rule as account reviews; staff can hide) and display with a
-- "From WhatsApp booking" marker, driven by source = 'whatsapp'.
--
-- Additive + idempotent + CRM-safe. Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. Per-booking review link token. Deliberately SEPARATE from invoice_token:
--    a shared review link must never open the invoice (payment amounts).
alter table public.bookings
  add column if not exists review_token text;

create unique index if not exists bookings_review_token_key
  on public.bookings (review_token)
  where review_token is not null;

-- 2. Reviews may now come from a WhatsApp booking. The constraint name follows
--    Postgres's auto-generated pattern from 07_reviews.sql.
alter table public.reviews drop constraint if exists reviews_source_check;
alter table public.reviews
  add constraint reviews_source_check check (source in ('curated', 'guest', 'whatsapp'));

-- 3. Expose `source` so the site can render the badge. `create or replace view`
--    maps columns by position and can only APPEND — so source goes at the END
--    (the app selects *, order doesn't matter).
create or replace view public.public_reviews
with (security_invoker = false) as
  select id, property_id, author_name, author_location, rating, body, stayed_on, created_at, host_reply, source
  from public.reviews
  where status = 'published';

grant select on public.public_reviews to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select column_name from information_schema.columns
--     where table_name='bookings' and column_name='review_token';
--   select source, count(*) from public.public_reviews group by 1;
-- ─────────────────────────────────────────────────────────────────────────
