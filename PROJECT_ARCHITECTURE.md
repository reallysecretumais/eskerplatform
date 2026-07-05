# PROJECT ARCHITECTURE — Esker Stays

The technical source of truth: stack, file map, database, the security model, accounts, booking flow, AI, env, and CRM integration. Pair with `SESSION_HANDOFF.md` and `ROADMAP.md`.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 (`@theme` tokens in `app/globals.css`) · `@supabase/ssr` + `@supabase/supabase-js` · lucide-react · OpenAI (`gpt-4.1-mini`). Server Components by default; `"use client"` only for interactivity. Dev on **port 3100**.

## Environment (`.env.local`, git-ignored — copied from the CRM)
| Key | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, browser-safe; everything reads through these + RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only**; used ONLY by `app/book/actions.ts` via `lib/supabase/admin.ts`. Bypasses RLS. Never client |
| `OPENAI_API_KEY` / `ESKER_AI_MODEL` (`gpt-4.1-mini`) | Concierge, ID vision check, description generation |

## Database (shared with the CRM — ADD only, never duplicate)
Migrations live in `supabase/` and are run by the founder in the Supabase SQL Editor:
- **`01_public_listings.sql`** — adds public fields to `properties` (`public_listing`, `esker_exclusive`, `public_title`, `public_description`, `public_price`, `capacity`); creates **`public_listings`** (safe columns, only `public_listing=true`; `category` = `properties.kind`) and **`public_availability`** (busy date ranges only) — both `grant select to anon, authenticated`.
- **`02_public_facts.sql`** — `properties.public_facts` (free text) + exposed in `public_listings`.
- **`03_accounts.sql`** — `accounts` + `account_roles`; reroutes `handle_new_user`; RLS. ✓
- **`04_bookings.sql`** — `bookings.account_id` + `bookings_select_own` RLS. ✓
- **`05_hold_expiry.sql`** — 18h auto-release of unpaid website holds. ✓ · **`06_notifications.sql`** — `guest_messages` outbox. ✓
- **`07_reviews.sql`** — `reviews` + `public_reviews` view. ✓
- **`08_accounts_links.sql`** — `owners.account_id`; `properties.{owner_account_id, owner_relationship (esker|partner|managed|host), comms_owner (esker|owner), listing_status}` — groundwork for the portals + chat routing. ✓ (all migrations 01–08 applied)

The website reads **only** the two views + `accounts`/`account_roles` (own) + own `bookings`. The base `properties`/`bookings`/`guests`/`owners`/`users` stay staff-only (their RLS uses `is_staff()`).

## Security model (the wall — sacred)
- **anon** → `public_listings` + `public_availability` only.
- **Authenticated website user** = a row in **`accounts`**, NOT in staff **`users`** → `is_staff()` returns false → automatically locked out of every internal table. Verified adversarially.
- **`handle_new_user` trigger** routes signups: if `raw_user_meta_data.account_type ∈ (guest,owner,partner)` → write to `accounts`/`account_roles` (never `users`); else → the original staff insert (unchanged). **CRM-safe** because the CRM upserts staff rows itself.
- **Service role** writes bookings server-side (validated) — the only elevated path, never exposed to the browser.
- Roles are **additive** (`account_roles` rows): one account can be guest + owner + partner. Self-signup grants `guest` (+`owner` if "list my place"); `partner` is admin-granted only.

## Accounts / auth
- `lib/supabase/middleware.ts` + `middleware.ts` — session refresh (@supabase/ssr).
- `lib/auth.ts` — `getAccount()` (cached), `requireAccount()`, `getMyBookings()`.
- `app/login`, `app/signup`, `app/auth/callback/route.ts`, `app/account` (+ `app/account/actions.ts`: `signOut`, `becomeHost`).
- `components/AuthForm.tsx` (email+password live; phone+OTP path dormant until SMS provider).
- `components/SiteNav.tsx` takes an `account` prop → shows "Account" + name when logged in (pages pass `getAccount()`).

