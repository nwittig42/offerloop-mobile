# Build 12 resubmission (App Review rejection fixes)

## STATUS UPDATE 2026-07-24: Build 13 was ALSO rejected (round two). BUILD 14
is the current fix, uploaded to App Store Connect and processing.

Round-two rejection (reviewed on 1.0 build 13): (a) 3.1.1 again, reviewer
photographed the Credits screen (Elite chip + View plans on the web card) and
requires IAP parity for externally purchased content, the US link-out
provision notwithstanding; (b) 2.3.10, the App Store listing screenshots use
mockups with non-iOS status bars.

Decision (Rylan, 2026-07-24): ship a tier-silent build now (fastest path to
live), build In-App Purchase properly as v1.1 which restores the upgrade
surface, adds a native paywall and top-up packs, and opens international.

Build 14 (commit 0ee2a7b on build-12-review-fixes) removes every rendered
purchase signal: Credits screen plan chip + View-plans card + Safari footnote
gone (read-only usage meter), both PRO/ELITE profile badges gone, tier-colored
feed pill border neutralized, "Pro/Elite feature" and "unlock Elite free" and
"Free to start" copy reworded. No tier names, prices, or purchase paths render
anywhere. upgrade.ts kept in-tree for v1.1, unimported.

Remaining checklist: demo account downgrade to free (script ready, Rylan runs
it), real-iOS screenshots replace the mockups (2.3.10), swap build 13 -> 14 on
the version page, paste the round-two reply (emphasizes IAP is actively
planned), resubmit.

Historical note follows (round one, superseded):

The rejected submission: iOS App 1.0 (Build 11), submission ID
5cb35457-532c-40bb-922e-61e5b05c5868, rejected July 23 on Guideline 4 (Design)
and Guideline 3.1.1 (Payments).

---

## 1. What Apple rejected, in plain language

**Guideline 4 (Design).** The welcome screen's "Create your account" button
opened Safari (offerloop.ai signup). Apple requires account creation to happen
inside the app. Sign-in itself was already in-app and fine. Their note about
account deletion is already satisfied: Build 11 ships in-app Delete Account
under Profile > Settings.

**Guideline 3.1.1 (Payments).** The app references a subscription purchased
on the website (plan badge, the signup-on-the-web copy) but offered no way to
purchase. Apple's own rejection text supplies the fix: apps on the United
States storefront may link out to the default browser for payment. That is
exactly the "View plans on the web" handoff we already built and verified on
staging. No In-App Purchase is required, and no 30 percent cut.

---

## 2. What Build 12 contains

Built from the EXACT Build 11 code (commit cf8db3f) plus only the review
fixes. None of the in-flight staging work (Scout apply-some, templates,
referral polish, feed changes) rides along; all of that ships later as OTA
updates once we are approved.

Where: git worktree at `~/offerloop-build12`, branch `build-12-review-fixes`,
commit `eceb740`. Typecheck clean (`npx tsc --noEmit`).

**Verified end to end against the real backend (2026-07-23):** a script walked
the exact reviewer path with a throwaway account. Create account with email +
password: works (uid minted). `GET /api/mobile/me`: 200, auto-provisioned
plan Free with 300 credits. `POST /api/mobile/account/delete`: 200, and the
account can no longer sign in afterwards. So registration, provisioning, and
the deletion requirement Apple cited are all proven working, not assumed.

Changes:

1. **New screen `src/app/(auth)/create-account.tsx`.** In-app registration:
   email + password (6+ chars), show/hide password, friendly error copy
   (already-in-use, invalid email, weak password, offline), Terms of Service
   and Privacy Policy links, "I already have an account" path to sign-in.
   Creation is instant (no email round-trip a reviewer could get stuck on).
   New accounts are auto-provisioned free-tier by the backend on first /me
   call (verified in `backend/app/routes/mobile.py: _ensure_user_doc`), then
   land in the existing first-run onboarding.
2. **`src/auth/AuthProvider.tsx`**: adds `createAccountWithPassword` (Firebase
   `createUserWithEmailAndPassword`, same project as the website, so the
   account works on offerloop.ai too).
3. **`src/app/(auth)/welcome.tsx`**: "Create your account" is now the primary
   button and routes to the new in-app screen. The Safari link and the
   "set up on offerloop.ai" copy are gone.
4. **`src/app/(auth)/sign-in.tsx`**: adds a "Sign in with a password instead"
   reveal for everyone (accounts created in-app have passwords). Magic link
   stays the default. Reviewer-email auto-reveal unchanged. Copy no longer
   mentions signing up on the website.
