# SPEC: In-App Purchase v1.1 (un-muting the app)

Status 2026-07-25: draft for Rylan approval, then Sid/Nick + mobile session
execution. Written while v1.0 build 14 (tier-silent) sits in App Review.
Nothing here ships until v1.0 is approved and live.

Goal: students can upgrade to Pro or Elite inside the app with Face ID at the
moment they run out of credits. Apple purchases sync into the same Firestore
account system Stripe already writes to. The tier-silent muting from build 14
gets reversed, legitimately this time.

---

## 0. Why RevenueCat (the one big dependency choice)

Raw StoreKit means hand-rolling receipt validation, renewal tracking, refund
handling, and sandbox weirdness on both the app and a new backend surface.
RevenueCat (RC) does all of that as a service, has a maintained Expo config
plugin (react-native-purchases), a free tier that covers us for a long time
(free under 2,500 USD MTR/mo), and webhooks that make the backend work a thin
translation layer. The alternative burns 1 to 2 weeks of Sid's time building
receipt infrastructure we would then own forever. Decision: RevenueCat.

---

## 1. Prerequisites (Rylan, can all start TODAY, Apple-paced)

1. Paid Apps agreement active in App Store Connect (banking + tax done).
2. Small Business Program enrollment approved (15 percent commission).
3. RevenueCat account created (rylan's email), project "Offerloop", iOS app
   attached to bundle id ai.offerloop.app with the App Store Connect API key.
4. Pricing decision locked with Nick. Default proposal: match web, Pro 29.99,
   Elite 59.99 per month. The .edu discount stays a web-only perk for now
   (Apple has no coupon equivalent; intro offers can come later).
5. Scope lock: subscriptions only in v1.1. Credit top-up packs (consumables)
   are v1.2, they add product types and review surface.

## 2. App Store Connect products

Subscription group: "Offerloop Membership" (one group so Pro and Elite are
upgrade/downgrade siblings, Apple handles proration).

| Product id | Name | Price |
|---|---|---|
| ai.offerloop.app.pro.monthly | Offerloop Pro | 29.99/mo |
| ai.offerloop.app.elite.monthly | Offerloop Elite | 59.99/mo |

Each product needs: display name, description, review screenshot (the paywall
screen), and localized price. Annual variants deferred until web annual exists.

RevenueCat entitlements: `pro` and `elite`, mapped to the products above.
Offering: `default` with two packages.

## 3. App changes (mobile session, ~2 to 3 days once native build possible)

NATIVE: react-native-purchases via the Expo config plugin. This is a new
native module, so v1.1 is a NEW BUILD for both the store app and the staging
variant (staging rebuild first, test there).

1. **Purchases bootstrap**: configure RC with the public SDK key at app start;
   `Purchases.logIn(firebaseUid)` on auth so RC app_user_id == Firebase uid
   (this is what makes webhooks map cleanly to Firestore docs). logOut on
   sign-out.
2. **New /upgrade paywall screen**, design-system native (ink primary button,
   Instrument Serif for the big price, Card/Chip primitives, watercolor
   backdrop). Content per tier: credits per month, contacts per search, daily
   draft caps, the real feature deltas from constants. Prices come ONLY from
   `Purchases.getOfferings()` (localized, never hardcoded, house rule).
   Required furniture: Restore Purchases button, Terms of Use (EULA) link,
   Privacy Policy link, "auto-renews until canceled, manage in Settings" line.
3. **Purchase flow**: `purchasePackage()`, optimistic spinner, then refetch
   /api/mobile/me until the tier flips (webhook race, see section 4; poll up
   to ~15s before showing "processing, check back in a minute").
4. **Un-mute the app** (reverses the build-14 strip, gated so it only renders
   when IAP is live): plan chip on Credits, PRO/ELITE profile badges,
   tier-colored PlanBorder, and an Upgrade entry on the Credits screen plus
   the out-of-credits moments (feed toast, Scout replies) linking to /upgrade.
5. **Already-subscribed states**: web-Stripe subscribers see their plan and
   "manage on the web where you subscribed" phrasing WITHOUT purchase buttons
   (no steering language, just status). Apple subscribers get a Manage
   Subscription row that opens `showManageSubscriptions()`.
6. **Restore**: `restorePurchases()` wired to the button, updates /me after.

## 4. Backend changes (Sid, ~2 to 3 days, deployable before the app ships)

New route: `POST /api/revenuecat/webhook` (blueprint `rc_webhook_bp`),
authenticated with RC's Authorization header secret (env
`REVENUECAT_WEBHOOK_SECRET`).

