# CLAUDE.md — Esker Stays (working name)

Read this first every session, then read `Esker_Platform_AI_First_Master_Plan.md` (the full brief). This file is the short, load-bearing rules; the master plan is the detail.

## What this is
The public, AI-first short-stay **booking website** — the consumer-facing "face" of the same business the **Esker OS CRM** runs. Pakistan-first (Islamabad/Rawalpindi). The wedge is an **AI concierge**: guests describe what they want in plain English (or Roman Urdu) and get the right real, available stay — alongside a beautiful, browsable photo-led site. Both, done excellently.

## The two rules that override everything
1. **One shared database, never duplicated.** This project uses the **same Supabase project** as the CRM (`../Esker OS`). Reuse existing tables (`properties`, `bookings`, `guests`, …). You may ADD public fields and genuinely new tables (reviews, public listing content) — never create a second `properties`/`bookings`/`guests`. Inspect the live schema before any DB change; show the plan and get approval before running migrations.
2. **The public/internal security wall is sacred.** The public site + guest AI run on the **anon key** and may read ONLY public listing data (listings flagged `public_listing`, public price, availability as free/busy only, public-safe facts, reviews). They must NEVER reach financials, other guests' PII, payment proofs, caretaker info, wifi/access codes, owner balances, or internal ops. Enforce in **Postgres RLS**, not the UI. Test adversarially before trusting it. The master/service-role key never touches the browser and stays off the public face except for specific, role-checked server actions.

## Stack (matches the CRM)
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (`@theme` tokens in `app/globals.css`) · `@supabase/ssr` · lucide-react. Reads through `lib/supabase/server.ts` (anon). Keys in git-ignored `.env.local` (URL + anon only).

## Design direction (decided)
Concept B — **the AI concierge is the hero, set on photography**; browsable listings below. Light, airy, premium, photography-led — the bright opposite of the dark CRM. Esker gold (`#C9A84C`) as a sparing accent; editorial serif (Fraunces) for headlines/prices, Inter for UI. Mobile-first. Tokens: `bg-bg`, `bg-surface`, `text-ink`, `text-gold`, `border-line`, `font-serif`.

## Name
Working name "Esker Stays" is a placeholder — keep it changeable. Never hardcode the brand in components; read from `lib/brand.ts`.

## Future scope (note — not Phase 1)
- **Property categories are broad:** apartments, penthouses, **farmhouses, villas, content spaces, swimming pools**, and more. Stored in `properties.kind` (the public `category` field). Design browse/search and the AI concierge to handle a mixed portfolio gracefully (per-category framing, not one flat grid).
- **Two booking models, by type:** most listings book **per night**. But **content spaces book hourly / by time-slot**, and **swimming pools book by slot** too. The booking + availability model must support both *nightly* and *slotted (hourly)* bookings — design the availability layer and booking flow so a slotted type slots in without a redesign. (`public_availability` will need a slot-aware variant for these.)
- **Swimming Pools is a special, dual category:**
  1. A **cross-cutting filter** — guests can see ALL properties that have a pool, across every tier (Esker Exclusive, external/owner inventory, etc.), driven by a "has pool" amenity/flag.
  2. **Standalone bookable pools** — new pool-only listings booked **by slot** (day-use / hourly), not overnight.
  So "Swimming Pools" is both an amenity-derived view over the whole portfolio AND its own slot-bookable listing type.
- **Beyond stays — services & experiences:** the platform will later list bookable **services and experiences** (not just places to stay). Architect listings/booking/AI so adding a new bookable *type* (service, experience, pool slot) later doesn't require a redesign. Confirm the booking + pricing model per type when we build it.
- **Performance is a permanent constraint, not a final pass:** every screen must stay fast on Pakistani mobile data — right-sized/lazy images, server-rendered listing/search pages, cached availability/listing reads, lean bundles, GPU-only animations (respect `prefers-reduced-motion`). Never ship a heavy hero or unoptimised images.
- **Multi-city soon:** launching Islamabad + Rawalpindi (density first, for SEO/trust), but expanding to more cities relatively quickly. Treat **city** as a first-class dimension (city → area), data and UI; never hardcode the two launch cities (`brand.launchCities`). Keep launch-city focus prominent without locking the architecture to it.
- **Browse / homepage IA:** the homepage stays light — beautiful entry points only: quick *browse by category*, *browse by area*, and a few *popular amenity* chips that **deep-link into the dedicated search/listings page**. Deep multi-filtering (area + dates + guests + amenities + price + sort + map) lives on the **search page**, not the homepage. The AI concierge also handles any combination conversationally. Rule of thumb: homepage invites; search page filters. Keep the homepage uncluttered and fast.
- **Brand/name + logo are placeholders:** the final name may not be "Esker"; the wordmark is currently text from `lib/brand.ts`. Swap in the real logo only once the name is locked. Keep everything name-agnostic.
- **Accounts & roles live HERE (the website), not the staff CRM.** Four audiences: anonymous public, **Guests** (sign up + login: their bookings/reviews), **Owners/Hosts** (sign up + login: their listings/bookings/earnings — host portal), **Investors/Partners** (login, read-only: their property's recovery/equity/results). Guests + Owners can self-sign-up. **Roles are ADDITIVE, not exclusive** — one account can hold several (an owner who also books is owner+guest). Model roles as a capability SET per account, never a single role field; the UI shows whichever portals that account has. **CRITICAL security work before ANY login is enabled:** (1) the shared DB's `handle_new_user` trigger turns every auth signup into a `grm` staff member — this MUST be defused so website signups become guest/owner roles, never staff, or they'd inherit internal access; (2) add **role-scoped RLS** so each role reads only its own slice (guest→own bookings; owner→own properties' data; partner→own property numbers only), never financials/PII that aren't theirs — test adversarially like the public wall. Design in Plan Mode; the security boundary is the gate everything else sits on. (Aligns with the prior "investor portal deferred → moved to the Platform website" decision.)

## Build order (Phase 1 — see master plan §12 for detail)
1. ✅ Public data layer + security boundary (public fields + RLS + safe availability) ← current focus
2. Listing + search pages (server-rendered, fast, image-optimized)
3. Property detail page
4. The Esker Brain (retrieval core) + public-safe knowledge store
5. Guest Concierge surface
6. Booking flow (phone+OTP, screenshot-verify payment → CRM as Awaiting Verification)
7+. Payment provider interface · guest accounts · Request a Price · host assist · reviews · CRM connect · perf pass

## Working style
Plan Mode for anything touching the DB or many files. Explain in plain language (the founder is non-technical) and say how to test each step. Never delete/irreversible without asking. Stop and ask on credentials. Quality and the security boundary over speed.