5. **`src/app/credits.tsx` + new `src/api/endpoints/upgrade.ts`**: the web
   checkout handoff ("View plans on the web" mints a one-time code and opens
   www.offerloop.ai/checkout in Safari, already signed in; balance refetches
   on return). Endpoint verified live on the backend the app points at
   (offerloop-staging.onrender.com, HTTP 401 unauthenticated = present), and
   www.offerloop.ai/checkout returns 200. The app still shows no prices and
   sells nothing in-app.

---

## 3. Rylan's checklist (in order)

### Step 1: unblock EAS builds. DONE (billing added 2026-07-23)

### Step 2: build and submit. DONE (2026-07-23, 2:09 PM)

Build 13 (1.0.0, commit eceb740) built on EAS and uploaded to App Store
Connect via auto-submit. Nothing to run here anymore.

### Step 3: App Store Connect (10 minutes)

1. **Set availability to United States only** (App > Pricing and
   Availability > country list). The 3.1.1 link-out provision is specific to
   the US storefront; this makes our compliance airtight. We can revisit
   other countries later with IAP if we ever want them.
2. Wait for Build 13 to finish processing (Apple emails when ready, usually
   under an hour), then open the rejected 1.0 version page, **remove Build 11
   and select Build 13**.
3. In App Review notes, keep the demo account (applereview@offerloop.ai +
   password) and add one line: "Account creation is now fully in-app from the
   welcome screen; feel free to register any test account."
4. **Reply to the rejection message** with the text in section 4 below.
5. **Resubmit for review.** Resubmissions typically get reviewed within
   24 to 48 hours.

Optional but recommended before resubmitting: install Build 13 from
TestFlight on your phone and smoke-test the two new flows (create an account
with a throwaway email; open Credits > View plans on the web).

### Step 4 (after approval)

Tell the sessions the app is approved. Then the accumulated staging work
ships to production users via normal OTA updates, and the temporary
"never touch production" rules in the handoff docs get lifted.

---

## 4. Reply to paste into the App Store Connect message thread

> Hello,
>
> Thank you for the detailed review. We have addressed both issues in a new
> build (1.0, build 13).
>
> Guideline 4 (Design): Account creation now happens entirely inside the app.
> The welcome screen's "Create your account" button opens a native in-app
> registration screen (email and password); no browser is involved in
> registration or sign-in. Account deletion is also available in the app
> under Profile > Settings.
>
> Guideline 3.1.1 (Payments): Offerloop subscriptions are purchased on our
> website. The app contains no purchasing UI, shows no prices, and captures
> no payment. In build 13, following the provision for the United States
> storefront quoted in your message, the Credits screen offers a single
> "View plans on the web" entry that links out to the default browser at
> www.offerloop.ai, where all payment is handled. The app's availability is
> set to the United States storefront only.
>
> A demo account is provided in the App Review notes, and new-account
> registration can be tested directly from the welcome screen.
>
> Thank you!

---

## 5. Decisions made autonomously (easy to reverse, say the word)

- **No In-App Purchase.** Rylan okayed a 30 percent cut, but IAP would be a
  native payments module, App Store Connect products, and backend receipt
  work (weeks). The US link-out route is sanctioned in Apple's own rejection
  text, is live today, and costs no commission. IAP stays on the table as a
  v1.1 choice if we ever want native purchasing or non-US storefronts.
- **Baseline resubmission.** Build 12 is Build 11 plus fixes only. Fastest
  path to approval, smallest review surface; everything else arrives by OTA
  after approval.
- **Password accounts.** In-app registration uses email + password rather
  than the magic link, so a reviewer can never get stranded waiting on email
  delivery (iCloud has silently dropped our Firebase emails before, see
  AUTH-SIGNIN-FIX-HANDOFF.md). Existing magic-link sign-in is unchanged.
  First-party email+password does not trigger the Sign in with Apple rule
  (4.8 covers third-party login).
- **"Create your account" is now the primary (black) button** on the welcome
  screen, with "Sign in" secondary. New-user growth is the priority and Apple
  wants registration prominent.
- Committed on a branch in a separate worktree (`~/offerloop-build12`), never
  pushed, main branch and both working checkouts untouched. The staging
  sessions' in-flight work is exactly where it was.

---

## 6. Answers to the process questions

- **Do we reply to the message?** Yes, reply in the thread (section 4) AND
  resubmit with the new build. The reply pre-empts a second 3.1.1 bounce by
  citing their own US link-out paragraph.
- **Is it "resubmitted" automatically?** No. Fix, upload Build 12, swap the
  build on the version page, then click resubmit. The version stays 1.0.
- **New submission fee or penalty?** None. Rejections and resubmissions are
  normal; first submissions get rejected more often than not.
