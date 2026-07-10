-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 16: host engagement (review replies · bio · view analytics)
-- Additive + idempotent + CRM-SAFE. Paste into Supabase → SQL Editor → Run.
--
-- Three pieces:
--   1. Host review replies — hosts read reviews of their own listings (RLS) and
--      reply; the reply shows publicly under the review.
--   2. Host bio — an optional intro shown in the "Hosted by …" card.
--   3. Listing views — a daily per-listing counter bumped by a public beacon,
--      so hosts see how many people viewed each listing.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1a. Review reply columns.
alter table public.reviews
  add column if not exists host_reply    text,
  add column if not exists host_reply_at timestamptz;

-- 1b. A host may READ reviews for listings they own (write is a service-role
--     action after an ownership check — no write policy needed here).
drop policy if exists reviews_select_host on public.reviews;
create policy reviews_select_host on public.reviews
  for select to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = reviews.property_id
        and p.owner_account_id = auth.uid()
    )
  );

-- 1c. Public read window now includes the host's reply.
create or replace view public.public_reviews
with (security_invoker = false) as
  select id, property_id, author_name, author_location, rating, body, host_reply, stayed_on, created_at
  from public.reviews
  where status = 'published';

grant select on public.public_reviews to anon, authenticated;

-- 2. Host bio (shown in the public "Hosted by …" card).
alter table public.accounts
  add column if not exists host_bio text;

-- 3a. Per-listing daily view counter. Service-role only (no grants); the public
--     beacon writes through the SECURITY DEFINER function below.
create table if not exists public.listing_views (
  property_id uuid not null references public.properties (id) on delete cascade,
  day         date not null default current_date,
  views       integer not null default 0,
  primary key (property_id, day)
);
alter table public.listing_views enable row level security;

-- 3b. Atomic increment for the current day. SECURITY DEFINER so anon/auth can
--     bump a view without any direct grant on the table.
create or replace function public.bump_listing_view(pid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.listing_views (property_id, day, views)
  values (pid, current_date, 1)
  on conflict (property_id, day)
  do update set views = public.listing_views.views + 1;
$$;

grant execute on function public.bump_listing_view(uuid) to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select bump_listing_view('<some property id>');   -- run twice
--   select * from public.listing_views order by day desc limit 3;  -- views=2
--   select host_reply from public.public_reviews limit 1;          -- column present
-- ─────────────────────────────────────────────────────────────────────────
