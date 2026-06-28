# ESKER STAYS — HOMEPAGE REDESIGN BRIEF
### Hand to Claude Code. Read alongside the AI-First Master Plan. This refines the homepage specifically.

This replaces the current 5-section homepage with a stronger structure. The goal: a premium, photography-led, fast homepage that converts the visitor we actually get (most arrive from Instagram/TikTok or Google), with the AI concierge fused into the experience rather than gating it. Keep everything from the master plan's design constraints (premium, minimal, light/airy, Esker gold accent, serif headlines + clean sans UI, mobile-first, fast).

---

## 0. The core reframing (why we're changing it)

Most first-time visitors arrive **from social media (already saw a gorgeous property, warm intent, on mobile) or from Google (searched a category/area, e.g. "farmhouse for rent Islamabad")**. Neither lands wanting to compose a sentence in a text box. So:

- **Imagery and inventory must hit first and simultaneously with the concierge** — not concierge-first, beauty-later. Fuse them.
- **The concierge stays the signature interaction**, but it is a superpower *over real inventory*, not a gate the visitor must pass through.
- **Browse should be led by a visual category showcase** (photo tiles), not abstract text-pill filters. This serves the Google visitor who arrived with a category in mind, sells the inventory, and doesn't offer a competing "use these instead of the AI" path.
- **The page must look intentional with few photos and stunning with many** — never half-finished. Photography is still being added, so design for graceful scaling.

---

## 1. The concierge behavior (resolve this first — it shapes everything)

When a guest types a request and hits "Ask Esker":
- **Simple/partial query** (e.g. just "pool" or "F-7") → **filter the property grid in place** on the homepage, smoothly. The beautiful grid below *becomes* the answer. The AI feels like a superpower over real listings, not a chatbot.
- **Full/complex query** (e.g. "pool, sleeps 6, this weekend, under 20k near Centaurus") → **transition into the dedicated server-rendered search/results page** with those criteria applied.
- **Never** a full-screen takeover chat wall on the homepage. The concierge enhances the visual experience; it doesn't replace it.
- Until the AI is wired, build the input and interaction shell so this behavior can slot in cleanly. The input must feel alive (focus states, the Roman-Urdu example placeholder, example chips that pre-fill the input when tapped).

---

## 2. New homepage structure (top to bottom)

### A. Top navigation
- Left: wordmark "Esker" (serif placeholder, easy to rename).
- Right: *Browse all stays*, *Esker Exclusive* (gold), *Help*, *Sign in* (outlined).
- Over the hero with a gradient wash + text-shadow for legibility on any photo.
- **Build the mobile menu** (currently missing) — a clean hamburger → slide-over with the same links. Mobile is the primary experience; the nav must work there first.

