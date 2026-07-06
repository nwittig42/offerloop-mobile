# Swipe Targeting — Plan (employee-first default + HM upgrade)

Status: SHIPPED (mobile-only) 2026-06-25. tsc clean. Needs on-device dogfood.
Turned out to need ZERO backend changes (see Build). Shared so Nick can see the shape.

## Goal

Make the hero swipe land a real, reachable contact far more often, keep casual-swipe
cost down, and give intentful users a clear upgrade to target decision-makers.

## Decisions (locked)

- **Default = employee-first.** Employees vastly outnumber recruiters/HMs in PDL, so
  "find someone at this company" almost always succeeds. Cheapest path (PDL + Hunter,
  no Perplexity). Existing warmth scoring already floats alumni / shared-school
  teammates to the top, so employee-first means "best-matched teammate," not random.
- **HM-first = opt-in upgrade.** Routes through `recruiter_finder.find_hiring_manager`
  (tier-scored decision-makers + Perplexity verification ON) with an EMPLOYEE FALLBACK
  so even HM mode rarely returns empty. Costs a bit more; only intentful users pay it.
- **The switch = global toggle, set once** (Option A). Lives in swipe-settings:
  "Contact priority: Teammates / Hiring managers." Respects the one-thumb-reflex
  principle. (Per-swipe "swipe up = hiring manager" gesture = possible fast-follow,
  not v1.)
- **Education nudge** on the Feed readback strip: "Drafting to a teammate · tap to
  target hiring managers" → tapping explains the tradeoff (decision-makers, costs a
  little more, best when you're serious) and opens the toggle.
- **Verification:** Perplexity verification stays ON for HM mode (accuracy is the point
  of the premium path). Bounded to opt-in users; revisit if spend shows up loud.

## Build (as shipped — MOBILE ONLY, zero backend changes)

Backend reuse instead of new code (the efficiency win): employee mode keeps using
`/api/prompt-search`; HM mode reuses the production `/api/job-board/find-hiring-manager`
(recruiter_finder targeting + verification + email + draft + charge + save, already
battle-tested on web). Nothing new to deploy, no collision with the metering terminal.

Mobile changes (offerloop-mobile):
- `src/types.ts`: added `priority: 'employee' | 'hiring_manager'` to SwipeSettings.
- `src/api/endpoints/swipe.ts`: employee mode = one prompt-search pass `{jobTitle} at
  {company}`, no-title fallback `people at {company}` on empty. HM mode = call
  `/api/job-board/find-hiring-manager`, attach generated email text to each manager,
  then client-side employee fallback to fill the remainder. Dropped the old expensive
  recruiter-first primary.
- `src/store/app.tsx`: default `priority: 'employee'`; beginDraft threads priority and
  forces HM mode to draft (the HM endpoint never sends); draftJob passes the setting;
  draftAnotherContact uses employee.
- `src/app/swipe-settings.tsx`: "Who we reach out to" toggle (Teammates / Hiring
  managers) + HM info note + fixed the stale "hiring manager first" count copy.
- `src/app/(tabs)/index.tsx`: mode-nudge pill above the action bar ("Drafting to
  teammates · tap to target hiring managers"), tap → swipe-settings.

## Known gaps (acceptable v1)
- HM swipes don't fire a "draft ready" push (the web endpoint doesn't call
  notify_drafts_ready). Contact still appears in the Inbox via the 60s outbox poll,
  and the user is in-app when swiping, so low value. Easy to add later.
- HM mode always drafts (never auto-sends) by design — surfaced in the UI copy.
- `/find-hiring-manager` has a 100/day per-user cap (fine for swiping).
- Ships via JS hot-reload; no backend restart needed.

## Net effect

Casual swiping gets cheaper AND lands more often (employee-first, miss-proofed).
Serious users flip one switch for verified decision-makers. No fake "Hiring manager"
labels — relation is derived from the contact's real title either way.
