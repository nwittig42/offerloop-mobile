# SPEC: IAP v2, pricing and credit packs (RevenueCat)

Status 2026-07-28: proposal for Rylan approval. Supersedes the pricing and scope
in SPEC-iap-v1_1.md (that doc assumed Pro 29.99 and Elite 59.99 and deferred
credit packs; both are now overridden by Nick's mobile pricing handoff of
2026-07-27). The webhook table, double-subscribe guardrails, and QA gate from
v1.1 carry forward and are restated here where they changed.

Built and tested on the STAGING variant (Offerloop Staging,
ai.offerloop.app.preview) while v1.0 sits in App Review. Nothing ships to the
production channel until v1.0 is approved.

---

## 1. The big decision: native IAP first, web link second

Rylan asked: is the external link the move, or is it only worth it because of
the 15 percent cut? Research answer (July 2026):

- External checkout links ARE now legal on the US storefront with zero Apple
  commission (Epic v. Apple contempt order, April 2025; Apple revised guideline
  3.1.1 for the US in May 2025). No entitlement, no scare screen, plain buttons
  allowed. Spotify and Patreon both do it. The old "no purchase links" rule in
  CLAUDE.md is obsolete for the US storefront.
- BUT: as a new app under 1M USD/year we qualify for Apple's Small Business
  Program, so our commission is 15 percent, not 30. Published data (Superwall,
  RevenueCat, May 2025) shows web link-out converts roughly 12 to 35 percent
  worse than native IAP. At a 30 percent commission link-out still nets more
  money; at 15 percent it is break-even to slightly NEGATIVE. A year after the
  ruling, web is still only about 5 percent of North American subscription app
  revenue.
- The zero-commission rule is also litigation-contingent: the Supreme Court took
  Apple's appeal in June 2026, so the rules could change again in 2027.
- Our purchase moments are impulse moments (a student just ran out of credits
  mid-swipe). One tap plus Face ID converts; bouncing to Safari to re-decide
  does not.

DECISION (proposed): native IAP (RevenueCat) is the primary purchase path for
both subscriptions and credit packs. The existing signed-in web handoff
(/api/mobile/web-handoff, already live) stays as the secondary path, reframed
as "Manage your plan on the web," and remains the only path shown to users who
subscribed via Stripe on the web. We do not add a "cheaper on the web" link-out;
at a 15 percent commission there is nothing to steer toward.

## 2. What we sell

### Subscriptions (per the 2026-07-27 handoff, one price for everyone)

| Product | Price | Credits/month | Trial |
|---|---|---|---|
| Pro monthly | 9.99/mo | 2,000 | 7-day free trial (App Store intro offer) |
| Elite monthly | 34.99/mo | 5,000 | none advertised |

One App Store subscription group ("Offerloop Membership") so Pro and Elite are
upgrade/downgrade siblings and Apple handles proration. Not built: annual
plans, credit sliders, in-tier credit options, .edu verification, strikethrough
pricing, any "no credit card required" claim.

Copy rules (match web exactly): CTA "Start 7-day free trial"; under it
"7 days free, then $9.99/mo. Cancel anytime."; frame "Student pricing, built
for recruiting season." Prices render ONLY from Purchases.getOfferings(),
never hardcoded.

### Credit packs (consumables), the new part

Rylan's instinct was batches like 15 / 20 / 30 emails. Research on how winning
apps ladder consumables (Hinge Roses 3/12/50, Tinder Boost packs, Duolingo
gems) says the sizes should SPREAD, not cluster: a small starter that anchors,
a badged middle pack most people buy, and a big pack whose per-unit price is
roughly half the starter's. All packs stay under the 9.99 impulse ceiling.
At 10 credits per draft:

| Pack | Credits | About | Price | Per draft | Badge |
|---|---|---|---|---|---|
| Quick pack | 100 | 10 drafts | 2.99 | 0.30 | |
| Popular pack | 250 | 25 drafts | 5.99 | 0.24 | Most popular |
| Value pack | 600 | 60 drafts | 9.99 | 0.17 | Best value |

Why these numbers protect the subscription: Pro works out to about 5 cents per
draft (9.99 for 2,000 credits). Packs run 17 to 30 cents per draft, 3 to 6
times worse. That is the same gap Tinder and Hinge keep between a la carte and
subscription, and it makes "just subscribe" the obvious answer for anyone who
tops up twice. The top-up sheet says so out loud: "Pro members get 2,000
credits a month for $9.99."

Two hard rules from Apple guideline 3.1.1 and RevenueCat's consumable docs:

1. PURCHASED pack credits never expire. Monthly allowance credits still reset
   on the 1st; purchased credits persist until spent. These are two different
   buckets (see section 5).
2. Credits are granted server-side off the RevenueCat webhook, never by the
   client. The client only refreshes the balance after purchase.

