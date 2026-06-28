-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 3: website accounts (guests / owners / partners)
-- ADDITIVE + CRM-SAFE. Adds two new tables and reroutes the signup trigger so
-- WEBSITE signups become website accounts — NEVER staff. Staff creation in the
-- CRM is unchanged (it upserts the users row itself; the trigger's staff branch
-- below is byte-for-byte the current behaviour for non-website signups).
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 1. One row per website user.
create table if not exists public.accounts (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- 2. Additive capability set — an account can be guest + owner + partner at once.
create table if not exists public.account_roles (
  account_id  uuid not null references public.accounts (id) on delete cascade,
  role        text not null check (role in ('guest', 'owner', 'partner')),
  created_at  timestamptz not null default now(),
  primary key (account_id, role)
);

-- 3. Reroute signup: website accounts (flagged by account_type) go to accounts,
--    never to public.users. Everything else keeps the EXISTING staff behaviour.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acct text := new.raw_user_meta_data->>'account_type';
begin
  if acct in ('guest', 'owner', 'partner') then
    -- Website account — NOT staff (never touches public.users → is_staff() stays false).
    insert into public.accounts (id, email, name, phone)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
      new.phone
    )
    on conflict (id) do nothing;

    -- Every account can book (baseline 'guest'); add the chosen role too.
    insert into public.account_roles (account_id, role) values (new.id, 'guest')
      on conflict do nothing;
    if acct <> 'guest' then
      insert into public.account_roles (account_id, role) values (new.id, acct)
        on conflict do nothing;
    end if;
  else
    -- Staff (created by the CRM). UNCHANGED from schema.sql.
    insert into public.users (id, email, name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      'grm'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- 4. Row-Level Security — each account sees only its own rows.
alter table public.accounts enable row level security;
alter table public.account_roles enable row level security;

grant select, update on public.accounts to authenticated;
grant select, insert on public.account_roles to authenticated;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select to authenticated using (id = auth.uid());

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists account_roles_select_own on public.account_roles;
create policy account_roles_select_own on public.account_roles
  for select to authenticated using (account_id = auth.uid());

-- A user may self-grant only guest/owner (e.g. "become a host"). NEVER 'partner'
-- (that is admin-granted via the service role, which bypasses RLS).
drop policy if exists account_roles_insert_self on public.account_roles;
create policy account_roles_insert_self on public.account_roles
  for insert to authenticated
  with check (account_id = auth.uid() and role in ('guest', 'owner'));

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- Later phases (NOT now): link logins to existing records for the portals —
--   alter table public.owners add column if not exists account_id uuid references public.accounts(id);
--   alter table public.guests add column if not exists account_id uuid references public.accounts(id);
-- VERIFY after running:
--   select * from public.accounts limit 1;          -- empty until first signup
--   -- a website signup must create an accounts row and NO public.users row.
-- ─────────────────────────────────────────────────────────────────────────
