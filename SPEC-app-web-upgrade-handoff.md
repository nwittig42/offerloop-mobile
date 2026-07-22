# Spec — App → Web upgrade & credit purchase (auth handoff)

**Status:** approved to build (Rylan + cofounders, 2026-07-16). Target: **v1.1**, after the
clean first App Store approval. Do NOT hold the tonight submission for this.

**Goal:** From inside the app, a signed-in user can reach the web checkout **already signed in
(no re-onboarding, no email round-trip)**, upgrade to Pro/Elite or buy credit top-ups on Stripe,
and come back to the app with the new entitlement already reflected.

This implements the "Auth deep-link handoff" from `PAYMENTS-AND-AUTH.md` and revises guardrail
#3 (see §7). It keeps the app compliant: **all payment happens on the web in Safari; the app
sells nothing and captures no payment** (guideline 3.1.1 safe). External purchase links are
permitted for US users post-2025 Epic injunction.

---

## 1. Flow (app → web → app)

1. **App:** signed-in user taps the upgrade entry (from the Credits screen / Profile).
2. **App → backend:** `POST /api/mobile/web-handoff` with the user's Firebase ID token.
3. **Backend:** verify the ID token → mint a **one-time handoff code** (random, opaque),
   store `{ code → uid, exp: now+60s, used: false }` in Firestore (`handoffCodes/{code}`).
   Return `{ url }` = `https://offerloop.ai/checkout?code=<code>&plan=<optional>`.
4. **App:** `Linking.openURL(url)` → opens Safari (external browser, NOT an in-app webview).
5. **Web `/checkout`:** reads `code` → `POST /api/web/handoff-exchange` → backend validates
   (exists, not expired, not used), marks used, returns a **Firebase custom token** →
   web `signInWithCustomToken()`. User is now signed in as the same uid.
   **This route is auth-gated but NOT onboarding-gated** — it must bypass the onboarding
   redirect entirely (this is the fix for "will it force onboarding": no).
6. **Web:** show plans + credit packs (reuse existing pricing components) → Stripe Checkout
   (Apple Pay + cards; already supported). `success_url` → `/checkout/success`,
   `cancel_url` → `/checkout`.
7. **Stripe webhook** (existing) updates Firestore tier/credits. **Web = source of truth.**
8. **Return to app:** `/checkout/success` shows "Return to Offerloop" →
   deep link `ai.offerloop.app://` (or universal link). App refetches `GET /api/mobile/me`
   → new tier/credits already reflected. (Real-time Firestore listener also picks it up.)

---

## 2. Components to build (by owner)

**Backend (Sid) — ✅ DONE, PR #156 (dormant until web + app land, safe to merge anytime):**
- `POST /api/mobile/web-handoff` — verifies ID token → mints one-time **192-bit** code →
  stores `handoffCodes/{code}` (60s TTL) → returns checkout URL. ✅
- `POST /api/web/handoff-exchange` — **atomically burns** the code via a Firestore
  transaction (closes the double-exchange race) → returns Firebase custom token. ✅
- `handoffCodes` TTL on `expires_at` **active in prod** (verified via gcloud). Single-use
  enforced by transaction. Exchange rate-limited **20/min per IP**. Token never in a URL.
  9 tests green covering the rejection paths. ✅

**Web (Nick):**
- New route **`/checkout`** — auth-gated, **onboarding-gate exempt**. Exchanges the code, signs
  in, renders plans + credit packs, launches Stripe Checkout. *(This route is the current
  missing piece the doc flags.)*
- `/checkout/success` + `/checkout` (cancel) pages, with a "Return to app" deep link button.
- Ensure Stripe Checkout has Apple Pay enabled + the offerloop.ai domain verified (one-time
  Stripe dashboard step).

**App (Rylan / app dev):**
- Upgrade entry point on the Credits screen (`src/app/credits.tsx`) + optionally Profile.
- Call `/api/mobile/web-handoff`, then `Linking.openURL(url)`.
- Deep-link handler (`expo-linking`) for the return trip → route to `/(tabs)` + refetch `/me`.

---

## 3. Security (do not skip)

