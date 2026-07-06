# Offerloop — App Store Connect Listing (paste-ready)

Draft 2026-06-29. Voice: human, student-to-student, product woven in naturally. No invented
stats or testimonials. Edit freely — this is a starting point, not gospel.

---

## Names & identifiers

- **App Name** (max 30 chars): `Offerloop` (9). Alt if you want a hook in the name:
  `Offerloop: Land the Job` (23).
- **Subtitle** (max 30 chars) — pick one:
  - `Network into your dream job` (27) ← recommended
  - `Cold outreach that lands` (24)
  - `Your job-search wingman` (23)
- **Bundle ID:** `ai.offerloop.app`
- **Primary category:** Business · **Secondary:** Productivity
  (Education is a defensible secondary given the student base — your call.)
- **Age rating:** 4+ (no objectionable content).

---

## Keywords (max 100 chars, comma-separated, NO spaces)

```
networking,internship,recruiting,cold email,coffee chat,career,job search,alumni,resume,referral
```
(99 chars. Don't repeat words already in the app name/subtitle — Apple indexes those separately.)

---

## Promotional text (max 170 chars — editable anytime without a new build)

```
Swipe a job, get a personalized intro email drafted to the right person in seconds. Build your network on the go and never let a warm lead go cold.
```

---

## Description (max 4000 chars)

```
Breaking into consulting, banking, or tech comes down to who you reach and how fast. Offerloop turns that grind into something you can do from your phone between classes.

Swipe to draft.
See a job you want? Swipe right. Offerloop finds the right people on that team, then writes a personalized intro email using your resume and their background. You review it and send from your own Gmail. No blank-page paralysis, no generic "I'd love to pick your brain" templates.

Everything in one inbox.
Your outreach lives in a single thread view: who you've messaged, who's replied, whose turn it is. Reply from your phone the moment someone gets back to you, because a warm lead goes cold fast.

Walk into every coffee chat ready.
Before a call or a career fair, Offerloop preps you on the person: common ground, what to ask, the company angle. You show up sounding like you did your homework, because you did.

Track the whole pipeline.
See the companies you've reached into, the conversations in flight, and the applications you've sent, without a spreadsheet.

Built for students breaking in.
Offerloop is made for college students recruiting into competitive roles. Your account, resume, and plan live on offerloop.ai and sync straight to the app.

Sign in with your Offerloop account to get started.
```

(Trim/expand to taste. If you want to add real proof later, only use numbers you can stand
behind — see the "no fake numbers/social proof" rule.)

---

## What's New (version 1.0.0)

```
First release. Swipe jobs to draft personalized outreach, manage every conversation in one inbox, and prep for coffee chats from your phone.
```

---

## URLs

- **Support URL:** `https://offerloop.ai/contact-us`
- **Marketing URL:** `https://offerloop.ai`
- **Privacy Policy URL:** `https://offerloop.ai/privacy`

---

## Privacy "nutrition labels" (App Privacy section) — derived from the code

Declare these data types. Everything below is **Linked to the user** (tied to their account) and
used for **App Functionality** unless noted. None is used for tracking across other companies'
apps, so answer "No" to App Tracking Transparency.

| Data type | Specifics | Purpose | Linked? |
|---|---|---|---|
| Contact Info | Email address, Name | App Functionality (account, outreach as you) | Yes |
| User Content | Resume/other documents, emails you draft & send, contacts you save | App Functionality | Yes |
| Identifiers | User ID (Firebase uid); device push token | App Functionality (auth, reply notifications) | Yes |
| Usage Data | Product interaction | Analytics | Yes — **only if you turn PostHog on** (key is empty today; if it stays empty at launch, you can omit this row) |

Notes for the questionnaire:
- **Gmail data:** if a user links Gmail, the app reads/creates/sends on their behalf. That's
  "User Content" (emails) for App Functionality. Be ready for a review question on Google API
  Services User Data Policy — justification: drafting/sending outreach the user explicitly
  initiates, disclosed in-app.
- **No** third-party advertising, **No** data brokering, **No** tracking.
- Diagnostics/crash: none shipped in the app (Sentry is backend-only, dev). Leave unchecked
  unless you add a mobile crash reporter.

---

## App Review Information (the notes box in ASC)

- **Sign-in required:** YES. The app reads a real Offerloop account.
- **Demo account:** PROVIDE ONE. Because sign-in is email magic-link (no password), reviewers
  need the login email AND access to that email's inbox to click the link. See
  `APP-STORE-SUBMISSION.md` → "CRITICAL — reviewer login." This must be solved before submit.
- **Notes draft:**
  ```
  Offerloop helps college students network into jobs. Sign in with the provided account.
  From the feed, swipe right on a job to generate a personalized outreach draft (this calls our
  AI backend and may take a few seconds). The draft appears in the Inbox; open it to review.
  Meeting Prep generates research on a contact before a coffee chat. The account, resume, and
  plan are managed on offerloop.ai and reflected in the app; the app does not sell anything.
  ```
