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

## Open questions (founder)

1. **Publish the owner's tap as public truth?** A "yes" tap already authorises
   real money within 48h — I recommend the same trust for display. Confirm.
2. **One trust window everywhere?** 48h tap / 12h iCal for both display and
   booking, or a tighter display window? I recommend one rule (48/12) so no
   two surfaces can disagree.
3. **Unknowns in the "Open tonight" world:** excluded entirely, or shown under
   a quiet "available on request" divider? I recommend shown — that section is
   the demand engine for Phase 3/4.
