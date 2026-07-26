-- ─────────────────────────────────────────────────────────────────────────
-- Esker — 19: BOOKABLE TYPES (nightly · day-use blocks · hourly)
-- Paste into Supabase → SQL Editor → Run. Idempotent. One transaction.
-- Requires 18_geography.sql to have run first (this recreates public_listings).
--
-- WHAT THIS UNLOCKS: swimming pools sold as day-use blocks and content spaces
-- sold by the hour. The website has PRICED these types since launch
-- (lib/listings.ts unitForCategory) but has never been able to BOOK them —
-- there was no slot menu, no time-aware availability, and bookings only carried
-- dates. This migration fixes that for the website and the app together.
--
-- MODE IS DECIDED BY CATEGORY (founder decision 2026-07-26):
--   stays (apartment/penthouse/villa/farmhouse) → nightly
--   swimming pool                               → blocks  (named day-use blocks)
--   content space                                → hourly  (start + duration)
--   experiences (later)                          → session (not built yet)
-- The mapping lives in ONE table (`category_modes`) and is exposed on
-- `public_listings` as `booking_mode` + `price_unit`, so the website and the app
-- read the same answer from the same place and CANNOT diverge. A new bookable
-- category later is an INSERT, not a release.
--
-- WHAT IS PER-LISTING: only the SCHEDULE. Two pools share a mode but never a
-- timetable — each defines its own blocks (times, prices, days) or its own open
-- hours + minimum. Mode = category; schedule = listing.
--
-- SCOPE NOTE: slot config lives on `properties` only (Esker-run AND host
-- listings are both `properties` rows). `external_properties` is resale
-- apartment inventory and stays nightly — no dead columns there.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. The one mode mapping ─────────────────────────────────────────────────
-- Keyed on the LOWERCASED category so 'Apartment' / 'apartment' both resolve.
create table if not exists public.category_modes (
  category   text primary key,          -- lowercase key, e.g. 'swimming pool'
  mode       text not null check (mode in ('nightly', 'blocks', 'hourly', 'session')),
  unit_label text not null,             -- 'night' | 'block' | 'hour' | 'session'
  sort_order integer not null default 0
);

comment on table public.category_modes is
  'How each listing category sells. THE single source of truth for booking mode + price unit, read by both the website and the app via public_listings. Adding a bookable category is an insert here, never a code change.';

alter table public.category_modes enable row level security;

drop policy if exists category_modes_select_all on public.category_modes;
create policy category_modes_select_all on public.category_modes
  for select to anon, authenticated using (true);

drop policy if exists category_modes_admin_write on public.category_modes;
create policy category_modes_admin_write on public.category_modes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.category_modes to anon, authenticated;