### B. Hero — concierge fused with photography
- Full-bleed, tall, but **photography is the star, not a half-gradient backdrop**.
- **Until many photos exist:** use ONE stunning full-bleed feature photo (the single best property image available), not a 3-real-3-gradient mosaic. A single great photo reads premium; a half-empty mosaic reads unfinished. **As real photos arrive, the hero can become a richer multi-photo treatment** — design it to scale up gracefully (the Ken-Burns drift and collage can return once there are enough genuinely beautiful images; gate that on photo count, don't ship it half-empty).
- Respect reduced-motion (no drift/animation for those users).
- Over the photo: a tasteful dark scrim + a soft gold glow behind the concierge to draw the eye.
- **Centered content** (gentle rise/fade on load):
  - Gold kicker: ✦ AI CONCIERGE
  - Serif headline: "Where would you like to stay?"
  - Subtext: "Describe it in your own words — even in Roman Urdu. We'll find the right place from real, available stays."
  - White rounded concierge input + gold "Ask Esker" button. Roman-Urdu example placeholder.
  - Example prompt chips that **pre-fill the input on tap**: "Pool, sleeps 6, this weekend" · "Ground floor for my parents" · "Under ₨20k near Centaurus".
  - Small line: "Now in Islamabad & Rawalpindi · more cities soon".
- **Trust signals near the hero** (trust is the conversion bottleneck in Pakistan): subtle, premium markers — e.g. "Verified stays," an Esker Exclusive guarantee mention, real reviews/ratings once they exist, response-time. Keep it elegant, not a badge soup. This reassures the scam-wary first-time visitor immediately.

### C. Esker Exclusive — featured stays
- Heading "Esker Exclusive" (serif) + "Explore all stays →".
- Responsive card grid (2 cols mobile → 5 desktop): photo, gold "Exclusive" badge, title, "category · area", and **price labeled by booking type** (see §3). Pull real Esker Exclusive listings from the DB once wired; placeholder cards until then.
- This is the trust anchor — it leads, and it's marketed first.

### D. Browse by category — VISUAL SHOWCASE (replaces the text-pill switcher)
- Replace the Categories/Areas/Amenities segmented pills with a **visual category showcase**: gorgeous photo/representative tiles for the categories people actually arrive wanting.
- **Categories (pull the real set from the DB; these are the expected ones):** Apartments, Penthouses, Villas, Farmhouses, **Content Spaces** (hourly), **Swimming Pools** (slot/day-use + the "has a pool" filter). 
- Each tile = a photo, the category name, and (nice touch) a live count ("12 stays"). Tapping a tile deep-links into the search/results page filtered to that category.
- This naturally separates the different booking models (stays vs pools vs content spaces) so they're framed correctly from the first click.
- **Areas and amenities are NOT primary homepage controls.** Move deep area/amenity filtering to the search page. Optionally include a quiet, secondary "Browse by area" row of small text links **populated from the real areas in the database** (see §4) — but it must not compete visually with the category showcase or the concierge.

### E. (Optional, if it strengthens the page) A short "Why Esker" trust strip
- A slim, elegant band reinforcing the three things that matter to a wary Pakistani guest: verified/managed quality (Esker Exclusive), local payment ease, real support. One line each, premium, no clutter. Only include if it doesn't slow or crowd the page.

### F. Footer
- Wordmark + tagline "Premium short stays, beautifully managed."
- Add useful real links as they exist (Browse, Esker Exclusive, Help, contact, social). Keep clean.

---

## 3. Mixed inventory — price must match booking type (important correctness fix)

The catalog has different booking models. A slot-booked pool showing "₨X/night" is wrong and erodes trust. The card/price system must understand booking *type* and label accordingly:
- **Per-night stays** (apartments, penthouses, villas, farmhouses) → "₨X / night"
- **Slot/day-use pools** → "₨X / slot" (or "/ day")
- **Hourly content spaces** → "₨X / hour"
- Later: services/experiences → their own appropriate unit.

Cards, listings, and the concierge results must all render the correct unit based on the listing's booking type (a field on the listing). Build this into the card component now so it's correct everywhere.

---

## 4. Use REAL areas/locations from the database (explicit requirement)

Do **not** hardcode a short area list. Every area/location that exists in the CRM/database must be usable on the website. Pull the real, current set of areas from the database (the same `properties` the CRM uses) wherever areas appear — search page filters, any "browse by area" element, the concierge's understanding. When a new property in a new area is added in the CRM, the website should reflect that area automatically without a code change. Areas are data, not hardcoded UI.

---

## 5. Performance & mobile (permanent constraints)

- Mobile-first: design and verify the mobile layout first; it's the primary experience.
- Right-sized, lazy-loaded images; never ship oversized photos (kills speed on Pakistani mobile data).
- Server-render the homepage and search pages (speed + SEO — important since most traffic is Google/social).
- GPU-only animations; lean JS; reserved heights so nothing layout-shifts.
- The page must be fast with many photos, not just with few. Enforce a performance budget.

---

## 6. Photo-readiness rule (design for graceful scaling)
Photography is being added. Design so the page looks **intentional with few photos and stunning with many**:
- Few photos → single hero feature image, fewer showcase tiles, no half-empty mosaic.
- Many photos → richer hero, full category showcase, more featured stays.
- Never render gradient-filler tiles next to real photos in a way that looks unfinished. Prefer fewer, real, beautiful images over padded grids.

---

## 7. Build order for this redesign
1. Card component that handles booking-type-aware pricing (§3) — reused everywhere.
2. New hero (single feature photo treatment + concierge shell + trust signals + mobile nav).
3. Visual category showcase (§D) pulling real categories + counts from the DB; deep-links to search page.
4. Esker Exclusive featured row from real DB listings.
5. Wire concierge interaction behavior (§1) — in-place filter for simple, transition to search for complex.
6. Real areas wired from DB (§4) wherever areas appear.
7. Optional "Why Esker" trust strip (§E) if it strengthens without cluttering.
8. Performance + mobile pass; reduced-motion; photo-readiness checks (§6).

Test each step on mobile first. Keep it premium, fast, uncluttered. When unsure, ask before assuming.

---

## 8. One-line north star
A premium, photography-led homepage where stunning real stays and an AI concierge greet the visitor together — browse by beautiful category, or just say what you want — correctly handling stays, pools, and content spaces, built fast and mobile-first, and designed to earn a scam-wary first-time guest's trust on sight.
