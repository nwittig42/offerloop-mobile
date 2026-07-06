# Handoff — "Use it in the wild" build (untethered, cellular, filmable)

**Goal:** Get Offerloop running as a real standalone app on Rylan's iPhone that works
**over cellular with no laptop and no shared WiFi** — so he can walk up to people,
demo swipe→draft outreach, and film content (incl. Meta Glasses POV). This is a
**field/demo build, NOT an App Store submission.** Do not do submission work here.

Keep fast iteration alive: Rylan still wants to make quick tweaks like he does in dev.

Written 2026-07-01 after auditing both repos. Facts below are verified against the
tree, not assumed.

## PROGRESS UPDATE 2026-07-02 (session continued setup)

DONE by Claude:
- Apple Developer account: CONFIRMED ACTIVE (verified June — Rylan has App Store
  Connect Full Access). No enrollment wait.
- **Backend branch pushed:** origin's `swap/onboarding-on-main` turned out to be stale
  (missing ALL mobile commits — they were 25 local-only) and diverged (origin 22 ahead).
  Fix: pushed local HEAD (fa6afb5c) to a NEW branch **`origin/staging/mobile-field`**.
  Render staging must deploy THAT branch, not swap/onboarding-on-main.
- **OTA configured:** `eas update:configure` ran — `updates.url` now in app.json,
  channels (development/preview/production) added to eas.json.
- **Preview profile now points at `https://offerloop-staging.onrender.com`**
  (committed to mobile repo, 744db44). The Render service MUST be named
  `offerloop-staging` or this URL must be updated to match.
- Mobile tree typechecks clean (tsc exit 0) including uncommitted WIP.

## STAGING IS LIVE (2026-07-02 ~3:04 PM PT)

