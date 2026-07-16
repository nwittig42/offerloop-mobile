# App Store Connect — submission checklist (anti-rejection)

Everything to fill in **App Store Connect** before hitting Submit. Two sections
that most often cause an instant reject: the **App Privacy** nutrition label
(must match what the binary actually does) and the **App Review Information**
(reviewer can't get past sign-in → automatic reject).

Last verified: 2026-07-15. App account under test: offerloop0@gmail.com.

---

## 1. App Privacy — nutrition label

Path: App Store Connect → your app → **App Privacy** → Edit.

**Global answer first:** Do you or your third-party partners use data for
**tracking** (linking to third-party data for ads, or sharing with a data
broker)? → **NO.** PostHog is first-party (our own project, keyed on the
Firebase uid), there are no ad SDKs, no IDFA, no data brokers. Answering No here
means you do **not** need an App Tracking Transparency prompt. Do not add one.

Then declare these data types. For every one below: **Linked to identity = Yes**
(all keyed to the signed-in user), **Used for tracking = No**.

| Data type (Apple's category) | Collect? | Purpose to check | Why |
|---|---|---|---|
| **Contact Info → Email Address** | Yes | App Functionality | Firebase email-link sign-in |
| **Contact Info → Name** | Yes | App Functionality | Profile / onboarding |
| **User Content → Other User Content** | Yes | App Functionality, Product Personalization | Resume, target companies, job/location preferences |
| **Identifiers → User ID** | Yes | App Functionality, Analytics | Firebase uid (also PostHog distinct_id) |
| **Usage Data → Product Interaction** | Yes | Analytics, Product Personalization | PostHog events (swipes, screen views) |
| **Audio Data** | Yes | App Functionality | Scout voice → on-device speech; clip may be sent for server transcription |

Notes / judgment calls:
- **Audio Data is declared even though server upload is currently founder-gated.**
  The binary requests microphone + speech-recognition permission and the upload
  path exists, and the web privacy policy already discloses voice capture — so
  declaring it keeps the label consistent with the binary and the policy.
  Under-declaring (collecting something you didn't list) is the reject risk;
  declaring it as App-Functionality-only, not tracking, is the safe side.
- **Do NOT** check any purpose containing "Third-Party Advertising" or
  "Developer's Advertising / Marketing" for any row — we don't do it, and
  checking it would trigger an ATT requirement we'd then fail.
- Diagnostics/Crash data: only declare if a crash SDK ships in the binary. As of
  this build there's no Sentry/Crashlytics in the app → leave Diagnostics off.

**Privacy Policy URL** field (App Privacy page): `https://offerloop.ai/privacy`
(the voice-clip + analytics disclosure is live there as of 2026-07-15).

---

## 2. App Review Information

Path: App Store Connect → the version → **App Review Information**.

### Sign-in required → ON. Demo account:

```
Username:  applereview@offerloop.ai
Password:  OfferloopReview!2026
```

### Notes (paste into the "Notes" box verbatim):

```
SIGN-IN (important):
This build uses passwordless email-link sign-in by default. For your review we
added a password path on the demo account ONLY. On the sign-in screen, TYPE the
demo email (applereview@offerloop.ai) first — a password field then appears
below the email field. Enter the password above and tap Sign In. The password
field is hidden until the demo email is entered; this is expected.

WHAT THE APP DOES:
Offerloop helps college students find and apply to jobs and network into them.
Core flow to test:
1. Feed tab — swipe right on a job card to generate a personalized outreach
   draft (the app's hero action). Swipe left to skip.
2. Tap a company name on any card to open the company page (overview + open
   roles). Try "Stripe" — it lists live open roles.
3. Scout tab — ask a question by text (voice is optional; if you allow the mic
   permission you can also speak). Example: "software jobs in New York".
4. Milestones / Profile — progress and account settings, including Delete
   Account and links to Privacy Policy and Terms.

PAYMENTS:
The app sells nothing in-app. There are no in-app purchases and no upgrade
buttons. The credits screen is read-only status only. Account/billing is managed
on our website, and the app does not link out to it to purchase anything.

VOICE / MICROPHONE:
Speech is processed on-device (Apple Speech). Microphone permission is optional —
the app is fully usable with typed input if you decline it.
```

### Contact info
- First/Last name, phone, email: a real address you monitor during review
  (Apple emails here if they have questions — a fast reply can save a rejection).

---

## 3. Pre-submit quick gate (2 min)

- [ ] Nutrition label saved & "Published" state matches the table above
- [ ] Privacy Policy URL resolves: https://offerloop.ai/privacy (200, has voice + analytics language)
- [ ] Demo account signs in via the type-email-then-password flow ON THE BUILD YOU'RE SUBMITTING
- [ ] No in-app purchase products attached (there should be zero)
- [ ] Screenshots uploaded (7-panel set, 1320×2868)
- [ ] Support URL + Marketing URL set (offerloop.ai)
- [ ] Age rating questionnaire completed
- [ ] Export compliance: uses standard encryption (HTTPS) only → typically "No"
      to the "qualify for exemption" custom-crypto question, i.e. exempt

Backend note: the search-by-company 500 was fixed and deployed to
staging/mobile-field on 2026-07-15 (commit f3851d17) — company pages return
roles. This is server-side and applies to the current binary with no rebuild.
