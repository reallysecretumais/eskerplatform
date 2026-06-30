-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 7: guest reviews (curated now, guest-submitted later)
-- Additive + idempotent. Paste into Supabase → SQL Editor → Run.
--
-- `reviews` is staff-managed (the team curates real testimonials, e.g. from
-- WhatsApp, in the CRM). The public website reads ONLY published reviews via the
-- `public_reviews` view — same wall pattern as public_listings/public_availability.
-- ─────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  guest_id        uuid references public.guests (id) on delete set null,   -- set for post-stay guest reviews
  author_name     text not null,
  author_location text,                                                    -- e.g. "Lahore" — adds trust
  rating          int  not null check (rating between 1 and 5),
  body            text not null,
  source          text not null default 'curated' check (source in ('curated', 'guest')),
  status          text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  stayed_on       date,                                                    -- optional ("Stayed Jun 2026")
  created_at      timestamptz not null default now()
);
create index if not exists reviews_property_idx on public.reviews (property_id, status);

alter table public.reviews enable row level security;

-- Staff manage reviews in the CRM (curate / moderate).
drop policy if exists reviews_staff_all on public.reviews;
create policy reviews_staff_all on public.reviews for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Public read window: only published reviews, safe columns.
create or replace view public.public_reviews
with (security_invoker = false) as
  select id, property_id, author_name, author_location, rating, body, stayed_on, created_at
  from public.reviews
  where status = 'published';

grant select on public.public_reviews to anon, authenticated;

commit;
