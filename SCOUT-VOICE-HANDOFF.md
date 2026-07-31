# Scout voice handoff (parallel session, staging channel ONLY)

**Mission:** make Scout brain-dead easy by voice. The north star ask from Rylan
(2026-07-21): *"Hey Scout, can you apply to a few jobs for me?"* spoken out loud,
and Scout does it. This session runs IN PARALLEL with the staging-dev session
(templates, credits, feed work), so respect the boundaries in section 5.

Read first: `STAGING-DEV-HANDOFF.md` (hard rules), `PLAN-scout-voice.md`,
`SCOUT-ACTION-CONTRACT.md`, `SCOUT-RISK-REGISTER.md`.

---

## 1. Hard rules (same as the staging handoff, plus deploy specifics)

- Repo is `~/offerloop-mobile` (branch `main`). A second checkout exists at
  `~/Downloads/Final_offerloop/offerloop-mobile` (no node_modules); if you work
  there, sync files to `~/offerloop-mobile` before shipping.
- Ship ONLY: `APP_VARIANT=preview EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com eas update --branch preview --message "<what changed>"`
  The env prefix is NOT optional: `eas update` does not read eas.json build env,
  and without it you publish a wrong-fingerprint, mock-mode bundle the staging
  app silently ignores. (Learned the hard way 2026-07-21.)
- NEVER `--branch production`, never `eas submit`, never a production build.
  Build 11 is in App Store review.
- Pure JS/TS only. The voice native modules you need are ALREADY in the staging
  build cut 2026-07-21 (expo-speech-recognition, expo-speech). If something
  needs a NEW native module or permission, stop and flag it.
- Typecheck before every publish: `npx tsc --noEmit` (run in `~/offerloop-mobile`).
- **Bump `src/lib/buildInfo.ts` on every publish** (next number + one-line notes).
  The stamp renders in Profile > Settings; it is how Rylan knows which OTA his
  phone is running. Both sessions share the counter.
- Verify on device: relaunch "Offerloop Staging" twice (first launch downloads,
  second runs it).

---

## 2. What already exists (do not rebuild)

The voice stack is real and shipping; the gap is intent coverage and polish,
not plumbing.

| Piece | File | State |
|---|---|---|
| Scout modal UI | `src/app/scout.tsx` (461 lines) | live, summonable everywhere via Header Yeti button |
| Speech-to-text | `src/lib/speech.ts` | on-device ASR (Apple SFSpeechRecognizer via expo-speech-recognition), feature-detected so it no-ops on old builds |
| Text-to-speech | `src/lib/speak.ts` | expo-speech, auto-picks the best en-US voice on device |
| Interim brain | `src/api/endpoints/scoutActions.ts` (873 lines) | client-side intent mapper per SCOUT-ACTION-CONTRACT.md; deleted wholesale when Nick's server brain speaks the contract |
| Server translator v0 | `src/api/endpoints/scoutAsk.ts` → `POST /api/mobile/scout/ask` | find_contacts (uncharged preview), draft_outreach (creates a draft job), classify |
| Voice autocorrect | in scoutActions.ts | deterministic fixes for firm-name mishears (Goldman Sachs, McKinsey, etc), shown corrected in the witnessed ask |
| Spend guard | `swipeSettings.scoutConfirmSpend` (default on) | voice asks show one Run-it tap before credits move |

Existing intents in the interim brain: `find_people` / `draft` (company-scoped),
`find_jobs` (role search), `apply_saved` ("apply to my saved jobs"), `prep`.
Contract rules already honored: reversible actions run immediately; irreversible
(auto-apply submit) ALWAYS gets a Confirm scope card; broad asks get at most one
clarify round; "send" downgrades to draft.

---

## 3. The build: "apply to a few jobs for me"