`https://offerloop-staging.onrender.com` — all /api/mobile/* respond 401 unauth (correct),
root serves the SPA. Render service `offerloop-staging` (srv-d93d0fcvikkc73a1igmg),
Starter tier, branch `staging/mobile-field`, auto-deploy on commit.

**The deploy took 5 fixes — ALL of these are dashboard-only settings a future staging
service will need again (they live outside the repo):**
1. Start Command was Render's autofill → `PYTHONPATH=/opt/render/project/src/backend
   gunicorn backend.wsgi:app --bind 0.0.0.0:$PORT --workers 4` (the PYTHONPATH prefix is
   REQUIRED — app code uses absolute `from app....` imports).
2. Build Command was Render's autofill (`pip install -r requirements.txt`) which hit the
   STALE 32-line requirements.txt at REPO ROOT (missing pdfplumber/playwright/anthropic).
   Must be `./render-build.sh` (installs backend/requirements.txt + builds frontend).
   Consider deleting the root requirements.txt someday — it's a trap.
3. Env var `PYTHON_VERSION=3.13.4` (Render default 3.14 breaks old pins; branch was
   deploy-fixed for 3.13 — see greenlet/playwright commits).
4. Env var `FLASK_SECRET=<random hex>` (required when FLASK_ENV=production).
5. Env vars from local .env (18 keys, FLASK_ENV=production, GOOGLE_APPLICATION_CREDENTIALS=
   /etc/secrets/firebase-service-account.json) + Secret File `firebase-service-account.json`
   (content = backend/creds/firebase-credentials.json).
Non-fatal warnings in logs: PRERENDER_TOKEN unset, Firestore rate limiter falls back to
in-memory. Staging shares PRODUCTION Firestore — intentional (real account, Gmail connected).

EAS preview build STARTED 2026-07-02: build id 2d9a7635-db64-4d7b-aefd-8fc514132e51
(Apple creds + iPhone UDID reused from June dev build, no prompts).

REMAINING:
1. Install the finished build on the iPhone (install link/QR on the expo.dev build page).
2. Smoke test on cellular (WiFi off): sign-in → feed → swipe → draft → Inbox → send.
3. Speed audit below (watch Render cold starts — Starter tier shouldn't sleep).
4. Iterate via `eas update --branch preview --message "..."` (OTA, no rebuild).

---

## What is already true (verified — don't re-litigate)

- **EAS is configured.** `eas.json` has a `preview` profile: `distribution: "internal"`
  with `EXPO_PUBLIC_API_BASE_URL` baked in. Internal distribution = **no App Review**.
- **API URL resolution is correct for release builds.** `src/api/config.ts` order is:
  `EXPO_PUBLIC_API_BASE_URL` → (dev only) Metro LAN IP → `extra.apiBaseUrl` → localhost.
  In a release build `__DEV__` is false, so the baked-in env var wins and the stale
  `172.16.x.x` in `app.json` `extra.apiBaseUrl` is **never reached**. (Still worth
  cleaning up, but it is not a functional blocker.)
- **Project is registered:** `extra.eas.projectId = c2498b56-...`, `owner: rylanbohnett`,
  bundle id `ai.offerloop.app`. `runtimeVersion.policy = "fingerprint"`.

## ⛔ THE blocker — fix this FIRST or every call 404s

The `preview`/`production` EAS profiles point at **`https://offerloop.ai`**, but the
**mobile API is not deployed to production.**

- `backend/app/routes/mobile.py` (blueprint `mobile_bp`, prefix `/api/mobile`) and its
  `wsgi.py` registration exist **only on branch `swap/onboarding-on-main`** of the
  `Final_offerloop` backend repo.
- That branch is **117 commits ahead of `main`** and is **not to be merged to main**
  (standing rule — it's onboarding-swap WIP).
- Render deploys `main`. Verified: `main` has no `mobile.py` and does not register the
  blueprint. Live `curl https://offerloop.ai/api/mobile/me` → redirect, not the route.

**=> A cellular build pointed at `offerloop.ai` 404s on every mobile endpoint.**

### Fix (recommended): separate staging backend

1. Create a **new Render service** (or other host with a public HTTPS URL) that deploys
   the `swap/onboarding-on-main` branch of `Final_offerloop`.
   - Run the **dev server, not gunicorn** if the auto-apply Playwright path OOMs under
     gunicorn (see backend `run-dev.sh` / `SETUP.md`). Confirm the mobile routes boot.
   - Bring the same `.env` keys (Firebase creds, OpenAI, PDL, etc.).
2. Verify `https://<staging-host>/api/mobile/me` responds (401 without auth is fine — it
   means the route exists; a redirect/404 means it doesn't).
3. Point the field build at it: in `eas.json`, set the `preview` profile's
   `EXPO_PUBLIC_API_BASE_URL` to `https://<staging-host>` (replacing `https://offerloop.ai`).

This keeps production untouched and never merges WIP to main.

**Alternative (later, cleaner):** cherry-pick just `mobile.py` + its new service/model
deps + the `wsgi.py` registration onto `main` and deploy. More dependency untangling;
do not attempt as part of getting the field build out.

---

## Runbook — get the untethered build on the phone

Prereqs: **Apple Developer Program membership** ($99/yr, enrolled & active — this is the
one hard external gate; enrollment can take a day or two). `eas-cli` installed,
`eas login` done.

1. **Point `preview` at the staging backend** (see blocker fix above). Commit `eas.json`.
2. **Configure OTA (one-time):**
   ```
   eas update:configure
   ```
   This adds `updates.url` to `app.json`. Required for pushing quick changes to the
   field build without rebuilding. (Currently missing — confirmed.)
3. **Build the internal field build:**
   ```
   eas build --profile preview --platform ios
   ```
   EAS will prompt to **register Rylan's device** (UDID) for internal distribution —
   accept. When done, it gives an install link / QR. Install on the iPhone.
4. **Smoke test on cellular:** turn WiFi OFF on the phone. Confirm sign-in works and the
   Feed → swipe-right → draft (Inbox) → open contact → send flow all hit the staging
   backend. If anything 404s, the backend URL is wrong (recheck step 1).
5. **Iterate in the field via OTA:**
   ```
   eas update --branch preview --message "tweak X"
   ```
   The installed build pulls it on next cold launch, over cellular. No rebuild for
   JS/TS/asset changes. **Native changes** (new native module, new permission, icon,
   plugin) require a fresh `eas build`.

Keep desk dev exactly as-is: `expo start` + Expo Go/dev client still hot-reloads and
auto-follows the LAN IP. The field build and dev mode coexist.

---

## Task: speed audit (Rylan asked for this)

Measure real-world responsiveness of the field build vs. dev, so he knows what the
in-the-wild demo will feel like.

- **App/JS side:** expect the release build to be *faster* than Expo Go (Hermes
  bytecode, minified, no Metro bridge). Note the subjective swipe/animation feel.
- **Network side — measure these against the staging backend over cellular:**
  - Time-to-first-byte / total latency for the hot `/api/mobile/*` paths actually used
    in the demo: feed/matches load, `outreach/<id>/send`, `company/<name>`, `me`.
  - **Watch for Render cold starts** — if the staging service sleeps, the first request
    after idle can take many seconds. If that hurts the demo, use a keep-warm ping or a
    non-sleeping Render tier for filming days.
  - Report p50/p95 per endpoint and flag anything > ~1.5s that would break the
    "draft in seconds" story.

---

## Explicitly OUT of scope for this handoff (do NOT do)

- App Store submission, `eas submit`, App Review notes.
- The Guideline 3.1.1 external-purchase-link change in `src/app/credits.tsx`.
- The reviewer magic-link / demo-account sign-in setup.
  These live in `SHIP-testflight.md` and are submission-only. A sideloaded internal
  build carried by the founder does not need any of them.

## Reference docs already in this repo
- `SHIP-testflight.md` — full submission runbook + the two rejection blockers.
- `SETUP.md` — local backend + on-device dev testing (LAN path).
- `PAYMENTS-AND-AUTH.md` — web-is-source-of-truth, auth model.
- `eas.json`, `app.json`, `src/api/config.ts` — the config this handoff references.