- **One-time code in the URL, never a raw Firebase token.** The custom token is returned only
  from the server-side exchange, over HTTPS, never in a query string.
- Code: opaque random (≥128 bits), **60s TTL**, **single-use** (mark `used` on first exchange).
- Exchange endpoint rate-limited; reject expired/used/unknown codes.
- Aligns with the standing rule: no sensitive data in URL params — the code is a short-lived
  nonce, not PII.

---

## 4. Native vs JS (what needs a rebuild)

- **Outbound** (open web signed-in, pay): `Linking.openURL` + a fetch = **pure JS**, no native
  module. Could even ship the entry button/flow without a native change.
- **Polished return-to-app** via **universal link** needs Apple **associated-domains**
  entitlement + `apple-app-site-association` on offerloop.ai → **native config → EAS rebuild.**
- Interim without the rebuild: return via custom scheme `ai.offerloop.app://` or the user
  switches back manually; entitlement still reflects on next `/me`. Ship polish in the same
  rebuild as any other native v1.1 change.

---

## 5. Stripe / catalog

- Subscriptions: existing Stripe prices — Pro `price_1ScLXrERY2WrVHp1bYgdMAu4`,
  Elite `price_1ScLcfERY2WrVHp1c5rcONJ3`. **No pricing mismatch** — Sid verified live Stripe
  2026-07-17: Pro charges **$14.99**, Elite **$34.99**, both match the displayed price. The old
  "$14.99 display vs $9.99 charge" CLAUDE.md note was stale and has been removed (PR #156).
- Credit top-ups: derive packs from `CREDIT_COSTS` (never hardcode a price).
- No new Stripe products needed — this reuses the web catalog.

---

## 6. Compliance checklist (approval-critical)

- [ ] Payment happens ONLY on web, in the external browser (no in-app webview capturing payment).
- [ ] The app itself sells nothing and shows no in-app price entry / native checkout.
- [ ] Link framing: functional upgrade entry is US-permitted post-Epic; keep the copy measured
      ("View plans" / "Upgrade on the web"), avoid a hard "Buy now" slammed onto a scare-free
      paywall if you want to stay safe outside the US too.
- [ ] Do NOT add Google/third-party sign-in to the app (would trigger Apple Sign in with Apple).
      The custom-token handoff is SIWA-safe.

---

## 7. Doc revision (guardrail #3)

`PAYMENTS-AND-AUTH.md` guardrail #3 previously said "neutral 'manage on web' link only, never
point at a paywall." As of 2026-07-16 the team is intentionally revising this to allow a
**functional upgrade/credit-purchase entry** that hands off to web checkout (US-permitted post-
Epic). Subscriptions + top-ups remain **web Stripe only**; the app still sells nothing. Update
the doc's guardrail #3 and "Current state" to reflect this once the flow ships.

---

## 8. Effort / sequencing

Medium; spans backend + web + app. **v1.1 fast-follow**, not tonight. The web `/checkout` route
is the critical-path dependency (and the piece that's been missing). Outbound flow can land
without a rebuild; bundle the universal-link return polish with the next native build.

---

## 9. Post-approval OTA backlog (separate from payments — same release window)

These are **pure JS/backend feature work**, so they ship via **EAS Update (OTA), no App Store
re-review** — build after the first approval and push within days. (This OTA freedom is for
genuine features within the app's purpose; it does NOT cover the payment/handoff surface above,
which still needs a reviewed build.)

- **Outreach email templates (approved to build).** A page where the user describes what they
  want a template to do, saves it, and reuses it across drafts — mirrors the web template flow.
  Pure RN UI + backend. Currently the app has no way to create/manage outreach templates; this
  closes that gap. OTA-eligible.
- **Broaden the resume/attachment slot (approved to build).** Today's upload is framed as a
  resume; broaden it to accept any PDF and/or add a second attachment slot (file picker already
  in the app for resume upload; PDFs need no extra iOS permission). OTA-eligible.
- **Auto-return-to-app polish** for the web checkout handoff (§4) — the ONE item here that needs
  native associated-domains config, so it rides the next native build, not OTA.