**STATUS 2026-07-22: BUILT (client-side, Phase A of SPEC-scout-intelligence.md).**
`parseApplySome` in scoutActions.ts (checked before parseJobSearch and the
question guard), `pickApplyCandidates` (eligible-only, target-role-first),
`applySome` scope card in the tab (named job list, credit math via
`AUTO_APPLY_CREDITS`, voice yes/no honored), per-job honest results with an
application-profile deep link on PROFILE_REQUIRED / WORK_AUTH_REQUIRED.
Sector-flavored asks fall through to `fetchSectorJobs` when the feed is dry.
Single-candidate asks reuse the existing applyOne confirm card. Note:
AUTO_APPLY_CREDITS is a client constant for now, TODO to serve it from
/api/mobile/me next to creditsPerSwipe.

`apply_saved` only covers explicitly saved jobs. The ask Rylan wants is broader:
no saved list required, Scout picks. Proposed shape (follow the contract):

1. New intent `apply_some` — triggers on "apply to a few / some / N jobs (for me)"
   with no saved-list qualifier. Parse an optional count; default a small honest
   number (3) rather than inventing scale.
2. Candidate selection: pull from the CURRENT feed (`useApp` feed state), filter
   `autoApplyEligible`, prefer jobs matching the profile's target roles. No new
   server surface needed.
3. Confirm scope card (auto-apply is irreversible): "Apply to these 3? [job list]
   · X credits" — one tap, honoring `scoutConfirmSpend`. Read real credit cost
   from `profile.creditsPerSwipe` / auto-apply cost; NEVER hardcode a price.
4. Execute via the EXISTING calls: `startAutoApply` (`src/api/endpoints/autoApply.ts`)
   per job, and (optional, matches swipe behavior now that auto-apply defaults on)
   `runSwipe` to also warm the team. Optimistic progress in the thread, honest
   per-job results ("2 applied, 1 needs a work-authorization answer").
5. Speak the outcome back via `speak.ts`, short and specific.

Auto-apply may stop and ask for application-profile answers (work authorization
etc). Surface that honestly in the thread with a deep link to
`/application-profile`, do not silently skip.

---

## 4. Also in scope for this session (from PLAN-scout-voice.md)

- Anything in `PLAN-scout-voice.md` still unchecked (voice UX polish, barge-in,
  transcript correction affordances).
- More ASR autocorrect entries as field testing surfaces mishears.
- NOT in scope: Nick's server brain, web Scout, anything under `backend/`.

---

## 5. Parallel-session boundaries (IMPORTANT)

Two Claude sessions edit the SAME working checkout. An `eas update` from either
session snapshots the WHOLE tree, including the other session's half-done work.

- **This (Scout) session owns:** `src/app/scout.tsx`, `src/components/scout/**`,
  `src/lib/speech.ts`, `src/lib/speak.ts`, `src/lib/scoutThread.ts`,
  `src/api/endpoints/scout*.ts`, this doc.
- **The staging-dev session owns:** feed, credits, templates, profile, inbox,
  attachments, `src/store/app.tsx`, `src/api/endpoints/*` (non-scout).
- Need a change in a shared file (`src/store/app.tsx`, `src/types.ts`,
  `src/api/queryKeys.ts`)? Keep it small and additive, and say so in your
  publish message.
- Before ANY publish: `npx tsc --noEmit` must pass (it checks the whole tree,
  so it catches the other session's breakage too — if the error is in their
  files, coordinate through Rylan instead of fixing it yourself).
- Publish messages must say which session shipped: prefix with `scout:`.

---

## 6. Verification checklist per change

1. `npx tsc --noEmit` clean in `~/offerloop-mobile`.
2. Publish with the full env-prefixed command (section 1).
3. Rylan/Nick relaunch Offerloop Staging twice.
4. Voice round-trip on device: hold-to-talk, say the ask, watch the witnessed
   (autocorrected) transcript, confirm the scope card, hear the spoken result.
5. Check the Inbox/Loops surfaces reflect what Scout claims it did. No fake
   numbers anywhere: every count shown must come from real responses.
