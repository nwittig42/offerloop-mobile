# CLAUDE.md, offerloop-mobile

Native iOS app for Offerloop (offerloop.ai). Brand-new codebase, separate from the
web monorepo. TWO backend branches, two truths, do not mix them up:

- `origin/main` = the live WEBSITE (offerloop.ai, Stripe, web features). Clean
  checkout at `~/Downloads/Final_offerloop-live-main`.
- `origin/staging/mobile-field` = the MOBILE backend. Both Render services the
  app calls (offerloop-staging and offerloop-mobile-prod) deploy from it: the
  RevenueCat webhook, /api/mobile/*, the credit ledger. When wiring app API
  calls, THIS branch is the truth; read it via
  `git show origin/staging/mobile-field:backend/...` from any checkout of the
  repo (github.com/deenabandi004-byte/Final_offerloop).

A route existing on main does not mean the app can call it (example that bit
us: resume_builder.py exists only on main). The old working copy at
`~/Downloads/Final_offerloop` is a dirty side branch, never a reference.

## Source-of-truth documents (read these first)

- Spec: `~/Desktop/App Design/OFFERLOOP_MOBILE_V1_BRIEF.md`
- Approved proposal: `~/Desktop/App Design/OFFERLOOP_MOBILE_V1_PROPOSAL.md`
- Sorce UI reference screenshots: `~/Desktop/App Design/IMG_*.PNG`

## Hard rules

- NO EM DASHES anywhere: copy, code, comments, docs. Use commas, periods, parentheses.
- No fake or invented numbers in any UI. A number renders only if it comes from real
  data the app has. Mock fixtures use obviously fake content (Sample Job Title,
  Acme Test Co), never plausible-looking stats.
- Two-phase workflow: propose, get Rylan's approval, then execute. Show diffs as you
  go. Never commit or push without explicit approval.
- Rylan is the CMO, not a senior engineer. Explain technical choices in plain
  language with tradeoffs.
- Phases 0 to 2 are mock-data only. When wiring real API calls, read the actual
  route definitions from `~/Downloads/Final_offerloop-live-main/backend/app/routes/`
  (the up-to-date live code), never from memory or handoff notes.
- No purchase or upgrade links anywhere in the app (App Store rule 3.1.1). Show the
  credit balance, sell nothing, link to no checkout.

## Stack

Expo SDK 56 (managed), Expo Router, TypeScript, NativeWind 4 + Tailwind 3.4,
Reanimated 4, TanStack Query, expo-font with Inter, Instrument Serif, JetBrains Mono.
Later: Firebase Auth + Sign in with Apple, EAS Build, TestFlight.

## Design system

Tokens live in two synced places: `tailwind.config.js` (NativeWind classes) and
`src/theme/tokens.ts` (raw values for shadows, navigator theming, dynamic styles).
Change both together. Primitives in `src/components/ui/` (Button, Card, Chip, Input)
follow the exact web recipes documented in the brief, section 8. The visual check
surface is the in-app design gallery at `/design` (reachable from the Feed tab).

Quick palette: paper #FFFFFF, paper-2 #FAFBFF, surface #F5F6F8, ink #111318,
accent slate-blue #4A60A8, navy #1B2A44, heading #1E2D4D, hairline #E5E5E0.
Primary buttons are ink-black fill. Corners tight: buttons 8, cards 10, inputs 6,
chips 8. Instrument Serif for screen titles and big numbers, Inter for everything
else.

## Product shape (v1)

Tabs (5): Feed (swipe-to-draft hero; credits pill left, logo centered, Scout Yeti
button right), Inbox (drafts, sent, replies), Loops (the autopilot, promoted to a
tab per Rylan 2026-06-12), Network (recent / by-company views), Profile
(Sorce-style: credits banner, then a horizontal tab strip: Resume / Personal /
Credits / Settings). All screen titles render centered in the header. The Feed
action row floats over the card (undo, pass, attachments doc, draft); /attachments
shows what travels with outreach. Notification hub is the header bell, not a tab.
Scout is a summonable modal sheet (/scout), job-aware from the Feed, mock until
Phase 3. Scout's face is the Yeti head (assets/images/scout-yeti-head.png, from the
web repo); NEVER use sparkle icons for Scout, Rylan finds them AI-generated-looking.

Feed card (Sorce-modeled): centered header (logo tile, big bold title as the focal
point, company + location), then enlarged glanceable detail chips (Compensation,
Role) a student scans before swiping. Tap expands in place; description scrolls,
swipe stays live. The action row floats over the card in a liquid-glass bar
(GlassBar, expo-glass-effect, graceful fallback below iOS 26): undo, pass, attach,
draft. Chips render only when the field exists.

Profile and Loops and Network all use the same horizontal tab strip pattern. Profile
tabs: Resume (shows the PARSED resume, the "here is what we gathered" view), Personal,
Files (resume + transcripts + add file), Settings. Loops tabs: Loops, Activity (the
8am-regimen log). Network tabs: Contacts (rows have a coffee button = meeting prep,
and a plus button = find another contact at that company), Meeting prep (the coffee
library). Inbox rows also have a plus = find another contact. Meeting prep
(/meeting-prep/new + /meeting-prep/[id]) = paste LinkedIn, get a brief + talking
points; lives in Network with a coffee identity, mock until Phase 3.

Header: clean icon mark (assets/offerloop-mark.png) top-left on Inbox/Loops/Network/
Profile; Feed keeps the full wordmark centered. The Scout Yeti button lives in Header,
so it is on every page. Feed action bar is a liquid-glass GlassBar low over the card:
[undo, playful X (PlayfulPass), draft, attach]. CompanyLogo renders real logos when a
logoUrl exists, else an initial tile; never fake a logo for a fixture company (no-fake-
data rule), the component is ready for real Phase 3 data. The plus button on Inbox and
Network rows opens FindAnotherDialog (a centered confirm popup, not an instant draft).
Inbox replied threads support an in-app follow-up composer. Profile Personal tab holds
multi-select target roles with suggestions, LinkedIn, and an About box; the resume
parse is collapsible with Scout chilling in the empty space. /credits is a mock paywall preview (real tier prices, top-up
pack prices deliberately unset, nothing purchasable). Right swipe = one-shot Loop
cycle: find one contact at the company and draft a tailored outreach email, async
with optimistic UI. "Find another contact" on outreach detail widens reach at the
same company. Draft by default, never auto-send. Locked numbers: 10 credits per
right-swipe (matches web Find), daily draft caps tiered (Free 3, Pro 10, Elite 15,
confirm before Phase 3 wiring).

## Commands

- `npm start` then scan the QR in Expo Go (or press i for the iOS simulator)
- `npx tsc --noEmit` for typechecking
- `npm run lint`
