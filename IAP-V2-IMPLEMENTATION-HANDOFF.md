# IAP v2 implementation handoff (RevenueCat, staging first)

**Mission:** implement native in-app purchases (Pro/Elite subscriptions + credit
top-up packs) per `SPEC-iap-v2-pricing-and-credits.md`, on the STAGING variant
only, so the whole purchase system is built, sandbox-tested, and ready to
become the next store submission. UPDATE 2026-07-28: build 14 (the tier-silent
build) was ALSO rejected on 3.1.1, so this work is no longer a post-approval
v1.1. The IAP build IS the 1.0 resubmission, packaged the day the QA gate
passes (Phase 6).

Read these first, in order:
1. `SPEC-iap-v2-pricing-and-credits.md` (the approved plan, source of truth)
2. `STAGING-DEV-HANDOFF.md` (staging rules, deploy workflow)
3. `SPEC-iap-v1_1.md` (superseded on pricing/scope, still correct on webhook
   guardrail intent)
4. `CLAUDE.md` (design system, hard rules; note its "no purchase links" line is
   pre-ruling and superseded by the v2 spec for this work)

---

## HARD RULES (non-negotiable)

- STAGING ONLY. Ship JS via
  `APP_VARIANT=preview EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com eas update --branch preview --message "<what changed>"`.
  NEVER `eas update --branch production`, NEVER `eas submit`, never a
  production build. Nothing is in review right now (build 14 was rejected
  2026-07-28; the version page sits in developer-action-needed), but the
  production channel stays untouched until the deliberate Phase 6 packaging
  step, which is not this session's job.
- Bump `src/lib/buildInfo.ts` (OTA_VERSION + OTA_NOTES) before every publish.
- The ONE allowed native step is the staging rebuild
  (`eas build --profile preview`) to add react-native-purchases. It needs
  Rylan's Apple login; coordinate with him, do not attempt other native changes.
- NO EM DASHES anywhere (copy, code, comments, docs). No fake numbers in UI:
  prices render ONLY from `Purchases.getOfferings()`, credit balances only
  from the backend. Never hardcode a price string.
