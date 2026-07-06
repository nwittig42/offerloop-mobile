# PLAN: Instant-Feel — make every long-running action feel immediate and never broken

**Owner:** Rylan (product) / whoever implements (this doc is the handoff)
**Written:** 2026-07-06, after the Nick field-test pile-up (4 swipes → 4 "Couldn't draft")
**Repos:** `~/offerloop-mobile` (Expo app) + `Final_offerloop/backend` (Flask, `staging/mobile-field` branch)

---

## The product principle

A swipe is a promise. The moment the card flies off, the user believes the draft
is happening. Every failure mode below breaks that promise — and each break reads
as "half-baked app," which is worse than "slow app." The goal is not 5-second
drafts; it's **zero broken promises + visible, honest progress + real speed where
it's cheap to get**.

"How do normal apps do it": instant acknowledgment → durable server-side job →
honest progress → push when done. We have all the raw parts already built; they
are just not connected.

---

## What's actually wrong today (verified in code, file:line refs)

### App side (`~/offerloop-mobile`)
1. **No swipe queue.** Each right-swipe fires an independent `runSwipe()` —
   fire-and-forget, unbounded parallel (`src/store/app.tsx:919`). Five fast swipes
   = five simultaneous 25–60s server requests. The staging box can cook ~2 at a
   time; the rest starve, time out, and fail. This is exactly what happened to Nick.
2. **"Tap to retry" is fake.** A failed row's tap just opens an empty draft editor
   (`src/app/(tabs)/inbox.tsx:368` → `outreach/[id].tsx:427-455`). No code path
   re-runs the draft. The one real "draft again" helper (`draftAnotherContact`,
   `app.tsx:1045`) is only wired to the company page.
3. **No timeout.** `apiFetch` (`src/api/client.ts:48-96`) never aborts. A hung
   request = a permanent "Drafting…" zombie row.
4. **Progress is cosmetic.** The pretty DraftingRow phrases rotate on a 1.7s timer
   (`inbox.tsx:105-173`) — they're not connected to what the server is doing.
5. **Push exists but isn't used for freshness.** The server already sends a
   `draft_ready` push per swipe batch (`draft_ready_notify.py`) and the app
   already receives it (`src/notifications/push.ts:20-46`) — but reception doesn't
   refresh the inbox. We literally suppress the banner and do nothing.

### Server side (`backend/`)
6. **The whole draft pipeline is synchronous.** `POST /api/prompt-search`
   (`runs.py:211-1116`) blocks a gunicorn worker for the full parse → PDL →
   enrichment → LLM writing → Gmail-draft chain. Workers are the scarcest thing
   we have (2 on staging). One burst of swipes starves everything, including the
   innocent `/api/mobile/me` call — which is why the "Reconnecting" banner shows
   up exactly when users are most active.
7. **Retries are dangerous right now.** No idempotency key. A retry after a
   partial failure (drafts created, save not committed) **creates duplicate Gmail
   drafts and charges credits twice** (draft creation `runs.py:897` happens before
   deduction `runs.py:966` and save `runs.py:1080`). This must be fixed *before*
   we add aggressive auto-retry.
8. **Credit display mismatch (small but trust-eroding):** app shows
   `creditsPerSwipe: 10` (`mobile.py:288`); actual charge is `5 × contacts drafted`
   (`runs.py:966`).

### The good news (already built, reusable)
- **The async-job pattern exists and works**: coffee-chat prep creates a Firestore
  job doc, spawns a background thread, returns an id immediately, client polls
  every 4s, worker updates stage/progress %, refunds credits on failure
  (`coffee_chat_prep.py:303-476`). This is the exact architecture the swipe needs.
- **Push infra is complete end-to-end** (`push_service.py`, tokens at
  `users/{uid}/devices/*`, Expo push, auto-pruning dead tokens).
- **Caches are strong**: PDL search 30-day shared cache, enrichment cache (7d/24h
  TTLs), resume-text cache on the user doc. Repeat searches are already fast.
- **Optimistic UI foundation is good**: placeholders, reconciliation, per-user
  cache persistence, animated drafting rows — the bones are right.

---

## The plan — four phases

### Phase 0 — "Never feel broken again" (app-only, ships OTA **today**, no reinstall)

| # | Change | Where |
|---|--------|-------|
| 0.1 | **Swipe queue**: serialize draft requests client-side (max 1–2 in flight; the rest wait). Queued placeholders show "Queued…" then flip to "Drafting…" when their turn starts. Swiping 10 fast becomes *the intended UX*. | `app.tsx` `beginDraft` |
| 0.2 | **Real retry**: failed row tap → actually re-runs the draft for that company (reuse `draftAnotherContact` logic), placeholder returns to "Drafting…". Until Phase 1 idempotency lands, retry only fires when the original request *failed cleanly* (network error / non-2xx), never on ambiguous timeout — avoids duplicate-draft risk. | `inbox.tsx`, `app.tsx` |
| 0.3 | **Client timeout + zombie sweep**: abort draft requests at 150s (server allows 300; if it hasn't answered in 150 it's lost); mark row failed-with-retry. On app foreground, any `drafting` row older than ~4 min gets reconciled against the server (it may have actually succeeded — the inbox poll already handles this, make it immediate on resume). | `client.ts`, `app.tsx` |
| 0.4 | **Push-driven freshness**: on receiving the existing `draft_ready` push, invalidate the inbox query → the finished draft pops in seconds after completion instead of at the next 60s poll. Same for auto-apply status pushes when Phase 3 adds them. | `push.ts`, `usePushNotifications.ts` |

