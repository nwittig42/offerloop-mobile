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

## One-time setup (Nick, Sid)

1. GitHub access to deenabandi004-byte/offerloop-mobile, clone, npm install.
2. Expo account: get added as a member of the rylanbohnett Expo org, then
   npx eas-cli login. (Rylan: expo.dev > organization settings > members.)
3. Xcode not required for OTA shipping. Node 20+.
4. Read this file, CLAUDE.md, and HANDOFF-post-resubmission.md.

## Reporting bugs (everyone, including from your phone)

File a GitHub issue with the Bug template (the GitHub mobile app makes this
a 30-second job: screenshot, two sentences, submit). One bug per issue.
Label severity: `p0` broken-for-everyone, `p1` broken-for-some, `p2` polish.

### The agent loop (optional but encouraged)

With the Claude GitHub app installed on the repo, comment `@claude` on any
bug issue with a line like "@claude investigate and open a PR with a fix".
The agent reads the codebase, writes the fix, and opens a pull request for
human review. A human always reviews and merges, then ships via the loop
above. Setup (Rylan, once): install the Claude GitHub app on the repo and
add the ANTHROPIC_API_KEY secret in repo settings; the workflow file is
.github/workflows/claude.yml.

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
