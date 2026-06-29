# PHASE 1 — Launch Checklist (Esker Stays)

The "trust & comms wrapper" + polish to take real public bookings safely. Pairs with `ROADMAP.md` / `SESSION_HANDOFF.md`. (✅ done · ⬜ next · ⚠️ founder action)

## Done ✅
- Security wall, homepage, search, property pages, AI text + **voice concierge**.
- Booking flow + first-time AI ID check; availability automation + 18h unpaid-hold auto-release.
- **Advance payments** — 25% standard / 50% Esker Exclusive; booking carries the real advance + proof (`payment_status='partial'`).
- **Guest "booking received" email** (Titan SMTP) + **WhatsApp queued** (inbox-native via the CRM) + **in-app team alert**.
- **Legal pages** — Terms, Cancellation/Refund, Privacy (drafted; founder to review) + linked in footer & checkout consent.
- **SEO + AI discoverability** — per-page metadata + title template, canonical URLs, OpenGraph/Twitter (branded homepage card + real property photos), dynamic `sitemap.xml`, `robots.txt` (welcomes Google **and** AI crawlers; blocks private/transactional), JSON-LD (`LodgingBusiness`/`WebSite`/`Product`+`Offer`/`BreadcrumbList`), and `llms.txt` for LLM discovery. Search + transactional pages are noindex'd.

## ⚠️ Founder actions to finish this build
- Run **`supabase/06_notifications.sql`** (guest_messages outbox).
- Add SMTP env in Vercel: `SMTP_HOST=smtp.titan.email`, `SMTP_PORT=465`, `SMTP_USER=admin@eskerrentals.com`, `SMTP_PASS=…`, `SMTP_FROM`.
- **Review the legal pages** (`/legal/*`) — they're sensible drafts, not legal advice; adjust the cancellation windows/wording to taste.
- Fill **`public_facts`** per property; decide Supabase **"Confirm email"** toggle.

## Cross-app (Esker OS / CRM session) — handoff
- **Verify-urgent dashboard flag** (website bookings >4h) — spec in memory `website-verify-urgent`.
- **WhatsApp sender** drains `guest_messages` where `channel='whatsapp' AND status='pending'` → create/find contact + conversation, send the approved **`booking_received` template**, record the outbound message (native inbox thread), mark the row `sent`. Needs the Meta template approved (utility).
- Later guest messages (payment confirmed / check-in details / cancelled) enqueue the same way; the CRM owns WhatsApp, the website owns email.

## Remaining Phase-1 ⬜ (sequenced next)
1. **Reviews** (basic capture + display; cold-start via Esker Exclusive).
2. **Analytics + Meta Pixel / Conversions API** (view listing, start booking, booking submitted) — for paid acquisition.
3. **Performance/caching pass** + CRM→site **revalidate webhook** (publish/price changes show instantly).
4. **Password-reset / forgot-password** flow; phone+OTP when an SMS provider is added.
5. **Vary AI descriptions** (stop all opening with "Experience…").
6. **Real-device mobile pass**.
7. **`favicon.ico` / app icons** — confirm a real favicon + apple-touch-icon exist in the brand look.

## Later (Phase 2+)
Owner host portal · Partner read-only investor view · real payment gateway · ElevenLabs/Realtime voice · NADRA Verisys · content-spaces (hourly) + pools (slot) booking models · multi-city.
