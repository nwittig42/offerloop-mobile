# TEAM-SHIPPING.md: how Rylan, Nick, and Sid ship changes to the live app

The app is live (App Store id 6789441106, build 16). This doc is the whole
shipping system. Read it once and you can ship a fix in ten minutes.

## The two lanes

1. OTA (over the air): any JavaScript/TypeScript change: screens, logic, bug
   fixes, copy, new features. Ships in minutes with ./scripts/ship-ota.sh.
   No Apple review. This is 95 percent of changes.
2. Native build: needed only when we add a library containing native code,
   change app.json (permissions, icons, splash), or upgrade the Expo SDK.
   Requires a new App Store build and review (about 1 to 2 days for updates
   to a live app). We BATCH these; see the native backlog below.

Not sure which lane a change is? If it only touches files in src/ it is OTA.
If it touches package.json (new dependency), app.json, or eas.json, assume
native and ask in the group chat first.

## Shipping a fix (the loop)

1. Branch, fix, commit, merge to main (small PRs, or direct to main for
   trivial fixes; use judgment).
2. ./scripts/ship-ota.sh staging "what changed"
3. On the staging TestFlight app: force-quit, open twice, confirm the stamp
   in Profile > Settings, and actually exercise the thing you changed.
4. ./scripts/ship-ota.sh production "what changed"
5. git push.

The script blocks shipping uncommitted code, typechecks, and refuses to
publish an update that the installed builds cannot receive (the fingerprint
gate). If it aborts with a fingerprint mismatch, your change is native lane.

## Hard rules

- Staging first, always. The clipped-paywall bug was caught this way instead
  of by an App Review rejection.
- Never edit eas.json casually. It silently changes the update fingerprint
  and strands updates. If you think you need to change it, group chat first.
- Purchase-flow changes (anything under src/api/purchases.ts, the paywall,
  the Credits screen): read the App Review history first (memory:
  appstore-iap-pivot, HANDOFF-post-resubmission.md). Apple rejected this app
  three times over 3.1.1; no web links to purchases, no external checkout,
  prices only from StoreKit.
- No fake numbers in UI, no em dashes anywhere (house rules, CLAUDE.md).
- The review demo account (applereview@offerloop.ai) is sacred: never buy
  subscriptions on it. App UPDATES get reviewed too.

## CI does the publishing (no Expo accounts needed for Nick and Sid)

- Merge to main: GitHub Actions auto-ships to STAGING (see
  .github/workflows/ship-staging.yml). Add "[skip ota]" to a commit message
  to opt out (docs-only changes and the like).
- Ship to production: repo > Actions > "Ship production OTA" > Run
  workflow, type the message and YES. That is the whole release.
- The local script still works for anyone who prefers the terminal:
  ./scripts/ship-ota.sh staging|production "message".
- Publishing identity is one repo secret, EXPO_TOKEN (an Expo access token
  from Rylan's account). If it ever leaks or a laptop is lost, revoke it at
  expo.dev > Settings > Access tokens and mint a new one.

## One-time setup (Nick, Sid)

1. GitHub access to deenabandi004-byte/offerloop-mobile, clone, npm install.
2. Xcode not required. Node 20+. No Expo account needed; CI publishes.
3. Read this file, CLAUDE.md, and HANDOFF-post-resubmission.md.

## Reporting bugs (everyone, including from your phone)

File a GitHub issue with the Bug template (the GitHub mobile app makes this
a 30-second job: screenshot, two sentences, submit). ONE bug per issue:
each issue becomes one focused agent conversation and one reviewable PR.
If you have a brain-dump of problems, file one issue with a bulleted list
and comment "@claude split each bullet into its own issue". Label severity:
`p0` broken-for-everyone, `p1` broken-for-some, `p2` polish.

### The agent loop (set up, working, and proven)

The issue IS the chat. Comment on any bug issue:
"@claude investigate this and open a PR with a fix" and post it. You can
close the app; the agent runs on GitHub's servers and replies in the same
thread (turn on GitHub app notifications to get pinged). Typical fix lands
as a linked branch/PR in 5 to 15 minutes. A HUMAN always reviews and
merges; merging auto-ships staging.

Proof it works: issue #1 (Scout drafted 1 of 2 requested contacts) went
phone report -> agent fix in 5m50s -> human merge -> staging -> production,
about an hour end to end, 2026-08-10. Note: the agent's environment cannot
run the typechecker, so give nontrivial PRs a local `npx tsc --noEmit` on
the branch before merging (Claude Code can do this for you).

Big product rethinks are not agent food; bring those to a Claude Code
session where you can design together first.

### Production-button gotchas

- After clicking Run workflow, the "workflow successful" toast only means
  the run was REQUESTED. Watch the run itself go green, or check
  `eas update:list --branch production` for the new entry.
- The staging_verified box must be exactly YES. Anything else silently
  skips the job and the run still shows green.
- Docs-only commits: put "[skip ota]" in the commit message so CI does not
  pointlessly re-ship staging.

## Native backlog (batch these into the next App Store build)

| Item | Why | Notes |
|---|---|---|
| Sentry crash reporting | We are blind to crashes on user phones | Top priority for build 17 |
| (add here) | | |

When the backlog justifies it, cut build 17: bump anything needed, run the
production build (auto-submits), review takes about a day, and OTA life
continues uninterrupted meanwhile. After a new build ships, update the
runtime hashes at the top of scripts/ship-ota.sh (the script prints
instructions when they go stale).

## Where things live

- Money pipeline map, service ids, account notes: HANDOFF-post-resubmission.md
- App Review saga history: memory appstore-iap-pivot.md (Claude sessions)
- Backend (webhook, credits): web repo branch staging/mobile-field
- Webhook log checker: ~/offerloop-ops/check-both-webhooks.sh (Rylan's Mac)
- Demo account daily reset: launchd job on Rylan's Mac until Sid ships the
  renewal guard (SID-PATCH-demo-renewal-guard.md)