Event handling (idempotent, keyed on RC event id, store processed ids):

| RC event | Action on users/{app_user_id} |
|---|---|
| INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE | set subscriptionTier + tier from entitlement, set maxCredits to TIER_CONFIGS grant; on INITIAL_PURCHASE and upgrade PRODUCT_CHANGE also top credits up to the new grant; set subscriptionSource: "apple", appleProductId, appleExpiresAt |
| CANCELLATION | flag autoRenewOff=true, tier unchanged (access runs to period end) |
| EXPIRATION | tier back to free, maxCredits 300, credits min(credits, 300), clear subscriptionSource |
| REFUND | same as EXPIRATION, immediately |
| BILLING_ISSUE | no tier change (RC grace period), optional flag for support |

Precedence and double-subscribe guardrails:
- `subscriptionSource` field ("stripe" or "apple") records who granted the
  current tier. A webhook only downgrades a user it upgraded (apple events
  never stomp an active Stripe sub and vice versa; if both exist, highest
  tier wins and support gets a log line, this should be rare because the
  paywall hides purchase buttons from active Stripe subscribers).
- Stripe webhook code gets the mirror-image check (Sid audits billing.py).
- The monthly calendar-month credit reset already reads tier, so renewals
  need no special credit logic beyond what the reset does today.

## 5. QA gate (staging build, sandbox Apple ID, before submission)

- Purchase Pro, purchase Elite, upgrade Pro to Elite, downgrade, cancel and
  let sandbox-expire (sandbox renews in minutes), refund via RC dashboard.
- Each: Firestore tier/credits correct, app UI reflects within one refetch.
- Restore purchases on a wiped reinstall.
- Web check: Apple-subscribed user shows correctly on offerloop.ai.
- Stripe user opens paywall: sees status, no purchase buttons.

## 6. Submission notes (v1.1)

- Submit the two subscriptions WITH the v1.1 binary (first IAPs must ride a
  version).
- App description gains the Apple-required block: subscription names, length
  (monthly), prices, and functional links to Terms of Use (EULA) and Privacy
  Policy.
- App Review notes: how to reach the paywall, demo account stays FREE tier so
  reviewers can exercise the purchase, mention Restore button location.
- After approval: expand availability beyond US-only (international unlock is
  the whole point of having IAP), revisit web link-out (allowed to coexist on
  the US storefront, decision deferred, do not re-litigate with review).

## 7. Sequencing

1. Rylan: section 1 items (agreements are the long pole, start now).
2. Sid: webhook route + guardrails on staging backend (no app dependency).
3. Mobile: staging rebuild with react-native-purchases + paywall, QA loop.
4. Products + review screenshots in App Store Connect.
5. v1.1 build, submit with IAPs, keep v1.0 live throughout.

Estimated calendar: about 2 weeks end to end, dominated by agreement
processing and one review cycle, not by engineering.

## 8. Open questions for Rylan

1. Prices: match web (29.99/59.99) or pad for commission? (Spec assumes match.)
2. Elite yearly / Recruiting Season Pass on iOS later? (Web shows a 199
   four-month pass; a non-renewing subscription product could mirror it in
   v1.2.)
3. Does the .edu discount ever come to iOS (via offer codes), or stay a
   web-only lever?
