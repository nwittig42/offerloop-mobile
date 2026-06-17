# Handoff — Mobile app ↔ local backend wiring (2026-06-16)

## Goal
Get the Expo iOS app (`~/offerloop-mobile`) to show **real data from the local Flask
backend** (`~/Downloads/Final_offerloop/backend`) instead of mock fixtures, on a
**physical iPhone via Expo Go**.

## Original symptoms
- App showed fixtures: "Sample University", 480 credits, "Sample Bank & Trust".
- Dev sign-in failed with `Firebase: Error (auth/operation-not-allowed)`.

## Root causes found (in order) and how each was fixed
1. **Firebase Email/Password provider was disabled** → dev sign-in (email+password)
   couldn't work. Fixed by enabling it on project `offerloop-native` (Identity
   Toolkit Admin API; equivalent to Firebase Console → Authentication → Sign-in
   method → Email/Password → Enable). Dev password set via:
   `cd ~/Downloads/Final_offerloop/backend && ./venv/bin/python scripts/set_dev_password.py rylanbohnett@gmail.com 'YourTempPass123'`
   (must use the venv python — system python lacks `python-dotenv`).

2. **The mock data is NOT an error fallback.** In `src/store/app.tsx`:
   `const profile = meQuery.data ?? MOCK_PROFILE`. Any time `/api/mobile/me` is
   pending OR errored, `meQuery.data` is undefined → the whole app renders
   `MOCK_PROFILE`. So "fixtures showing" == "the real call isn't succeeding."
   (`USE_MOCKS` is a separate hard offline switch and is OFF — not involved here.)

3. **The running backend was STALE** — started before `backend/app/routes/mobile.py`
   existed, so `/api/mobile/me` returned **404**. Killing the old process + a fresh
   start registered the route (now **401** unauthed = live).

4. **`wsgi.py` can't be launched with `python3 wsgi.py`.** It mixes relative
   (`from .app...`) and absolute (`from app...`) imports. It only boots when run
   **from the repo root**, as `backend.wsgi:app`, with **`PYTHONPATH=backend`**,
   under gunicorn. Captured in a launcher script (below).

5. **Phone `localhost` = the phone, not the Mac.** `app.json` `extra.apiBaseUrl`
   was `http://localhost:5001`. Changed to the Mac's LAN IP `http://192.168.4.62:5001`
   so both the phone and the simulator reach the backend. (Mac firewall is OFF, so
   nothing blocks the phone; IP verified reachable at 401.)

## Files changed
**Mobile (`~/offerloop-mobile`):**
- `src/store/app.tsx` — added a `connection` state (`status: 'ok'|'loading'|'error'`,
  `usingSampleData`, `retry`) derived from the `me` React Query; exposed via store.
- `src/components/ConnectionBanner.tsx` — NEW. Global banner: amber "Connecting…" on
  first load, red "Can't reach Offerloop — showing sample data · Retry" on error.
  Makes the silent `?? MOCK_PROFILE` fallback visible. (This is a slice of WS4.)
- `src/app/_layout.tsx` — mounted `<ConnectionBanner />` next to `<Toast />`.
- `app.json` — `extra.apiBaseUrl`: `localhost` → `192.168.4.62:5001`.
  ⚠️ **Do NOT commit** — personal LAN IP, dev-only. Revert to `localhost` when done
  testing on a physical device (simulator works with either).

**Backend (`~/Downloads/Final_offerloop`):**
- `backend/run-dev.sh` — NEW launcher. Runs gunicorn from repo root with
  `PYTHONPATH=backend`, binds `0.0.0.0:5001`, `--reload`. Use this, not `python3 wsgi.py`.
- `backend/scripts/set_dev_password.py` — already existed (untracked); used as above.

**Remote config (not a file):**
- Firebase project `offerloop-native`: Email/Password sign-in provider ENABLED.
- Dev password set for `rylanbohnett@gmail.com`.