## Booking flow
- Entry: `components/BookingWidget.tsx` "Reserve" → `/book/[id]?checkin&checkout&guests`.
- `app/book/[id]/page.tsx` (server) — validates dates/availability, order summary; `components/CheckoutForm.tsx` (client) — details, first-time CNIC/passport, payment, screenshot.
- `app/book/actions.ts` `createBooking` (server, **service role**): validates (public property, dates, no overlap, server-recomputed `amount`), **auto-provisions an account** if the booker isn't signed in (`ensureGuestAccount` — reuse-by-email or `auth.admin.createUser`, magic link into the confirmation email), find/create `guests` by phone, **ID required only if none on file** + **`lib/ai/idcheck.ts` vision check** (side-aware: CNIC front AND back, or passport data page; reads number/name/expiry, **rejects expired**), inserts `bookings` (`status:'awaiting_payment'`, `source:'Website'`, `payment_status:'partial'`, `account_id`, notes incl. AI-read ID), uploads proof to `guest-docs/payments/<id>/…`, inserts `booking_payments` with the **real advance** + proof.
- **Advance**: `advanceAmount` = 50% Exclusive / 25% else, **floored at ₨2,000** and capped at the stay total; `advanceLabel` says "minimum"/"full amount" when the floor applies. Real-time ID check at the form: `verifyIdUpload` server action fires per image on pick; Confirm is blocked until valid.
- **Payment provider seam**: `lib/payments/provider.ts` (`PaymentProvider` interface, `manualProvider` = today's screenshot-verify) — a real gateway (Safepay/PayFast) drops in without touching the booking flow.
- `app/book/[id]/confirmation/page.tsx` — success/reassurance. "My bookings" on `/account`.
- Payment accounts: `lib/payments.ts` — **ESKER RENTALS** · Soneri `PK64SONE0041020015820404` (primary) · Allied `13960010133695040020`. Pay via any Easypaisa/JazzCash/bank/SadaPay → screenshot. Money held until check-in (not advertised as escrow).

## AI
- **Concierge** — `lib/ai/concierge.ts` (`CONCIERGE_SYSTEM`/`VOICE_SYSTEM` + shared `catalog`; the old single-shot `askConcierge` was removed — everything streams), `app/api/concierge/route.ts` (streaming, accepts `messages` + per-property `context` + `voice:boolean`). Retrieval-first: fed ONLY `public_listings` (+ `public_facts`) → cannot leak; the catalog is built **server-side**, so client components receive only `SlimListing[]` (`lib/data/listings.ts` — id/title/area/category/price/exclusive/lead photo). Machine tail: `STAYS: <ids>` + optional `WHY: id: reason; …` — the WHY reasons render as gold "why this matches" captions under each card in `ConciergeStream` (which also shows one-tap refine chips). Text path is Roman-Urdu-in / English-out; the voice path mirrors the guest's language (voice tail has no WHY).
- **Voice concierge** (homepage hero "wow") — `components/VoiceConcierge.tsx` (full-screen overlay, lazy-loaded) + `components/VoiceOrb.tsx` (amplitude-reactive orb). Pipeline per turn: record (`MediaRecorder` + silence auto-stop) → `app/api/voice/transcribe/route.ts` (OpenAI STT, Urdu/Roman-Urdu reliable) → `/api/concierge` with `voice:true` (streamed, bilingual, same safe retrieval) → `app/api/voice/speak/route.ts` (OpenAI TTS, one warm voice both languages) → auto-listen again. Guest can interrupt (tap orb), mute, type, or end. Optional env: `ESKER_STT_MODEL`, `ESKER_TTS_MODEL`, `ESKER_TTS_VOICE` (defaults exist). `isUrduText()` in `lib/listings.ts` tags language for the badge/voice. Same wall — only public listings + the guest's own words ever reach the model.
- **ID check** — `lib/ai/idcheck.ts` (vision). **NADRA** verification slots in after this (verify extracted number).
- **Descriptions** — generated once into `public_description` (host-assist).
- **Support chat brain** — `lib/ai/support.ts` (guest chat first-reply). Retrieval-first + data-layer scoped: sees ONLY public listings (+ facts) and the asking guest's OWN bookings — never wifi/access (CRM `property_info`), other guests, staff, or financials. Roman-Urdu aware; self-escalates via a `HUMAN: yes|no` tail.

## Guest messaging (Phase 2 — rides the CRM Unified Inbox)
- **Model**: website chat is a new **`website` channel** in the CRM's shared `contacts`/`conversations`/`messages` tables (CRM `supabase/phase24.sql`). ONE thread per guest = the account's conversation with `owner_account_id NULL` (the NULL/host-owner split is the Phase-3 seam). `messages.sender_kind` = guest|staff|ai|owner|system.
- **Security**: guests get RLS **SELECT-only** on `conversations`/`messages` where `account_id = auth.uid()`; every guest WRITE goes through `app/chat/actions.ts` server actions using the **service role after verifying session ownership** (same pattern as booking). Verified: 13/13 RLS checks — no cross-account read, no anon read, no internal-table read.
- **HUMAN-only flow**: `ensureThread` (find/create the account's website contact + conversation, attach property/booking context) → `sendGuestMessage` (guest msg in as `sender_kind='guest'`; conversation → `unreplied`; staff bell once per burst). **No auto-AI** — staff reply from the CRM inbox; the reply flows back over realtime. The AI concierge stays on the property pages (pre-booking Q&A); staff may use the CRM's AI-draft assist. Reads via `lib/data/chat.ts` (`getMyThreads`/`getThreadMessages`/`getMyThread`); realtime via `lib/supabase/realtime.ts` `subscribeAuthed` (JWT-on-socket-first or RLS drops events).
- **UI**: `app/messages/page.tsx` = two-pane inbox (`components/chat/MessagesInbox`) — thread list (Esker Support + a thread per host/stay in Phase 3, no contact numbers) + open `ChatThread`; threads load lazily (`loadThreadMessages`). Floating support panel (`ChatLauncher`+`ChatDock`) mounted once in `app/layout.tsx` (hidden on `/book/*`, auth, `/messages`); entry points via `components/chat/ChatEntry`. CRM side: `providerFor('website')` stub (insert = delivered), `sendMessage` skips the 24h window for website, staff reply pings `POST {WEBSITE_URL}/api/chat/notify-reply` (shared `REVALIDATE_SECRET`) → throttled guest email.

## Pages & components
`app/`: `page.tsx` (home), `stays/page.tsx`, `stays/[id]/page.tsx`, `book/[id]/page.tsx` + `confirmation`, `login`, `signup`, `account`, `auth/callback`, `api/concierge`.
`components/`: SiteNav, HeroCollage, ConciergeSearch, ConciergeStream, PropertyConcierge, CategoryShowcase, StayCard, Gallery, BookingWidget, AmenityList, PakistanDetails, LocationSection, AuthForm, CheckoutForm, BookingActions.
`lib/`: `brand.ts`, `payments.ts`, `listings.ts` (units/price/format), `img.ts` (Supabase thumbnail transform), `data/listings.ts` (getListings/getListing/getAvailability/pick…), `auth.ts`, `ai/concierge.ts`, `ai/idcheck.ts`, `supabase/{client,server,admin,middleware}.ts`.

## Design system
Concept B — light/airy, photography-led. Esker gold `#C9A84C` (sparing). Display = **Sora** (`font-display`, weights 500/600/700 only), body = **Inter** (`font-sans`); Georgia italic serif reserved for precious accents (hero "stay", money figures). Tokens in `app/globals.css`: `bg-bg`, `bg-surface`, `text-ink`, `text-muted`, `text-gold`/`text-gold-deep`, `border-line`, etc. Mobile-first. Images served via `thumb()` (Supabase image transform); cards use real `<img loading="lazy">` + alt + 480/720 srcset.
**Performance rules (2026-07-04 pass):** client components take `SlimListing[]`, never full listings · all decorative motion is transform/opacity-only + `prefers-reduced-motion` safe · touch devices run zero per-frame JS (hero uses the `.hero-sway` CSS keyframe; the pointer-tilt rAF loop is desktop-only and also drives the cursor gold light) · Supabase storage preconnect + `viewport`/`themeColor` in `app/layout.tsx`.

## CRM integration (cross-app)
- The CRM toggles `public_listing`/`esker_exclusive` + public overrides (its property "Website" card) → **live source of truth**. The website **caches** public listing reads (10‑min TTL, `unstable_cache` tag `listings`) and the CRM pings **`POST /api/revalidate`** (`x-revalidate-secret`) on publish/edit to refresh instantly.
- **Website bookings** appear in the CRM as `status=awaiting_payment`, `source=Website`, carrying the **real advance** (25% / 50% Exclusive) in `booking_payments` + proof, `payment_status='partial'`. Finance/co‑founders verify the proof → move to `payment_collected`.
- **Team alerts**: a new website booking inserts `notifications` rows (`type='booking'`) for active staff. **Guest WhatsApp** is queued in `guest_messages` for the CRM's inbox sender (when WA is live). See memory: `website-crm-hooks`, `guest-notifications`, `website-verify-urgent`.

## Phase‑1 launch modules (added on top of the core above)
- **Advance payments** — `lib/payments.ts` `advancePct`/`advanceAmount` (50% Exclusive, else 25%); shown at checkout (`app/book/[id]`, `CheckoutForm`); the booking action records the advance + proof (not ₨0).
- **Notifications** — `lib/email.ts` (Titan SMTP/nodemailer), `lib/emailTemplates.ts` (branded "booking received"), `lib/notifyGuest.ts` (email now + WhatsApp outbox row + team `notifications`). Table `guest_messages` (`06_notifications.sql`). All best‑effort.
- **Reviews** — table `reviews` + view `public_reviews` (`07_reviews.sql`); `lib/data/reviews.ts`; `components/Reviews.tsx` (rating + cards, Exclusive fallback); `aggregateRating` via `lib/seo.ts`.
- **SEO** — `lib/seo.ts` (metadata/JSON‑LD builders), `app/{robots,sitemap,opengraph-image}`, `components/JsonLd.tsx`, `public/llms.txt`; per‑property `generateMetadata`.
- **Analytics** — `lib/analytics.ts` (Meta CAPI, hashed PII), `components/MetaPixel.tsx` + `components/TrackEvent.tsx` (env‑driven via `NEXT_PUBLIC_META_PIXEL_ID`/`META_CAPI_TOKEN`).
- **Caching** — `lib/data/listings.ts` caches `getListings`/`getListing` (cookieless anon client); availability stays uncached/fresh. Bust via `app/api/revalidate`.
- **Auth** — password reset: `forgot()` in `components/AuthForm.tsx` → `/auth/callback?next=/auth/reset` → `app/auth/reset`.
- **Voice concierge** — `components/VoiceConcierge.tsx` + `VoiceOrb.tsx`; routes `app/api/voice/{transcribe,speak}`; `/api/concierge` `voice:true` (bilingual, Roman Urdu). `lib/voiceAudio.ts` (gesture‑unlocked AudioContext).
- **Brand** — `components/EskerLogo.tsx` (wordmark, currentColor), `app/icon.svg` (favicon).