- Client NEVER grants credits or writes tier fields. Purchases grant
  server-side via RevenueCat webhook (Sid's side). The app only purchases and
  then refetches `/api/mobile/me`.
- Secrets: Rylan has the App Store Connect In-App Purchase key at
  `~/Downloads/SubscriptionKey_THHS67UN7C.p8`. It is uploaded to the
  RevenueCat dashboard ONLY. Never copy it into the repo, never commit any
  .p8, never paste its contents anywhere.
- Two-phase workflow: propose diffs, get Rylan's approval, then execute.
  Never commit or push without explicit approval.

## Decisions already made (do not re-litigate)

- Native IAP via RevenueCat is the primary purchase path. The existing web
  handoff (`src/api/endpoints/upgrade.ts`) demotes to a "Manage on the web"
  row and is the only path shown to Stripe-web subscribers.
- Pricing: Pro 9.99/mo (2,000 credits, 7-day free trial intro offer), Elite
  34.99/mo (5,000 credits, no advertised trial). One subscription group.
  No annual, no slider, no .edu gate, no strikethrough pricing, never say
  "no credit card required."
- Packs (consumables): 100 credits 2.99, 250 credits 5.99 ("Most popular"),
  600 credits 9.99 ("Best value"). Purchased credits NEVER expire and live in
  a separate `purchasedCredits` bucket, distinct from the monthly allowance.
- Copy: CTA "Start 7-day free trial"; subline "7 days free, then $9.99/mo.
  Cancel anytime."; frame "Student pricing, built for recruiting season."
  The dollar amounts inside these strings are TEMPLATES: interpolate the
  localized price from getOfferings() at render time (same for the "Pro
  members get 2,000 credits a month for $9.99" top-up sheet line). A literal
  price string in code fails acceptance criterion 3.
- Paywall style: bottom sheets in our design system (ink primary button,
  Instrument Serif for the big price, Card/Chip primitives). NOT RevenueCat
  remote paywalls, NOT full-screen takeovers, no countdown timers or fake
  scarcity, no sparkle icons anywhere near Scout.

Open items being resolved in parallel (build to these defaults, flag if they
change): Nick confirming web-side pack parity + never-expire alignment.

## Current state of the repo (what exists today)

- `src/app/credits.tsx`: Credits screen, balance card + web handoff card.
  Becomes the store screen (keep the gradient balance card).
- `src/api/endpoints/upgrade.ts`: `requestWebHandoff()` mints the signed-in
  Safari checkout URL. Keep, demote to "Manage on the web."
- `src/api/errors.ts`: `isInsufficientCredits()` (402 or "insufficient
  credits" body) + a helper reporting needed credits. This is the limit-hit
  detection to hook.
- Limit-hit call sites: `src/store/app.tsx` (~line 1210 and the
  `INSUFFICIENT_CREDITS` branch ~1451), `src/app/(tabs)/feed.tsx` (~line 157
  out-of-credits toast), `src/app/(tabs)/index.tsx` (~line 526 Scout
  no-credits reply with a "View credits" action).
- `src/components/feed/StaminaBar.tsx`: swipe stamina row (the low-balance
  pill lands near it).
- Auth/bootstrap: `src/app/_layout.tsx` (Purchases.configure + logIn go here).
- Staging backend: `https://offerloop-staging.onrender.com`. `/api/mobile/me`
  serves profile + credits.

## Build order

### Phase 0: accounts and dashboards (Rylan does clicks, you drive)

1. App Store Connect: create an app record for bundle id
   `ai.offerloop.app.preview` ("Offerloop Staging"). It is NEVER submitted for
   review; it exists so sandbox StoreKit can serve products. Creating it does
   not affect the in-review production app.
2. On that record create 5 products, all metadata filled to "Ready to Submit"
   (products in "Missing Metadata" do not return in sandbox; number one cause
   of empty offerings):
   - Subscription group "Offerloop Membership":
     `ai.offerloop.app.preview.pro.monthly` 9.99 with a 7-day free-trial
     introductory offer; `ai.offerloop.app.preview.elite.monthly` 34.99.
   - Consumables: `...credits.100` 2.99, `...credits.250` 5.99,
     `...credits.600` 9.99.
3. RevenueCat dashboard: add the preview bundle id as an app in the project,
   confirm the In-App Purchase key (the .p8 above) is uploaded, import the 5
   products. Entitlements `pro` and `elite` mapped to the two subscriptions.
   Consumables get NO entitlement. Offering `default`: Pro package (default)
   + Elite package. Project restore behavior: "Keep with original App User ID"
   (login-required app).
4. Rylan's two subs already created in RevenueCat were for the production
   bundle id; keep them, they become the production app's mapping later.
5. Sandbox tester Apple IDs for Rylan's and Nick's phones.
6. Verify the Paid Apps agreement shows Active (Rylan signed it; sandbox
   returns nothing until it is).

### Phase 1: native rebuild (one time, coordinate with Rylan)

- `npx expo install react-native-purchases` (add `react-native-purchases-ui`
  only if actually used; plan says custom sheets, so probably skip it).
- RevenueCat public SDK key via env
  (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`) wired per variant in the eas.json
  preview profile env, next to the existing `APP_VARIANT` /
  `EXPO_PUBLIC_API_BASE_URL` pattern. Public SDK keys are not secret but the
  staging and production RC apps have different keys, so env-per-variant.
- `eas build --profile preview`, install on both phones. After this, all
  remaining work is OTA JS.
- Expo Go note: react-native-purchases runs a mock "preview API mode" in Expo
  Go, so UI iterates in simulator; real purchases only on the rebuilt app.

### Phase 2: purchase plumbing (JS, OTA)

1. Bootstrap in `_layout.tsx`: `Purchases.configure({apiKey})` at start;
   `Purchases.logIn(firebaseUid)` when auth resolves; `logOut()` on sign-out.
   RC app_user_id MUST equal the Firebase uid (this is what makes webhooks
   land on the right Firestore doc, shared with web Stripe).
2. New `src/api/purchases.ts` (or similar): typed wrappers for getOfferings,
   purchasePackage, restorePurchases, plus a post-purchase poller that
   refetches `/api/mobile/me` until tier/balance changes (webhook race: poll
   up to ~15s, then show "Processing. Check back in a minute.").
3. Gate everything behind the variant/env so production builds without the
   native module never crash (feature flag: IAP available only when the
   native module + key exist).

### Phase 3: the sheets and triggers (JS, OTA, the conversion work)

One sheet component, two modes (see spec sections 2 and 3 for full layout):
- UpgradeSheet (free users): Pro card with trial CTA + required subline,
  Elite listed as anchor, secondary link "Just need a few more drafts?"
  revealing the pack row. Required furniture: Restore Purchases, Terms of
  Use, Privacy Policy links, "auto-renews until canceled, manage in
  Settings" line.
- TopUpSheet (Pro/Elite): three packs, badges on 250 ("Most popular") and
  600 ("Best value"), per-draft framing ("about 25 drafts"), line reminding
  Pro exists ("Pro members get 2,000 credits a month for $9.99") for free
  users only.

Wire four triggers:
1. Insufficient-credits failures (errors.ts detection at the store/app.tsx and
   feed.tsx call sites): open the sheet instead of today's toast. Free user
   gets UpgradeSheet, subscriber gets TopUpSheet.
2. Low-balance pill near the StaminaBar when balance <= 30 credits: "3 drafts
   left this month" (compute from real balance, render only with real data).
   Max once per day, dismissible.
3. Scout no-credits reply (index.tsx ~530): add "Get more credits" action
   opening the sheet, keep the honest "nothing was charged" copy.
4. Credits screen becomes the store: keep balance card (now showing allowance
   + never-expiring purchased balance breakdown once the backend serves it),
   plan section, pack grid, Restore + legal links, web handoff demoted to
   "Manage on the web" row. Stripe-web subscribers see plan status + web
   manage row and NO purchase buttons.

### Phase 4: backend dependency (Sid, parallel; do not build it here)

App-side work assumes Sid's staging webhook from spec section 5:
`POST /api/revenuecat/webhook` (auth header verify, idempotent on event id,
environment branch), subscriber-snapshot tier sync, `purchasedCredits` bucket
+ spend order (allowance first, wallet after), `/api/mobile/me` exposing the
new bucket. One decision to get from Sid up front: REFUND clawback when the
credits were already spent (clamp purchasedCredits at zero, or record a
negative balance owed against the next grant). The Phase 5 refund test hits
this either way. Hand Sid the spec section; until it is live, build UI against
mocks (obviously-fake fixture data only) and keep purchase buttons disabled
on staging.

### Phase 5: sandbox QA gate (both phones, staging build)

- Pro purchase shows TRIAL period, converts on sandbox renewal; Elite
  purchase; upgrade Pro to Elite; downgrade; cancel and sandbox-expire;
  refund from RC dashboard.
- Each pack: exact credit grant lands exactly once (manually redeliver the
  webhook to prove idempotency), REFUND claws back.
- Spend through allowance into wallet; monthly reset leaves purchasedCredits
  untouched; buy a pack mid-trial.
- Restore Purchases on wiped reinstall; Stripe-account user sees status only.
- Firestore tier/credits correct after every step; UI reflects within one
  refetch.

### Phase 6: production packaging (starts the day Phase 5 passes; this IS the resubmission)

Not this session's job to execute, only to leave ready. Build 14 was rejected
on 3.1.1 (2026-07-28), so there is no tier-silent approval to wait for: the
IAP build is the next 1.0 store submission itself. Steps: mirror the 5
products on the real `ai.offerloop.app` record (real intro offer on Pro), map
them in RC's production app, un-mute tier UI behind the flag, cut a 1.0
production build (build 15) from the QA-passed code, attach the 5 IAPs to the
1.0 version, resubmit. Also required: the App Store description gains the
Apple-required subscription block (subscription names, monthly duration,
prices, working Terms of Use and Privacy Policy links; omitting it is a
standard 3.1.2 bounce), and App Review notes (paywall location, Restore
button location, demo account stays Free so the reviewer can exercise the
purchase). Update CLAUDE.md's stale "no purchase links" rule in the same
change.

## Acceptance criteria

1. Staging app: a Free sandbox user hitting a credit wall completes a Pro
   trial purchase in one sheet with Face ID and sees tier + credits update
   without leaving the Feed.
2. A subscribed sandbox user buys the 250 pack and the balance rises by
   exactly 250, once, server-granted.
3. No hardcoded price anywhere (grep proves it); all prices from offerings.
4. Production channel, production branch, and the in-review app: untouched.
5. Every publish has a matching buildInfo bump and was verified on a phone.
