# HANDOFF: post-resubmission state (written 2026-08-03)

For any new terminal session picking up offerloop-mobile. Read this top to
bottom before touching anything. Rylan is the CMO, not an engineer: explain
choices in plain language, propose before executing, never commit or push
without his approval. NO EM DASHES anywhere. No invented numbers in UI.

## Where things stand

1.0 build 15 was RESUBMITTED to App Review on 2026-08-01 at 1:20 PM PT as
one submission with 7 items: the app version, 3 consumable credit packs,
2 auto-renewable subscriptions, and the Offerloop Membership subscription
group. Status at handoff: Waiting for Review (Apple says up to 48h; the
verdict arrives by email to rylanbohnett@gmail.com). A reply explaining the
IAP implementation was posted in the Resolution Center thread before
submitting. This is the fourth submission after three 3.1.1 rejections;
the fix was implementing IAP, and the whole stack is built and was verified
with real sandbox purchases before shipping.

If REJECTED: there is a granted App Review phone call invitation from the
3.1.1 saga, and SUPPORT-CASE-error5.md holds an unsent case file. Read the
rejection notes first; everything configurable was verified correct.

If APPROVED: purchases go live immediately against infrastructure that is
already deployed and listening (see topology below). First follow-ups:
ship Sid's ranker integration as an OTA (see Post-approval work), and
confirm real PRODUCTION purchase events arrive at the mobile-prod webhook.

## The money pipeline (all live, all verified on staging)

Purchase flow: app (RevenueCat SDK, StoreKit 2) -> Apple -> RevenueCat ->
webhook -> Flask backend -> Firestore credit ledger -> /api/mobile/me ->
app UI. The client NEVER writes credits or tier; grants are server-side
only. Prices render ONLY from StoreKit; zero hardcoded price strings.

