# Auth sign-in bug — fix handoff (for a fresh Claude session)

**Mission:** iOS users with **@icloud.com** emails can't sign into the app — the magic-link
email never arrives (Apple/iCloud silently drops Firebase's default sender). There may also be a
fragile magic-link hand-back. **This session fixes the WEBSITE + Firebase/DNS CONFIG side.** The
APP side is owned separately (Rylan, in `offerloop-mobile`) — this doc gives you the exact
contract so the two sides meet.

**Do NOT touch the app repo (`offerloop-mobile`).** Your repo is the website:
`Final_offerloop` (the site is `connect-grow-hire/`, deploys from **`origin/main`**). Rylan's
local checkout is stale/diverged — **base your work on `origin/main` (the live code), not
whatever branch is checked out.**

---

## STEP 0 — Scope it before building anything (10 min, do this FIRST)

On a **real device**, test: does a **Gmail** user tapping the magic link actually land **in the
app, signed in**?

- **YES →** the *only* bug is iCloud email delivery. Do **Fix A only.** No finish-signin rework,
  no AASA work, no app rebuild. You're likely done in ~an hour.
- **NO →** magic-link completion is broken for everyone. Do **Fix A + B + C** and coordinate the
  contract (below) with Rylan.

**Do not rebuild the universal-link plumbing until you've confirmed it's actually broken.** Rylan
uses the app daily via Gmail, so completion may already work — in which case this is *only* the
email-domain config.

---

## The full flow (shared mental model)

1. **App:** `sendSignInLinkToEmail(auth, email, { url: CONTINUE_URL, handleCodeInApp: true, iOS: { bundleId: 'ai.offerloop.app' } })`.
2. **Firebase** sends the email (default sender `noreply@offerloop-native.firebaseapp.com`).
3. User taps the link → Firebase auth handler → **redirects to `CONTINUE_URL`** with an `oobCode`.
4. **finish-signin page (website)** must hand back to the app: redirect to
   `offerloop://finish-signin?link=<url-encoded original magic-link URL>` (custom scheme), or the
   link opens the app directly via **universal links** (AASA).
5. **App** (`AuthProvider.completeSignInFromUrl`) receives that URL, unwraps `link`, calls
   `signInWithEmailLink()` → signed in.

**Facts pulled from the app code** (`offerloop-mobile/src/auth/AuthProvider.tsx`):
- `CONTINUE_URL = https://offerloop.ai/app/finish-signin`
- App expects the hand-back as `offerloop://finish-signin?link=<encoded>`
- Firebase project: **`offerloop-native`**. Uses Firebase's **built-in** email sender.
- Apple Developer **Team ID: `UB44PF7BF6`**. App bundle ID: `ai.offerloop.app`.

---

## Fix A — iCloud email deliverability (PRIMARY, most isolated)

**Root cause:** Firebase's default auth emails (from `firebaseapp.com`) are silently dropped by
Apple/iCloud mail servers (SPF/DKIM/domain reputation). Gmail accepts them; iCloud blackholes
them — not even to junk. This matches the symptom exactly.

**Fix:** give Firebase Auth a **custom authenticated sending domain**:
- **Option 1 (simplest):** Firebase Console → Authentication → Templates → set a custom sender /
  SMTP on an `offerloop.ai` subdomain (e.g. `auth@mail.offerloop.ai`), then add **SPF, DKIM, and
  DMARC** DNS records so Apple trusts the sender.
- **Option 2 (more control/deliverability):** route auth emails through a transactional provider
  (SendGrid / Postmark) on an authenticated `offerloop.ai` subdomain — via Firebase custom SMTP,
  or a custom email-link generation flow.

**Verify:** send a test magic link to a real **@icloud.com** address → confirm it arrives. Also
test @yahoo and @outlook (also strict).

**Access needed:** Firebase Console (project `offerloop-native`) + **DNS for offerloop.ai.**

---

## Fix B — finish-signin page + redirect (ONLY if Step 0 = NO)

**Findings (live, 2026-07-20):**
- `https://offerloop.ai/app/finish-signin` returns **301 → `www.offerloop.ai/...`**. A redirect
  can drop/mangle the `oobCode` query params and break the handoff.
- The URL currently serves the SPA shell — **confirm the `finish-signin` route actually runs JS
  that redirects to `offerloop://finish-signin?link=<encoded full URL>`.**

**Fix:** serve finish-signin at the **exact `CONTINUE_URL` host** (canonical, non-param-losing),
and ensure its JS performs the `offerloop://` hand-back. Repo: `connect-grow-hire`. **Agree the
canonical host with Rylan** — `CONTINUE_URL` (app) and the served page (web) must match exactly.

---

## Fix C — AASA / universal links (ONLY if Step 0 = NO and using universal links)

**Finding:** `https://offerloop.ai/.well-known/apple-app-site-association` returns **301, not
200.** Universal links require AASA served at **200**, content-type **`application/json`**, with
**no redirect.**

**Fix:** serve AASA at 200 (no redirect) with `applinks` → appID **`UB44PF7BF6.ai.offerloop.app`**,
path `/app/finish-signin`. **Rylan** adds the matching `associated-domains` entitlement app-side
(native change → EAS rebuild). This is the one item that crosses into the app repo — flag it to
him, don't do it here.

---

## The contract (both sides MUST agree — do not diverge)

| Piece | Value |
|---|---|
| CONTINUE_URL | `https://offerloop.ai/app/finish-signin` — served **200, no param-losing redirect** |
| Hand-back scheme | `offerloop://finish-signin?link=<url-encoded original magic-link URL>` |
| AASA appID / path | `UB44PF7BF6.ai.offerloop.app` / `/app/finish-signin` |
| Firebase sender | custom authenticated domain on `offerloop.ai` (Fix A) |

---

## Definition of done

- Real **@icloud.com** device: request link → **arrives** → tap → **lands in app signed in.**
- Real **@gmail.com** device: same (no regression).
- Website's own **Google-OAuth** sign-in still works (don't break it).

