-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 10: account preferences (notification channels + language)
-- Additive + idempotent + CRM-SAFE. Adds three defaulted columns to accounts so a
-- guest can choose how we reach them and their language. Existing rows keep the
-- current behaviour (email + WhatsApp on, English). RLS is unchanged — the
-- account already owns SELECT/UPDATE on its own row (see 03_accounts.sql), so the
-- website updates these through the normal authenticated client, no new policy.
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.accounts
  add column if not exists notify_email    boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default true,
  add column if not exists language        text    not null default 'en'
    check (language in ('en', 'ur'));

comment on column public.accounts.notify_email is
  'Guest opted in to email updates (booking + account).';
comment on column public.accounts.notify_whatsapp is
  'Guest opted in to WhatsApp updates (delivered by the CRM inbox once WA is live).';
comment on column public.accounts.language is
  'Preferred language: en (English) | ur (Roman Urdu).';

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select notify_email, notify_whatsapp, language, count(*)
--     from public.accounts group by 1,2,3;   -- existing rows: true/true/en
-- ─────────────────────────────────────────────────────────────────────────
