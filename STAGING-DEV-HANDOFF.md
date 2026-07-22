# Staging-dev handoff — Offerloop app (STAGING channel ONLY)

**Mission:** implement app changes to the **staging** build only, ship them via
`eas update --branch preview`, and verify on the "Offerloop Staging" app on Rylan's + Nick's
phones. The production app (**Build 11**) is in **App Store review** — this session must not
touch it in any way.

Repo: `~/offerloop-mobile` (branch `main`). App code in `src/`.

---

## HARD RULES (read first — these are non-negotiable)

- ✅ **Ship ONLY with `eas update --branch preview`.**
- ⛔ **NEVER `eas update --branch production`.** Build 11 is in review — a production OTA can
  change what the reviewer sees and get it rejected.
- ⛔ **NEVER `eas submit`, and never a production build.**
- ✅ **Pure JS/TS changes only** (those are OTA-eligible). If a change needs **native** — a new
  native module, iOS permission, entitlement, or background mode — **STOP and flag it.** It needs
  a *staging rebuild* (`eas build --profile preview`), which is a separate step and needs Rylan's
  Apple login. Do not try to sneak native behavior through OTA.
- ✅ The staging app talks to the **staging backend**: `https://offerloop-staging.onrender.com`.
  Any endpoint you call must be live there.
- ⛔ **Do not touch:** the production channel, the App Store submission, the auth / finish-signin
  sign-in flow (owned separately, see `AUTH-SIGNIN-FIX-HANDOFF.md`), or the variant config
  (`app.config.js` / `eas.json` — already set up, leave alone).

---

## Setup context (already done — just so you understand it)

- Staging build: bundle `ai.offerloop.app.preview`, name **"Offerloop Staging"**, channel
  **`preview`**, backend `offerloop-staging.onrender.com`. Installed side-by-side with production
  on Rylan's + Nick's phones. They sign in via the **dev password panel** (Elite test accounts).
- **Deploy a change:** `eas update --branch preview --message "<what changed>"` → the staging app
  pulls it on next launch.

---

## Work source — the specs already developed (this is your backlog)

Read these two docs in this repo; they define what to build:

### 1. `SPEC-app-web-upgrade-handoff.md` §9 — Post-approval OTA backlog (pure JS, do these first)
- **Outreach email templates** — a page where the user describes what a template should do, saves
  it, and reuses it across drafts (mirrors the website's template flow). The app currently has no
  way to create/manage outreach templates. **Pure RN UI + existing draft backend. START HERE.**
- **Broaden the resume/attachment slot** — accept any PDF and/or add a second attachment slot.
  The file picker already exists for resume upload; PDFs need no extra iOS permission. Pure JS.

### 2. `SPEC-app-web-upgrade-handoff.md` §2 (app-side) + `SID-web-handoff-backend.md` — the upgrade CTA
- Credits-screen **"upgrade" entry** → `POST /api/mobile/web-handoff` → `Linking.openURL(webCheckoutUrl)`.
  The **outbound** part is pure JS (OTA-ok). The **auto-return** deep-link needs an
  `associated-domains` entitlement (native → staging rebuild) — build the JS outbound first, flag
  the native return.
- **PREREQ: ✅ UNBLOCKED (2026-07-21).** Sid's handoff endpoints are **live and verified
  end-to-end on the staging backend** (`offerloop-staging.onrender.com`):
  `/api/mobile/web-handoff` (mints code → returns checkout URL) and `/api/web/handoff-exchange`
  (burns code → returns Firebase custom token, single-use enforced). So you can wire the app-side
  upgrade CTA now.
  - The app calls `POST /api/mobile/web-handoff` with the Firebase ID token → gets back
    `{ url: "https://www.offerloop.ai/checkout?code=<code>" }` → `Linking.openURL(url)`.
  - **Note the host: the checkout URL is `www.offerloop.ai`** (offerloop.ai 301-redirects to www).
    Keep this consistent with the auth finish-signin work so the two web flows don't diverge on
    host — the `/checkout` page (Nick's) must serve on the canonical host.
  - The **auto-return deep-link** back into the app still needs `associated-domains` (native →
    staging rebuild). Build the outbound (openURL) part first via OTA; flag the native return.

---

## Workflow per change

1. Make the JS/TS change in `src/`.
2. Sanity-check locally if you can (`npx expo start`, simulator).
3. `eas update --branch preview --message "<what changed>"`.
4. Rylan/Nick relaunch "Offerloop Staging" → verify on device.
5. Vetted staging changes get promoted to production **later, after App Store approval** — NOT in
   this session.

---

## Suggested order

1. **Outreach email templates** (§9) — highest-value gap, pure JS, no new backend dependency.
2. **Broaden attachments** (§9) — small, pure JS.
3. **Upgrade CTA** (§2) — only after confirming the staging backend has the handoff endpoints.

Keep each change small and shippable so it can be OTA'd and tested on the phones independently.
