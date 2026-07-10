# App Store metadata — paste-ready drafts (2026-07-09 submission night)

Everything App Store Connect asks for, drafted. Edit voice to taste; nothing
here overpromises (no fake numbers, no invented social proof — house rules).

## App name (30 chars max)

`Offerloop — Networking Agent` (28) — or plain `Offerloop` if the subtitle
carries the pitch.

## Subtitle (30 chars max)

`Land interviews, not silence` (28)
Alt: `Recruiting outreach, drafted` (28)

## Category

Primary: Business. Secondary: Productivity.

## Description (paste-ready)

Offerloop finds the right people at the companies you're chasing and drafts
the outreach that gets replies — so networking into consulting, banking, and
tech takes minutes a day, not weekends.

MEET SCOUT
Ask out loud or type: "Draft 3 analysts at Goldman Sachs in LA." Scout finds
real professionals, writes personalized emails grounded in your resume, and
puts the drafts in your inbox for your approval. You always review before
anything sends.

SWIPE. DRAFT. SEND.
A daily feed of roles matched to your profile. Swipe on a job and Offerloop
finds people on that team and drafts your outreach while you keep moving.

EVERYTHING IN ONE PLACE
- Inbox: every draft and reply, tracked automatically with Gmail
- Meeting prep: a full brief before every coffee chat — background, talking
  points, questions to ask
- Applications: auto-apply to eligible roles and track every submission
- Network: the people and companies you're building relationships with

BUILT FOR STUDENTS BREAKING IN
Consulting, investment banking, and tech recruiting all run on warm
conversations. Offerloop gets you into them earlier, with less grunt work
and none of the spreadsheet chaos.

Free to start. Connect Gmail to have drafts land in your own account —
nothing ever sends without you.

## Keywords (100 chars max, comma-separated)

`networking,recruiting,internship,cold email,coffee chat,consulting,investment banking,outreach` (97)

## URLs

- Support URL: https://offerloop.ai/contact-us
- Marketing URL: https://offerloop.ai
- Privacy Policy URL: https://offerloop.ai/privacy  (MUST include the
  voice-clip transcription line before submitting — see checklist)

## Age rating questionnaire

All "None" (no violence/gambling/medical/UGC-web). Unrestricted web access:
No. Result should be 4+.

## Privacy nutrition labels (Data Collection)

Collected, linked to identity, App Functionality:
- Contact Info: email, name
- User Content: resume/documents (resume text powers drafting + matching);
  Audio Data (voice asks — transcribed to act on the request; clips
  processed, not retained)
- Identifiers: user ID (Firebase uid)
- Sensitive/Other: Gmail data IF the user links Gmail (drafts created and
  replies read on the user's behalf, disclosed in-app)

Collected, linked to identity, Analytics (NOT tracking — no ad networks, no
data brokers, no cross-app tracking):
- Usage Data: product interaction events (PostHog, first-party proxy)
- Identifiers: user ID

"Used to track you": NO for everything.

## App Review Information (the reviewer-login gate)

- Sign-in required: YES.
- Demo account (CREATED 2026-07-09, uid DPiaCKOnHghLl4CwzrCZd2N7cOp2):
  - Email: applereview@offerloop.ai
  - Password: Offerloop-Review-2026!
  - Mechanism: production builds show a password panel when this exact email
    is typed in the sign-in field (build-time allowlist
    EXPO_PUBLIC_REVIEWER_EMAILS in eas.json production env). Normal users
    never see it; magic link remains the consumer path.
- Notes for reviewer (paste-ready):
  "Offerloop normally signs in via email magic link. For review: on the
  sign-in screen, type applereview@offerloop.ai in the email field - a
  PASSWORD SIGN-IN panel appears below. Enter the same email and password
  Offerloop-Review-2026! there and tap sign in. Voice features: tap the
  center Scout orb and speak; audio may be transcribed on Offerloop servers
  as disclosed in the permission dialog. Gmail connection is optional and
  not required to evaluate the app."
- TODO before submit: sign into the demo account once on a test device and
  complete onboarding so the reviewer lands on a populated app (or verify
  the onboarding flow itself is the intended first-run experience).

## Screenshot shot list (6.7" required = iPhone 15/16 Pro Max; 6.5" optional)

Capture in this order (it's the story):
1. Scout tab, orb idle with suggestion chips visible ("Draft 3 IB analysts…")
2. Scout mid-conversation: a reply card with receipt chips (e.g. "View 3 in
   your Network") + the context pill
3. Feed: a job card mid-swipe
4. Inbox: drafts + a reply thread (use demo data, real-looking but not real
   people — house rule: no fake numbers/testimonials in marketing overlays)
5. Meeting prep detail: the brief with talking points
6. Applications view (Network tab → Applications)
Overlay copy (if using framing): "Ask for outreach out loud" / "Drafts land
in your inbox" / "Prep for every coffee chat". No invented stats.

## Build + submit commands (when gates are green)

```bash
cd ~/offerloop-mobile
npx eas-cli build -p ios --profile production      # autoIncrement on
npx eas-cli submit -p ios --latest                  # needs ASC API key in EAS
```
TestFlight internal first: install on both phones, run the smoke lane
(sign-in round-trip, feed→swipe→draft→inbox, voice ask, prep build, an
auto-apply dry run), THEN submit for review.

## Known-good facts for review responses

- Voice audio: transcription starts on-device; short clips may be sent to
  Offerloop servers for accuracy (disclosed in the permission string);
  processed, not retained; never ads, never sold.
- Gmail: OAuth per-user, drafts created on the user's behalf, user reviews
  before sending; Google API Services User Data Policy — limited use,
  disclosed in-app and in the privacy policy.
- Payments: none in-app for v1 (web handles subscriptions; the app links
  out only where policy-compliant). No IAP surface = no 3.1.1 exposure.
