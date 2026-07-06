# Offerloop Mobile — App Store Submission Checklist

Status as of 2026-06-29. iOS first (bundle id `ai.offerloop.app`). TestFlight before public submit.

---

## Fixed in code/config (done)

- [x] **API base URL for real builds** — `eas.json` preview + production now set
  `EXPO_PUBLIC_API_BASE_URL=https://offerloop.ai`. Previously prod fell through to
  `app.json extra.apiBaseUrl` = a **LAN IP** (`192.168.4.62:5001`), which would be dead +
  cleartext for reviewers. (Dev / `expo start` still uses the LAN IP from app.json.)
- [x] **Splash screen** — was the default Expo white-on-white logo (effectively blank); now uses
  the Offerloop mark (`icon.png`, 1024²) at imageWidth 200 on a white bg.
- [x] App icon: `icon.png` is 1024×1024, opaque, branded. Good.
- [x] No photo-library permission needed (resume upload is web-only; no image picker in the app).
- [x] Camera usage string present (LinkedIn QR at career fairs).
- [x] `ITSAppUsesNonExemptEncryption: false` set (skips the export-compliance prompt).
- [x] Mocks OFF in prod (`USE_MOCKS` only true via explicit flag), dev "force onboarding" OFF in
  prod, no committed `.env`.

---

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

- [ ] PostHog analytics is OFF (`extra.posthogKey` empty). To get launch-day analytics, set the
      key via `EXPO_PUBLIC_POSTHOG_KEY` in the eas production env.
- [ ] Gmail/Google data use: if Gmail is linked in-app, App Review may ask about Google API
      Services User Data Policy compliance — have the justification ready (drafts/sends on the
      user's behalf, disclosed).
