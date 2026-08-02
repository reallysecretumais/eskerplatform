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

## The ledger (founder, 2026-08-01) — every live night, every time

**The idea:** the live notice should not describe only the range just
confirmed. It should list **every** date range currently live for that
property, each individually removable. A WhatsApp thread scrolls; the first
notice is gone by the third. Re-stating the whole exposure in the newest
message means the owner's most recent view is always complete, and forgetting
an older promise stops being possible.

**It is a set of NIGHTS, not a list of checks.** This is the part that reframes
the design. A "check" is a question we happened to ask; overlapping questions
(3–5 Aug, then 4–6 Aug) are two rows describing one commitment. Worse, once a
guest books 4–5 Aug out of that span, neither check describes what remains. The
ledger is therefore computed:

```
live nights = ⋃ nights from answers that are still yes and in trust window
            − nights the owner has since refused
            − nights we have already booked
```

then re-expressed as contiguous runs. Merged for display, so the owner sees
*3 – 6 Aug*; split around a booking, so a booked 4–5 Aug leaves *3 Aug* and
*6 Aug* as separate removable rows. That is the founder's requirement — a
specific night must be removable cleanly — and only a night-set can express it.

**THE LEDGER IS PER-OWNER, NOT PER-PROPERTY (correction, 2026-08-02).** Found
by the vStardom 2 session and the founder independently: one owner can hold
several apartments, and the WhatsApp thread is found by the owner's PHONE —
one thread per owner, all properties mixed. A per-property ledger therefore
breaks the founding requirement the moment an owner has two apartments:
confirming Apartment A would re-list A's nights while B's scrolled away with an
old message. "The newest message is always complete" must mean complete
ACROSS EVERYTHING THE OWNER HAS LIVE.

