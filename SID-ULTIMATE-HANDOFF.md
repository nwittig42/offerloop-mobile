# Sid ultimate handoff, Offerloop mobile (STAGING)

**Goal:** get the **"Offerloop Staging"** app onto Sid's phone, give Sid every
resource he needs to work in this codebase, and let him make and ship changes
to the staging channel end to end on his own.

**Why staging matters right now:** the production Offerloop app (Build 11) is
sitting in **App Store review** and must not change in any way while Apple
looks at it. Offerloop Staging is our **sandbox**. It is a fully separate app
(different bundle id, different name, different icon slot) that installs
side-by-side with production on the same phone, talks to the staging backend,
and receives over-the-air (OTA) JavaScript updates within minutes of
publishing. Everything we build while we wait for review ships to staging,
gets verified on real phones, and gets promoted to production later, after
approval. Staging is where all work happens. Production is frozen.

---

## 0. Hard rules (non-negotiable, read before anything else)

- Ship ONLY with `eas update --branch preview`.
- NEVER `eas update --branch production`. A production OTA can change what the
  App Store reviewer sees and get Build 11 rejected.
- NEVER `eas submit`, never a production build of any kind.
- Pure JS/TS changes only over OTA. Anything native (a new native module, an
  iOS permission, an entitlement, a background mode) needs a staging REBUILD
  (`eas build --profile preview`), which requires Rylan's Apple login. Stop
  and flag it. Do not try to sneak native behavior through OTA.
- The staging app talks to the staging backend:
  `https://offerloop-staging.onrender.com`. Any endpoint you call must be
  live there first.
- Do not touch: the production channel, the App Store submission, the
  auth / finish-signin flow (owned separately, see
  `AUTH-SIGNIN-FIX-HANDOFF.md`), or the variant config (`app.config.js`,
  `eas.json`). The variant config is already set up and fragile, leave it alone.
- Never commit or push without Rylan's explicit approval. Propose, show the
  diff, then execute.
- Project style rules (from `CLAUDE.md`, they apply to Sid too): no em dashes
  anywhere (copy, code, comments, docs), and no fake or invented numbers in
  any UI. A number renders only if it comes from real data.

---

## 1. How the two-app setup works (plain-language mental model)

One codebase, two apps on the phone:

| | Production "Offerloop" | Staging "Offerloop Staging" |
|---|---|---|
| Bundle id | `ai.offerloop.app` | `ai.offerloop.app.preview` |
| URL scheme | `offerloop` | `offerloopstaging` |
| EAS update channel | `production` (FROZEN) | `preview` (ours) |
| Backend | staging Render service (see note) | `https://offerloop-staging.onrender.com` |
| Who has it | App Store review, Rylan, Nick | Rylan, Nick, soon Sid |

The switch is `APP_VARIANT=preview`, read by `app.config.js`. The `preview`
build profile in `eas.json` sets it automatically for builds. Because the two
apps have different bundle ids they install side-by-side and never collide.

**How OTA updates work here:** an EAS "channel" is what the installed app
listens to, and a "branch" is what you publish to. The staging app listens to
channel `preview`, so `eas update --branch preview` puts new JS in front of
it. On the next launch the app downloads the update in the background, and on
the launch after that it runs it (hence "relaunch twice"). Only JavaScript
and assets travel this way. Native code is frozen at build time, which is why
anything native needs a rebuild.

**Backend URL:** `src/api/config.ts` hardcodes the staging Render URL for the
`preview` channel (env inlining proved unreliable for `eas update` bundles).
Note that even the production build currently points at the staging Render
service, by deliberate submission decision (2026-07-09), because the mobile
API routes only exist there. Do not "fix" that.

---

## 2. Access checklist (what Sid needs, who provides it)

| # | Access | How | Status |
|---|--------|-----|--------|
| 1 | GitHub repo (`offerloop-mobile`, branch `main`) | Rylan sends a collaborator invite to Sid's GitHub account | ☐ |
| 2 | Expo / EAS project | Project `offerloop-native`, owner `rylanbohnett`, projectId `c2498b56-5d1c-4d17-bea7-b319b137541e`. Rylan invites Sid's Expo account, or generates an access token Sid exports as `EXPO_TOKEN` before running `eas` commands | ☐ |
| 3 | Staging backend (Render) | `https://offerloop-staging.onrender.com`. Sid already owns this from the backend handoff (`SID-web-handoff-backend.md`), including Render dashboard access for logs and deploys | ☐ |
| 4 | Test account credentials | An Elite test account with a dev password (same mechanism Rylan and Nick use). Rylan shares email + password, or sets a fresh one from the web repo: `backend/scripts/set_dev_password.py <email> '<pass>'` | ☐ |
| 5 | Device registration | Sid's iPhone UDID must be in the ad-hoc provisioning profile before the staging app can install on his phone. See section 3, this is the one step that forces a rebuild | ☐ |