**Effect:** burst swiping can no longer produce "Couldn't draft" from pile-ups;
every failure has a working retry; nothing hangs forever. This alone removes ~all
of the "broken app" impressions from the field test.

### Phase 1 — "Retries are always safe" (backend, ~1 day, ships with next staging deploy)

| # | Change | Where |
|---|--------|-------|
| 1.1 | **Idempotency key on prompt-search**: app sends a `swipeId` (uuid per gesture); server records it on a request doc before doing work; a duplicate `swipeId` returns the original outcome instead of re-running. Kills duplicate drafts + double-charging forever, and unlocks fearless auto-retry in the app. | `runs.py`, `swipe.ts` |
| 1.2 | **Charge before work, refund on failure** (same TOCTOU pattern coffee-chat already uses) — today credits deduct *after* Gmail drafts are created, so a mid-pipeline crash charges nothing but a retry double-creates. Align order: deduct → run → refund on failure. | `runs.py` |
| 1.3 | **Fix the 10-vs-5×N credit display mismatch** — decide the real per-swipe price, make `mobile.py:288` and the deduction agree, and update app copy. | `mobile.py`, `runs.py` |

### Phase 2 — "The draft is a job, not a request" (backend + app, ~3–4 days — **the centerpiece**)

Convert the mobile swipe→draft to the proven coffee-chat async pattern, factored
into a small reusable helper this time:

- **`POST /api/prompt-search` (mobile path) returns in <1 second** with a job id.
  The pipeline runs in a background thread; the job doc in Firestore carries
  `status`, `stage`, `stageLabel`, `progressPct` — updated at each real step:
  `parsing → searching → found (name/company!) → researching → writing → drafting → done`.
- **Generic job helper** (create-doc → spawn thread → update-stage → refund-on-fail
  → poll endpoint, extracted from `coffee_chat_prep.py`) so every future feature
  gets this for free.
- **Bounded worker pool** (e.g., 3 concurrent draft jobs server-side, rest queue
  in order). Bursts queue gracefully **regardless of instance size** — a bigger
  Render box becomes a throughput upgrade, not a crash fix.
- **App polls the job** every 2–3s (poll endpoint rate-limit-exempted like
  coffee-chat's) and the DraftingRow shows **real** progress. The magic moment:
  ~5s after the swipe the row updates to "Found **Sarah Kim** at Adyen —
  researching…" with the real name. That's the "it's actually happening right
  now" feeling, and it's honest (no fake numbers/social proof — house rule).
- **Push completes the loop** (`draft_ready` already sent) → inbox updates
  instantly even if the user backgrounds the app mid-draft.
- Gunicorn workers are freed in <1s per swipe → `/me` never starves → the
  Reconnecting banner effectively never appears from user activity again.

### Phase 3 — real speed + everywhere-consistency (ongoing, measure first)

- **Instrument stage timings** in the job doc (we get this free from Phase 2) →
  see exactly where the 25–60s goes per swipe (LLM writing and enrichment are the
  prime suspects). Optimize the top stage only, with data.
- **Warm the caches for demos**: PDL + enrichment caches are shared and 30-day —
  swiping target companies once before filming makes on-camera drafts fast. (Also
  applies to real users: second student searching Adyen is fast for free.)
- **Speculative prefetch (evaluate cost first)**: when a card sits on top of the
  deck >2s, pre-warm the PDL search for that company. PDL calls cost money —
  gate behind measurement of how often top-card → swipe converts.
- **Apply the pattern to the rest of the app**:
  - **Auto-apply**: already async (8s poll in Network tab) — add a push on
    terminal status + reflect "Applying…" state on the job card in the feed, not
    just buried in Network.
  - **Meeting prep**: already the model citizen — add `draft_ready`-style push on
    completion so the user doesn't have to sit on the screen.
  - **Company pages**: cache-miss fetch is a slow synchronous SERP+Firecrawl call
    (`mobile.py:528`) — return cached-or-skeleton instantly and fill in via the
    job pattern.
  - **Loops**: `loopsQuery` never auto-refreshes (`app.tsx:662`) — add poll while
    a loop is running + push on cycle completion.
- **Kill the mock-profile flash**: `profile = meQuery.data ?? MOCK_PROFILE`
  (`app.tsx:300`) briefly shows fake data on cold start before cache restore —
  show a skeleton instead of sample data when signed in.

### Phase 4 — infrastructure honesty (decide when mobile goes real)

- Staging (512MB, 2 workers) is fine **after Phase 2** because workers stop being
  the bottleneck. For filming days or a beta cohort: Standard instance ($25/mo)
  = comfort margin, not a requirement.
- Long-term: merge mobile routes to `main` so the app rides the production
  service — the always-on box that already serves offerloop.ai.

---

## Sequencing & effort

| Phase | Effort | Ships via | Risk |
|-------|--------|-----------|------|
| 0 | ~half a day | OTA update (both phones, next launch) | Low — app-only |
| 1 | ~1 day | staging deploy | Low — additive |
| 2 | ~3–4 days | staging deploy + OTA | Medium — touch the hero path; do behind the existing `notify_draft_ready` mobile flag so web is untouched |
| 3 | ongoing | per-item | Low, data-driven |
| 4 | decision, not code | Render dashboard / git | — |

Order: **0 → 1 → 2**, then 3 continuously. Phase 0 alone ends the "broken app"
impression; Phase 2 makes "swipe a bunch" genuinely delightful.

## What we will NOT do
- No fake progress numbers, no invented "found 3 contacts!" counts before the
  server confirms them (house rule: no fake numbers / no fake social proof).
- No client-side auto-retry until idempotency (1.1) makes it safe.
- No preemptive server upsizing — Phase 2 removes the reason bursts crash it.
