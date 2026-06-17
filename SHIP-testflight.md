# Shipping to TestFlight / App Store — runbook + blockers

Status as of 2026-06-17. Core data layer is real (feed, swipe, inbox, send, reply,
loops, meeting-prep, notifications, network, profile, company). Push system
committed. What's left is verification + the App Store submission.

---

## ⛔ Two blockers to settle BEFORE you submit (likely rejections)

### 1. External purchase link in the Credits screen (Apple Guideline 3.1.1)
`src/app/credits.tsx` opens `https://offerloop.ai/pricing` via `Linking.openURL`.
Apple prohibits linking to outside purchase flows for digital goods **unless** you
either:
- **(a)** are granted the **StoreKit External Purchase Link Entitlement** (US) and
  show Apple's required system disclosure sheet before the link, **or**
- **(b)** qualify under the **"multiplatform service" reader exception (3.1.3(b))**
  — the account can be *used* in-app if purchased elsewhere, but you **still may
  not link to or mention** where/how to buy, **or**
- **(c)** remove the tappable link and make it **plain, non-actionable text**
  (e.g. "Manage your subscription at offerloop.ai" with no button/URL).

**Lowest-friction path for v1:** option (c) — drop the `openURL` button, keep the
read-only balance + plain text. Ship, then pursue the entitlement later.
**Decision needed from Rylan + cofounders.** (One-line code change once decided.)

### 2. Reviewer can't sign in (email magic-link only)
Auth is `sendSignInLinkToEmail` / `signInWithEmailLink`. The dev
`signInWithPassword` path is **stripped from release builds**, so an Apple reviewer
has no way in unless they can receive the magic-link email. Options:
- **(a)** Provide a **demo account** whose magic links route to an inbox you can
  share, and put step-by-step sign-in in the review notes (below), **or**
- **(b)** Keep a **reviewer-only password sign-in** behind a build flag for the
  review build only, **or**
- **(c)** Set up the **universal link** so tapping the emailed link opens the app,
  and give the reviewer a real mailbox they can open on the test device.

Without one of these, **guaranteed rejection** (reviewer blocked at login).

---

## Interactive runbook (run these yourself — they need a TTY / your phone)

1. **Restart the local backend** so `me()`, `/api/mobile/notifications`, and
   `/api/mobile/company` take effect (gunicorn has no `--reload`; `run-dev.sh`
   does). Mobile JS hot-reloads on its own.
2. **Verify push on-device** (the one WS5 piece that needs your phone):
   - In the app: Profile → enable notifications (registers the Expo token via
     `POST /api/mobile/device`).
   - Reply path: have someone reply to one of your sent threads → expect a
     "{contact} replied" push → tap → opens `/outreach/{id}`.
   - Loop path: let a Loop cycle complete → expect "{loop} ran" → tap → `/loops`.
   - Needs the real `eas.projectId` (already set) so token mint works in the build.
3. **Finish OTA:** `cd ~/offerloop-mobile && eas update:configure` (fills
   `updates.url`). One-time. After this, JS/TS ships over-the-air via `eas update`.
4. **Production build:** `eas build --profile production --platform ios`.
5. **Submit:** `eas submit --profile production` (or upload via App Store Connect),
   then add the reviewer notes below in App Store Connect → "Notes for Review".

---

## Notes for App Store Review (paste into App Store Connect)

> Offerloop is a free companion app for an existing web service (offerloop.ai) that
> helps college students network into jobs — find contacts, draft outreach, track
> replies, and run "Loops" that surface contacts automatically.
>
> SIGN IN: The app uses passwordless email sign-in. To test, use this demo account:
>   • Email: <DEMO_EMAIL — fill in>
>   • [If using a reviewer password build: Password: <DEMO_PASSWORD>]
>   • Enter the email on the welcome screen, tap "Send link", then open the link we
>     send to that inbox: <how the reviewer accesses it — fill in>.
>
> SUBSCRIPTIONS: The app sells nothing through it. It is a free companion to a
> multiplatform service; any plan/credits are purchased and managed on our website
> and simply reflected (read-only) in the app. There are no in-app purchases.
>
> PERMISSIONS: Push notifications are used only to alert the user when a networking
> contact replies or when a background "Loop" finds new results. Optional.
>
> TEST FLOW: After signing in, the Feed shows real job matches — swipe right to
> draft an outreach email (Inbox tab), open a contact to send it, or tap a company
> to view its profile. Everything is live against our production backend.

(Fill the <…> placeholders before submitting. Do NOT invent reviewer credentials —
use a real provisioned demo account.)
