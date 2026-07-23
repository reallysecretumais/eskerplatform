-- ─────────────────────────────────────────────────────────────────────────
-- Esker Stays — 20: web-push subscriptions (browser notifications)
-- Paste into Supabase → SQL Editor → Run. Idempotent.
--
-- A guest can opt in to a browser notification the moment the owner answers a
-- request-to-book (and any future website nudge). One row per browser/endpoint;
-- an account may have several (phone + laptop). Writes go through the service
-- role (the subscribe action + prune on send); a guest may read/delete its own.
-- ─────────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  endpoint   text not null unique,   -- the push service URL (dedupe key)
  p256dh     text not null,          -- client public key
  auth       text not null,          -- client auth secret
  created_at timestamptz not null default now()
);

create index if not exists push_subs_account_idx on public.push_subscriptions (account_id);

alter table public.push_subscriptions enable row level security;

-- Guests can see + remove their own subscriptions; inserts/prunes are service-role.
grant select, delete on public.push_subscriptions to authenticated;
drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions
  for select to authenticated using (account_id = auth.uid());
drop policy if exists push_subs_del_own on public.push_subscriptions;
create policy push_subs_del_own on public.push_subscriptions
  for delete to authenticated using (account_id = auth.uid());

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: select count(*) from public.push_subscriptions;
-- ─────────────────────────────────────────────────────────────────────────