---

## STATUS — 2026-07-21 (website session)

**Step 0 answered from code, no device needed: NO — completion is broken for everyone.**
Root cause: `d8c549a5` (Jul 9) added the finish-signin page + route; Nick's ScoutChatContext
rewrite (`114a76b0`, PR #130) rewrote `App.tsx` and deleted the lazy import + Route, orphaning
the page. Live `/app/finish-signin` renders NotFound; the `offerloop://` hand-back never fires.
(Rylan's daily Gmail use = persisted session from before #130.)

- **Fix B: DONE, awaiting push to main.** Branch `fix/restore-finish-signin-route` (commit
  `b305867b`, +4 lines to App.tsx) pushed to origin. Vite build verified. Ship:
  `git push origin fix/restore-finish-signin-route:main` (fast-forward). The apex→www 301
  **preserves query params** (verified live) and www serves the SPA, so no DNS/redirect change
  needed — the hand-back encodes the www URL, which `signInWithEmailLink` accepts.
- **Fix A: DONE 2026-07-21.** Custom sender domain `mail.offerloop.ai` verified + applied in
  Firebase Console; auth emails now send from `noreply@mail.offerloop.ai` (API confirms
  `customDomain: mail.offerloop.ai`, `useCustomDomain: true`). NOTE: DNS is at **Namecheap**
  (registrar-servers.com NS), NOT Cloudflare — the `server: cloudflare` header is Render's CDN.
  4 records added in Namecheap Advanced DNS (account `nwittig`): TXT `mail` SPF
  (`v=spf1 include:_spf.firebasemail.com ~all`), TXT `mail` `firebase=offerloop-native`, CNAME
  `firebase1/2._domainkey.mail` → `mail-mail-offerloop-ai.dkim1/2._domainkey.firebasemail.com`.
  Remaining: real-device test — magic link to @icloud.com (+ @yahoo/@outlook) must arrive.
- **Fix C: SKIPPED (correctly).** Custom-scheme hand-back suffices; AASA still 301s/serves HTML
  if universal links are ever wanted later.
- Authorized domains already include `offerloop.ai` + `www.offerloop.ai` — no change needed.

## Notes

- The **website's** own sign-in is **Google OAuth** (popup), not email-link — so it doesn't send
  magic emails. But other Firebase-sent emails (verification, password reset) hit the *same*
  iCloud issue, so **Fix A helps the website too.**
- App repo (`offerloop-mobile`) is Rylan's — this session doesn't edit it; only the AASA
  entitlement (Fix C) crosses over, and that's Rylan's to add.
- **Keep this doc as the source of truth.** If the contract changes, update the table above and
  tell both sides.
