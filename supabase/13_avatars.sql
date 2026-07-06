-- ─────────────────────────────────────────────────────────────────────────
-- ESKER STAYS — Step 13: account profile pictures (avatars)
-- Additive + idempotent + CRM-SAFE. Adds accounts.avatar_url and a PUBLIC
-- `avatars` storage bucket (images are non-sensitive and shown in the nav, so
-- public read is simplest — no signed-URL churn). Uploads happen via a validated
-- service-role action (same pattern as guest-docs), so no RLS insert policy needed.
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter table public.accounts
  add column if not exists avatar_url text;

comment on column public.accounts.avatar_url is
  'Public URL of the account profile picture (avatars bucket), or NULL for the initials fallback.';

-- Public, image-only, 5 MB cap. Reads are public; writes go through the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY:
--   select id, public, file_size_limit from storage.buckets where id='avatars';
-- ─────────────────────────────────────────────────────────────────────────
