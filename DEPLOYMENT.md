# DEPLOYMENT — Esker Stays → eskerrentals.com

Goal: deploy this website to **`eskerrentals.com`** (apex) on **Vercel (Hobby/free)**. The CRM stays on `os.eskerrentals.com` as a **separate** Vercel project. Both share the **same Supabase project** — do NOT create a new Supabase.

> **⚠️ PRE-DEPLOY RULE (learned the hard way):** always run **`npm run build`** locally before pushing — NOT just `npx tsc --noEmit`. A client component (`"use client"`) importing a `server-only` module (e.g. one that pulls in the service-role Supabase client) **passes `tsc` but fails `next build`**, and Vercel then **silently keeps the old deploy live** — looking like "my changes didn't go through". Fix by moving client-safe consts/types into non-`server-only` modules (see `lib/ai/hostInterviewShared.ts`, `lib/hostConstants.ts`). It's live once you push `main`; run migrations in Supabase first if the code reads new columns/tables (though reads are written to degrade gracefully so a missing migration never crashes signed-in pages).

## 0. Prerequisites
- The website is **not a git repo yet**. `.gitignore` already excludes `.env.local`, `node_modules`, `.next` (secrets won't be pushed).
- Run any pending migrations first (esp. **`supabase/04_bookings.sql`**) — see `SESSION_HANDOFF.md`.

## 1. Put the code on GitHub (its own repo, separate from the CRM)
```
cd "C:\Claude Projects\Esker Platform"
git init
git add .
git commit -m "Esker Stays — initial deploy"
# create an empty GitHub repo (e.g. esker-stays), then:
git remote add origin https://github.com/<your-account>/esker-stays.git
git branch -M main
git push -u origin main
```

## 2. Create a new Vercel project
- Vercel → **Add New → Project** → import the `esker-stays` repo. Framework auto-detects **Next.js**. Keep defaults.
- Region is pinned to **`hnd1`** (Tokyo) via `vercel.json` to sit next to Supabase for low latency.

## 3. Set environment variables (Vercel → Project → Settings → Environment Variables)
Copy the values from your local `.env.local` (same Supabase project as the CRM):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`  ← **Production only**, server-side; used solely by the booking action. Keep secret.
- `OPENAI_API_KEY`
- `ESKER_AI_MODEL`  (`gpt-4.1-mini`)

Set them for **Production** (and Preview if you want preview deploys). Redeploy after adding.

## 4. Point the domain
In Vercel → Project → **Settings → Domains**, add:
- `eskerrentals.com` (the apex — this is the website)
- `www.eskerrentals.com` (Vercel will offer to redirect www → apex)

Vercel shows the exact DNS records to add at your **domain registrar / DNS provider**:
- **Apex** `eskerrentals.com` → an **A record** to Vercel's IP (`76.76.21.21`), or an ALIAS/ANAME/CNAME-flattening to `cname.vercel-dns.com` if your DNS supports it.
- **www** → **CNAME** to `cname.vercel-dns.com`.
- Leave the existing `os.eskerrentals.com` record alone — that's the CRM's separate project.

DNS can take minutes to a few hours to propagate; Vercel auto-issues HTTPS.

## 5. Tell Supabase about the production URL (REQUIRED for auth)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://eskerrentals.com`
- **Redirect URLs** (add all): `https://eskerrentals.com/auth/callback`, `https://www.eskerrentals.com/auth/callback`, and keep `http://localhost:3100/auth/callback` for dev.

Without these, email-confirmation / callback links won't return users to the site in production.

## 6. Email confirmation decision
Supabase → Authentication → Providers → Email → **"Confirm email"**:
- **Off** = instant signup (simplest for launch).
- **On** = users get a confirm email; the built `/auth/callback` brings them back signed in.

## Going-live checklist
- [ ] `04_bookings.sql` run; all 4 migrations applied.
- [ ] Env vars set in Vercel (all 5).
- [ ] Domain added + DNS records set; HTTPS green.
- [ ] Supabase Site URL + Redirect URLs include the prod domain.
- [ ] "Confirm email" decided.
- [ ] Smoke test on prod: browse → property → AI concierge → sign up → **book a stay** (screenshot + first-time ID) → booking appears in the CRM as `awaiting_payment` / `source=Website` with the proof → "My bookings" shows it.
- [ ] Fill `public_facts` for the live properties.

## Ongoing
Push to `main` → Vercel auto-deploys. (Same flow as the CRM.) Make changes locally, commit, push.

## Notes / gotchas
- **Free plan function limits**: the booking action runs AI vision + uploads (~3–6s) — within Hobby's window. If you ever hit a timeout, add `export const maxDuration = 30;` to `app/book/[id]/page.tsx` (or the action's route).
- **Image optimization**: the site serves resized images via Supabase's transform (`lib/img.ts` `thumb()`), not heavy `next/image` — so Vercel image-optimization quotas aren't a concern.
- **Shared DB**: deploying does NOT change the database. The CRM and website keep sharing the same Supabase project and the same `properties`/`bookings`/`guests`.
