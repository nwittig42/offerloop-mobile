# Offerloop Mobile — Setup & Testing (handoff)

Get the Expo app running on your machine + your phone for user testing. ~20 min.

## How it's wired

Two repos, talking over your local network:

```
[your phone: Expo app]  ──LAN──►  [your Mac: Flask backend on :5001]  ──►  Firestore / OpenAI / PDL / etc.
   offerloop-mobile                 Final_offerloop (branch: swap/onboarding-on-main)
```

- The mobile **API lives on the `swap/onboarding-on-main` branch** of `Final_offerloop`, NOT on `main`. The `/api/mobile/*` routes don't exist on `main`.
- The app points at **your machine's LAN IP**, so your phone and Mac must be on the **same Wi-Fi**.

## Prereqs

- Node 18+ (you have nvm), npm
- Python 3.x (for the backend; the venv targets 3.14 but 3.11+ is fine)
- Your existing `Final_offerloop` `.env` (same keys you already have — OpenAI, Firebase creds, PDL, etc.)
- **Expo Go** on your phone (App Store / Play Store) for the quick path, OR an EAS dev build for full fidelity (see Step 4)

---

## 1. Backend (the API the app calls)

```bash
cd ~/path/to/Final_offerloop
git fetch origin
git checkout swap/onboarding-on-main
git pull origin swap/onboarding-on-main

# venv + deps (first time only)
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# make sure your .env (with all the keys) is at the repo root, then run the
# DEV server (NOT gunicorn — gunicorn OOMs on the auto-apply Playwright run):
python main.py
```

It serves on `0.0.0.0:5001`. Leave it running. Grab your LAN IP — you'll need it next:

```bash
ipconfig getifaddr en0   # Mac Wi-Fi (en0); try en1 if on Ethernet
```

## 2. Mobile app

```bash
git clone git@github.com:deenabandi004-byte/offerloop-mobile.git
cd offerloop-mobile
npm install
```

## 3. Point the app at YOUR backend

The app defaults to a hardcoded IP that isn't yours. Override it — easiest is an env var when you start Metro (no file edit, nothing to accidentally commit):

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:5001 npx expo start
```

(Replace `<your-LAN-IP>` with the `ipconfig getifaddr en0` value, e.g. `http://192.168.1.42:5001`. Host = origin only, no `/api`.)

## 4. Run it on your phone

**Quick path — Expo Go (5 min, no build):**
- Run the Step 3 command, then scan the QR with **Expo Go** (iOS: point the Camera app at it; Android: Expo Go's scanner).
- Works for almost everything: feed/swipe, Inbox, Network, Loops, Scout, Meeting Prep, onboarding.
- **Known limits in Expo Go:** the QR scanner shows a "needs a rebuild" screen (camera is a native module), push notifications won't register, and the email magic-link won't deep-link back. Use the **dev sign-in** below — it sidesteps the magic link.

**Full-fidelity path — EAS dev build (camera + push work):**
```bash
npm i -g eas-cli   # if you don't have it
eas login
eas build --profile development --platform android   # Android = simple APK, install + open
# or: --platform ios  (needs your device registered for ad-hoc/internal distribution)
```
Install the build it gives you, then run `npx expo start --dev-client` (with the same `EXPO_PUBLIC_API_BASE_URL` prefix) and open from the dev build.

**Simulator (Mac, no phone):** `npx expo run:ios` — heavy first build (compiles CocoaPods); fine if you've got time.

## 5. Sign in (dev account)

The magic link needs the full dev build, so for testing use the **DEV SIGN-IN** box on the sign-in screen (only shows in `__DEV__`). Either type the test creds, or prefill them:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:5001 \
EXPO_PUBLIC_DEV_EMAIL=<test-email> \
EXPO_PUBLIC_DEV_PASSWORD=<test-password> \
npx expo start
```

(Use the same test account as the auto-apply testing — ask Rylan for the password, or set one with `backend/scripts/set_dev_password.py`.)

## 6. What to test

- **Onboarding:** Profile → Settings → **Replay onboarding** (dev only) replays the 7-step flow on demand. New accounts get it automatically.
- **Core loop:** Feed → swipe right → draft lands in Inbox.
- **Network:** Contacts / Meeting prep / Applied tabs.
- **Scout:** ask it something → tap an action chip (it navigates).
- **Meeting Prep:** paste a LinkedIn URL → the free preview confirms the person.
- **Loops, Profile, Credits.**

## Gotchas

- **Same Wi-Fi.** Phone and Mac must share a network for the LAN IP to resolve. If they can't (corporate Wi-Fi, etc.), use `npx expo start --tunnel` (slower, routes through Expo).
- **Backend must be running** and reachable at the `EXPO_PUBLIC_API_BASE_URL`, or every screen shows an error state.
- **Right branch.** The `/api/mobile/*` routes are only on `swap/onboarding-on-main`. On `main` the app will 404 everything.
- **Don't commit the IP.** Use the env var (Step 3) rather than editing `app.json`'s `apiBaseUrl`, so you don't push your local IP.
- **Typecheck:** `npx tsc --noEmit` (or `npm run typecheck`). There are no frontend unit tests.
</content>
