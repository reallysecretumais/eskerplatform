-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 25: the phone app's push tokens live beside the browser ones
-- Paste into Supabase → SQL Editor → Run. Idempotent; safe to re-run.
--
-- One table answers "where do we reach this guest": a browser subscription
-- (kind 'web': endpoint + its two keys) or the Esker Rentals app on a phone
-- (kind 'expo': endpoint holds the Expo push token, no keys). lib/push.ts
-- sends to both, so every guest push the website already makes reaches the
-- app too, with nothing to remember at the call sites.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.push_subscriptions
  add column if not exists kind text not null default 'web';

alter table public.push_subscriptions drop constraint if exists push_subs_kind_chk;
alter table public.push_subscriptions
  add constraint push_subs_kind_chk check (kind in ('web', 'expo'));

-- An app token has no browser keys.
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth   drop not null;

alter table public.push_subscriptions drop constraint if exists push_subs_web_keys_chk;
alter table public.push_subscriptions
  add constraint push_subs_web_keys_chk check (kind <> 'web' or (p256dh is not null and auth is not null));

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: select kind, count(*) from public.push_subscriptions group by kind;
-- ─────────────────────────────────────────────────────────────────────────
