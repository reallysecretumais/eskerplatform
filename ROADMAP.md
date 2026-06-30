# ROADMAP — Esker Stays

Where we are and what's left. Pairs with `SESSION_HANDOFF.md`. (✅ done · 🟡 partial · ⬜ not started · ⚠️ blocked on a founder action)

## Done ✅
- **Foundation + security wall** — public data layer (`public_listings`, `public_availability`), RLS, adversarially verified.
- **Homepage** (Concept B) — concierge hero over a 3D drifting photo-wall, category showcase, Esker Exclusive row, trust strip.
- **Search** `/stays` (filters + AI mode) and **property pages** (gallery, "Ask about this place", grouped amenities, Built-for-Pakistan §8, location map §6, trust line, booking widget).
- **AI concierge** — retrieval-first (OpenAI, public data only), Roman-Urdu-in/English-out, streaming, "find similar". Leak-tested.
- **Accounts** — guest/owner/partner additive roles; email+password; login/signup/account; account-aware nav; verified isolation. Phone+OTP built (dormant).
- **Booking flow** — checkout, first-time CNIC/passport + **AI ID check (rejects expired)**, real bank accounts, screenshot → `awaiting_payment`/`source=Website` into the CRM; "My bookings".
- **Property descriptions** auto-generated into `public_description`.
- **WhatsApp "Request a price"** — BookingWidget links to `wa.me/923325977626` prefilled.

## Phase 1 — COMPLETE ✅ (deployed to eskerrentals.com)
Foundation + security wall · homepage/search/property pages · **text + voice AI concierge** · accounts + password reset · booking flow + AI ID check · **advance payments (25/50%)** · availability + 18h auto‑release · **guest notifications (email + WhatsApp‑queued) + team alerts** · **reviews** (curated) · **SEO + AI discoverability** · **Meta Pixel/CAPI** · **caching + revalidate webhook** · brand logo/favicon · premium descriptions · legal pages. Full status + remaining founder actions in **`PHASE1_LAUNCH_CHECKLIST.md`**.

Small leftovers: real‑device mobile pass · optional PNG app icons · post‑stay review capture.

## Next builds ⬜ — Phase 2 (each sits on the accounts foundation)
1. **Owner host portal** — a logged-in `owner` manages their listings, sees their bookings/earnings. Needs owner→property link (`owners.account_id`) + owner-scoped RLS.
2. **Partner read-only view** — `partner` (admin-granted) sees their property's performance, read-only, scoped to their property. Strict RLS.
3. **Real payment gateway** — behind the existing advance/booking flow (provider interface); keep screenshot‑verify until then.
4. **Voice quality jump** — ElevenLabs or OpenAI Realtime when ready (OpenAI TTS is at its ceiling).

## Later phases ⬜
- **Phone+OTP** for guests — switch on by adding an SMS provider in Supabase (no code change).
- **NADRA Verisys** — real CNIC verification against the national DB (regulated API agreement); slots in after the AI ID extraction.
- **Real payment gateway** — behind the same booking flow (provider interface). Keep screenshot-verify until then.
- **Content Spaces (hourly)** + **Swimming Pools (slot/day-use)** booking models — the unit logic exists (`unitForCategory`/`formatPrice`); wire slot/hour selection when those listings are added.
- **Multi-city** beyond Islamabad/Rawalpindi (city is a first-class dimension; don't hardcode the two launch cities).
- **Services & experiences** (beyond stays), reviews maturity, host self-signup + escrow + ops-brain fraud detection (master plan Phase 2–3).
- Optional CRM polish: a "Website · awaiting verification" badge + one-click "confirm payment".

## North star
A premium, AI-first, Pakistan-native booking site where a guest says what they want and gets the right real place — anchored by Esker Exclusive, on the same brain as the CRM. Build the bounded, brilliant version first.
