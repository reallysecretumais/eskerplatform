# SESSION HANDOFF — Esker Stays

> Read this first to resume. Pairs with `CLAUDE.md` (rules), `PROJECT_ARCHITECTURE.md` (how it's built), `ROADMAP.md`, `PHASE1_LAUNCH_CHECKLIST.md` (status + founder actions), `DEPLOYMENT.md`, and `Esker_Platform_AI_First_Master_Plan.md` (vision). Last updated: **2026‑07‑04**.

## What this is (one line)
The public, AI‑first short‑stay **booking website** for Esker Rentals (Islamabad/Rawalpindi) — the consumer face of the same business the **Esker OS CRM** runs, on the **same Supabase DB**. Folder: `C:\Claude Projects\Esker Platform` (sibling of `C:\Claude Projects\Esker OS`). **Live at https://eskerrentals.com** (Vercel, region hnd1). Repo: `github.com/reallysecretumais/eskerplatform` (push `main` → auto‑deploys). CRM is at `os.eskerrentals.com`.

## Run / verify locally
```
cd "C:\Claude Projects\Esker Platform"
npm run dev -- -p 3100      # CRM uses 3000
```
The integrated preview tool can't reach this folder — verify with a terminal dev server + curl (use full URLs; Git Bash mangles leading `/paths`). Turbopack on Windows crashes intermittently → restart the dev server (the running one isn't this session's). `npx tsc --noEmit` is the authoritative compile gate; `npm run lint` is broken in this repo (flat‑config quirk) — ignore it, Vercel doesn't gate on it.

## Status — Phase 1 is essentially COMPLETE (built + verified, deployed)
- **Security wall** (anon → only public views; adversarially verified) · **homepage** (Concept B) · **search** `/stays` · **property pages**.
- **AI concierge — text + VOICE** (full‑screen orb, OpenAI STT/TTS, Roman‑Urdu in/out as Roman Urdu, female "nova" voice, respectful "aap", availability‑aware, fast). Retrieval‑first on public data only.
- **Accounts** (guest/owner/partner additive) · email+password · **password reset** (`/auth/reset`) · phone+OTP dormant.
- **Booking flow** — first‑time AI ID check (rejects expired) · **advance payments (25% / 50% Esker Exclusive)** recorded as the real advance + proof (`payment_status='partial'`) · `awaiting_payment`/`source=Website`.
- **Availability** — live view off `bookings`; **unpaid website holds auto‑release after 18h**; staff holds never do. Verified.
- **Guest notifications** — "booking received" **email** (Titan SMTP, sends now) + **WhatsApp queued** in `guest_messages` outbox (CRM delivers when WA live) + **in‑app team alert** (`notifications`, type `booking`).
- **Reviews** — `reviews` table (staff‑curated) + `public_reviews` view; rating + cards on property pages (Esker‑Exclusive trust fallback when none); `aggregateRating` in JSON‑LD.
- **SEO + AI discoverability** — metadata/OG (branded homepage card + real property photos), canonical, `sitemap.xml`, `robots.txt` (welcomes AI crawlers), JSON‑LD, `llms.txt`.
- **Analytics** — Meta Pixel + Conversions API (env‑driven; ViewContent/InitiateCheckout/Purchase).
- **Performance** — public listing reads cached (cookieless `unstable_cache`, 10‑min TTL) + `/api/revalidate` webhook (secret) for the CRM to bust on publish.
- **Brand** — ESKER/RENTALS wordmark (theme‑aware) in nav/footer + SVG favicon. **Premium descriptions** regenerated in the DB.
- **Legal** — `/legal/{terms,cancellation,privacy}` (drafted) linked in footer + checkout consent.

## NEW since 2026-06-30 (this session)
- **Booking upgrades**: advance floors at **₨2,000** (capped at total; honest "minimum/full amount" label) · **real-time AI ID check** on pick — CNIC front AND back (side-aware) + passport single-page toggle; Confirm blocked until valid · thumbnails 3:2.
- **Accounts backbone (portals program Phase 1)**: every booker gets an auto-provisioned account (magic link in the email); `08_accounts_links.sql` adds `owners.account_id` + `properties.{owner_account_id, owner_relationship (esker|partner|managed|host), comms_owner (esker|owner), listing_status}`.
- **Pre-launch quality pass** (commit `28555e8`): client payload slimming (`SlimListing` — property −21%, AI search −46% HTML) · StayCard real lazy `<img>` + srcset/alt · hero 640px thumbs, zero-JS CSS sway on touch, edge mask, cursor gold light, staggered entrance, serif-gold headline word, shimmer CTA, scroll cue · card/tile hover life · footer trust row · nav Help→WhatsApp · featured=6/honest heading · AI **WHY** reasons under match cards + one-tap refine chips · slot-booking WhatsApp CTA · hold reassurance at checkout/confirmation · Sora 400 dropped, Supabase preconnect, viewport/theme-color, dead `askConcierge` removed.
- **APPROVED program (multi-phase, in shared memory `platform-portals-chat-program`)**: three-tier owners (partner / managed / host) · unified inventory in `properties` · messaging reuses the CRM Unified Inbox (`'website'` channel + account-scoped RLS). **Next: Phase 2 — guest↔Esker chat** (pre-booking inquiry + post-booking chatbox, realtime, CRM `phase21.sql`). Phase 3 (host portal) needs the payout/commission decision; Phase 4 = partner+managed portals.
- **Logo still needed**: icon pipeline exists (`scripts/gen-icons.mjs` + generated PNGs, untracked); founder must save the real logo (ideally vector) to `public/brand/` — then icons + PWA manifest + `docs/MOBILE_APP.md` ship in one commit.

## ⚠️ PENDING FOUNDER ACTIONS
1. **Run `supabase/07_reviews.sql`** (reviews table) **and `08_accounts_links.sql`** (account/owner links). _(01–06 already run.)_
2. **Meta ads tracking** (when advertising): add in Vercel → `NEXT_PUBLIC_META_PIXEL_ID=2200445110719489`, `META_PIXEL_ID=2200445110719489`, `META_CAPI_TOKEN=<from Events Manager → Conversions API>`.
3. **`REVALIDATE_SECRET`** — set the SAME value in BOTH Vercel (website) and Esker OS so the CRM can bust the listings cache on publish.
4. **Fill `public_facts`** per property (parking, real distances, check‑in, family/prayer/load‑shedding) → powers concierge + §6/§8. **Decide Supabase "Confirm email"** toggle (recommend OFF for launch).
5. After deploy: submit `sitemap.xml` in **Google Search Console**.
6. Later: SMS provider (turns on phone+OTP) · NADRA Verisys · real payment gateway.
- ✅ Already done by founder: SMTP_PASS added (emails send); cancellation windows reviewed; 01–06 migrations run.

## Migrations (founder runs each in Supabase SQL Editor)
`01_public_listings` ✓ · `02_public_facts` ✓ · `03_accounts` ✓ · `04_bookings` ✓ · `05_hold_expiry` ✓ · `06_notifications` ✓ · **`07_reviews` ← RUN** · **`08_accounts_links` ← RUN**.

## Cross‑app — Esker OS (CRM) TODOs (specced in shared memory)
`website-verify-urgent` (4h verify‑urgent dashboard flag) · `guest-notifications` (drain `guest_messages` → WhatsApp via inbox + approved `booking_received` template) · `website-crm-hooks` (reviews curation UI; ping `POST /api/revalidate` with `x-revalidate-secret` on publish/price edits).

## Env (`.env.local`, git‑ignored) — see `.env.example`
Supabase URL/anon/**service‑role** (service key used ONLY by `app/book/actions.ts` + `lib/supabase/admin.ts`, never client) · OpenAI (concierge/ID/voice/descriptions; `ESKER_*` voice knobs) · SMTP (Titan) · Meta Pixel/CAPI · `NEXT_PUBLIC_SITE_URL` · `REVALIDATE_SECRET`.

## Key gotchas
- **Don't break the shared DB** — only ADD columns/tables; the CRM owns `properties`/`bookings`/`guests`/`users`/inbox. `handle_new_user` reroute is CRM‑safe.
- All guest comms are **best‑effort** (try/catch) — they never break a booking.
- Logs (`dev.log`, `*.log`) are gitignored — don't commit them.

## Genuinely left in Phase 1
Real‑device mobile pass (code is responsive; needs a human eye) · PNG app icons + PWA manifest + `docs/MOBILE_APP.md` (**blocked on the real logo file** → `public/brand/`) · post‑stay review capture (needs `07_reviews.sql`). Then the approved program: **Phase 2 messaging → Phase 3 host portal → Phase 4 partner/managed portals** — plus later: real payment gateway (seam ready in `lib/payments/provider.ts`, Safepay/PayFast), ElevenLabs/Realtime voice.
