-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 9: WhatsApp phone verification (OTP)
-- Additive + idempotent. Paste into Supabase → SQL Editor → Run.
--
-- Lets a guest confirm their real number via a WhatsApp OTP. Codes live in a
-- service-role-only table (no grants → never reachable from the browser); the
-- website server actions generate/send/verify them. On success the account's
-- phone is set + stamped verified.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.accounts
  add column if not exists phone_verified_at timestamptz;

comment on column public.accounts.phone_verified_at is
  'When the account confirmed its phone via WhatsApp OTP (null = unverified).';

-- One active code per account (upserted on each send).
create table if not exists public.phone_otps (
  account_id   uuid primary key references public.accounts (id) on delete cascade,
  phone        text not null,             -- E.164 target (e.g. 923xxxxxxxxx)
  code_hash    text not null,             -- sha256(code + account_id) — never the raw code
  expires_at   timestamptz not null,
  attempts     int  not null default 0,   -- wrong tries (locks at 5)
  last_sent_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table public.phone_otps enable row level security;
-- No grants + no policies → only the service role (server actions) can touch it.

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select column_name from information_schema.columns
--     where table_name='accounts' and column_name='phone_verified_at';
--   select * from public.phone_otps limit 1;   -- empty until first send
-- ─────────────────────────────────────────────────────────────────────────
