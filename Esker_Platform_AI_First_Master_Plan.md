# ESKER PLATFORM — AI-FIRST MASTER PLAN
### Pakistan's first AI-first short-stay booking platform, built on Esker's real inventory and CRM
### Confidential — Founders. Working name TBD. Hand this whole file to Claude Code.

---

## 0. One-Paragraph Summary

Build a fast, premium, AI-first short-stay booking platform for Pakistan, launching in Islamabad/Rawalpindi with 15–20 real vetted properties (Esker's own + trusted owners), running on the **same database** as the Esker OS CRM. The platform's wedge is an **AI concierge** that lets guests find and book by describing what they want in plain English (and understanding Roman Urdu input), instead of fighting an Airbnb-style filter grid. Lead with **Esker Exclusive** — professionally managed, guaranteed-quality listings — as the trust anchor. Launch with screenshot-verify local payments; integrate a real gateway in parallel. Grow from curated launch → curated marketplace → open AI-first marketplace with escrow, host intelligence, and negotiation. Each phase is independently valuable and de-risks the next.

---

## 1. Strategic Foundation (read before building)

**The gap is real.** Pakistan's market is split between Airbnb (works but painful local payments, weak domestic discovery), Zameen/OLX (huge audience, no booking infrastructure, no trust layer, fraud-prone), and informal WhatsApp/Instagram dealing. Nobody combines local payments + trust + booking infrastructure + an experience native to how Pakistanis actually shop. That's the wedge.

**The hard parts are NOT the website** — they are cold-start (chicken-and-egg supply/demand), trust (fear of scams), and money-handling (SBP regulation). Esker's unfair advantages neutralize all three: you launch with 15–20 real properties (supply solved), Esker Exclusive (trust anchor), and an existing guest/inquiry base (demand seed).

**Why AI-first is the real moat.** The way Pakistanis shop for short stays is *conversational* — they DM on WhatsApp/Instagram describing what they want. Incumbents force them into English filter grids that feel alien. An AI concierge that meets them in their native mode — describe your need, get the right place, ask anything, book — is something Airbnb will never rebuild for this market. That's how you lead the category instead of joining it.

**Timeline:** ~1.5–2 months for Phase 1 (soft target). Launch the buildable, valuable thing; grow the venture behind it.

---

## 2. Architecture — One Brain, Three Faces

The platform and CRM share **one Supabase database**. This is the foundational decision.

- **Face 1 — Esker OS (staff app):** existing CRM. Bookings, guests, properties, inbox, finance, ops.
- **Face 2 — Public booking website:** what guests see. Browse, AI concierge, book, pay, manage stay.
- **Face 3 — Host portal:** what third-party hosts see (later phases). Their listings, bookings, earnings, AI pricing help. Reuses the read-only partner-login pattern already built for investors.

**Shared brain — same database.** A website booking writes to the same `bookings` table the team manages. A listing is the same `properties` record. No syncing, no duplicate systems.

**The critical security boundary:** Row-Level Security must cleanly separate **public** data (listings, availability, public prices, reviews) from **internal** data (financial splits, other guests' personal data, caretaker info, partner balances, deal logic). A guest or the public AI must NEVER reach internal data. Enforce at the database, not just the UI. This is the single most important security requirement in the whole build — test it adversarially before launch.

Implementation notes:
- Add `public_listing` (bool) + public fields to properties (gallery, public description, amenities, public nightly rate, area, capacity, house rules-public-safe).
- Website bookings get `source = "Website"` (and `source = "AI Concierge"` when the AI drove the booking) for channel analytics.
- Availability is one source of truth: a booking anywhere blocks the calendar everywhere instantly. No double-booking between site, AI, and team.

---

## 3. THE AI LAYER (the heart of the platform)

The platform is AI-first: AI is woven through the guest experience, the host experience, and the business operations. All AI surfaces share **one underlying intelligence and knowledge base** ("the Esker Brain"), exposed through different surfaces, each with its own permission scope and guardrails. Build the brain once; expose it safely in multiple places.

### 3.1 — The Esker Brain (shared foundation)
A retrieval-based AI core: when asked something, it (a) understands the request, (b) retrieves ONLY the permission-scoped data it's allowed for that surface/user, (c) generates a response grounded in that real data. It never free-queries the database and never answers from imagination when data is available. Database facts always beat model assumptions; if it can't verify something, it says confirmation is needed rather than guessing.

Three surfaces draw on this brain:
1. **Guest Concierge** (public website) — the wedge.
2. **Staff AI** (inside CRM) — already designed (unified inbox assistant + internal Esker AI). Same brain, internal scope.
3. **Ops Brain** (business side) — grows from the CRM AI; fraud detection, demand forecasting, matching at platform scale (later phases).

A shared **knowledge store** feeds all three: per-property facts (wifi, parking, family-appropriateness, distance to landmarks like Centaurus/F-9 Park, pool details, access info — public-safe subset for guests), policies, pricing logic, SOPs. Same store specced for the staff AI; the guest surface reads only the public-safe subset.

### 3.2 — Guest Concierge (LAUNCH — the category-defining feature)

**The interface philosophy: between "conversation is everything" and "normal site with a chat widget."** The site is a beautiful, fast, browsable premium booking site AND the AI is the smarter way to search and decide — woven in, not bolted on. A guest can:
- Browse listings normally (premium, photo-led, fast), OR
- Just say what they want ("I need a place in F-7 for my parents next weekend, ground floor, under 20k") and the AI finds it, filters the **real live inventory**, and presents actual matches.
- These blend: typing a need live-filters the real listings; browsing and asking a question about a listing are the same fluid experience.

**What the Guest Concierge does at launch:**
- **Understands needs in natural language.** English by default. **Understands Roman Urdu input** ("mujhe F-7 mein 2 din ke liye apartment chahiye") and replies in clean English. This is a deliberate Pakistan-native edge incumbents don't have. (Full Urdu script output is a later option; launch = understands Roman Urdu in, replies English.)
- **Answers deep property questions** by reading property data + the public-safe knowledge store: parking, family-appropriateness, distance to landmarks, pool, capacity, amenities, house rules. This is where it beats a search box.
- **Recommends across the live portfolio.** If the first choice is booked or over budget, it proactively surfaces the best real alternatives ("the 2BHK you wanted is booked those nights, but here are two similar in F-11 that are free and within budget"). This is the single most powerful guest-AI behavior — always on.
- **Guides toward booking** naturally — surfaces the right next step, removes uncertainty, builds trust. Premium hospitality tone, never pushy, never "chatbot-y."
- **Lets the guest book through it** (autonomy level (b)): the AI recommends and walks the guest into the booking flow, but does NOT autonomously handle money or negotiate at launch. The booking still goes through the real payment + confirmation flow.

**Guest Concierge guardrails (hard, enforced on data + actions):**
- Reads only public-safe data via RLS. Cannot reach financial splits, other guests' data, caretaker info, internal ops. Test adversarially.
- Does NOT confirm payments, set prices, or negotiate autonomously at launch.
- Grounds every factual claim in retrieved data; if unverifiable, says so.
- Task-scoped (finding/booking/answering about stays) — not an open general chatbot.

**Internal reasoning (never shown to the guest):** before responding, the concierge internally determines guest intent, constraints (area, dates, budget, group, family), buying signals, objections, missing info, best next action, and confidence — then outputs only the helpful, human, premium reply. Reasoning stays internal.

### 3.3 — Host Intelligence (LAUNCH: basic; later: deep)

**At launch (basic host assist):**
- **AI auto-writes a listing** from property details (description, highlights, amenities) so onboarding a host/property is fast and the copy is premium and consistent.
- **AI suggests a starting price** from comparable live listings (area, type, capacity).

**Later phases (deep host intelligence — the supply-side moat):**
- Dynamic pricing from real demand data ("drop weekday rate 10% to fill these 3 empty nights").
- Occupancy prediction, demand forecasting, photography/quality guidance, performance insights.
- This is how you win hosts away from Airbnb — you don't just list them, you make them more money.

### 3.4 — Ops Brain (grows from the CRM AI; later phases)
Already started as the internal Esker AI. At platform scale it expands into: fraud/scam detection (critical as you open to third-party hosts), demand forecasting, automated guest–host matching, anomaly detection in payments/bookings. Treated as a natural growth of the CRM AI you already have, expanded in later phases — not a launch deliverable, but architected so it can grow without redesign.

### 3.5 — Future-proofing the AI toward agentic
Design every AI surface so it can evolve from "recommend/answer" to "take actions" (create bookings, create guests, schedule follow-ups, update records, negotiate) without redesign. The guest concierge graduates to handling whole bookings incl. negotiation later, with the same staged-trust guardrails used for the staff inbox AI (money + negotiation always gated until explicitly trusted; high-value, complaints, disputes, refunds always hand off to a human). Build the action-layer seams now; enable them later.

---

## 4. Phased Roadmap

### Phase 1 — LAUNCH (~1.5–2 months): AI-first Esker booking site
Fast, premium, photo-led public site on the shared CRM database, Islamabad/Rawalpindi, 15–20 real properties. Includes:
- Browse + AI Concierge (conversational search, deep Q&A, cross-portfolio recommendations, Roman-Urdu-in/English-out, recommend-and-book autonomy).
- Esker Exclusive tier.
- Booking flow with screenshot-verify local payments (money held, not instantly released).
- Guest accounts: phone+OTP optional, email captured, forceable-later.
- "Request a Price" routing to the CRM inbox.
- Basic host assist (AI listing copy + starting price) for onboarding the launch inventory.
- Reviews capture (basic).
- Everything writes to the CRM; availability shared; source-tagged.

### Phase 2 — Curated marketplace
Onboard more known owners as hosts. Host portal (reuse partner-login pattern) with their bookings/earnings + basic AI pricing help. Reviews mature. Integrate the **real payment gateway**. Guest accounts become more central.

### Phase 3 — Open AI-first marketplace
Open (verified) host self-signup. Real escrow wallet with proper SBP-compliant structuring. Deep host intelligence (dynamic pricing, forecasting). Ops Brain fraud detection at scale. Guest concierge graduates to autonomous booking + negotiation. InDrive-style reverse-bidding once liquidity supports it. Optional: full Urdu output, more cities.

---

## 5. Payments

**Launch (screenshot-verify — build now):** guest sees total → shown local options (Easypaisa/JazzCash/bank/SadaPay) → pays in their own app → uploads screenshot/reference → booking enters CRM as **Awaiting Verification** → team verifies → **Confirmed**. Money is **held by Esker, not instantly released to the host** (informal hold until check-in; do NOT advertise as "escrow" yet).

**In parallel (real gateway — important):** integrate a Pakistani payment gateway so payment is automatic. Needs merchant account + approvals — start the application early (lead time). Build the payment step as a **provider interface** so the gateway slots in behind the same booking flow without redesign.

**Regulatory:** holding guest funds before host release is escrow-like and touches SBP rules. Informal at launch scale among trusted owners; get proper legal structuring before Phase 3 / open escrow. Don't market "escrow"/"wallet" as features until compliant.

---

## 6. Guest Accounts
- Launch: book with **phone + OTP**, account optional, **email captured** at account creation. Every booking captures phone → implicit **stub account** keyed to phone.
- Later: flip a switch to **require accounts** — every past guest already has a phone-keyed stub, so nothing's lost and no one's locked out. Force accounts only when worth it (loyalty, saved details, reviews).
- Email = booking confirmations, recovery, the one durable non-WhatsApp channel.

---

## 7. Esker Exclusive — The Trust Moat
A premium tier for properties Esker operates/manages to a guaranteed standard (your owned/managed units + best controlled external inventory). Visually distinguished (badge, premium placement, "professionally managed, quality guaranteed"). Function: the trust anchor a pure marketplace can't replicate day one. New guests trust Esker Exclusive → trust the platform → trust extends to vetted third-party hosts later. Lead marketing with it. The AI concierge highlights Esker Exclusive matches and explains the guarantee when relevant.

---

## 8. Negotiation — "Request a Price" (launch) → Bidding (later)
Bidding needs liquidity (Phase 3). For launch: **"Request a Price" / "Make an Offer"** — guest proposes a price or describes a situation ("late check-in, can you do 25k?"); it routes into the **CRM unified inbox** where team/host responds. Gives the local haggling feel Pakistanis expect, captures price-sensitive guests, reuses existing infrastructure. Bridge to full AI-driven negotiation and InDrive-style reverse-bidding later.

---

## 9. Design — Premium & Fast (non-negotiable)
- **Look:** consumer-facing, lighter than the dark CRM — airy, aspirational, trustworthy, editorial, **photography-led** (big beautiful property photos are the hero). Esker gold as accent, refined typography. Premium hospitality, not budget-listings. The AI concierge is elegantly woven in (e.g. a prominent, inviting "tell me what you're looking for" entry that feels premium, plus contextual AI on listing pages), never a clunky chat bubble.
- **Mobile-first:** most users are on phones; the mobile experience IS the product.
- **Trust signals everywhere:** verified badges, reviews, clear pricing, Esker Exclusive marks, real photos, response-time.
- **Fast:** Next.js with image optimization (right-sized, lazy-loaded — photo pages must be fast on Pakistani mobile data); server-render listing/search pages (speed + SEO for domestic discovery Airbnb under-serves); lean initial bundle; cache availability/listing data; never hit the DB raw per page load. Enforce a performance budget.

---

## 10. Go-To-Market — Cold-Start
- **Supply solved at launch:** 15–20 real properties, all genuinely listed/photographed/priced/available before launch. Protect this — it's your biggest edge.
- **First guests:** funnel existing Esker demand (Instagram/TikTok/WhatsApp inquiries, past guests) to the site instead of closing only in DMs. Seeds bookings + reviews day one.
- **Reviews early:** every Esker Exclusive stay requests a review → trust flywheel.
- **SEO from launch:** server-rendered listing pages targeting domestic search ("short stay Islamabad," "furnished apartment Rawalpindi").
- **Density over breadth:** dominate Islamabad/Rawalpindi before any other city.

---

## 11. What Reuses the CRM (don't rebuild)
Properties (same records + public fields) · Bookings (same table, source-tagged) · Guests (same records, phone-keyed stubs unify with guest intelligence) · Inbox (Request-a-Price + guest messages route here) · Host/partner dashboards (reuse investor read-only login pattern) · Finance (bookings flow into existing revenue/finance) · Availability (one source of truth) · The AI knowledge store (shared brain, public-safe subset for guests).

---

## 12. Build Order for Claude Code — Phase 1

Build in this sequence, testing each before moving on. Use Plan Mode for the data layer, the RLS boundary, and the AI retrieval design especially. Stop and ask before anything touching credentials or irreversible setup.

1. **Public data layer + security boundary.** Add `public_listing` + public fields to properties. Implement RLS separating public vs internal data. **Test adversarially**: an anonymous/public user (and the guest AI) must read ONLY listing data, never anything internal. This gates everything else.
2. **Listing + search pages** — server-rendered, fast, image-optimized. Browse, filter by area/dates/guests, Esker Exclusive tier visible.
3. **Property detail page** — stunning gallery, amenities, description, rate, availability calendar, reviews section, "Book" + "Request a Price" actions.
4. **The Esker Brain (retrieval core) + public-safe knowledge store** — per-property facts (parking, family-appropriate, landmark distances, pool, capacity, house rules), retrieval that returns only permission-scoped data, grounded generation, "confirm if unverifiable" behavior. Build the shared core here so all surfaces reuse it.
5. **Guest Concierge surface** — conversational search woven into the site: understands needs (English default, Roman Urdu input), filters real live inventory, answers deep property questions from the knowledge store, **recommends across the portfolio** (alternatives when first choice booked/over budget), guides toward booking, recommend-and-book autonomy (no autonomous money/negotiation). Internal reasoning hidden; premium human tone; guardrails enforced on data + actions; adversarial role/leak tests.
6. **Booking flow** — dates → total → phone+OTP (account optional, email captured) → local payment → upload proof → booking created Awaiting Verification in CRM (source-tagged, incl. "AI Concierge" when AI-driven).
7. **Payment provider interface** — screenshot-verify provider now; gateway slot later.
8. **Guest accounts (light)** — phone-keyed stubs, booking history, forceable-later switch, email capture.
9. **"Request a Price"** — routes into the unified inbox.
10. **Basic host assist** — AI auto-writes listing copy + suggests starting price (for onboarding the 15–20 launch properties).
11. **Reviews capture** — post-stay request + display.
12. **Connect to CRM** — website/AI bookings appear in the team CRM, availability shared, channels tagged.
13. **Design + performance pass** — premium, photo-led, mobile-first, performance budget enforced.
14. Full test (incl. AI guardrail/leak tests + RLS tests), mobile check, launch with all 15–20 properties live.

Phases 2–3 (real gateway, host portal + deep host intelligence, escrow, open signup, ops-brain fraud detection, autonomous concierge + bidding, full Urdu) are separate later build scripts.

---

## 13. Risks & Honest Cautions
- **AI data-leak is the top risk of an AI-first site.** The guest concierge has powerful retrieval; one RLS gap and it could surface internal financials or another guest's data. The public/internal boundary (build step 1) and adversarial testing of the concierge are non-negotiable.
- **Money-handling/SBP** — stay informal/curated until properly structured; don't advertise escrow/wallet until compliant.
- **Cold-start past your own inventory** — 15–20 launches you; growing third-party supply is the real Phase 2 test. Have a host-acquisition plan.
- **Trust/fraud as you open up** — every third-party host is risk; keep vetting strict; keep Esker Exclusive clearly distinguished so quality never dilutes; this is where the Ops Brain fraud detection earns its place.
- **Photography/quality bar** — a premium AI-first site with mediocre photos fails. Launch inventory must look stunning.
- **Scope creep vs the window** — the gateway, escrow, deep host AI, autonomous negotiation, and bidding are the time-sinks. Keep them OUT of Phase 1. Launch screenshot-verify + bounded concierge + Esker inventory; everything else follows.
- **AI cost/latency** — the concierge calls a model; keep it retrieval-based and token-efficient (one well-scoped call per turn, not multi-step chains), cache where possible, so it's fast and affordable at scale.
- **Focus** — you're running Esker AND the CRM AND this. This platform is the culmination, but don't let it starve the operating business that funds it.

---

## 14. The One-Line North Star
An AI-first, Pakistan-native short-stay platform where a guest simply says what they want and gets the right place — anchored by Esker Exclusive's guaranteed quality, powered by the CRM you already run, launched lean in one city, and architected to grow into the country's leading marketplace. Build the bounded, brilliant version first; grow the venture behind it.

---

*Hand this whole file to Claude Code as the platform brief. It complements (does not replace) the Esker OS CRM CLAUDE.md and addenda — the platform is the public, AI-first face of the same system. When in doubt, ask before assuming, and never let the public surface reach internal data.*
