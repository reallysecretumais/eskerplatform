/**
 * Curated copy for SEO landing pages — the second gate in lib/landings.ts.
 *
 * A page does NOT exist until its slug appears here. That is deliberate: a
 * generated page with the area name swapped into a template is thin content,
 * and thin content is how programmatic SEO gets a site demoted. Writing a few
 * honest paragraphs is the price of admission for a new page.
 *
 * ── THE RULE: WRITE ONLY WHAT CANNOT CHANGE ───────────────────────────────
 * This copy is static; the inventory underneath it is not. So it describes the
 * AREA and the KIND of stay — geography, character, who it suits — and never
 * the current stock. Specifically, NEVER write:
 *
 *   ✗ what we currently have    ("a studio, two 2BHKs and a penthouse")
 *   ✗ counts                    ("all four", "our three apartments")
 *   ✗ prices or positioning     ("from ₨21,000", "the affordable option")
 *   ✗ amenity lists             ("WiFi, AC, backup power, parking")
 *   ✗ booking terms             ("rates are quoted per night")
 *
 * Every one of those goes stale the moment a listing is added, delisted,
 * repriced or edited in the CRM — silently, because nobody re-reads this file.
 * And they are all rendered ON the page already, live from the database: the
 * stay count, the from-price, and the "Standard across these stays" line. Copy
 * that repeats them is duplicated truth waiting to become a contradiction.
 *
 * What DOES belong here: what the area is actually like, what it is near, the
 * honest trade-off against other areas, and who should book it. Those are true
 * this year and next.
 *
 * ⚠️ These drafts hold to that rule but are written from public geography. The
 * lines a competitor genuinely cannot copy — which building is quiet, where to
 * park at night, what the drive is really like at 9am — are Umais's to add.
 */
export const LANDING_COPY: Record<string, string[]> = {
  // ── Area pages ────────────────────────────────────────────────────────
  "short-stay-f-10-f-11-islamabad": [
    "F-10 and F-11 are two of Islamabad's most established residential sectors, sitting side by side in the middle of the city. For a short stay they are about as convenient as Islamabad gets: F-10 Markaz and Jinnah Super are close by for food and groceries, Fatima Jinnah (F-9) Park is a few minutes away, and you are within easy reach of both the Blue Area and the Margalla foothills.",
    "The housing here is largely modern residential towers rather than houses with gardens, so a stay in F-10/F-11 means a city apartment — lifts, secure buildings, views over the sectors, and everything within a short drive. That is the trade: you give up outdoor space and gain the ability to get anywhere in Islamabad quickly.",
    "It is the pocket to book if you want to be central, arrive late, and not think about logistics — a business trip, a city weekend, or a family visit where being close to everything matters more than having a lawn.",
  ],

  "short-stay-bahria-town-phase-7-8-rawalpindi": [
    "Bahria Town Phase 7 and 8 sit on the Rawalpindi side of the twin cities, inside a large gated community. It is a different feel from central Islamabad — wider roads, quieter streets, planned blocks and its own commercial strips — and it suits people who want space and security more than they want to be downtown.",
    "Because land here is less tight than in the Islamabad sectors, the same money tends to buy noticeably more room, which is why families and groups often end up on this side. Security at the gate and easy parking also make it a practical choice if you are arriving late at night or in more than one car. The trade is that you will want a vehicle: this is not an area you walk out of.",
    "A common pick for weekend trips, family visits and small celebrations, where having somewhere everyone can spread out is the point.",
  ],

  "short-stay-gulberg-greens-islamabad": [
    "Gulberg Greens sits along the Islamabad Expressway side of the city and is known for being green and low-rise — farmhouse plots, gardens and open air, rather than dense blocks. It is a calmer base than the central sectors while still being a straightforward drive into town, and it is convenient for anyone coming in from the airport side.",
    "Stays here tend to be in newer, well-finished buildings with terraces and views out towards the Margallas or back over the city, which is the reason to choose the area over a central sector: you get the light and the outlook that F-10 or F-11 simply cannot offer.",
    "If you are weighing this against a city sector, the honest split is that Gulberg Greens wins on space, quiet and views, and a central sector wins if you want to walk to a market. It suits families, longer stays, and anyone who would rather cook and sit out than eat every meal in a restaurant.",
  ],

  // ── Category × city ───────────────────────────────────────────────────
  "apartments-islamabad": [
    "A furnished apartment is usually the better deal in Islamabad once you are staying more than a night or two. You get a kitchen, a living room and laundry, far more space than a hotel room at a comparable rate, and the price is for the whole apartment rather than per person — which is what makes it work for families and small groups.",
    "Islamabad's sectors each have their own character: the central ones put you within minutes of markets and restaurants, while the greener areas further out trade that for space, terraces and views towards the Margallas. Whichever you choose, a serviced apartment means you can arrive on your own schedule and live at your own pace instead of around a hotel's.",
    "Every stay listed here is inspected before guests arrive and managed by a team you can actually reach. Places marked Esker Exclusive are ones we run directly ourselves.",
  ],

  "apartments-rawalpindi": [
    "Rawalpindi's short-stay apartments give you noticeably more space for the money than the equivalent in Islamabad, which is why they work well for families, groups and longer stays. Much of the good short-stay stock sits inside the planned gated communities, where the streets are quieter and arriving late is straightforward.",
    "Staying on this side means you will want a car — it is a drive to central Islamabad rather than a walk to a market — but in exchange you get room to spread out, easy parking and security at the gate. For a family trip or a group weekend that trade is usually the right one.",
    "Each apartment is booked whole, so the space is yours: no shared areas, no per-person charge, and no negotiating over who sleeps where.",
  ],

  "penthouses-islamabad": [
    "A penthouse is the top-floor unit of its building, which in practice means the terrace, the light and the outlook that the flats below do not get. In Islamabad that usually means the Margalla Hills on one side and the city on the other — the view is genuinely the product.",
    "They are the properties people book when the place itself is part of the occasion rather than just somewhere to sleep: a birthday, an anniversary, a shoot, or a weekend where you want somewhere worth staying in. The outdoor space is what separates them from an ordinary apartment, and it is why they book out earliest in good weather.",
    "Each is taken whole and privately. If you are travelling as a group, a top-floor terrace is usually the difference between everyone crowding a living room and everyone actually having somewhere to be.",
  ],

  // ── Amenity intent ────────────────────────────────────────────────────
  "stays-with-private-pool-islamabad": [
    "A private pool means exactly that: it belongs to your booking for the duration. Not a shared facility, not reserved hours, not other guests in it while you are trying to use it. In Islamabad that is rare enough to be worth planning a trip around.",
    "Places with their own pool are almost always on larger plots towards the city's edges — that is simply where the land is — so booking one usually means a short drive out and, in exchange, proper grounds, outdoor space and somewhere a group can actually spend the day. They are a common choice for family gatherings, birthdays, and shoots that need the outdoors as much as the building.",
    "Demand here is seasonal and sharp: summer weekends and the days around Eid go first, often well in advance. If your dates are fixed, it is worth checking early and messaging us if the calendar looks tight — we can usually tell you what is genuinely still open.",
  ],
};
