# Offerloop Mobile — App Store Submission Checklist

Status as of 2026-06-29. iOS first (bundle id `ai.offerloop.app`). TestFlight before public submit.

---

## Fixed in code/config (done)

- [x] **API base URL for real builds** — DECIDED 2026-07-09 (submission night): the
  mobile API lives on the staging service, NOT offerloop.ai (origin/main has no
  /api/mobile/* routes — a prod build pointed there is a dead app). Production
  channel now hardcodes https://offerloop-staging.onrender.com in src/api/config.ts
  (same env-inlining rationale as the preview hardcode) and eas.json production env
  matches. Graduation path: pinned prod/mobile Render service + an OTA swapping the
  constant. IMPLICATION: staging is code-frozen for risky pushes while Apple reviews.
- [x] **Splash screen** — was the default Expo white-on-white logo (effectively blank); now uses
  the Offerloop mark (`icon.png`, 1024²) at imageWidth 200 on a white bg.
- [x] App icon: `icon.png` is 1024×1024, opaque, branded. Good.
- [x] No photo-library permission needed (resume upload is web-only; no image picker in the app).
- [x] Camera usage string present (LinkedIn QR at career fairs).
- [x] `ITSAppUsesNonExemptEncryption: false` set (skips the export-compliance prompt).
- [x] Mocks OFF in prod (`USE_MOCKS` only true via explicit flag), dev "force onboarding" OFF in
  prod, no committed `.env`.

---

## CRITICAL — voice audio privacy copy (added 2026-07-09, voice overhaul P2)

**Items 1 + 4 DONE 2026-07-09** (the honest-copy build): `app.json`
speechRecognitionPermission rewritten ("Transcription starts on your device;
short clips may also be sent securely to Offerloop's servers for a more
accurate read. Never used for ads, never sold."), the Meet Scout overlay's
"on-device only" line fixed, and the AUDIO_UPLOAD_ALLOWLIST founder gate
REMOVED. Old builds with the on-device-only promise can never receive the
gate-lifted JS: the app.json change moved the runtime fingerprint, and OTAs
only target their own runtime — install the new build to cross over.

Still manual, in App Store Connect / web, before submission:

2. **App Store privacy nutrition label:** declare Audio Data → App
   Functionality (not tracking). Also PostHog analytics went live 2026-07-09
   (identifiers + usage data → Analytics, not tracking).
3. **Privacy policy:** add voice-clip transcription (processed, not retained).

## CRITICAL — reviewer login (the real gate)

The app is **email magic-link only** (no password, no Google — by design, per PAYMENTS-AND-AUTH.md).
Apple reviewers MUST be able to sign in. Two things to nail before submit:

1. **Verify in-app magic-link sign-in completes end-to-end in a real (non-Expo-Go) build.** Per
   PAYMENTS-AND-AUTH.md the web→app `finish-signin` deep-link page is "the current missing piece" —
   confirm the pure in-app "Sign in → email → tap link → back in app" round-trip actually works in a
   production build. If it doesn't, NO ONE (reviewer or user) can sign in.
2. **Give reviewers a way in.** Options:
   - Provide a demo account in App Store Connect → App Review Information, AND give reviewers the
     credentials to an email inbox you control so they can retrieve the magic link, OR
   - Add a temporary review-only password path / test account, OR
   - Ship the auth deep-link handoff (bigger; see PAYMENTS-AND-AUTH.md).

This connects to the deferred **auth deep-link handoff** — the cleanest long-term fix.

---

## Process tasks (App Store Connect / EAS — you + cofounders)

- [ ] App Store Connect app record with bundle id `ai.offerloop.app`.
- [ ] **Privacy policy URL** — `https://offerloop.ai/privacy` (exists).
- [ ] **Privacy nutrition labels** — declare what's collected: email, name, resume/documents,
      usage data, identifiers (Firebase uid), and Gmail data (if linked). Map each to a use.
- [ ] **Screenshots** — 6.7" iPhone required (also 6.5"). Show swipe→draft, inbox, meeting prep.
- [ ] App description, keywords, support URL, marketing URL, category, age rating questionnaire.
- [ ] **Push (APNs)** — `expo-notifications` is configured; add an APNs key to EAS credentials if
      shipping push at launch.
- [ ] Build + submit: `eas build -p ios --profile production` then `eas submit -p ios`
      (TestFlight internal test first).

---

## Optional / nice-to-have

- [x] PostHog analytics LIVE 2026-07-09 (app.json extra.posthogKey, host =
      data.offerloop.ai reverse proxy, unified with web). Declare in nutrition
      labels: identifiers + usage data -> Analytics (not tracking). Mark founder
      uids as internal users in PostHog before launch metrics.
- [ ] Gmail/Google data use: if Gmail is linked in-app, App Review may ask about Google API
      Services User Data Policy compliance — have the justification ready (drafts/sends on the
      user's behalf, disclosed).
