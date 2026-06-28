# SESSION HANDOFF — Esker Stays

> Read this first to resume work. Pairs with `CLAUDE.md` (rules), `PROJECT_ARCHITECTURE.md` (how it's built), `ROADMAP.md` (what's left), `DEPLOYMENT.md` (going live), and `Esker_Platform_AI_First_Master_Plan.md` (the vision). Last updated: **2026‑06‑28**.

## What this is (one line)
The public, AI‑first short‑stay **booking website** for Esker Rentals (Islamabad/Rawalpindi) — the consumer face of the same business the **Esker OS CRM** runs, on the **same Supabase database**. Folder: `C:\Claude Projects\Esker Platform` (sibling of `C:\Claude Projects\Esker OS`).

## Run it locally
```
cd "C:\Claude Projects\Esker Platform"
npm run dev -- -p 3100      # port 3100 (the CRM uses 3000)
```
Open http://localhost:3100. The integrated preview tool can't reach this folder — verify with a terminal dev server + curl. If Turbopack crashes (Windows `0xc0000142`): stop the server, `rm -rf .next`, restart.

## Status — what's DONE (built + verified)
- **Security wall** (anon → only `public_listings`/`public_availability`; verified adversarially).
- **Homepage** (Concept B): AI‑concierge hero over a drifting 3D photo‑wall, category showcase, Esker Exclusive row, trust strip, Sora display font.
- **Search** `/stays` (filters + AI concierge mode) and **property pages** `/stays/[id]` (gallery, "Ask about this place" concierge, grouped amenities, **Built for Pakistan** §8, **Where you'll be** map §6, booking widget).
- **AI concierge** — retrieval‑first on OpenAI `gpt-4.1-mini`, fed ONLY public data (can't leak), understands Roman Urdu, streams, finds similar. Leak‑tested.
- **Accounts** — guest/owner/partner, **additive roles** (one account can be all three). Email+password live; phone+OTP built but dormant (needs SMS provider). Login/signup/account pages; account‑aware nav. **Verified** website users can't reach internal data.
- **Booking flow** — checkout (`/book/[id]`): guest details, **first‑time CNIC/passport + AI vision ID check that rejects expired docs**, real Esker bank accounts, screenshot upload → creates a booking as `awaiting_payment` + `source=Website` with the proof attached for the CRM team. **My bookings** on `/account`.
- **Property descriptions** auto‑generated and stored (`public_description`).

## ⚠️ PENDING FOUNDER ACTIONS (do these)
1. **Run `supabase/04_bookings.sql`** — adds `bookings.account_id` + the "see only your own bookings" rule. **Booking submission and "My bookings" error until this runs** (as of this writing the column does NOT exist — the migration hasn't applied).
2. **Supabase Auth → "Confirm email"**: toggle OFF for instant signup (or leave ON; the `/auth/callback` handles the confirm link).
3. **Fill `public_facts`** per property in the CRM (parking, "12 min from Centaurus", check‑in, family‑friendly) → lights up the §8 details, §6 distances, and concierge answers. (Don't invent distances — must be real.)
4. **Deploy** to `eskerrentals.com` — see `DEPLOYMENT.md`.
5. Later: add **SMS provider** keys in Supabase (turns on phone+OTP, no code change); pursue **NADRA Verisys** agreement (real CNIC verification slots in after the AI extraction).

## Migrations run in Supabase (founder runs each in SQL Editor)
`supabase/01_public_listings.sql` ✓ · `02_public_facts.sql` ✓ · `03_accounts.sql` ✓ · **`04_bookings.sql` ✗ NOT YET** (run it).

## Key gotchas
- **Service‑role key** is in `.env.local` but used **only** by `app/book/actions.ts` / `lib/supabase/admin.ts` (server). Never import it from client code.
- **Don't break the shared DB.** Only ADD columns/tables; the CRM depends on `properties`/`bookings`/`guests`/`users`. The `handle_new_user` change is CRM‑safe (staff branch unchanged).
- **Website is NOT a git repo yet** — needs one for Vercel (see `DEPLOYMENT.md`).
- Dev cookie cross‑over on localhost (CRM cookies reach the site) is harmless and won't happen in prod (different domains).

## Where things live
Pages in `app/`; UI in `components/`; data/auth/AI in `lib/`; migrations in `supabase/`; design briefs in `docs/`. Full map in `PROJECT_ARCHITECTURE.md`.
