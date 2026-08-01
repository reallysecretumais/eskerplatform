# Availability Truth — plan (2026-08-01)

**The founder's insight, formalised:** availability is a three-valued fact —
*confirmed free · confirmed busy · unknown* — and every public surface currently
flattens it to two by treating **unknown as free**. That is how the app says
"17 open tonight" when most externals have no linked calendar. The fix is not to
remove "Open tonight"; it is to make the number honest and let real guest demand
convert *unknown* into *known*, once per answer, shared by everyone.

## What already exists (verified in code, not memory)

| Piece | Where | State |
|---|---|---|
| Composite verdict engine (own bookings → owner iCal → owner tap, 48h trust) | CRM `lib/externalAvailability.ts` | ✅ built, used by inbox/External page/Esker AI |
| WhatsApp tap-to-reply ask, 24h pending dedupe, failed-ask tracking | CRM, same file + webhook | ✅ built |
| Guest-demand template (`availability_check_web`) so owners know it's live demand | CRM | ✅ built (approval status to confirm) |
| iCal cron → `external_ical_busy`, `ical_synced_at` (stamped on success only) | CRM cron | ✅ built |
| Booking-time tiers: instant iff iCal fresh (<12h) else request-to-book | Platform `lib/data/externalBooking.ts` | ✅ built |
| Guest's own "yes" for exact dates within 48h authorises booking | Platform `hasAuthorizedRequest` (`external_date_requests`) | ✅ built |
| **Display truth** — `freeTonight` = "no busy row tonight" | Platform `lib/data/inventory.ts:58` | ❌ treats unknown as free |

So the middle ground the founder described **already exists at the booking
step**. What's missing: (a) the display layer never reads it, (b) an owner's
answer only benefits the guest who asked.

## Phase 1 — one verdict, defined once (small migration)

A SQL function/view `availability_confidence(listing_id, from, to)` →
`confirmed_free | confirmed_busy | unknown`, drawing on: bookings (internal +
resold), `external_ical_busy` gated by `ical_synced_at < 12h`, and fresh
(≤48h) owner taps in `external_availability_checks` covering the range.

Why SQL: CRM (TS) and Platform (TS) cannot share code, and the no-duplication
rule forbids two verdict implementations. The database both already share is
the one place the rule can live once. The CRM's rich UI wording stays where it
is; only the verdict core moves down.

## Phase 2 — honest display (app + web, ~a day)

- `getInventory` gains the third state. **Confirmed tonight** = internal with
  no busy row (we own that calendar), or external with fresh iCal and no busy,
  or external with a fresh owner tap covering tonight.
- "Open tonight" doorway, greeting counts ("2 pools glowing"), and world chips
  use **confirmed only**. The doorway already self-hides at zero — no removal
  needed, the number just becomes true.
- Unknown externals stay visible everywhere but wear **"On request"** instead
  of implying availability. Same badge on web stay pages.

## Phase 3 — answers are shared (the actual middle ground)

- **Display trust is global:** any fresh "yes" covering tonight upgrades that
  listing to confirmed for *everyone*, not just the asker. An owner answers
  once per 48h window instead of once per guest.
- **Booking authorisation stays per-account + exact dates** (as built) — that
  is a money-safety rule, not a display rule. Don't loosen it.
- **Audit the two-table seam:** web writes `external_date_requests`, CRM reads
  `external_availability_checks`. Verify whether the request-to-book loop
  already joins them; if they are parallel truths, unify so one answer feeds
  both (this is the likely "web is missing it too" gap).
- Dedupe across surfaces: before any new ask, check pending (24h) and fresh
  answers (48h) for overlapping dates — one gate, in the shared layer.

## Phase 4 — demand-shaped asking (later, deliberate)

**No anticipatory cron sweeps.** Asking every owner every evening about demand
that may not exist burns the channel. Instead: asks fire only from real guest
intent (web "Check availability" today; the app gets the same button with the
V2-7 money path), and each answer upgrades the public truth for 48h. Busy
nights populate themselves because busy nights generate taps. Optional garnish:
the "Open tonight" world shows a quiet "N more on request" section — which is
exactly where guest demand converts unknowns.

## Decisions (founder, 2026-08-01)

**1. Shared truth: YES — with the founder's revocation mechanism.** He caught
the hole in the plain version: an owner taps "Available", sells the night to
their own guest 30 minutes later, and our display still says free → double
booking. His fix, adopted: the tap triggers a follow-up message that (a) tells
the owner the property is now live and bookable by anyone, (b) promises we'll
notify them the moment it books, and (c) gives them a one-tap **"Mark
unavailable"** button. That message is what makes shared truth legitimate — the
owner has been told, in writing, exactly what their tap now means, and holds a
one-tap kill switch the whole time.

Two companions that close the loop:
- **Consumption** — the moment any Esker booking lands it writes a busy row, so
  the display flips itself; nothing to build.
- **Booking-moment notice** — when a guest books, the owner instantly gets
  "Booked: [dates]. Anything wrong? tap here / call us", so a race that slipped
  through is caught in minutes, not at check-in.

**Correction to the first draft of this plan: the live-notice needs NO Meta
approval.** The owner's "Available" tap is an inbound message, which opens the
24-hour customer-service window — and the notice goes out seconds later. So it
sends as an interactive free-text message with a quick-reply button, exactly
like the in-window branch of `askOwnerAvailability` already does. Only the
BOOKED notice needs a template, because that can land days after the tap, long
after the window has shut. That reorders the build: nothing is blocked on Meta
except the last piece.

The revocation tap lands on the same webhook/button plumbing as
`avail:<id>:yes|no` — a new payload prefix (`unlist:<checkId>`).

### The messages, word-for-word