Packs are sellable to everyone (free and subscribed). Free users always see
the trial CTA first; packs are the secondary option on the same sheet.

## 3. Where the paywall appears (the enticement design)

Research is unambiguous: the highest-converting paywall moment is the limit
hit, the second best is the low-balance warning right before it. We wire four
triggers, all opening native sheets in our design system (ink primary button,
Instrument Serif price, Card and Chip primitives). No RevenueCat remote-config
paywalls in v1; our design fidelity matters more than remote iteration, and
triggers stay fully in our control. RevenueCat Experiments can come later.

1. Limit hit (the big one). A right-swipe, Scout draft, or auto-apply that
   fails with insufficient_credits (the app already detects this in
   src/api/errors.ts) opens a bottom sheet instead of today's toast:
   - Free user: the upgrade sheet. Trial CTA on Pro, Elite listed as the
     anchor. Secondary link at the bottom: "Just need a few more drafts?"
     opens the pack row.
   - Pro or Elite user: the top-up sheet. Three packs, one tap, Face ID,
     balance updates in place. Subscription upsell line only for Pro users
     who might fit Elite.
2. Low-balance warning. When the balance drops to 30 credits or fewer (3
   drafts), the Feed shows a quiet pill near the stamina bar: "3 drafts left
   this month." Tapping opens the same sheet as trigger 1. Shown at most once
   per day, dismissible; nagging kills trust with students.
3. Scout out-of-credits reply. Scout's existing "You're out of credits for
   this one" message gains a second action button, "Get more credits," opening
   the sheet. Scout stays honest: nothing was charged, credits refresh on the
   1st, and now there is a real fix.