Credit ledger has three buckets (web repo backend/app/services/
credit_ledger.py): monthly (credits/maxCredits, resets monthly), bonus
(bonusCredits, purchased packs, never expire), promo (promoCredits, can
expire). Spend order monthly -> bonus -> promo. /api/mobile/me returns the
combined total as `credits` plus each bucket separately (commit 214ed126,
authored by Claude under Rylan's git identity, reviewed by Nick).

## Topology

- Web prod: final-offerloop.onrender.com serves offerloop.ai, deploys from
  web repo `main`. DO NOT merge staging/mobile-field into main; app and web
  are deliberately separate economic entities (tier limits differ on
  purpose). This is Nick's explicit ruling.
- Mobile staging backend: offerloop-staging.onrender.com, Render service
  srv-d93d0fcvikkc73a1igmg, deploys from web repo branch
  staging/mobile-field. Sandbox-only webhook (REVENUECAT_EXPECT_PRODUCTION
  unset). The staging app (TestFlight) points here.
- Mobile prod backend: offerloop-mobile-prod.onrender.com, Render service
  srv-d9miocrm8hqs73ceaopg, same branch, REVENUECAT_EXPECT_PRODUCTION=1,
  its own webhook secret. Build 15 points here. Created 2026-07-31 as a
  clone of staging (env vars + firebase-service-account.json secret file).
- Render API key: RENDER_API_KEY in ~/Downloads/Final_offerloop/.env.
  Env var changes via API do NOT auto-deploy; POST /deploys after.

## App Store Connect (two app records, sessions expire FAST, ~30 min)

- Production app "Offerloop": Apple ID 6789441106, bundle ai.offerloop.app.
  Products: credits.150 6796180930 $2.99, credits.400 6796183903 $5.99,
  credits.1000 6796185627 $9.99, elite.monthly 6796186623 $34.99 (level 1),
  pro.monthly 6796187229 $9.99 + 7-day free intro offer (level 2), group
  "Offerloop Membership" 22274197. All availability all countries, review
  screenshots + notes saved on each.
- Staging app "Offerloop Staging": Apple ID 6795695227, bundle
  ai.offerloop.app.preview. Mirror set of 5 products with .preview. ids.
- ASC UI landmines (all bitten us): review screenshot uploads do NOT
  enable Save; type a review note to dirty the form, Save, then RELOAD to
  verify the upload persisted. New consumables pre-check all countries but
  the save can silently drop; new subscriptions start with ZERO countries.
  Page freezes can eat saves. Verify everything by reload.
- StoreKit error 5 lesson: after creating products or changing
  availability, sandbox purchases can fail with "product is not available
  for purchase" for 24-72h while fetch works fine. It is Apple-side
  activation lag. Wait, do not debug.

## RevenueCat (project 083723e5, one project, two apps)

- "Offerloop IOS" app659c88e628 = production bundle, public key
  appl_CzmrakvRLfwKKrtvxvjICLvIjbk.
- "Offerloop Staging iOS" app2707b1cad1 = staging bundle, public key
  appl_AbwRUeFzOscwAUNHMCiJtxUsKBg.
- Entitlements pro/elite attached to both bundles' subscription products.
  Consumables get NO entitlement; the webhook grants them.
- Default offering packages ($rc_monthly and custom "elite") each hold the
  staging AND production product.
- Webhooks: "Offerloop staging sandbox" whintgr8e363c5f84 (Sandbox only ->
  staging service) and "Offerloop mobile prod" whintgr353316cee9
  (Production only -> mobile-prod service). Authorization header format:
  `Bearer <secret>`. The handler now accepts raw or Bearer. Secrets live in
  the Render env vars; do not put them in files or chat.
- app_user_id == Firebase uid (logInPurchases at app start). Purchases on
  $RCAnonymousID get DROPPED by the webhook by design.

## Mobile repo (this repo, branch main, all committed)

- src/api/purchases.ts: RC wrapper. iapAvailable() gates every purchase
  surface on EXPO_PUBLIC_REVENUECAT_IOS_KEY being baked at BUILD time.
- src/components/paywall/PaywallSheet.tsx + paywallBus.ts: the purchase
  sheet, two modes (Free: Pro trial + Elite anchor + packs reveal;
  subscriber: packs). Vibrant style matches the Credits screen shop.
- src/app/credits.tsx: the Credits screen shop (gradient banners, rims,
  watercolor wash, gold price chips, serif numbers). NEVER sparkle icons.
- src/app/_layout.tsx: RC configure/logIn/logOut on uid change + clears the
  TanStack Query cache on account switch (prevents cross-account data).
- Grant toasts only fire on a live-to-live balance increase or plan change
  (connection.usingSampleData guard in credits.tsx and PaywallSheet.tsx).
- buildInfo.ts: OTA_VERSION counter (at "staging v16"). BUMP ON EVERY
  eas update PUBLISH. The stamp is hidden on the production channel.

## Build and OTA mechanics (gotchas that cost us hours)

- Staging OTA publish: APP_VARIANT=preview EXPO_PUBLIC_API_BASE_URL=
  https://offerloop-staging.onrender.com EXPO_PUBLIC_REVENUECAT_IOS_KEY=
  <staging key> npx eas-cli update --branch preview --message "..."
- eas.json IS part of the update fingerprint. Editing it (even production
  profile env) changes the iOS runtime version and STRANDS the OTA away
  from installed builds. Verify with eas-cli update:list that the new
  update's iOS runtime matches the installed build's, currently
  8aaf00e0b6e6bcaec0fe1e1e4274417cd0e3db27 for TestFlight build 5.
- Production build: profile "production" (points at mobile-prod, has the
  production RC key, channel production, ascAppId 6789441106, submit via
  --auto-submit). Build 15 = EAS build 15f1e9bd, git b9ffab88.
- Staging TestFlight build: profile "preview-testflight", ascAppId
  6795695227, internal group "IAP QA" (Rylan + nickwittig@icloud.com).
- The Claude Code sandbox blocks git push, eas build, and secret-bearing
  curl. Pattern that works: write a script to the scratchpad, have Rylan
  run it with the `!` prefix.

## Accounts for testing

- Demo/reviewer account: applereview@offerloop.ai / OfferloopReview!2026
  (documented in ASC review notes). MUST be a Free account whenever a
  reviewer might touch it. It took a sandbox Pro trial on 2026-07-31;
  trial should have self-expired. VERIFY it reads Free (probe script:
  scratchpad probe-demo-account.sh pattern, Firebase REST signIn + GET
  mobile-prod /api/mobile/me).
- Sandbox tester rylan+sandbox1@gmail.com exists but TestFlight testing
  uses real Apple IDs; the sandbox account is only for dev-signed builds.
- Firebase project offerloop-native is SHARED by web, staging, and prod
  backends; account state crosses environments.

## Post-approval work, in order

1. Sid's ranker integration (deliberately EXCLUDED from build 15). Web PRs
   #178/#179: GET /api/ranker/candidates (deck + deck_id), POST
   /api/ranker/feedback per swipe (echo deck_id or 400), POST
   /api/ranker/candidates/<id>/reveal-email (8 credits, cache-first,
   refunds on miss). Docs: web repo docs/IOS_RANKER_HANDOFF_TO_RYLAN.md
   sections 3/5/6. No hometown chip (field not wired). JS-only, so it
   ships as an OTA to the production channel, no App Review needed.
2. Confirm first real production purchase end to end in RC dashboard +
   mobile-prod webhook logs + a real account's balance.
3. Web/iOS pack ladder parity and web showing combined balance (Nick).
4. Verify the displayed swipe cost matches actual charges before real
   money at scale (creditsPerSwipe comes from CREDIT_COSTS now, but
   confirm against runs.py charging; old mismatch was 10 shown vs 5x
   contacts charged).
5. Refund clawback behavior is clamp-at-zero with shortfall recorded on
   lastPackRefundShortfall (Nick's decision, unit-tested, never live-tested).

## Web repo working pattern

Local clone ~/Downloads/Final_offerloop (remote origin = the real repo,
deploys come from it). Its working tree is dirty with someone's WIP: do
not touch it. Use a worktree: `git fetch origin && git worktree add
../<name> -b <branch> origin/staging/mobile-field`. Python venv for tests:
~/Downloads/Final_offerloop/backend/venv/bin/python -m pytest tests/ -q.
Suite has ~15 pre-existing failures unrelated to mobile; the revenuecat,
ledger, and mobile test files all pass. If Claude authors a commit, SAY SO
to Nick explicitly; the git identity is Rylan's and he will skim past it.

## Key docs

- SPEC-iap-v2-pricing-and-credits.md + IAP-V2-IMPLEMENTATION-HANDOFF.md:
  the IAP design source of truth (pricing rationale, QA gates, sequencing).
- SUPPORT-CASE-error5.md: the error 5 case file (resolved, kept for
  reference; do not file it).
- Web repo docs/REVENUECAT-WEBHOOK.md: webhook contract and env vars.
- Claude auto-memory (any Claude session): appstore-iap-pivot.md in the
  project memory dir carries this same state in compressed form.
