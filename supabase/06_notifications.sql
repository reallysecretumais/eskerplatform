-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 6: guest-notification outbox
-- Additive + idempotent. Paste into Supabase → SQL Editor → Run.
--
-- A small queue the website writes to when a booking event happens. Email is
-- sent immediately by the website (and logged here as 'sent'/'failed' for an
-- audit trail). WhatsApp rows sit 'pending' until the CRM's inbox sender (Esker
-- OS, which owns the WhatsApp API + templates + conversation model) drains them
-- and delivers them natively into the guest's inbox thread — so guest WhatsApp
-- "just works" the moment the WA API goes live, with zero website changes.
--
-- Internal/system only: NO grants to anon/authenticated. Written by the website
-- service role, read/sent by the CRM service role (both bypass RLS).
-- ─────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.guest_messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings (id) on delete cascade,
  channel     text not null check (channel in ('email', 'whatsapp')),
  event       text not null,                       -- e.g. 'booking_received'
  recipient   text,                                -- email address / phone
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts    int  not null default 0,
  error       text,
  payload     jsonb not null default '{}',         -- template name + variables for WA; subject for email
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index if not exists guest_messages_pending_idx on public.guest_messages (channel, status, created_at);
create index if not exists guest_messages_booking_idx on public.guest_messages (booking_id);

alter table public.guest_messages enable row level security;
-- (No policies + no grants → only the service role can touch it. System table.)

commit;