Sid does NOT need: the Apple Developer login (Rylan holds it, only needed at
rebuild time), App Store Connect, or the production Firebase console.

---

## 3. Getting Offerloop Staging onto Sid's phone (one-time)

The staging build uses internal (ad-hoc) distribution, so a phone can only
install builds whose provisioning profile includes that phone's UDID. Sid's
phone is not registered yet, so:

1. **Register the device.** Run `eas device:create` (Rylan's machine, or
   Sid's once he has EAS access). It prints a registration URL / QR code.
   Sid opens it ON HIS IPHONE in Safari and installs the profile it offers.
   That captures his UDID into the Expo account.
2. **Cut a new staging build** that bakes in the new device (needs Rylan's
   Apple credentials when prompted for signing):

   ```bash
   eas build --profile preview --platform ios
   ```

   The preview profile already sets `APP_VARIANT=preview`, nothing to pass by
   hand. Rylan's and Nick's existing installs are unaffected and keep pulling
   OTAs. The rebuild exists only to add Sid's device.
3. **Install it.** When the build finishes, expo.dev shows an install page
   with a QR code. Sid opens it on his phone, taps Install, and the app
   appears as **"Offerloop Staging"**, next to (not replacing) any production
   Offerloop install.
4. **Sign in.** Type the test account email on the sign-in screen. For that
   account a password panel appears below, enter the dev password. No magic
   link, no Gmail needed to get in.
5. **Verify freshness.** Profile > Settings shows the OTA stamp (for example
   `staging v3 · a1b2c3d4`), coming from `src/lib/buildInfo.ts`. It should
   match the latest publish message. A fresh install shows `embedded` until
   the first OTA lands. Relaunch the app twice: the first launch downloads
   the update, the second runs it.

---

## 4. Machine setup (Sid's laptop)

Prereqs: Node 20+, git, and the EAS CLI.

```bash
npm i -g eas-cli
git clone <repo-url> && cd offerloop-mobile
npm install
eas login          # or: export EXPO_TOKEN=<token from Rylan>
eas whoami         # confirm you are on the rylanbohnett-owned project
```

### Run the app locally

Three modes, pick per task:

**a) Against the staging backend (default for this work, mirrors the phone):**

```bash
EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com npx expo start
```

Press `i` for the iOS simulator, or scan the QR with Expo Go on the phone.

**b) Mock mode (no backend at all, UI work offline):**

```bash
EXPO_PUBLIC_USE_MOCKS=1 npx expo start
```

Endpoint functions return fixtures from `src/mocks/data.ts` instead of
hitting the network. Fixtures are deliberately fake-looking (Sample Job
Title, Acme Test Co). If you ever see that content on a phone build,
something published with the wrong env, see Troubleshooting.

**c) Against a local backend** (rare, see `SETUP.md` for the Flask local run;
in dev the app auto-derives the backend host from Metro's own IP and swaps in
port 5001).

### Sign in during local dev

Expo Go cannot receive the magic-link deep link, so use the dev sign-in
panel (only shows in dev builds). Prefill it via env:

```bash
EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com \
EXPO_PUBLIC_DEV_EMAIL=<test-email> \
EXPO_PUBLIC_DEV_PASSWORD=<test-password> \
npx expo start
```

Known Expo Go limits: no camera QR scanner, no push notifications, no
deep-link return. Everything else (feed, swipe, inbox, loops, Scout,
meeting prep) works.

### Checks before shipping anything

```bash
npx tsc --noEmit   # typecheck, must be clean
npm run lint
```

---

## 5. Shipping a change (the OTA loop, the core workflow)

1. Make the JS/TS change in `src/`.
2. Sanity-check locally (section 4).
3. **Bump `src/lib/buildInfo.ts`:** next `OTA_VERSION` number plus a one-line
   `OTA_NOTES` describing what shipped. The counter is shared by everyone
   publishing to staging, whoever ships next takes the next number. This
   stamp is how a phone proves it is running your update.
