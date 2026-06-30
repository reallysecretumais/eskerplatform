# PHASE 1 — Launch Checklist (Esker Stays)

The "trust & comms wrapper" + polish to take real public bookings safely. Pairs with `ROADMAP.md` / `SESSION_HANDOFF.md`. (✅ done · ⬜ next · ⚠️ founder action)

## Done ✅
- Security wall, homepage, search, property pages, AI text + **voice concierge**.
- Booking flow + first-time AI ID check; availability automation + 18h unpaid-hold auto-release.
- **Advance payments** — 25% standard / 50% Esker Exclusive; booking carries the real advance + proof (`payment_status='partial'`).
- **Guest "booking received" email** (Titan SMTP) + **WhatsApp queued** (inbox-native via the CRM) + **in-app team alert**.
- **Legal pages** — Terms, Cancellation/Refund, Privacy (drafted; founder to review) + linked in footer & checkout consent.
- **SEO + AI discoverability** — per-page metadata + title template, canonical URLs, OpenGraph/Twitter (branded homepage card + real property photos), dynamic `sitemap.xml`, `robots.txt` (welcomes Google **and** AI crawlers; blocks private/transactional), JSON-LD (`LodgingBusiness`/`WebSite`/`Product`+`Offer`/`BreadcrumbList`), and `llms.txt` for LLM discovery. Search + transactional pages are noindex'd.
- **Logo + favicon** — ESKER / RENTALS wordmark (theme-aware) in nav + footer; SVG favicon.
- **Reviews** — `reviews` table (staff-curated) + `public_reviews` view; property pages show rating + cards with an Esker-Exclusive trust fallback; `aggregateRating` in JSON-LD. (`07_reviews.sql`)
- **Analytics** — Meta Pixel (browser) + Conversions API (server, hashed PII), env-driven; ViewContent / InitiateCheckout / server Purchase.
- **Password reset** — forgot-password on login + `/auth/reset`.
- **Performance** — public listing reads cached (cookieless, 10-min TTL) + `/api/revalidate` webhook (secret) for the CRM to bust on publish.
- **Premium descriptions** — regenerated in the DB (varied, exclusive, enticing).

## ⚠️ Founder actions to switch it all on
- ✅ SMTP_PASS added (emails send). Run migrations: **`06_notifications.sql`** ✓ and **`07_reviews.sql`** ← run this.
- **Meta Pixel/CAPI** (for ads): add `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `META_CAPI_TOKEN` in Vercel.
- **`REVALIDATE_SECRET`**: set the same value in BOTH Vercel (website) and Esker OS, so the CRM can bust the listings cache on publish.
- ✅ Cancellation windows reviewed. Fill **`public_facts`** per property; decide Supabase **"Confirm email"** toggle.
- After deploy: submit `sitemap.xml` in **Google Search Console**.

## Cross-app (Esker OS / CRM session) — handoff (in memory)
- **Verify-urgent dashboard flag** (website bookings >4h) — `website-verify-urgent`.
- **WhatsApp sender** drains `guest_messages` (pending) → native inbox send via approved `booking_received` template — `guest-notifications`.
- **Reviews curation UI** — staff add/moderate rows in `reviews` (source `curated`, status `published`); start by pasting real WhatsApp testimonials.
- **Ping `POST {site}/api/revalidate`** (header `x-revalidate-secret`) when an admin toggles publish / edits public title/price/photos/facts → website updates instantly.

## Remaining Phase-1 ⬜
1. **Vary AI descriptions** ✅ done (regenerated). _(monitor quality / tweak any in CRM.)_
2. **Real-device mobile pass** — final visual QA on a phone (code is responsive; needs a human eye).
3. **PNG app icons** (optional) — 180×180 `apple-icon.png` + 512×512 maskable (SVG favicon + nav logo done).
4. **Post-stay review capture** (the "later" half of reviews) — request flow after checkout.

## Later (Phase 2+)
Owner host portal · Partner read-only investor view · real payment gateway · ElevenLabs/Realtime voice · NADRA Verisys · content-spaces (hourly) + pools (slot) booking models · multi-city.
