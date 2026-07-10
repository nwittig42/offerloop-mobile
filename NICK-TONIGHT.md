# Nick — tonight's submission sheet (2026-07-09)

We submit the iOS app this session. This is your complete lane. Pull latest
`main` first (`git pull` — tip is `e73e511` or newer). Rylan runs App Store
Connect + the production build; Claude holds the main thread fixing whatever
field-testing finds.

## 1. BLOCKING — Firebase Console (5 minutes, do first)

Project `offerloop-native` → Authentication:
- **Sign-in method → Email/Password: ENABLED** (the reviewer password path
  hard-fails without it, and so does `set_dev_password`-created auth).
- **Same screen → Email link (passwordless sign-in): ENABLED** (the consumer
  magic-link path).
- **Settings → Authorized domains: `offerloop.ai` present.**
Reply in the chat with a ✅ when done — the production build's smoke test
depends on it.

## 2. BLOCKING — web prereqs push (1 command, you or Rylan)

Two commits are staged on a branch (privacy disclosures + the
`/app/finish-signin` magic-link handoff page). Fast-forward, prod-web deploy:

```bash
cd ~/Downloads/Final_offerloop-privacy && git push origin HEAD:main
```

(That worktree is on Rylan's machine — if you're pushing from yours, the
branch is `privacy/voice-clips-analytics`, two commits `58e87e60` + `d8c549a5`
on top of `origin/main`.) If prod Render is manual-deploy, trigger it. Verify
after: https://offerloop.ai/privacy shows the voice-clip paragraph, and
https://offerloop.ai/app/finish-signin renders the "Open the Offerloop app"
button (not the 404).

## 3. RULE — staging code freeze

The App Store build talks to `offerloop-staging.onrender.com` (origin/main has
no mobile API — decided tonight, documented in APP-STORE-SUBMISSION.md). From
the moment we submit until Apple approves: **no risky pushes to
`staging/mobile-field`**. Bugfixes fine; refactors and schema changes wait.

## 4. CODE LANE — polish backlog (ranked; all file:line verified tonight)

Already fixed by Claude (don't redo): fixture seeds on fresh accounts, dev
screens in Settings, dead Gmail chip, attachment stub, Phase-3 share copy,
stale 15-credit prep copy, magic-link silent failures + `?link=` unwrap,
reviewer password path.

Yours, in order (HIGH = reviewer-visible):

1. **HIGH — sign-in: no Resend button** — `src/app/(auth)/sign-in.tsx:110-124`:
   after "sent" the only action is "Use a different email". Add Resend
   (re-call `sendSignInLink`, brief cooldown).
2. **HIGH — Loops sold to new users though shelved** — `(auth)/welcome.tsx:22`,
   `(onboarding)/index.tsx:396,455`, `components/NotificationPrompt.tsx:22`,
   `app/scout.tsx:43` (suggestion chip), `milestones.tsx:61` (never-completable
   "Start your first Loop" milestone). Reword to Scout/one-shot framing; drop
   the loop milestone.
3. **HIGH — fresh-account resume dishonesty** — `profile.tsx:624` ("Attached"
   chip on the "No resume yet" card), `profile.tsx:77` (completion ring counts
   the placeholder as done), `swipe-settings.tsx:380-383` (blank card on mock
   fallback). Derive a real `hasResume` in `src/api/endpoints/me.ts`, gate all
   three.
4. **HIGH — apply-questions swallows failure** — `apply-questions/[id].tsx`:
   no isError branch (failed fetch renders "Finishing your application…",
   line 357), no refetchInterval, unlabeled spinner (341-344).
5. **HIGH — meeting-prep detail dead end** — `meeting-prep/[id].tsx:180-188`:
   error text with no retry while the 4s poll (143-152) keeps running under
   it. Retry button; stop polling on error.
6. **HIGH — Applications tab hides errors** — `network.tsx:372`: fetch error →
   "No applications yet". Add isError branch + retry.
7. **HIGH — milestones/school-colors contradiction** — `milestones.tsx:233-234`
   ("Preview…" disclaimer) vs `profile.tsx:184-195` (reward toggle freely
   usable). Simplest: drop both the disclaimer and the "Earned in Milestones"
   label.
8. NICE — `company/[name].tsx:39` uncaught `decodeURIComponent` (URIError
   crashes render on malformed %); cap the 2.5s pending poll (:54-67).
9. NICE — `outreach/[id].tsx:141-149` dead-end "no longer exists" (add Back);
   :133-138 no-Gmail-app → web Gmail fallback URL.
10. NICE — `inbox.tsx:120-129` invented research phrases ("Viewing {company}
    YouTube videos") → honest generics.
11. NICE — `credits.tsx:98` dangling "· " when resetLabel empty;
    `loops.tsx:259,269` hardcoded credit numbers.
12. NICE — `scan-linkedin.tsx:74-90` "Rebuild the app" dev copy user-facing.
13. NICE — `application-profile.tsx:131` silent load/error → skeleton + note.

Ship each as its own commit; `npx tsc --noEmit` + `node
scripts/scout-battery.mjs` before every push. JS-only changes can OTA onto
the production build later — nothing here needs a rebuild.

## 5. TEST LANE — TestFlight smoke (when Rylan's build lands)

On a real device, FRESH install:
1. Sign-in: type `applereview@offerloop.ai` → password panel appears → sign in
   with the password in APP-STORE-METADATA.md. (This is the exact path Apple
   exercises.) Then complete onboarding so reviewers land on a populated app.
2. Magic link (your own account): send link → Safari → finish-signin page →
   "Open the Offerloop app" → signed in. Same device only.
3. Feed → swipe → draft lands in Inbox (Gmail-less compose-link path too).
4. Scout: voice ask (new mic dialog — honest copy), "find me 3 analysts at
   Goldman" (count-clarify → contacts), "employees in the tech industry in
   LA" (firm-picker card, NOT a garbage run).
5. Meeting prep from chat → card → prep opens. Kill app mid-build → card
   re-hydrates.
6. Auto-apply one eligible job (dry run first if you prefer) →
   Applications tab.
7. Fresh-account sweep: zero fake activity anywhere — no badge counts, no
   "Taylor Test", empty states everywhere pre-action.

## Reference docs

- `APP-STORE-METADATA.md` — store listing, demo creds, reviewer notes,
  screenshot list, submit commands
- `APP-STORE-SUBMISSION.md` — the running checklist (updated tonight)
- `docs/NICK-HANDOFF-scout-brain-landing.md` (backend repo, staging branch) —
  the prod-WEB brain landing. **NOT tonight's problem** — ignore until the
  app ships.
