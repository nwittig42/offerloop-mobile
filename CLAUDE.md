# CLAUDE.md, offerloop-mobile

Native iOS app for Offerloop (offerloop.ai). Brand-new codebase, separate from the
web monorepo at `~/Downloads/Final_offerloop`.

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
- Phases 0 to 2 are mock-data only. No real API call is written until Rylan pulls the
  merged backend (the local web repo copy is stale).
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

Tabs: Feed (swipe-to-draft hero), Inbox (drafts, sent, replies), Network
(tracker-lite), Profile (credits, Loops, settings). Notification hub is the header
bell, not a tab. Right swipe = one-shot Loop cycle: find one contact at the company
and draft a tailored outreach email, async with optimistic UI. Draft by default,
never auto-send. Locked numbers: 10 credits per right-swipe (matches web Find),
daily draft caps tiered (Free 3, Pro 10, Elite 15, confirm before Phase 3 wiring).

## Commands

- `npm start` then scan the QR in Expo Go (or press i for the iOS simulator)
- `npx tsc --noEmit` for typechecking
- `npm run lint`