-- ⚠️ THE ONE PLACE MODE IS DECIDED. `lib/listings.ts unitForCategory()` mirrors
-- this seed as a fallback (it covers a code-first deploy before this migration
-- runs, and host drafts, which aren't in public_listings yet). If you change a
-- row here, change that function too — they are the only two copies and they
-- must agree. Everything else reads public_listings.booking_mode.
insert into public.category_modes (category, mode, unit_label, sort_order) values
  ('apartment',      'nightly', 'night',   1),
  ('penthouse',      'nightly', 'night',   2),
  ('villa',          'nightly', 'night',   3),
  ('farmhouse',      'nightly', 'night',   4),
  ('swimming pool',  'blocks',  'block',   5),
  ('content space',  'hourly',  'hour',    6)
on conflict (category) do update
  set mode = excluded.mode,
      unit_label = excluded.unit_label,
      sort_order = excluded.sort_order;

-- ── 2. Per-listing schedules ────────────────────────────────────────────────
-- BLOCKS: a pool's day-use blocks. Rows, so changing a price is an edit.
create table if not exists public.property_slots (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  label        text not null,                       -- 'Afternoon'
  start_time   time not null,
  end_time     time not null,
  price        numeric not null check (price >= 0),
  days_of_week smallint[],                          -- null/empty = every day; 0=Sun … 6=Sat
  capacity     integer not null default 1 check (capacity >= 1),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint property_slots_time_order check (end_time > start_time)
);

comment on table public.property_slots is
  'Day-use blocks for `blocks`-mode listings (swimming pools). capacity 1 = exclusive use of the whole slot.';
comment on column public.property_slots.days_of_week is
  'Which weekdays this block runs (0=Sunday … 6=Saturday). NULL or empty = every day.';

create index if not exists property_slots_property_idx on public.property_slots (property_id, active);

alter table public.property_slots enable row level security;

-- Staff manage slots; the public reads the safe view below, never this table.
drop policy if exists property_slots_staff_all on public.property_slots;
create policy property_slots_staff_all on public.property_slots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- HOURLY: open hours + minimum for `hourly`-mode listings (content spaces).
alter table public.properties
  add column if not exists open_time    time,
  add column if not exists close_time   time,
  add column if not exists min_hours    integer,
  add column if not exists hourly_price numeric;

comment on column public.properties.open_time is
  'Hourly-mode listings only: earliest bookable start time (local, Asia/Karachi).';
comment on column public.properties.min_hours is
  'Hourly-mode listings only: minimum bookable duration in hours.';

-- ── 3. Bookings become time-aware ───────────────────────────────────────────
-- Nightly bookings keep writing checkin/checkout dates exactly as today.
-- Slotted bookings additionally write real timestamps. ONE bookings table — the
-- CRM's ledger, splits, payments, inbox and notifications keep working untouched.
alter table public.bookings
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz,
  add column if not exists slot_id   uuid references public.property_slots(id) on delete set null;

comment on column public.bookings.starts_at is
  'Slotted bookings (blocks/hourly): exact start. NULL for nightly bookings, which use checkin/checkout dates.';
comment on column public.bookings.slot_id is
  'Which day-use block was booked (blocks mode). NULL for nightly and hourly.';

create index if not exists bookings_starts_at_idx on public.bookings (property_id, starts_at)
  where starts_at is not null;

-- No two guests may hold the same slot. This is the slotted equivalent of the
-- nightly date-overlap check, enforced in Postgres rather than app code.
-- Partial: it covers ONLY rows with timestamps and a live status, so it applies
-- to zero existing rows today (every current booking has starts_at NULL) and
-- therefore cannot fail on legacy data.
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_slot_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_slot_no_overlap
      exclude using gist (
        property_id with =,
        tstzrange(starts_at, ends_at) with &&
      )
      where (
        starts_at is not null
        and ends_at is not null
        and status in (
          'awaiting_payment', 'payment_collected', 'handed_over',
          'awaiting_checkin', 'currently_staying', 'needs_attention'
        )
      );
  end if;
end $$;

-- ── 4. WINDOW 1 (again) — public_listings: + booking_mode, price_unit ───────
-- Supersedes the version in 18_geography.sql. Same geography + security rules;
-- adds mode/unit and makes `price` correct per mode:
--   nightly → public_price / nightly_rate      (per night)
--   blocks  → cheapest active block            ("from" price)
--   hourly  → hourly_price                     (per hour)
drop view if exists public.public_listings;
create view public.public_listings
with (security_invoker = false) as
  select
    p.id,
    coalesce(p.public_title, p.name)          as title,
    coalesce(l.name, p.area)                  as area,
    l.city                                     as city,
    m.name                                     as market,
    m.slug                                     as market_slug,
    p.kind                                     as category,
    coalesce(cm.mode, 'nightly')               as booking_mode,
    coalesce(cm.unit_label, 'night')           as price_unit,
    p.type,
    p.bedrooms,
    p.capacity,
    case coalesce(cm.mode, 'nightly')
      when 'blocks' then coalesce(s.min_price, p.public_price, p.nightly_rate)
      when 'hourly' then coalesce(p.hourly_price, p.public_price, p.nightly_rate)
      else               coalesce(p.public_price, p.nightly_rate)
    end                                        as price,
    p.public_description                       as description,
    p.amenities,
    p.photos,
    p.esker_exclusive,
    p.public_facts,
    'esker'::text                              as source
  from public.properties p
  left join public.locations      l  on l.id = p.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(p.kind))
  left join lateral (
    select min(ps.price) as min_price
    from public.property_slots ps
    where ps.property_id = p.id and ps.active
  ) s on true
  where p.public_listing = true
    and coalesce(p.listing_status, 'live') = 'live'

  union all

  select
    e.id,
    coalesce(e.public_title, e.name)           as title,
    l.name                                      as area,
    l.city                                      as city,
    m.name                                      as market,
    m.slug                                      as market_slug,
    e.kind                                      as category,
    coalesce(cm.mode, 'nightly')                as booking_mode,
    coalesce(cm.unit_label, 'night')            as price_unit,
    null                                        as type,
    e.bedrooms,
    e.capacity,
    coalesce(e.public_price, e.typical_price)   as price,
    e.public_description                        as description,
    e.amenities,
    e.photo_urls                                as photos,
    e.esker_exclusive,
    null                                        as public_facts,
    'external'::text                            as source
  from public.external_properties e
  left join public.locations      l  on l.id = e.location_id
  left join public.markets        m  on m.id = l.market_id
  left join public.category_modes cm on cm.category = lower(trim(e.kind))
  where e.public_listing = true
    and e.active = true;