4. **Publish.** The env vars are REQUIRED. `eas update` does not read the
   eas.json build env, and without `APP_VARIANT=preview` the update is built
   against the wrong app fingerprint and the staging app silently ignores it:

   ```bash
   APP_VARIANT=preview \
   EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com \
   eas update --branch preview --message "<what changed>"
   ```

5. On the phone, relaunch "Offerloop Staging" twice, confirm the OTA stamp in
   Profile > Settings matches your publish message, then verify the change
   behaves.
6. Keep each change small and independently shippable, so it can be OTA'd and
   phone-verified on its own.
7. Promotion to production happens later, after App Store approval, and never
   in these sessions.

---

## 6. The backlog (what to build, in order)

Full specs are in the repo, read them before starting:

1. **Outreach email templates** (`SPEC-app-web-upgrade-handoff.md` §9).
   A page where the user describes what a template should do, saves it, and
   reuses it across drafts (mirrors the website's template flow). Pure RN UI
   plus the existing draft backend. Work has started on the working tree:
   `src/app/outreach-template.tsx` and `src/api/endpoints/emailTemplate.ts`.
   **START HERE.**
2. **Broaden the resume/attachment slot** (§9). Accept any PDF and/or a
   second attachment slot. The file picker exists, PDFs need no new iOS
   permission. Pure JS.
3. **Upgrade CTA** (`SPEC-app-web-upgrade-handoff.md` §2 plus
   `SID-web-handoff-backend.md`, which Sid wrote, so he knows the backend
   half already). Backend live and verified on staging as of 2026-07-21:
   - App calls `POST /api/mobile/web-handoff` with the Firebase ID token and
     gets back `{ url: "https://www.offerloop.ai/checkout?code=<code>" }`,
     then `Linking.openURL(url)`. Note the host is `www.offerloop.ai`
     (the bare domain 301-redirects to www).
   - The auto-return deep link back into the app needs an
     `associated-domains` entitlement. That is native, so it means a staging
     rebuild. Ship the outbound (openURL) half via OTA first, flag the
     return half.
   - In-progress files on the working tree: `src/api/endpoints/upgrade.ts`,
     `src/app/credits.tsx`.

App Store rule 3.1.1 still governs the app itself: show the credit balance,
sell nothing in-app, no checkout links in production UI. The web handoff
flow is the sanctioned path around that.

There is also parallel in-flight Scout work (`SCOUT-VOICE-HANDOFF.md`,
`SPEC-scout-intelligence.md`). It is not Sid's lane unless Rylan says so, but
be aware other sessions may publish OTAs, which is exactly why the shared
`buildInfo.ts` counter exists.

---

## 7. Codebase tour (how the app is put together)

Stack: Expo SDK 56 (managed) + Expo Router (file-based routing), TypeScript,
NativeWind 4 (Tailwind classes in React Native), Reanimated 4, TanStack Query
for all server state, Firebase Auth.

### Product shape

Five tabs: **Feed** (the swipe-to-draft hero; right swipe = spend 10 credits,
find one contact at that company, draft a tailored outreach email, async with
optimistic UI), **Inbox** (drafts, sent, replies), **Loops** (the autopilot),
**Network** (contacts + meeting prep), **Profile** (resume, personal info,
files, settings; the OTA stamp lives in Settings). Scout is the summonable
Yeti assistant sheet at `/scout`, reachable from every header. Draft by
default, never auto-send.

### Directory map

| Path | What |
|------|------|
| `src/app/` | Screens. Expo Router: the file path IS the route. `(tabs)/` holds the five tabs, `(auth)/` sign-in, `(onboarding)/` first-run. Dynamic routes like `outreach/[id].tsx`, `meeting-prep/[id].tsx`, `company/[name].tsx` |
| `src/app/_layout.tsx` | Root layout: providers, fonts, navigation shell |
| `src/app/design.tsx` | In-app design gallery, the visual check surface for primitives |
| `src/api/config.ts` | Backend URL resolution per channel + `USE_MOCKS`. Read this first to understand environments |
| `src/api/client.ts` | Fetch wrapper: base URL, auth header, error shaping |
| `src/api/endpoints/` | One file per domain (feed, inbox, loops, outreach, scout, profile, upgrade, emailTemplate...). Paths read 1:1 against the backend routes |
| `src/api/queryKeys.ts` | Central TanStack Query key registry. Add keys here, never inline |
| `src/auth/` | Firebase auth: `AuthProvider.tsx` (session context), `firebase.ts`, `tokenStore.ts` |
| `src/store/app.tsx` | Global client-side app state |
| `src/components/ui/` | Primitives (Button, Card, Chip, Input...). Follow the recipes, check `/design` |
| `src/components/feed/` | Swipe deck, job card, action bar pieces |
| `src/components/scout/` | Scout orb + error boundary |
| `src/components/` | Shared chrome: Header (Scout button lives here, so it is on every page), GlassBar, CompanyLogo, FindAnotherDialog, Toast |
| `src/mocks/data.ts` | Mock fixtures (obviously fake content only, by rule) |
| `src/lib/buildInfo.ts` | OTA version stamp. BUMP ON EVERY PUBLISH |
| `src/theme/tokens.ts` + `tailwind.config.js` | Design tokens, two synced copies, change both together |
| `src/types.ts` | Shared domain types |
| `app.config.js` / `eas.json` / `app.json` | Variant, build, and update config. DO NOT TOUCH |

### Design system quick reference

Paper #FFFFFF, surface #F5F6F8, ink #111318, accent slate-blue #4A60A8, navy
#1B2A44, heading #1E2D4D, hairline #E5E5E0. Primary buttons are ink-black
fill. Corners tight: buttons 8, cards 10, inputs 6, chips 8. Instrument Serif
for screen titles and big numbers, Inter for everything else. Screen titles
render centered. Never use sparkle icons for Scout, the Yeti head
(`assets/images/scout-yeti-head.png`) is Scout's face.

### Document index (the repo's paper trail)

| Doc | What |
|-----|------|
| `CLAUDE.md` | Project rules and product shape, the constitution |
| `STAGING-DEV-HANDOFF.md` | The original staging session brief this doc supersedes |
| `SPEC-app-web-upgrade-handoff.md` | Upgrade CTA + OTA backlog spec (the work source) |
| `SID-web-handoff-backend.md` | Backend half of the upgrade handoff (Sid's own doc) |
| `AUTH-SIGNIN-FIX-HANDOFF.md` | Auth / finish-signin flow. Owned separately, hands off |
| `SETUP.md` | Long-form local setup, including running the local Flask backend |
| `SCOUT-VOICE-HANDOFF.md`, `SPEC-scout-intelligence.md`, `SCOUT-ACTION-CONTRACT.md` | Scout workstream (parallel, not Sid's lane) |
| `APP-STORE-SUBMISSION.md`, `SUBMISSION-APP-STORE-CONNECT.md` | The frozen production submission, context only |
| `PAYMENTS-AND-AUTH.md` | Payments guardrails and auth background |

---

## 8. Troubleshooting

- **OTA stamp will not advance after two relaunches.** Almost always a
  publish without the env vars (section 5 step 4). The update got a wrong
  fingerprint and the app ignored it. Republish with the full command.
- **Phone shows "Sample Job Title" / "Acme Test Co".** The bundle was
  published in mock mode, same root cause as above, republish correctly.
- **Build install page says the device is not eligible.** The phone's UDID is
  not in the provisioning profile. Do section 3 steps 1 and 2.
- **`eas` commands hit the wrong account.** `eas whoami`, and make sure you
  are acting on owner `rylanbohnett` / project `offerloop-native`.
- **Local app cannot reach the backend.** Phone and laptop must share Wi-Fi
  for LAN mode; otherwise `npx expo start --tunnel`, or just point at the
  staging URL (section 4 mode a).
- **A staging endpoint 404s.** The staging Render service does not have it
  yet. Sid owns that service, deploy the backend change there first.

---

## 9. When to stop and ping Rylan

- Any change that needs native code, a new permission, or an entitlement
  (rebuild territory, needs Rylan's Apple login).
- Anything touching payments, checkout, or upgrade copy in the app UI
  (App Store 3.1.1 exposure).
- Anything touching the auth / finish-signin flow.
- Before any git commit or push.
- Anything that would touch the production channel or the App Store
  submission, which is everything section 0 forbids. When in doubt, ask
  first, publish second.
