/**
 * Curated copy for SEO landing pages — the second gate in lib/landings.ts.
 *
 * A page does NOT exist until its slug appears here. That is deliberate: a
 * generated page with the area name swapped into a template is thin content,
 * and thin content is how programmatic SEO gets a site demoted. Writing three
 * honest paragraphs is the price of admission for a new page.
 *
 * RULES FOR ADDING COPY (keep these):
 *  • Every claim must be true and checkable. No invented distances, no
 *    "best in the city", no amenities the listings don't have.
 *  • Say something a competitor's scraper cannot: what the stays here are
 *    actually like, who they suit, what the trade-offs are.
 *  • Do NOT restate live numbers (count, price) — the page renders those from
 *    the database, so copy that repeats them goes stale.
 *  • 2–3 short paragraphs. This is an intro, not an essay.
 *
 * ⚠️ These drafts are grounded in the listing data plus uncontrovertible
 * geography. The lines a competitor genuinely cannot copy — which building is
 * quiet, where to park at night, which block loses power — are Umais's to add.
 * See the content review doc; his edits land straight in this file.
 */
export const LANDING_COPY: Record<string, string[]> = {
  // ── Area pages ────────────────────────────────────────────────────────
  "short-stay-f-10-f-11-islamabad": [
    "F-10 and F-11 are two of Islamabad's most established residential sectors, sitting side by side in the middle of the city. For a short stay they are about as convenient as Islamabad gets: F-10 Markaz and Jinnah Super are close by for food and groceries, Fatima Jinnah (F-9) Park is a few minutes away, and you are within easy reach of both the Blue Area and the Margalla foothills.",
    "Our stays here are almost all one-bedroom apartments in modern residential towers — the right size for a couple, a business traveller, or a small family who would rather have a full apartment than a hotel room. Most look out over the city, and every one comes furnished with a proper kitchen, fast WiFi, air conditioning and backup power, so a load-shedding hour doesn't end your evening.",
    "This is the pocket to book if you want to be central, arrive late, and not think about logistics. Rates are quoted per night, there is no minimum-stay games, and each apartment is cleaned and checked between guests by the same team that manages it.",
  ],

  "short-stay-bahria-town-phase-7-8-rawalpindi": [
    "Bahria Town Phase 7 and 8 sit on the Rawalpindi side of the twin cities, inside one of the largest gated communities in the country. It is a different feel from central Islamabad — wider roads, quieter streets, its own commercial strips — and it suits people who want space and security more than they want to be downtown.",
    "The stays we run here are the most varied in our portfolio: a compact studio for a solo trip or a short work stay, one and two-bedroom apartments with jacuzzis, projectors and terraces, and a three-bedroom riverview penthouse with a garden and BBQ setup for a family or a group travelling together. Several have Margalla or open city views, and gated security means arriving at an odd hour is not a problem.",
    "It is a common choice for weekend trips, family visits and small celebrations, precisely because you get more room for the money than in the Islamabad sectors. Everything is booked by the night with real, live availability.",
  ],

  "short-stay-gulberg-greens-islamabad": [
    "Gulberg Greens sits along the Islamabad Expressway side of the city and is known for being green and low-rise — farmhouse plots, gardens and open air, rather than dense blocks. It is a calmer base than the central sectors while still being a straightforward drive into town and convenient for anyone arriving from the airport side.",
    "Our stays here are a set of two-bedroom apartments finished to a genuinely high standard — each one styled differently rather than four copies of the same flat — with terraces, and Margalla or city views from most. Two bedrooms and a full kitchen make them a comfortable fit for families, two couples travelling together, or a longer stay where you actually want to cook.",
    "If you are choosing between here and a central sector: pick Gulberg Greens for space, quiet and views, and a city sector if being able to walk to a market matters more.",
  ],

  // ── Category × city ───────────────────────────────────────────────────
  "apartments-islamabad": [
    "A furnished apartment is usually the better deal in Islamabad once you are staying more than a night or two — you get a kitchen, a living room, laundry and far more space than a hotel room at a similar nightly rate, and there is no restaurant bill for breakfast.",
    "Ours are spread across the city's residential sectors, from compact one-bedrooms in central F-10 and F-11 to larger two-bedrooms in Gulberg Greens. Every one is furnished and equipped the same way as standard, not as an upsell: a working kitchen, fast WiFi, air conditioning, heating, backup power, free parking and gated security.",
    "All of them are booked by the night, with the price you see being the price for the whole apartment rather than per person. Listings marked Esker Exclusive are managed directly by our team to a guaranteed standard.",
  ],

  "apartments-rawalpindi": [
    "Rawalpindi's short-stay apartments give you noticeably more space for the money than the equivalent in Islamabad, which is why they work well for families, groups and longer stays. Ours are concentrated in Bahria Town Phases 7 and 8, inside the gated community.",
    "The range runs from a small studio suited to one or two people up to two-bedroom apartments with jacuzzis, projectors and terraces. All are fully furnished with a proper kitchen, WiFi, air conditioning, heating and backup power, and all sit within gated security with parking.",
    "Booking is per night with live availability, and the whole apartment is yours — there is no shared space and no per-person charge.",
  ],

  "penthouses-islamabad": [
    "A penthouse is the top-floor unit of its building, which in practice means the terrace, the light and the views that the flats below don't get. In Islamabad that usually means the Margalla Hills on one side and the city on the other.",
    "Ours range from a compact studio penthouse with a jacuzzi and a hill view — an easy choice for a couple — up to duplex penthouses with a private pool, an outdoor cinema setup, a BBQ area and room for a group. They are the properties we put forward for occasions: a birthday, an anniversary, a shoot, or simply a weekend where the place itself is the point.",
    "Each is booked whole and by the night. The larger ones are Esker Exclusive, meaning our own team manages and inspects them rather than a third party.",
  ],

  // ── Amenity intent ────────────────────────────────────────────────────
  "stays-with-private-pool-islamabad": [
    "A private pool means exactly that — it belongs to your stay for the duration, not a shared facility with reserved hours and other guests in it. In Islamabad these are rare enough to be worth planning a trip around, and they book out well ahead in summer.",
    "The options split into two kinds. The penthouses pair a pool with a terrace, an outdoor cinema and a BBQ setup, and suit a group of friends or a family celebration. The farmhouses are larger again — three and five bedrooms on open ground with gardens and hill views — and are the ones people take for a big group, an event or a shoot.",
    "All are booked whole and by the night. Because these are the properties most in demand for weekends and Eid, it is worth checking dates early and messaging us if the calendar looks tight.",
  ],
};