4. Credits screen becomes the store. Keeps the gradient balance card, then:
   plan section (current plan, upgrade cards with the trial CTA, or "manage on
   the web" for Stripe subscribers), pack grid, then the required furniture:
   Restore Purchases, Terms of Use, Privacy Policy, "auto-renews until
   canceled" line. The web handoff card demotes to a "Manage on the web" row.

Deliberately NOT built: countdown timers, fake scarcity, streak guilt. The
audience is students; the pitch is "recruiting season is short," which is real
urgency, not manufactured.

## 4. RevenueCat and App Store Connect setup

Identity: Purchases.configure at app start, then Purchases.logIn(firebaseUid)
on auth (this is what ties Apple purchases, Stripe purchases, and Firestore to
one account; the uid is shared with the user's Google sign-in). logOut on
sign-out. Restore behavior in the RC dashboard: "Keep with original App User
ID," the right setting for a login-required app; it prevents a second Apple ID
restore from silently moving a subscription between Offerloop accounts.

Products in RevenueCat (Rylan already created the two subscriptions):
- Entitlements: pro, elite, mapped from the two subscription products.
- Offering "default": Pro package (default) + Elite package.
- Add the three consumable products (e.g. ai.offerloop.app.credits.100 / .250
  / .600). Consumables get NO entitlement (RevenueCat's own guidance); they
  are granted by webhook only.

The staging problem (no app in the App Store yet), solved: sandbox testing
does not require an approved app or approved products. The standard approach,
confirmed viable in RevenueCat's own support threads:

1. Create an App Store Connect app record for the STAGING bundle id
   ai.offerloop.app.preview. It never gets submitted for review; it exists so
   sandbox StoreKit has products to serve. This does not touch the in-review
   v1.0 app in any way.
2. Duplicate the five products on that record and fill metadata to "Ready to
   Submit" (products stuck in "Missing Metadata" do not return from sandbox,
   the number one cause of empty-offerings bugs). Paid Apps agreement is
   already signed, which is the other prerequisite.
3. Attach the preview bundle id as its own app inside the RevenueCat project,
   sandbox API key in the staging build.
4. Sandbox tester Apple ID on Rylan's and Nick's phones. Sandbox renews
   subscriptions in minutes, so expiry and renewal are testable same-day.

When v1.0 is approved, we repeat product setup on the real
ai.offerloop.app record with the real prices and the 7-day intro offer on Pro,
and the first IAPs ride the v1.1 binary submission.

## 5. Backend (Sid): webhook and the two credit buckets

New route POST /api/revenuecat/webhook, verified with the Authorization header
secret (constant-time compare), idempotent on the event id, and branching on
environment so SANDBOX events never touch production data.

Subscription events (INITIAL_PURCHASE, RENEWAL, UNCANCELLATION,
PRODUCT_CHANGE, CANCELLATION, EXPIRATION, REFUND, BILLING_ISSUE): rather than
hand-deriving state per event, the handler fetches the current subscriber
snapshot from RevenueCat's API and sets subscriptionTier, maxCredits (2,000 /
5,000), subscriptionSource: "apple", and the expiry fields from the
entitlements snapshot (RevenueCat recommends exactly this). The v1.1 spec's
guardrails carry forward unchanged: subscriptionSource records who granted the
tier, Apple events never stomp an active Stripe subscription and vice versa,
CANCELLATION only flags auto-renew off, EXPIRATION downgrades.

Trial: INITIAL_PURCHASE arrives with period_type TRIAL; the entitlement is
active during the trial so the app gates identically. The conversion signal is
the first RENEWAL with period_type NORMAL. Per the handoff we do NOT try to
sync trial eligibility with the web's trialUsedAt; Apple enforces its own
one-trial-per-account rule.

Consumables: NON_RENEWING_PURCHASE grants the pack's credits, idempotent on
transaction_id (webhooks retry up to 5 times; store granted ids). REFUND on a
pack claws the credits back.

The two buckets (new Firestore shape, needs Nick/Sid sign-off):
- credits: the monthly allowance, resets to maxCredits on the 1st, unchanged.
- purchasedCredits: the pack wallet. Never expires, never reset, only
  incremented by the webhook and decremented by spending.
- Spend order: allowance first, wallet only after the allowance hits zero. The
  backend spend path and the balance in /api/mobile/me both need to know about
  the second bucket; the app displays the sum with a small breakdown on the
  Credits screen.

Clients can never write subscriptionTier, maxCredits, purchasedCredits, or
any store id directly; Firestore rules already block it and everything flows
through the webhook.

## 6. App changes (this repo)

NATIVE REBUILD REQUIRED. react-native-purchases is a native module: install,
then eas build --profile preview (needs Rylan's Apple login), then everything
after is OTA-able JS as usual. Expo Go keeps working in a mock "preview API
mode," but real purchase flows need the rebuilt staging app. This is the same
specific rebuild the staging handoff doc told us to stop and flag.

1. Purchases bootstrap: configure + logIn(firebaseUid) in src/app/_layout.tsx
   alongside existing auth wiring; logOut on sign-out.
2. UpgradeSheet and TopUpSheet components (one sheet, two modes): offerings
   from getOfferings(), purchasePackage() with an optimistic spinner, then
   poll /api/mobile/me until the tier or balance flips (the webhook race,
   up to about 15s, then "processing, check back in a minute").
3. Trigger wiring per section 3 (feed insufficient-credits path, low-balance
   pill, Scout reply action, Credits screen store).
4. Restore Purchases wired to restorePurchases(), refetch /me after.
5. Stripe-subscriber state: plan shown, no purchase buttons, "manage on the
   web where you subscribed" via the existing handoff.
6. Un-mute tier UI behind a flag that only renders when IAP is live (plan
   chip, PRO/ELITE badges, tier PlanBorder), reversing the build-14 strip.

## 7. QA gate (staging, sandbox)

The v1.1 matrix carries forward: purchase Pro (verify TRIAL period), purchase
Elite, upgrade, downgrade, cancel and sandbox-expire, refund from the RC
dashboard, restore on a wiped reinstall, Stripe-subscriber sees status only.
New for v2: buy each pack and verify the exact credit grant lands once (retry
the webhook manually to prove idempotency), spend through the allowance into
the wallet, verify the monthly reset leaves purchasedCredits untouched, refund
a pack and verify clawback, buy a pack mid-trial.

## 8. Sequencing

1. Rylan approves this spec, then: ASC app record for the preview bundle id,
   five products at "Ready to Submit," consumables added in RevenueCat,
   sandbox testers. (Apple-paced, start first.)
2. Sid: webhook route + purchasedCredits bucket + spend order on staging
   backend. No app dependency, can start immediately.
3. Mobile: install SDK, staging rebuild, then sheets and triggers as OTA
   iterations on the rebuilt staging app.
4. QA gate on staging phones.
5. After v1.0 approval: real products on ai.offerloop.app, v1.1 binary with
   IAPs submitted, tier UI un-muted. CLAUDE.md guardrail text updated to the
   post-ruling reality at the same time.

## 9. Open questions for Rylan

1. Pack lineup: 100/250/600 credits at 2.99/5.99/9.99 as proposed, or closer
   to the original 15/20/30-email instinct? (Recommendation: the spread ladder;
   15/20/30 prices too close together to steer anyone.)
2. Nick alignment: the web handoff doc says "no credit slider or in-tier
   options" but does not mention top-up packs at all. Do packs exist on web
   too, and does web agree purchased credits never expire? (Apple forces
   never-expire on iOS; web should match or balances diverge.)
3. Trial on the sheet vs a full-screen paywall for the Free limit-hit moment:
   proposed is a bottom sheet (stays in the swipe context); a full-screen
   takeover tests better in some apps but feels heavier. Sheet unless you say
   otherwise.
4. Elite: list it on the sheet as the anchor (recommended, per the handoff:
   "listed but not pushed") or hide it behind the Credits screen only?