Structure: headline = the event that triggered it ("{{property}} is now marked
available for {{dates}}…"), then the full ledger beneath, grouped by property.
iCal-linked properties still never appear, even when the same owner's OTHER
apartment is tap-based — the exclusion is per-property, not per-owner.

**Shape:** exactly one live run across all properties → the single
`No longer available` button. Otherwise a WhatsApp **list message**: one
SECTION per property (section title = property name, 24-char limit), one ROW
per run (title = the date range), each tappable to remove exactly those
nights. The 10-row ceiling is shared across sections; overflow rule =
soonest-first (near nights carry the double-booking risk), and past ten runs
send a second list message rather than silently dropping the tail.

**Payload correction:** `unlist:<propertyId>:<startISO>:<endISO>` — the
property id is REQUIRED. Without it, "3 – 6 Aug" is ambiguous for any owner
with more than one apartment, and a revocation could land on the wrong one:
the exact class of silent wrongness this whole system exists to remove. (Row
ids allow 200 chars; uuid + two dates fits easily.)

### The multi-range message, exactly (final wording + field limits)

The ledger message is the multi-property owner's little dashboard — "everything
you have live with us" — so it has to read as a benefit, not an audit. Body
(WhatsApp interactive-list body, 1024-char cap):

```
JazakAllah for the quick reply, {{name}}.

{{property}} is now marked available for {{dates}} on our website and app.
Any guest can book those nights on the spot, without us checking with you
again — which is exactly why they fill fast. The moment someone books, we'll
message you right away with all the details.

Everything you have live with us right now:

• Apartment 51 — 3–6 Aug
• Gulberg 2BHK — 9–11 Aug · 14–16 Aug

If any of these nights get booked anywhere else, tap the button below and
pick the dates — it takes a second, and it makes sure no guest is ever sent
to a room that's already taken.
```

Rules carried over from the founder-approved single-range notice: no
salutation (it replies inside an open thread), the consent line ("without us
checking with you again") stays verbatim, dates inline, no `Check-in:` block,
no rates.

Why the bullet summary is IN the body even though the menu repeats it: the
menu is hidden behind a tap, and an owner should see their whole exposure at a
glance without opening anything. **Fallback:** if the assembled body would
exceed 1024 chars, drop the bullets (keep both paragraphs) and add "Open the
menu below to see and manage every date." — the menu remains complete.

The menu (Cloud API interactive `list`):

| Element | Value | Limit |
|---|---|---|
| Opener button | `Mark unavailable` | 20 chars (16 ✓) |
| Section title | property name; if >24 chars, cut at 23 + `…` | 24 |
| Row title | the run, e.g. `3 – 6 Aug` | 24 |
| Row description | `{{n}} nights · tap to remove` | 72 |
| Row id | `unlist:<propertyId>:<start>:<end>` | 200 (~65 ✓) |
| Rows total | 10 across all sections | 10 |

**Payload registry — every id the owner can send back** (all handled in the
CRM's `app/api/whatsapp/webhook/route.ts`; **`unlist:` is the only one that
writes**, which is what keeps recompute, the incident guard and the ledger
re-send in one place):

| Prefix | Sent by | Meaning |
|---|---|---|
| `avail:<checkId>:yes\|no` | the ask (buttons / template) | the owner's answer to a specific check |
| `unlist:<propertyId>:<start>:<end>` | a ledger row, or any picker row | mark these nights unavailable — **the only writer** |
| `pick:<propertyId>:<start>:<end>` | a multi-night ledger row | open a picker of that run's individual nights + "All of these dates"; writes nothing itself, every row it offers is an `unlist:` |
| `balance` / typed `BALANCE`, `hisab`, `حساب` | the menu row, notice button, or the owner typing | send the owner's statement |
| `Something's wrong` (text) | booked-notice button | raise an incident; **also matched as literal text**, because a QUICK_REPLY with no payload echoes its label |

**As of `19b29ad` the menu lists NIGHTS directly when everything fits in the ten
rows** (the common owner: one property, a couple of short runs) — one tap per
night, an "All:" row per stretch, and "My balance" as its own row. The
run-then-picker shape above survives as the >10-row fallback. Row copy is
**"Mark Aug 7 unavailable", never "Remove Aug 7"** (founder): the owner is
stating a fact about their calendar, not losing something — and a later yes
genuinely reopens the night. Opener is **"Manage my dates"**.

Ordering: sections by their soonest night, ascending; rows within a section
ascending. Overflow past ten runs: a second list message, soonest-first —
never drop the tail. If two truncated section titles collide (two properties
sharing a 23-char prefix), disambiguate with a trailing digit rather than
shipping two identical headings.

The single-button shortcut (`No longer available`) applies only when the owner
has exactly ONE live run across ALL properties — one thing to remove needs no
menu. Its body is the founder's original single-range notice, unchanged.

**Revocation needs no new table.** Removing a run inserts an
`external_availability_checks` row with `status = 'unavailable'` spanning it.
Because confidence takes the owner's *latest* answer per night, those nights
flip to busy immediately, and a later yes can still reopen them. The audit
trail is the same table, in order.

**Booked nights leave the ledger.** Once sold they are ours; the booked-notice
is the owner's record. Leaving them in would invite an owner to "mark
unavailable" something already sold — alarming, and it would change nothing.

## 🔴 A TEMPLATE THAT NEVER EXISTED (found 2026-08-02 wiring the booked notice)

`lib/ownerNotify.ts` had been sending **`external_booking_owner`** since
phase59. Listing the live WABA (`902646692166912`) returned **13 templates and
that is not one of them.** Every owner notification that fell outside the 24h
window has been failing since phase59 shipped.

**The bug worth learning from is not the wrong name — it is that the wrong name
was unobservable.** The message row recorded neither `template_name` nor the
failure reason, so a send that could never succeed looked identical to one
waiting on a retry. The first query for its failures returned *nothing at all* —
not even failed rows — which reads as "it never ran" rather than "it ran and we
threw the evidence away". Both fields are recorded now.

This is the same family as the `availability-replied` no-op that hid staff asks
from the website, and as the light sweep that "worked" while being discarded
every frame: **the behaviour was wrong AND the wrongness left no trace.** Rule
for every outbound integration here — persist the identifier you sent and the
reason it failed, or you have built something that cannot be debugged from
production.

`booking_confirmed_owner` (APPROVED) is therefore a REPLACEMENT, not an
addition. Adding a second owner-booked sender would have duplicated the notice
on one event.

**Verify a template's components before first send.** This path cannot be
exercised without messaging a real owner, so the pre-flight is the test: body
param COUNT must equal the approved body's, and a `quick_reply` component must
target a button index that genuinely exists — **a button component sent against
a buttonless template is a runtime failure.**

### The booked notice's two paths — ruling (2026-08-02)

Both divergences from strict template/in-window parity are **approved**, with
one condition.

**1. In-window sends interactive buttons, not plain text.** Correct. An owner
who cannot dispute a booked notice is exactly how a double-booking survives to
the doorstep, and the escape hatch must not depend on which side of a 24-hour
window the message happened to land on.

**2. Parity is broken additively, and that is the right reading.** The approved
template is fixed at four variables and physically cannot carry guest name,
headcount or `owner_note`. The parity convention exists so an owner never reads
a DIFFERENT message depending on invisible timing — and it isn't violated here,
because the shared core is word-for-word identical and the extras are appended
after it. The template's own sentence ("our team will be in touch shortly with
the guest details") is a promise that the in-window path simply keeps. Dropping
`owner_note` to satisfy a literal reading would quietly undo a field phase59
built for this exact message, which is a worse outcome than a richer message
sometimes.

**CONDITION — an undelivered `owner_note` must not vanish silently.** When the
template path is taken AND extras exist, the note has not reached the owner.
Per the standing rule that no failure path may be swallowed, that must surface:
notify staff ("owner was outside the window — note not delivered, call them")
rather than letting an operationally important instruction ("guest arrives 2am,
brief the guard") disappear because of a timing detail nobody can see. Without
this, the divergence creates precisely the class of invisible loss the phantom
template above just taught us to hate.

## Review findings (2026-08-02) — owner engagement and safety seams

**Revoking a booked night is an incident, not an update.** Old ledger messages
stay tappable in WhatsApp forever. If an owner taps a row whose nights now
include a CONFIRMED booking, the handler must NOT silently write `unavailable`
— those nights are sold, and a silent write would bury a real conflict. Rule:
nights split into (still-live → revoked normally) and (booked → staff alerted
via `notifyUsers` + owner told "those dates include a confirmed booking — our
team will call you right away"). This converts the worst failure (double-book
discovered at the doorstep) into a phone call within minutes, initiated by us.

**Stale taps are answered politely, never errored.** The `unlist` payload
carries night ranges, not check ids, so the handler recomputes against current
state: nights already revoked → "already removed, nothing to do"; ledger
re-sent so the owner's newest view is again complete.

**The payout moment is the calendar-link moment.** Every ~3rd booked notice
appends one line: *"Want this to be automatic? Send us your calendar link and
we'll never need to ask."* The whole tap system is a bridge to linked
calendars; the moment an owner has just been paid is the one moment the ask
lands as an upgrade rather than a chore. (iCal-linked owners never receive
ledgers — their calendar already speaks for them, and reading their own synced
nights back at them is noise.)

**Demand is the engagement engine, already built.** Web-origin asks say a real
guest is waiting; the ledger re-listing every live night doubles as a recurring
"Esker is actively selling for you" touchpoint. No gamification needed — the
product's own activity is the retention message.

## ⚠️ META GOTCHA — a LIST ROW is not a BUTTON

**A row tapped in an interactive list arrives as `interactive.list_reply`,
never `button_reply`.** A handler that reads only `button_reply` leaves every
row of the list decorative while the tap still renders in the thread, so it
looks handled. This shipped inside the ledger and was found only by the
founder's real tap — see the STATUS section. **Verify any new list message's
`list_reply` route with an actual tap; a send Meta accepted proves nothing
about the way back.**

## ⚠️ META GOTCHA — a QUICK_REPLY with no payload echoes its TEXT

Found by the CRM session while wiring `booking_confirmed_owner` (status:
PENDING at Meta). A template quick-reply button only returns OUR payload if one
is attached in the `button` component **at send time**; omit it and Meta sends
back the button's visible TEXT instead. `Something's wrong` would then have been
silently dead the first time anyone sent that template without wiring the
payload — a button that looks fine and does nothing.

Two defences, both now in place CRM-side and both worth keeping: attach the
payload on every template send, AND accept the button text as a first-class
second route in the handler. Anyone wiring a new template button here should
assume the payload will be forgotten once.

**Also live-with-a-typo:** `availability_check_web` was approved carrying
"a quick tap below **let's** the guest know…". Founder's call whether a
re-approval round trip is worth it; noted so nobody "fixes" the code to match
a template that reads wrong.

## STATUS (2026-08-02)

**LIVE on the Platform + app.** All verified against production, not assumed:

| | |
|---|---|
| `lib/data/confidence.ts` | three-valued verdict, trust ladder, latest-answer-wins, Karachi dates |
| `lib/data/inventory.ts` | `freeTonight` = confirmed only · `onRequestTonight` · `confidence` map · `counts.onRequest` |
| `/api/app/v1/listings?openTonight=1` | returns `onRequest` as its own list |
| `/api/platform/availability-replied` | busts the signal cache **before** guest-matching → a rep's ask updates the site in seconds |
| `lib/cache.ts` | `bustAvailabilitySignals()` |
| app tonight world | confirmed, then "N more on request" divider, then unknowns |
| Measured | hero line went `17 open tonight` → **`3 open tonight`**; tonight feed 2 confirmed + 13 on-request, zero overlap |

**CRM half — BUILT 2026-08-02** by the *Esker OS Web vStardom 2* session
(`7993dfc` live notice + revocation + incident path + `Something's wrong`;
`6c22cf8` the per-owner night-set ledger, `lib/availabilityNights.ts`,
14 unit tests). All three of my hand-off conditions met and verified.

✅ **THE POPULATED LEDGER IS NOW PROVEN — the outbound half.** Sent to a real
phone and accepted by Meta: 2 property sections, 3 runs, body **690/1024** with
real property names, and section-title truncation exercised on a 49-char name.
So the assembly, the sectioning, the limits and the send all work on live
production. (Before this, live data yielded zero runs for every owner —
correctly, for two agreeing reasons: every answered check covered JULY nights,
and all were 170–319h old, past even the 168h ceiling. Honestly empty, not
broken.)

🔴 **THE TAP CAME BACK, AND IT WAS DEAD.** Resolved the hard way, hours later
(CRM `fffd329`). The founder tapped **"Aug 14 – Aug 16"** on his own ledger:
the message ingested and **nothing else happened** — no withdrawal row, no
ping, no reply.

**A row picked from an interactive LIST returns `interactive.list_reply`, never
`button_reply` — and the webhook read only `button_reply`. Every row of the
ledger was decorative.** The precise dead-button failure this feature exists to
prevent, shipped *inside* the feature, one layer below where we were looking
for it. And it looked handled: the classifier already parsed `list_reply`, so
the tap rendered as a normal bubble in the thread.

Neither unit tests nor the send-side check that Meta accepted the list could
have caught it. **Only a real thumb on a real row.** Treat that as the standing
requirement for every new list message: verify the `list_reply` route with an
actual tap.

✅ **AND NOW PROVEN BOTH WAYS.** The CRM session replayed the exact tap as a
signed webhook POST against production: the `unavailable 2026-08-14 → 16` row
written on the right property, the payload round-tripping with the correct
`propertyId` (the multi-apartment guard held), the **recomputed ledger returned
and delivered** with Aug 14–16 absent and the other runs intact, and the whole
exchange recorded in the CRM thread. Test rows were then torn down by
enumerated id. **What remains unfired is narrower and worth naming precisely:
the booked-night incident path** (withdrawing nights that carry a confirmed
booking → `needs_attention` + staff push) has never run, because the test
property had no bookings.

🔴 **AND MY OWN HALF OF THAT SEAM WAS BROKEN TOO** (fixed, `205393e`). The
CRM's withdrawal pings `/api/platform/availability-replied` with
`externalPropertyId` + dates and **no `checkId`** — there is no waiting guest to
notify. This route required `checkId` and returned **400 on the line above
`bustAvailabilitySignals()`**, so **every owner withdrawal busted nothing**, and
the CRM's fire-and-forget `void fetch(...).catch(() => {})` meant neither side
saw it. Bounded, not unlimited — `revalidate: 60` still expired on its own, so
a withdrawn night was offered for up to a minute rather than forever — but the
ping exists so the *safety-critical* direction is instant, and for withdrawals
it had never once worked. **The route has two jobs and only one needs a
`checkId`**: busting is a fact about the whole catalogue, notifying needs the
request row. It now busts on any valid status and answers a checkId-less ping
`{ok, busted: true, matched: false}` instead of 400.

**The lesson is the same one twice in a day, from both directions:** each side
verified its own half and the join was never exercised. Neither bug was
findable by reading your own file.

⚠️ **AND THE PING ITSELF IS STILL UNPROVEN IN PRODUCTION — do not assume
otherwise.** Both bugs above were found by reading both sides of the call, NOT
by observing production; nobody has read a Vercel log. Two live possibilities
remain and cannot be told apart from either developer machine:

1. `REVALIDATE_SECRET` / `PLATFORM_API_SECRET` IS set on the CRM's Vercel → the
   ping authenticated, hit the 400, and the fix above lands.
2. It is NOT set → `pingPlatformAvailability` returns at `if (!secret)` and the
   ping **has never fired at all** → the fix is necessary but not sufficient.

**Why no evidence exists either way, and this is the third failure shape:** for
a staff-origin ask the route busts the cache and returns
`{ok: true, matched: false}` **without writing anything**, so a successful ping
and a ping that never left the building are byte-identical from the database.
Not "no signal on failure" — **no signal on SUCCESS**. And `external_date_requests`
holds **zero rows** in production, so the guest half has never completed either.

**A FOURTH, upstream of all of them:** neither repo can exercise this
integration where it is developed. The shared secret exists only in Vercel, so
a local POST returns 401 in both directions and proves nothing. **An
integration that cannot be run where it is written is one nobody runs until it
is live.**

Settled by: the CRM's `b53ae94` (a failed or unsent ping now writes an
`availability_ping_failed` row into `webhook_events`, including the
absent-secret case) on the next real owner withdrawal — or immediately, by
checking that the `eskos` and `eskerplatform` Vercel projects hold the **same
value** for that secret. A mismatch produces 401s indistinguishable from
"not configured".

**Since fixed, and extended** (CRM `13e476c`, `19b29ad`): revocation is now
**night-granular** (a multi-night row opens a picker of its individual nights
plus "All of these dates", so an owner whose 14th sold elsewhere withdraws
exactly the 14th); when the whole thing fits in Meta's ten rows the menu lists
the **nights themselves**, one tap each, with **"My balance"** as its own row; a
booking re-sends the recomputed ledger after the booked notice. Owner money
landed alongside it (`phase69`, `external_owner_payouts`, **RUN — verified
against production, and holding REAL payouts within the hour**: the founder
entered ₨27,000 and ₨15,000 against two owners minutes after it shipped, so
this table is the only record of real money and must never be cleaned by a
`created_at` window —
`owed = Σ cost of completed external stays − Σ payouts`, deliberately kept out
of expenses/cash-position so the two ledgers can't disagree about one rupee).

**Founder's wording rule, applied throughout: "Mark Aug 7 unavailable", never
"Remove Aug 7."** The owner is stating a fact about their calendar, not losing
something — and a later yes genuinely reopens the night. The opener button is
**"Manage my dates"**.

### A FOURTH SHAPE: tested logic inside untested wiring (2026-08-02)

The three faults catalogued earlier are all *"the wrong behaviour left no
signal"*. This one is different, and worth its own entry because it is the one
that survives good testing.

The ledger had **14 passing unit tests** on the night-set math and every
WhatsApp field limit measured at worst case. The bugs were in neither. They were
in the plumbing *around* the tested core: the notice and the ledger were fired
straight at Meta and **never written to `messages`**, so Meta returned 200 with
a wamid, the owner's phone showed the message, and the CRM thread showed
nothing — a rep opening that owner's chat could not see what we had promised on
their behalf. And a failed send left no trace at all, so after a signed webhook
POST to production you could not tell from the database whether the notice had
gone out.

**Tested logic inside untested wiring reads as "verified" and isn't.** Unit
tests bound the core; only an end-to-end run exercises the seams between it and
everything else — and that run looked skippable *precisely because* the core was
so well tested. Fixed CRM-side (`e5f4174`): all three owner-facing sends persist
a row, sent or failed, with Meta's reason, and bump the thread preview like
every other send path.

**Same audit turned on this repo.** `bustAvailabilitySignals()` sits at the top
of `/api/platform/availability-replied` and had never been exercised either. A
bad-secret POST to production returns **401**, which proves the route still
evaluates (the new `lib/cache` import didn't break module scope — the
`"use server"` trap) and that auth-before-body is intact. The bust firing
correctly on a real reply is still only proven by the CRM's live tap test.

### Still to build

1. ~~SQL function for the night-set~~ — **DEFERRED WITH A TRIGGER (arbitrated
   between sessions, 2026-08-02).** The CRM builds the runs math in TS first
   (only the CRM needs split-around-bookings today, and TS can be tested
   against real check rows before an interface freezes). The Platform's
   `confidence.ts` stays the reference for the per-night verdict constants and
   the CRM module must mirror them exactly (trust ladder 48/96/168h at ≤7/≤30
   days, latest-answer-wins, Asia/Karachi nights, checkout-exclusive), with
   mutual source-citations per the sanctioned-duplicate convention.
   **Promotion trigger:** the app's V2-5 world availability chips ("From Sat"
   needs forward-looking confirmed runs per listing — `DESIGN_V2_BUILD_PLAN.md`
   §4.3) or the first observed drift, whichever comes first. Then the night-set
   becomes ONE SQL function and both repos call it.
2. CRM: `sendInteractiveList` (the sender only does buttons today), ledger
   assembly, `unlist:<runStart>:<runEnd>` payload handling.
3. Platform + app: the "N more on request" divider, and "On request" badges on
   cards whose confidence is `unknown`.
4. ~~`booking_confirmed_owner` template at Meta~~ — **SUBMITTED 2026-08-02,
   awaiting review** (founder edited the wording slightly; read the approved
   version from Meta before wiring the send). Nothing else is approval-gated.

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

> ⚠️ **SUBMITTED TO META 2026-08-02, awaiting review — and the founder edited
> the wording slightly at submission. THE APPROVED TEMPLATE AT META IS THE
> SOURCE OF TRUTH, NOT THE BODY BELOW.** Before writing the send-side, read the
> live definition (`getMetaTemplates()` in `lib/whatsapp/cloud.ts` already
> fetches it) and match the variable COUNT and ORDER exactly — a mismatch is a
> runtime send failure, not a build error. Re-sync the block below and the
> in-window free-text version to whatever Meta approved, so the owner reads the
> same words whether we caught them inside the 24h window or not; that
> word-for-word parity is an existing convention here
> (`externalAvailability.ts:374–391`).
>
> **AS SUBMITTED (pre-edit) — structure to expect:**
> Meta rules already satisfied: no variable at the very start or end of the
> body, no two variables adjacent, body well under 1024 chars.
>
> | Field | Value |
> |---|---|
> | Name | `booking_confirmed_owner` |
> | Category | **Utility** |
> | Language | **English (en)** — `sendTemplate` defaults to `"en"`; a mismatch fails at send |
> | Header | *none* |
> | Footer | *none* |
> | Buttons | **Quick reply** × 1 → `Something's wrong` |
>
> Sample values Meta asks for when submitting:
> `{{1}}` Ahmed · `{{2}}` Apartment 51 · `{{3}}` 3 Aug, 4:00 PM · `{{4}}` 5 Aug, 12:00 PM
>
> Variable meanings (must match the send-side order in the CRM):
> `{{1}}` owner name · `{{2}}` property name · `{{3}}` check-in (date + time)
> · `{{4}}` check-out (date + time). Times are included deliberately — the ask
> template already carries them because a bare "3 Aug to 5 Aug" hides whether we
> need the place from the morning or the afternoon.

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
