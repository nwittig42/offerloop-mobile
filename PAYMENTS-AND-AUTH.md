# Offerloop Mobile — Payments, Auth & Web↔App (Source of Truth)

Read this BEFORE touching anything that: adds or changes **payments/purchases in the app**,
adds a **buy/upgrade CTA**, links the app out to **web checkout**, changes **sign-in/sign-up**,
or builds a **web feature meant to drive app usage**. This is the canonical decision doc;
update it when a decision changes.

---

## Core model (LOCKED)

**The website (offerloop.ai) is the source of truth for identity, profile, and billing.
The app reads and reflects — it does not create accounts or sell digital goods.**

- Web fully enriches the profile (resume upload, LinkedIn, school, targets). The app reads it
  via `GET /api/mobile/me`. That enrichment is what makes the drafts good, so the app stays
  thin on profile capture. (The "capture LinkedIn in-app" idea is parked — web does it better.)
- New users create a (free) account on the web; the app routes them there, then they sign in.
- Anything bought on the web (tier, credits) shows up in the app because the app reflects `/me`.

---

## Apple rules (the guardrails — approval-critical)

1. **Digital goods used in the app (credits, Pro/Elite), if sold *inside the app*, MUST use
   Apple IAP** (15–30% cut). You can **never** put a Stripe/credit-card checkout in the app for
   digital goods — that is an instant rejection (guideline 3.1.1).
2. **The web-first model is approval-safe *because the app sells nothing*** — it only reflects
   entitlements purchased on the web.
3. **Anti-steering:** Apple historically banned even *mentioning* outside purchasing. The 2025
   Epic v. Apple ruling lets **US** apps include an external-purchase **link**. Keep it
   **neutral/informational** ("Manage on offerloop.ai"), never a "Buy now" CTA, and never point
   it at a paywall screen. That stays safe globally, not just US.
   **REVISED 2026-07-16:** team decided to add a *functional* upgrade / credit-purchase entry that
   hands off (signed-in) to web checkout — US-permitted post-Epic. Payment stays 100% on web; the
   app still sells nothing. Keep copy measured ("View plans" / "Upgrade on the web") to stay safe
   outside the US. Spec: `SPEC-app-web-upgrade-handoff.md`. Build in v1.1.
4. **Free account creation on the web is fine. Paying on the web is fine. The app reflecting the
   result is fine.** Just keep the web-link CTA framed as "create your account" (free), not
   "subscribe."
5. Adding Google/any third-party sign-in to the app triggers Apple's **Sign in with Apple**
   requirement (guideline 4.8) + native config + rebuild. We deliberately use **email
   magic-link only** to avoid that.

---

## Current state (compliant today)

- `src/app/credits.tsx` — read-only balance + usage + a single "Manage credits & plan on
  offerloop.ai" link → **`/account-settings`** (neutral billing management, NOT the `/pricing`
  paywall). **No in-app purchase.** Compliant. (2026-06-29 audit: was pointing at `/pricing`, a
  paywall, which broke guardrail #3; repointed to `/account-settings` and softened the card copy
  to "Manage your plan and credits.")
- Exhausted-action paths (swipe draft, meeting prep, scout) are toast-only with no buy CTA and no
  forced paywall — compliant. The swipe toast was de-steered 2026-06-29 ("Top up on offerloop.ai"
  → "Not enough credits for that swipe"). Scout intercepts `/pricing` nav → in-app Credits screen.
- Subscriptions (Pro/Elite) — **web Stripe only.**
- `src/app/(auth)/welcome.tsx` — "Sign in" (returning, email magic-link) + "Create your account"
  → `offerloop.ai/signin?mode=signup` (new). No in-app account creation, no paywall link.

---

## Monetization decisions (LOCKED for v1, with one measured future lever)

- **v1: web-first everything. The app sells nothing. No IAP.**
- **Subscriptions (Pro/Elite): ALWAYS web Stripe.** Margin (~3% vs Apple 15–30%, especially on
  *recurring* revenue) makes moving subs to IAP a non-starter. Never do it.
- **Credit top-ups: web for now.** FUTURE LEVER (measured, not default): if the web-redirect
  trip proves to kill impulse top-up conversion, consider **consumable IAP for top-ups ONLY**
  (the simplest IAP type). Accept the 30% only if conversion data justifies it. **Measure web
  top-up conversion first.**

**Decision rule for any new "buy" surface:** default = web (reflect-only in the app + at most a
neutral "manage on web" link). Only consider IAP if BOTH (a) it's a consumable impulse buy AND
(b) data shows web-redirect friction is costing real conversion. Subscriptions are exempt — always web.

---

## Auth deep-link handoff (PLANNED — build later, not now)

**Problem (the real funnel leak):** web signup is easy (Google on web), but the app's sign-in is
**email magic-link** = enter email → wait for email → tap link → deep-link back. That round-trip
loses people right after they finished setting up on the web. This is THE funnel lever to fix.

**Planned solution:**
1. **Web:** after signup/sign-in on offerloop.ai, mint a short-lived **Firebase custom auth
   token** (or one-time code) and redirect to a universal link, e.g.
   `https://offerloop.ai/app/finish-signin?token=…`.
2. **That page deep-links back into the app** with the token (universal link / `ai.offerloop.app://`).
3. **App:** handle the deep link (`expo-linking`), `signInWithCustomToken(token)`, drop into
   `/(tabs)`. No email round-trip.

**Requirements:** a `offerloop.ai/app/finish-signin` page (website dep — currently the gap),
Apple associated-domains entitlement + `apple-app-site-association` (native config → **needs an
EAS rebuild**), a backend endpoint to mint the custom token, and a deep-link handler in the app.
**Effort:** medium; spans web + native + backend.

**Interim:** keep email magic-link. Note it only fully works once the `finish-signin` page exists
(that page is the current missing piece).

---

## Web features that encourage the app ("web drives app")

- The web can/should nudge users to the app for the **mobile-native moments**: swipe-to-draft,
  push notifications on replies, on-the-go follow-ups. No Apple constraint on web→app promotion.
- **Keep entitlements unified** (web purchase → app reflects) so there's never an app-vs-web
  value gap that makes one feel worse than the other.

---

## Quick checklist (when this doc is triggered)

- Adding a purchase/CTA in the app? → default **web reflect-only**; **never in-app Stripe**; IAP
  only for **consumable top-ups** if data-justified; subscriptions always web.
- Linking app → web for billing? → **neutral "manage on web"** link, not a paywall, not "buy now."
- Changing sign-in? → follow the **deep-link handoff plan**; don't add Google (triggers Apple SIWA).
- Web feature to drive app adoption? → fine; keep **entitlements unified**.
