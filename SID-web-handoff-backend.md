# Sid — backend for the app→web upgrade handoff

Your slice of `SPEC-app-web-upgrade-handoff.md`. **Two endpoints + one Firestore
collection.** Self-contained — you can build and test these independently; the only
external handshake is that the web `/checkout` page (Nick) calls your exchange endpoint.

**Status:** approved, v1.1 (after the App Store approval). Not urgent, not blocking.

---

## Context (one paragraph)

From inside the iOS app, a signed-in user taps "upgrade." We hand them off to the web
checkout **already signed in** (no re-onboarding, no email round-trip), they pay on
Stripe, and the app reflects the new tier/credits on return. All payment stays on the
web (App Store compliance). Your job is the secure **app→web auth handoff**: mint a
short-lived code in the app, exchange it for a Firebase sign-in on the web.

---

## What to build

### 1. `POST /api/mobile/web-handoff`
Called by the **app** with the user's Firebase ID token (Bearer).
- Verify the ID token → get `uid`.
- Mint a **one-time opaque code** (random, ≥128 bits).
- Write `handoffCodes/{code}` = `{ uid, exp: now + 60s, used: false }`.
- Return `{ "url": "https://offerloop.ai/checkout?code=<code>" }`
  (optionally append `&plan=<pro|elite|topup>` if the app passes an intent).

### 2. `POST /api/web/handoff-exchange`
Called by the **web** `/checkout` page with `{ code }`.
- Look up `handoffCodes/{code}`. Reject if missing, expired (`exp < now`), or `used`.
- Mark `used: true` (atomically — single-use).
- Return `{ "token": <firebase_custom_token> }` via
  `admin.auth().create_custom_token(uid)`. Web calls `signInWithCustomToken(token)`.

### 3. Firestore `handoffCodes/{code}`
- Fields: `uid` (string), `exp` (timestamp), `used` (bool).
- **60-second TTL**, single-use. Add a TTL policy / cleanup so stale codes don't pile up.

---

## Hard rules (security — do not skip)

- **The raw Firebase custom token is returned ONLY from the server-side exchange, over
  HTTPS — never placed in a URL.** The URL carries only the opaque one-time code.
- Code is **single-use** (burn `used` on first exchange) and **expires in 60s**.
- **Rate-limit** `handoff-exchange`; reject unknown/expired/used codes with a generic error.
- The code is a short-lived nonce, not PII — consistent with the "no sensitive data in
  URL params" rule.

---

## Not yours (so you're not blocked on it)

- The **web `/checkout` route** (exchanges your code, signs in, renders plans, launches
  Stripe Checkout) is **Nick's**. It's the piece that calls your `handoff-exchange`.
- The **app-side upgrade button + deep-link return** is the **app** team.
- **Stripe** already exists (webhook updates Firestore → app reflects via `/api/mobile/me`).
  No new Stripe products; this reuses the web catalog. Nothing new for you there.

---

## Definition of done (your part)

- [ ] `POST /api/mobile/web-handoff` — verifies ID token, mints + stores code, returns URL.
- [ ] `POST /api/web/handoff-exchange` — validates + burns code, returns custom token.
- [ ] `handoffCodes` collection with 60s TTL + single-use enforcement + cleanup.
- [ ] Exchange endpoint rate-limited; expired/used/unknown codes rejected.

Full context (flow diagram, app + web parts): `SPEC-app-web-upgrade-handoff.md` §1–§4.