## How to run (two terminals, same Wi-Fi)
```bash
# Terminal 1 — backend
~/Downloads/Final_offerloop/backend/run-dev.sh
# wait for: Listening at: http://0.0.0.0:5001  (no worker traceback)

# Terminal 2 — mobile (Metro)
cd ~/offerloop-mobile && npx expo start -c
# scan the QR with the iPhone Camera → "Open in Expo Go"
```
Phone must be on the **same Wi-Fi** as the Mac (not cellular). Expo Go installed.

## Verification
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/mobile/me` → **401**
  (was 404 before the restart; 401 = route live, just needs auth).
- `curl ... http://192.168.4.62:5001/api/mobile/me` → **401** (reachable over LAN).
- In-app: red banner gone + real account on Profile tab = fully wired.
  Red banner present = phone can't reach Mac (wrong network / IP changed).

## Known follow-ups / gotchas
- **`app.json` IP is network-specific.** If Wi-Fi changes, the Mac IP changes —
  update that line (get current IP: `ipconfig getifaddr en0`). Long-term: auto-detect
  or use the `EXPO_PUBLIC_API_BASE_URL` env var instead of hardcoding.
- **CLAUDE.md is wrong**: its Quick Start says `python3 wsgi.py` for the backend —
  that does not work (see cause #4). Should point to `run-dev.sh`.
- **ConnectionBanner is only a slice of WS4** — feed/inbox still fall back to mocks
  silently in places; full loading/error states per screen are still TODO.
- Backend dev noise is harmless: WeasyPrint (PDF) unavailable, Sentry not installed,
  PRERENDER_TOKEN unset — none affect the mobile flow.

---

## EAS / dev-client build setup (2026-06-16)

Moving off Expo Go toward a real **development build** on a physical iPhone (needed
for push tokens + the path to TestFlight/App Store).

### Done (no TTY required)
- **EAS project created & linked**: `@rylanbohnett/offerloop-mobile`
  → https://expo.dev/accounts/rylanbohnett/projects/offerloop-mobile
- **`app.json` `extra.eas.projectId`** written: `c2498b56-5d1c-4d17-bea7-b319b137541e`
  (was empty `""`; this is what unblocks `expo-notifications` push tokens).
- `expo-dev-client@~6.0.21` confirmed already in `package.json`.
- `eas.json` `development` profile already correct: `developmentClient: true`,
  `distribution: internal`, `ios.simulator: false` (targets physical device).

### Gotcha that caused the earlier failures
The first attempts ran `npx eas-cli init/device:create/build` from the **monorepo
root** (`~/Downloads/Final_offerloop`, package name `vite_react_shadcn_ts`) instead
of `~/offerloop-mobile`. That's why `eas init` tried to create
`@rylanbohnett/vite_react_shadcn_ts` and `expo-dev-client` looked "not installed."
**Always `cd ~/offerloop-mobile` first.**

### Remaining steps — MUST be run in a real terminal (interactive: Apple 2FA + phone QR)
```bash
cd ~/offerloop-mobile
eas device:create     # choose "website" → open the URL/QR ON the iPhone, install profile
eas build --profile development --platform ios   # Apple ID login + cert/profile gen, then cloud build
```
After the build, install it on the phone and run `npx expo start --dev-client`
(instead of Expo Go).

### Prerequisites / blockers
- **Apple Developer Program membership ($99/yr)** is required for `device:create`
  and internal-distribution iOS builds on a physical device. If not enrolled yet,
  this is the gate.
- iPhone on hand to scan the QR and install the provisioning profile.
- These steps can't be done from the Claude Code session — they need a TTY for
  Apple 2FA prompts and a physical device for the QR scan ("stdin is not readable").

### projectId is committed-safe (unlike the LAN IP)
Unlike the `apiBaseUrl` LAN IP (do NOT commit), the `projectId` is meant to live in
`app.json` and is safe to commit.

---

## 2026-06-17 — Feed + Profile data wiring (on-device dogfood round 2)

**If you're another terminal: read this before touching `feed.ts`, `JobCard.tsx`,
`profile.tsx`, `me.ts`, or `backend/app/routes/mobile.py`.**

### Done this session (committed both repos)
- **Feed cards were starved.** `feed.ts` mapJob read guessed keys that don't exist
  on the backend `FeedJob` shape. Now maps the real keys: `employer_logo`,
  `salary_display`, `remote`→"Remote" (+ employment `type`),
  `structured.experience_level`, `structured.requirements`. Description now comes
  from `structured.responsibilities` (in the feed payload) shown as bullets; jobs
  without it lazy-fetch `/api/jobs/{id}/description` (description_raw). Dropped the
  `FIXTURE_QUALS` mock fallback.
- **Profile resume/LinkedIn un-mocked.** `me()` now returns `resumeExperiences`
  (from `resumeParsed.experience`) and `linkedinHighlights` (from
  `linkedinResumeParsed`: objective + skills + extracurriculars). `gradYear`
  auto-extracts from `resumeParsed.education.graduation`; school already falls back
  to `resumeParsed.education.university`; a parsed resume counts as "on file";
  `about` falls back to the parsed objective. `profile.tsx` renders real data with
  honest empty states; removed `MOCK_RESUME_EXPERIENCES` / `MOCK_LINKEDIN_HIGHLIGHTS`.

### ⚠️ Action required
- **Restart the local backend** (gunicorn has no `--reload`) so the `me()` changes
  take effect. Mobile JS changes hot-reload on their own.

### Known caveat
- Rylan's own account has **no resume parse and no LinkedIn enrichment**, so grad
  year / LinkedIn view / resume experiences are correctly wired but **invisible on
  his profile** until he uploads a resume / runs enrichment on web. Verify against
  an account that has `resumeParsed`, or wire onboarding capture next.

---

## 2026-06-17 — Push system + Notifications + Network (round 3)

**Read this if you're a fresh terminal. Most-current state lives in the auto-memory
`project_mobile_phase3_wiring`; this section is the human-readable mirror.**

### ⚠️ FIRST: state of the working tree
Mobile (`~/offerloop-mobile`) is **committed & clean**. Backend has **UNCOMMITTED**
changes (same working tree, so they're on disk and live — just not committed yet):
- `M backend/app/routes/gmail_webhook.py` — reply-push hook
- `M backend/app/services/loop_jobs.py` — loop-run push hook
- `?? backend/app/services/push_service.py` — NEW Expo push service
- `?? backend/tests/test_push_service.py` — NEW (5 tests)
- (also earlier-infra still uncommitted: `gmail_client.py`, `wsgi.py`, `run-dev.sh`,
  `scripts/set_dev_password.py`)
Commit these when ready. The notification routes in `mobile.py` + their tests are
ALREADY committed (bundled with the round-2 resume commit).

### ⚠️ SECOND: restart the backend
`me()` (resume/grad/linkedin) AND the new `/api/mobile/notifications` routes need a
gunicorn restart to take effect if your server predates them. `run-dev.sh` uses
`--reload`, so if you launched with it you're fine; otherwise restart.

### Push notifications — DONE (both paths live)
- **Service:** `backend/app/services/push_service.py` — `register_device` (stores
  Expo token at `users/{uid}/devices/{sha1(token)}`), `send_push` (Expo Push API,
  chunks 100, prunes `DeviceNotRegistered`, best-effort never raises).
- **Route:** `POST /api/mobile/device` in `mobile.py` (validates Expo token).
- **Hooks (idempotent):** reply → `gmail_webhook.py` fires `send_push` only after
  `_append_reply_notification` returns non-None (deduped vs Pub/Sub redelivery),
  `data.url=/outreach/{id}`. Loop-run → `loop_jobs.py` after
  `write_loop_run_notification` (one summary item/cycle), `data.url=/loops`.
- **Mobile:** `src/notifications/push.ts` (permission + `getExpoPushTokenAsync` →
  `registerDevice`), `src/hooks/usePushNotifications.ts` (mounted in `_layout`,
  routes taps + cold-start via `data.url`), store `setNotificationsEnabled(true)`
  does real OS permission + token register, launch effect re-registers for
  already-granted users. `app.json` has `expo-notifications` plugin + the real
  `eas.projectId` (so tokens mint).
- **VERIFY ON DEVICE (not yet done):** enable notifications in-app → trigger a real
  reply to a sent outreach → push should land + tap-through to the thread.

### Notifications bell — DONE (committed)
`GET /api/mobile/notifications` reads `users/{uid}/notifications/outbox` (same doc
replies + loops + push write to) → mobile `NotificationItem`s; `POST .../read`
zeroes counters. Store `notificationsQuery` (60s poll) seeds the bell + screen;
badge is real. Closes the loop: push → bell/list → tap reply → conversation.

### Network tab — DONE (no new endpoint)
`trackerRows` is now **derived** from the already-polled `outreach` array
(`outreachToTrackerRows` in `store/app.tsx`) — Network "Contacts" == Inbox people,
kept in lockstep. `toggleContactPin` toggles the underlying outreach pin (one
source of truth). `MOCK_TRACKER_ROWS` no longer used.

### OTA / expo-updates — STAGED (one command left)
`expo-updates@~29.0.18` installed + `app.json` `runtimeVersion: {policy:fingerprint}`.
`updates.url` not set yet — run **`eas update:configure`** once (needs projectId,
now present) to finish. Dev build doesn't use OTA (Metro serves JS); this is for
the future preview/TestFlight build. After it's set: `eas update --branch development
-m "msg"` ships JS-only changes in seconds, no rebuild/review.

### WS6 — dev build is LIVE on device
iOS development build runs on Rylan's iPhone, hot-reloads from Metro over LAN.
EAS auto-managed all Apple credentials incl. APNs push key. (Build-break fix that
mattered: removed unused `@expo/ui` canary that broke the native Swift compile.)

### What's still mock (by design / deferred)
- `loopActivity` (MOCK_LOOP_ACTIVITY) — only remaining real-data candidate; check
  for a per-loop activity endpoint before wiring (lower value — loop-run *pushes*
  already surface "what your Loop did").
- Scout, milestone theme rewards, file upload — deferred for v1.

### NEXT (suggested order)
1. **On-device:** verify reply-push + loop-run push actually arrive (the one
   unverified piece of WS5).
2. `eas update:configure` to finish OTA.
3. TestFlight build (`eas build --profile preview`) + App Store review notes
   explaining the **web-first** monetization (no IAP, manage-on-web link) so review
   doesn't reject.
4. The batched polish pass (cosmetic nitpicks, done on-device).
5. Optional: onboarding capture (resume upload + LinkedIn enrichment) so accounts
   populate the now-wired profile fields.

## 2026-06-17 (cont.) — Company page wired

- **New endpoint** `GET /api/mobile/company/{name}` (mobile.py): firm-intel
  pipeline (Perplexity website discovery → Firecrawl `extract_company_profile`),
  mapped to `CompanyInfo` (about/industry/size/hq; **news deferred to v1**).
  Cached globally in Firestore `companyProfiles/{slug}` for 30 days — the live
  call is slow (~5–15s) and costs Perplexity+Firecrawl credits. Honest-empty +
  only caches real hits.
- **`company/[name].tsx`** now uses React Query (`qk.company`) instead of
  `MOCK_COMPANY_INFO`. Loading state + per-field chips + empty state.
- **Coordination:** this terminal is the sole driver of the mobile↔backend wiring
  for now — do NOT run the phase build-out in another terminal against the same
  files (`mobile.py`, `store/app.tsx`, `feed.ts`, `profile.tsx`) concurrently.
- Still needs the **backend restart** for all the `me()` + `/company` routes.
