# Esker Stays — Homepage: Current State & Open Questions
*(A self-contained brief for a design discussion. The reader has no access to the code — everything needed is here.)*

## 1. What this product is

**Esker Stays** (working name) is an **AI-first, Pakistan-first short-stay booking website** — the public, guest-facing "face" of a business whose staff already run an internal CRM on the same database. Launch market: **Islamabad + Rawalpindi**, expanding to more cities soon.

**The core wedge:** an **AI concierge**. Guests describe what they want in plain language — even Roman Urdu ("mujhe F-7 mein 2 din ke liye apartment chahiye") — and get the right *real, available* place. But it is deliberately **NOT** a chatbot-only site: it's also a beautiful, fast, browsable premium booking site. The goal is **both, woven together** — "tell us what you want" *and* "browse and fall in love with a place yourself."

**Inventory is a mixed portfolio**, growing:
- Apartments, penthouses, villas, farmhouses
- **Content spaces** (for shoots) — booked **hourly / by time-slot**, not per night
- **Swimming pools** — a dual concept: (a) a filter showing *all* properties that have a pool, and (b) standalone pools booked **by slot** (day-use)
- Later: **services and experiences** (not just places to stay)

**Esker Exclusive** is a premium trust tier — properties Esker manages to a guaranteed standard. It's the trust anchor (badge + premium placement) and is marketed first.

## 2. Design principles / hard constraints

