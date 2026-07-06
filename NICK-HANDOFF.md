# Offerloop Mobile + Backend — Nick's Full-Stack Boot-Up

You're running the whole stack on your own Mac: backend, Metro, and the app on your phone. Once it's up you're independent of Rylan's machine.

## The shape of it

```
[your phone: the app]  --Wi-Fi-->  [your Mac: Flask backend on :5001]  --> Firestore / OpenAI / PDL / ...
[your Mac: Metro] ----------------/
```

Two repos:
- **`Final_offerloop`** = the backend (Flask). Branch **`swap/onboarding-on-main`** (the `/api/mobile/*` routes live ONLY here, not `main`).
- **`offerloop-mobile`** = the Expo app.

Three pieces run: the backend, Metro (Expo dev server), and the app on your phone. Your phone and your Mac just need to be on the same Wi-Fi (any network, doesn't have to be Rylan's).

---

## Part 0 — Get the secrets from Rylan (out of band)

These are gitignored and can NOT go through git. Have Rylan **AirDrop** you three files:

1. `.env`  (repo root)
2. `backend/.env`  (this is the one actually loaded)
3. `backend/creds/firebase-credentials.json`  (Firebase service account)

Heads up: same creds = your backend writes to the **same production Firestore** Rylan's does. That's expected (it's how we dogfood), just don't be surprised that data is shared.

---

## Part 1 — Backend on your Mac

```bash
git clone git@github.com:deenabandi004-byte/Final_offerloop.git
cd Final_offerloop
git checkout swap/onboarding-on-main

# drop the AirDropped files into place:
#   .env                                  -> repo root
#   backend/.env                          -> backend/
#   firebase-credentials.json             -> backend/creds/   (mkdir -p backend/creds first)
```

**Fix the creds path** (it points at Rylan's home dir). In BOTH `.env` and `backend/.env`, change:
```
GOOGLE_APPLICATION_CREDENTIALS=/Users/rylanbohnett/Downloads/Final_offerloop/backend/creds/firebase-credentials.json
```
to your own absolute path, e.g.:
```
GOOGLE_APPLICATION_CREDENTIALS=/Users/<you>/<...>/Final_offerloop/backend/creds/firebase-credentials.json
```

Then:
```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# DEV server (NOT gunicorn — it OOMs on the auto-apply Playwright run):
python main.py
```
Serves on `0.0.0.0:5001`. Leave it running and watch the logs — this is the "backend at work" you wanted (you'll see PDL lookups, Hunter, email-gen, etc. fire on each swipe).

Grab your Mac's IP for the app:
```bash
ipconfig getifaddr en0   # try en1 if on Ethernet
```

---

## Part 2 — Mobile app on your Mac

```bash
git clone git@github.com:deenabandi004-byte/offerloop-mobile.git
cd offerloop-mobile
npm install
```

Run Metro pointed at **your own** backend (use the IP from Part 1):
```bash
EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:5001 \
EXPO_PUBLIC_DEV_EMAIL=deena.bandi004@gmail.com \
EXPO_PUBLIC_DEV_PASSWORD=TempPass123 \
npx expo start
```
(The DEV_EMAIL/PASSWORD lines just prefill the sign-in card. Host is origin only, no `/api`.)

---

## Part 3 — On your phone

1. Install **Expo Go** (App Store).
2. Scan the QR from Part 2 (iOS: Camera app).
3. Hit **DEV SIGN-IN**, use the creds below. Edits hot-reload.

Expo Go covers feed/swipe, Inbox, Network, Loops, Scout, Meeting Prep, onboarding. Push notifications + the in-app camera scanner need a full EAS dev build (optional, ask Rylan if you want it).

---

## Sign-in

DEV SIGN-IN card on the sign-in screen:
- **Email:** `deena.bandi004@gmail.com`  (shared governing account, already populated)
- **Password:** `TempPass123`

---

## What to test / watch

- **Core loop:** Feed → swipe right → watch the backend log do the find + draft → a draft lands in Inbox.
- **Inbox / Network / Loops / Profile / Meeting Prep / Scout.**
- **Onboarding:** Profile → Settings → Replay onboarding (dev only).

## Gotchas

- **Right branch:** backend MUST be on `swap/onboarding-on-main` or every `/api/mobile/*` call 404s.
- **Creds path:** if the backend won't boot or Firebase errors, you forgot to repoint `GOOGLE_APPLICATION_CREDENTIALS` to your machine.
- **Same Wi-Fi** for your phone and your Mac, or the LAN IP won't resolve. (Corporate Wi-Fi blocks this sometimes — fallback `npx expo start --tunnel`.)
- **Don't commit secrets or your IP.** `.env`, `backend/.env`, the creds file, and `app.json`'s `apiBaseUrl` all stay local. Use the env var for the IP.
- **Typecheck before pushing:** `npx tsc --noEmit`. Backend tests: `cd backend && pytest tests/`.