Written to match the two approved templates: same salutation, property on its
own line, `Check-in:` / `Check-out:`, one line of motivation, `JazakAllah.`

**A. Live notice** — interactive, in-window, sent on the "Available" tap.
Button: `No longer available` (19 chars, under Meta's 20 limit).

```
JazakAllah for the quick reply, {{name}}.

{{property}} is now marked available for {{dates}} on our website and app.
That means any guest can book those nights on the spot, without us checking
with you again — which is exactly why they fill fast. The moment someone does,
we'll message you right away with all the details.

Just one thing we'd ask: if these nights get booked anywhere else, tap below
straight away. It takes a second, and it makes sure no guest is ever sent to a
room that's already taken. The button stays in this chat, so you can tap it
whenever it happens.
```

**The load-bearing sentence is "without us checking with you again."**

Everything in Phase 3 stands on the owner having genuinely understood what
their tap did. "Guests can book it directly" is soft enough that an owner could
still assume a human will call before anything is confirmed — and if they
believe that, a double booking is our fault however many buttons we gave them.
Saying plainly that we will NOT ask again is what converts the tap from a
casual reply into informed consent, and it is the difference between a
mechanism that is defensible and one that merely looks careful.

It also does the persuasive work for free. The removed step IS the benefit —
no waiting on a reply is precisely why the nights fill — so the honest
disclosure and the uplifting framing turn out to be the same sentence. And it
makes the paragraph that follows logically necessary rather than a bolted-on
warning: if nobody checks with you first, then telling us the moment it sells
elsewhere is obviously your half of the arrangement.

**Why that last paragraph is shaped the way it is.** The whole system rests on
the owner remembering to revoke, so the wording has to earn the tap rather than
merely permit it. Four deliberate moves:

1. **A trigger, not a hypothetical.** "If those nights get taken elsewhere" is
   a condition nobody notices themselves meeting. "If these nights get booked
   anywhere else" names the exact moment they will experience, so the memory
   has something to attach to.
2. **An ask, not an offer.** "You stay in control" is a permission — nothing to
   live up to. "Just one thing we'd ask" is a small agreement, and people keep
   agreements they have accepted.
3. **Their stake, not ours.** "No guest is ever sent to a room that's already
   taken" is the owner's own doorstep problem, not Esker's data quality.
4. **Friction named and dismissed.** "Takes a second" and "the button stays in
   this chat, so you can tap it whenever" — because the realistic failure is
   the owner seeing the message at 11pm, thinking *later*, and later never
   coming. The quick-reply button remains tappable in the thread indefinitely,
   so this is true as well as reassuring.

**Not said, deliberately:** that the freshness ladder drops the listing to "on
request" after 48h anyway. It is true, and it is our safety net — but telling
an owner their forgetfulness is already covered is the surest way to guarantee
they forget.

**Backstop if forgetting still proves common** (measure first, don't
pre-build): a single quiet reminder at ~18h — *"{{property}} is still live for
{{dates}}. Still free?"* with the same two buttons. One message, once, only
while a listing is actually live.

**Two rules this message follows, and the ask template does not:**

*No salutation.* It arrives seconds after the owner's own tap, in a thread
they are already reading. `Assalam o Alaikum … this is an automated message`
belongs on a message that OPENS a conversation; repeated as a reply inside one
it reads like a machine that has forgotten it was already talking. Same reason
it closes without a second `JazakAllah` — it opened with one.

*Dates INLINE, never as a `Check-in:` / `Check-out:` block.* That block is the
visual grammar of a confirmation. On the ask it is correct — we're asking about
exactly those dates. On this message nothing is booked, and stacking the dates
that way made it read as though something had been. Inline inside the sentence
(`live … for 3 Aug, 4pm – 5 Aug, 12pm`) says *window of availability*, which is
what it is. One `{{dates}}` variable, built from the same `formatDateTime`
labels the ask already produces.

**B. Booked notice** — template `booking_confirmed_owner`, 4 body variables to
mirror the existing pair. Button: `Something's wrong` (17 chars).

```
Assalam o Alaikum {{1}}, this is an automated message from Esker Rentals.

Good news — {{2}} has just been booked through Esker Rentals:

Check-in: {{3}}
Check-out: {{4}}

Your dates are now blocked on our side, so you won't get any more requests for
them. Our team will be in touch shortly with the guest details.

If anything about this doesn't look right, tap below and we'll call you.

JazakAllah.
```

**Deliberately absent:** any mention of rate or payment. Those terms differ per
owner and per deal, and a template that states commercial terms it doesn't
actually know is the fastest way to lose an owner's trust — the ops team
handles that conversation.

**2. Trust window, rethought (he asked for better than a flat 48h):** time is
the wrong primary axis — the risk is *intervening events*, which the revocation
button now covers when the owner remembers and a window must cover when they
forget. So, a **freshness ladder** instead of one number:

| Signal age | Display | Booking |
|---|---|---|
| Tap or iCal ≤ 12h | shows available | **instant book** |
| Tap 12–48h (covering the dates) | shows available | **fast-request** — "we're confirming with the owner", auto re-ask fires |
| Older / nothing | "on request" | request-to-book |

One ladder, three rungs, used by every surface. A tap is also bounded by the
dates it was about (a tap about tonight dies at checkout regardless), and dies
early on revocation or consumption. 12h for money mirrors the iCal freshness
rule that already exists — two signal types, one standard.

**3. Unknowns in the tonight world: SHOW, under a quiet "N more on request"
divider.** Approved as proposed — that section is the demand engine.

**Status: decisions taken; build order is Phase 1 → 2 → 3 with the revocation
template submitted to Meta first (longest lead time). Not yet started.**