- **Premium, minimal, photography-led, aspirational.** Light and airy (the bright opposite of the dark internal CRM). **Esker gold** (#C9A84C) used sparingly as an accent. Editorial **serif** for headlines/prices; clean **sans** for UI.
- **Mobile-first** — most guests are on phones; the mobile experience IS the product.
- **Fast and efficient, always** — a permanent constraint, not a final pass. Right-sized/lazy images, server-rendered pages, GPU-only animations, lean JavaScript.
- **Chosen homepage concept ("Concept B"):** the **AI concierge is the hero**, set on property photography, with browsing woven in beneath it. (We compared three concepts; this one won.)

## 3. The homepage right now — section by section

The page currently has **5 parts**, top to bottom. Most content is **placeholder** (visual foundation); the data layer and AI are built but not yet wired into this page.

### A. Top navigation (over the hero)
- Left: the wordmark "Esker" (serif; placeholder — final name/logo TBD).
- Right: links — *Browse all*, *Esker Exclusive* (in gold), *Help*, and an outlined *Sign in*.
- Sits over the photo hero, with a dark gradient wash + text-shadow so it stays readable on any photo.
- *Note:* the nav links currently show only on larger screens; a mobile menu isn't built yet.

### B. Hero — the AI concierge over a photo collage (the centerpiece)
- Full-bleed, tall (~92% of screen height), dark.
- **Background:** an **asymmetric collage mosaic** (a 4×3 grid with varied tile sizes — one large feature tile) of property photos. Currently 3 real photos + 3 warm gradient filler tiles (only 3 photos are uploaded so far). The photo tiles have a slow, cinematic **Ken-Burns drift** (gentle zoom), GPU-only, and **disabled for users who prefer reduced motion**.
- Over the collage: a dark scrim gradient + a soft **gold glow** centered behind the concierge to draw the eye.
- **Centered content** (gently rises/fades in on load):
  - Small gold kicker: ✦ "AI CONCIERGE"
  - Big serif headline: **"Where would you like to stay?"**
  - Subtext: "Describe it in your own words — even in Roman Urdu. We'll find the right place from real, available stays."
  - A white rounded **concierge input bar** with a gold **"Ask Esker"** button (placeholder text is a Roman-Urdu example). **Not functional yet.**
  - Three example **prompt chips**: "Pool, sleeps 6, this weekend" · "Ground floor for my parents" · "Under ₨20k near Centaurus"
  - A small line: "Now in Islamabad & Rawalpindi · more cities soon"

### C. Esker Exclusive — featured stays (directly under the hero)
- Heading "Esker Exclusive" (serif) + an "Explore all stays →" link.
- A responsive grid of property **cards** (2 columns on mobile → 5 on desktop): a photo area, a gold **"Exclusive"** badge, the title, "category · area", and price (₨X / night).
- Currently 5 placeholder sample stays.

### D. "Browse our stays" — the filtering control (THE THING IN QUESTION)
- A subtly banded section, centered heading **"Browse our stays."**
- A centered **segmented switcher** with three tabs: **Categories / Areas / Amenities** (active tab = dark pill).
- Below it, **centered chips** for whichever tab is active; switching tabs swaps the chips **in place, instantly** (client-side, no reload, reserved height so nothing jumps):
  - **Categories:** Apartments, Penthouses, Villas, Farmhouses, Content Spaces, Swimming Pools
  - **Areas:** E-11, F-10, B-17, Bahria Phase 7
  - **Amenities:** Private pool, Jacuzzi, Home cinema, Margalla view, BBQ, Gaming
- The chips currently link nowhere — they're intended to later **deep-link into a dedicated search/results page** (not built yet).

### E. Footer
- Wordmark + tagline: "Premium short stays, beautifully managed."

## 4. What's real vs placeholder (important)
- **Built & verified:** the database/security layer — the public site can read only safe public listing data; all internal data (finances, other guests, etc.) is sealed off.
- **Placeholder on this page:** the concierge input (not wired to the AI), the listing cards (sample data), all links, and most photos (only 3 real ones exist). The page is a **design foundation**, not yet a working product.
- **Only interactive thing today:** the Browse segmented switcher (toggles which chips show).
- **Planned next:** a dedicated, server-rendered **search/listings page** where the *deep* filtering lives (combine area + dates + guests + amenities + price, sort, map), plus the property detail page, then wiring the AI concierge.

## 5. The open question I want to discuss

**Should area / category / amenity filtering be on the main page at all — and if so, how?**

The tension:
- The product's whole edge is the **AI concierge** ("just tell us what you want"). Do traditional filter chips **complement** that (reassuring browse-minded users, aiding discovery, SEO) or **compete with / undermine** it (clutter, sending the message "use these filters instead of the AI")?
- There's already a **dedicated search page** planned for heavy filtering. So is putting filters on the homepage redundant, a helpful shortcut, or a distraction?
- Constraints: must stay **premium, uncluttered, fast, mobile-first.**

Some directions to weigh (not exhaustive):
1. **Keep lightweight entry points on the homepage** (like the current segmented switcher) that deep-link into the search page.
2. **Remove filters from the homepage entirely** — lead with the concierge + a showcase of beautiful properties/categories, and let the AI (or a single search bar) handle intent; full filtering lives only on the search page.
3. **Replace pills with a visual category showcase** (photo/icon tiles for Apartments, Villas, Pools, etc.) as the browse method, with areas/amenities pushed to the search page.
4. **A single unified search bar** (Airbnb-style: where / when / guests) instead of category/area/amenity pills, with the AI as the smarter alternative.
5. **Hybrid** — e.g., a category showcase on the homepage, and area/amenity filtering only inside the search experience.

### Specific questions to explore
- Does on-homepage filtering strengthen or dilute an AI-first product?
- If kept: which axis matters most to a guest first — **category**, **area**, **amenity**, or **dates/price**? Should only the most important one be on the homepage?
- What's the most premium, least cluttered *form* (segmented pills vs photo tiles vs single search bar vs nothing)?
- How should it behave on **mobile** specifically?
- How do filters and the AI concierge coexist without one making the other feel pointless?
- Where's the line between "inviting exploration" (homepage) and "serious filtering" (search page)?

## 6. One-line summary for the discussion
*An AI-first, premium, photography-led short-stay homepage where the concierge is the hero — now figuring out whether/how traditional category/area/amenity browsing should appear on the main page without cluttering it, slowing it, or undermining the "just tell us what you want" wedge.*
