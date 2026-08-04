# Sid handoff, 2026-08-03: state of the app, the new rejection, and what is yours

You asked for a new repo and an issues doc. Short answer on the repo: we do not
need a new one. Everything lives in two existing repos, and the current App
Store rejection is an account-state problem, not a code problem. This doc is
the issues doc, plus a map of where everything lives.

## The two repos (no third one needed)

1. offerloop-mobile (this repo, branch main). The native iOS app. Expo SDK 56,
   TypeScript. All IAP client code is here: src/api/purchases.ts,
   src/components/paywall/PaywallSheet.tsx, src/app/credits.tsx.
2. The web repo (deploys from origin, local clone at Rylan's
   ~/Downloads/Final_offerloop). The mobile backend lives on branch
   staging/mobile-field: backend/app/routes/revenuecat_webhook.py and
   backend/app/services/revenuecat_service.py. Two Render services deploy from
   that one branch: offerloop-staging (sandbox purchases) and
   offerloop-mobile-prod (production purchases). Web prod on main is separate
   and deliberately stays separate (Nick's ruling).

If you need access to either repo, ask Rylan for a GitHub invite. Do not fork
into a new repo; the Render services deploy from the existing one and the
review trail with Nick is there.

## What just happened: rejection number 4, and why it is different

The first three rejections were policy (3.1.1, no IAP). We built the full IAP
stack and resubmitted build 15 on 2026-08-01. On 2026-08-04 (Apple's date) it
was rejected under Guideline 2.1(b), Information Needed. This is not a policy
rejection. The reviewer started the review and simply could not find the
subscriptions inside the app: "we cannot locate the In-App Purchases, such as
Elite Monthly and Pro Monthly, within the app at this time."

Root cause, confirmed by probing /api/mobile/me on the production backend: the
demo account in the review notes (applereview@offerloop.ai) was still reading
plan Pro. It took a sandbox Pro trial during QA on 2026-07-31 and the sandbox
subscription kept auto-renewing, so it was legitimately active when the
reviewer signed in. The app intentionally hides the Pro and Elite offers from
subscribed accounts (subscribers only see credit pack top-ups), so the
reviewer, signed in as a "Pro" user, could not see the two subscriptions
anywhere. The rejection is our app behaving as designed on an account in the
wrong state.

The unblock (done 2026-08-03, no code change, no new build): we replayed an
EXPIRATION event through the staging webhook, the account now reads Free on
the production backend, and Rylan is replying to Apple in the Resolution
Center with exact steps to find each IAP. One live risk remains: RevenueCat
shows the sandbox subscription running until 2026-08-04T19:50:50Z. If Apple's
sandbox renews it once more, the RENEWAL event will flip the account back to
Pro. Rylan re-probes after 12:50 PM PT on 08-04 and replays the fix if needed.

## The two real backend findings (these are yours)

We resolved the rejection by replaying an EXPIRATION event through the staging
webhook on 2026-08-03. The replay worked and surfaced two facts:

1. The demo account was not the victim of a dropped webhook. RevenueCat showed
   the sandbox subscription STILL ACTIVE (expires 2026-08-04T19:50:50Z, period
   "normal", so it kept renewing after the 07-31 trial). The webhook pipeline
   had done nothing wrong; the account was Pro because RevenueCat said so. The
   process fix is operational: never run subscription QA on the review demo
   account. A dedicated QA account should take the trials.
2. The replay response said "tierSource": "event". That means
   fetch_subscriber_tier (the authoritative read from the RevenueCat REST API)
   returned None on staging and the handler fell back to the event payload.
   The authoritative read is failing, most likely a missing or wrong
   RevenueCat secret API key in the staging Render env. This matters beyond
   the demo account: the fail-safe keeps the CURRENT tier when the read fails
   on ambiguous events, so with the read permanently broken, downgrades depend
   entirely on event contents. Please verify the key on BOTH services
   (offerloop-staging srv-d93d0fcvikkc73a1igmg and offerloop-mobile-prod
   srv-d9miocrm8hqs73ceaopg), confirm fetch_subscriber_tier succeeds for a
   real uid, and check the Render logs for its warning line.

Also worth adding while you are in there: a reconcile pass, either a daily job
or an on-login check in /api/mobile/me, that re-reads the RevenueCat
subscriber for apple-sourced subscriptions past their expiry and downgrades.
Then a missed or misprocessed event self-heals instead of leaving someone on a
free paid tier forever.

Unit tests for the webhook live in backend/tests/test_revenuecat_webhook.py
and test_revenuecat_route.py, all passing. The suite has ~15 pre-existing
failures unrelated to mobile; ignore those.

## Your main post-approval work (unchanged, deliberately not in build 15)

The ranker integration ships as an over-the-air JS update after approval, no
App Review needed. The contract is web PRs #178/#179:
- GET /api/ranker/candidates returns the deck plus a deck_id.
- POST /api/ranker/feedback per swipe, must echo deck_id or the server 400s.
- POST /api/ranker/candidates/<id>/reveal-email: 8 credits, cache first,
  refunds on a miss.
Full details: web repo docs/IOS_RANKER_HANDOFF_TO_RYLAN.md sections 3, 5, 6,
and SID-ULTIMATE-HANDOFF.md in this repo. The hometown chip is out of scope
(field not wired).

## Architecture in one paragraph

Purchase flow: app (RevenueCat SDK, StoreKit 2) to Apple to RevenueCat to
webhook to Flask backend to Firestore credit ledger, read back through
/api/mobile/me. The client never writes credits or tier; every grant is server
side. Credit ledger has three buckets: monthly (resets), bonus (purchased
packs, never expire), promo (can expire), spend order monthly then bonus then
promo. Prices in the UI render only from StoreKit, never hardcoded. Firebase
project offerloop-native is shared by web, staging, and prod backends, so
account state crosses environments; that sharing is exactly why a staging-side
downgrade fixes what the production reviewer sees, and also why sandbox QA on
a shared demo account can poison a production review.

## Secrets and accounts

No secrets in this doc or any doc. Webhook secrets live in the Render env vars
for each service, RevenueCat keys in the RevenueCat dashboard, and the demo
account credentials are in the App Store Connect review notes (and
HANDOFF-post-resubmission.md, which also carries the full topology: service
ids, product ids, bundle ids). Read that file next if you want the complete
operational picture.