comment on view public.public_listings is
  'Public read window: safe listing fields for published Esker-run + external inventory. Geography = market/city/area. booking_mode + price_unit come from category_modes so web and app cannot diverge. price is mode-correct (blocks = cheapest block). Gated on listing_status = live. Exposed to anon.';

-- ── 5. WINDOW 3 — public_slots: the bookable day-use menu ──────────────────
-- Times and prices only. Never capacity internals or any listing the public
-- can't already see.
drop view if exists public.public_slots;
create view public.public_slots
with (security_invoker = false) as
  select
    ps.id,
    ps.property_id,
    ps.label,
    ps.start_time,
    ps.end_time,
    ps.price,
    ps.days_of_week,
    ps.capacity,
    ps.sort_order
  from public.property_slots ps
  join public.properties p on p.id = ps.property_id
  where ps.active
    and p.public_listing = true
    and coalesce(p.listing_status, 'live') = 'live';

comment on view public.public_slots is
  'Public read window: the day-use block menu (label, times, price) for published blocks-mode listings.';

-- ── 6. WINDOW 4 — public_slot_availability: busy TIME ranges ───────────────
-- The time-aware sibling of public_availability. Slotted listings only.
drop view if exists public.public_slot_availability;
create view public.public_slot_availability
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
    -- Website's unpaid holds auto-release after 18h, same rule as the nightly window.
    and (
      b.status <> 'awaiting_payment'
      or coalesce(b.source, '') <> 'Website'
      or b.created_at > now() - interval '18 hours'
    );

comment on view public.public_slot_availability is
  'Public read window: busy TIME ranges (no PII/amounts) for slotted listings, so the app/site can dim taken blocks and hours.';

grant select on public.public_listings          to anon, authenticated;
grant select on public.public_slots             to anon, authenticated;
grant select on public.public_slot_availability to anon, authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY (run after):
--   -- Every listing now carries a mode + unit (all 'nightly'/'night' today):
--   select title, category, booking_mode, price_unit, price
--     from public.public_listings order by booking_mode, title;
--   -- The mode mapping itself:
--   select * from public.category_modes order by sort_order;
--   -- No slots yet (expected until the first pool is listed):
--   select count(*) from public.public_slots;
--
-- ADDING THE FIRST POOL (after the CRM offers the new categories):
--   -- 1. create the property in the CRM with kind = 'Swimming Pool'
--   -- 2. give it its day-use blocks:
--   insert into public.property_slots (property_id, label, start_time, end_time, price, sort_order)
--   values
--     ('<property id>', 'Morning',   '10:00', '14:00', 12000, 1),
--     ('<property id>', 'Afternoon', '15:00', '19:00', 15000, 2),
--     ('<property id>', 'Evening',   '20:00', '00:00', 18000, 3);
--   -- 3. confirm it prices "from ₨12,000 / block":
--   select title, booking_mode, price, price_unit from public.public_listings
--    where id = '<property id>';
--
-- ADDING A CONTENT SPACE:
--   update public.properties
--      set kind = 'Content Space', open_time = '09:00', close_time = '21:00',
--          min_hours = 3, hourly_price = 4500
--    where id = '<property id>';
-- ─────────────────────────────────────────────────────────────────────────
