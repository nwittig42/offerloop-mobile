# Feed Personalization, the Exposure Ceiling, and Live Job Search

Exploration + spec, 2026-07-11. Written after mapping the live code across the mobile app and the staging backend. Answers: how does the profile talk to the feed/Scout/contacts, does it update live, why do users get "boxed in," and how do we build the way out (starting with live job search).

---

## 1. The direct answers to "how is our personalization / does it update live?"

Three different subsystems, three different behaviors:

| Surface | Personalized by profile? | Reflects a profile edit… | Reaches the full universe? |
|---|---|---|---|
| **Contacts** (Scout drafts, swipe-to-draft) | No — prompt-driven; profile only **re-orders** results (same-city/major = tiebreak), never filters | **Instantly** (fresh Firestore read every call) | **Yes** — full 2.2B PDL, any role/company/location |
| **Scout** (the assistant framing) | Yes — writes your school/year/industry into the search prompt it builds | **≤60s** (profile context is TTL-cached 60s) | Contacts: yes. Jobs: **no** (see below) |
| **Job feed** | Yes — ranks + optionally gates a shared pool against your profile | **Not until the cache ages out (~30min–2h)**, and only if the edit even persisted (it often doesn't — see §4) | **No** — bounded three ways (see §3) |

So: **contacts are essentially not boxed at all** — that's the good news, and it's why the hero (find people → draft) works for anyone. The ceiling you felt is **entirely on the jobs side**, and it's real.

---

## 2. How the job feed actually works today

- **The pool is a fixed, shared scrape.** Every user's feed is filtered from **one global Firestore `jobs` collection**, populated by a cron pipeline (`pipeline/fetcher.py`, GitHub Action every 2h) that pulls from a **hardcoded list of ~hundreds of Greenhouse / Lever / Ashby / Fantastic.jobs employers**. No live search, not per-user. If a job's employer isn't in that slug list, **it can never appear in anyone's feed.**
- **Personalization = ranking, not (by default) dropping.** `GET /api/jobs/feed` ranks the pool for you: it collapses you to one inferred "field" (from `careerTrack` or resume `major`) and gives **+40 points to same-field jobs** (`job_ranking.py`), so a Software-Engineer profile's SE jobs sort to the top of a 1,000-ID cache, of which only **300 are hydrated** into the deck. Adjacent roles exist in the pool but sit below the visible window.
- **The hard gates are OFF by default.** `hardIntentGating` defaults false, so the feed isn't *deleting* non-matching jobs out of the box — it's *burying* them. (When that flag is on, it additionally drops any posting with zero keyword overlap — turning "ranked low" into "never shown.")
- **The deck is one flat, merged stack.** In the app, `top_jobs` + `new_matches` are concatenated into a single `<SwipeDeck>`. **No tabs, no sections, no filters, no search bar, no "show all."** A left-swipe/pass is **local-only** — it never hits the server, so passes don't even train the ranker.

**Net:** the feed shows you a well-ranked slice of a fixed pool, tuned to one inferred field, with no in-app control to look anywhere else.

---

## 3. Why users get boxed in — the three stacked ceilings

1. **Pool ceiling:** the feed can only ever surface jobs from the scraped employer list. Everything outside it is invisible — permanently.
2. **Ranking ceiling:** you're reduced to one field; adjacent roles/industries/cities get buried below the 300-job window and are effectively unreachable by swiping.
3. **No release valve:** the app exposes no way to broaden — no explore/search, no role/location/company toggles, and the one backend escape hatch (`?ungated=true`) is never wired to the client.

The user experiences this as "I picked Software Engineer once and now that's all Offerloop is." Personalization is doing double duty: it's both **"what's most relevant"** *and* **"the only thing you can access."** Those must be decoupled.

---

## 4. Two real bugs to fix regardless of the bigger vision

Found during the map — both make personalization feel broken:

1. **Editing your Target Roles/Industries in the Profile tab doesn't persist.** `profile.tsx` writes only the local React Query cache; it never POSTs to `/api/mobile/preferences`. Only the onboarding step and the location screen actually save to the server. So a user "updates their profile" and nothing changes — because the server never heard about it. **Fix: wire the Profile roles/industries editor to POST `/api/mobile/preferences`.**
2. **A profile edit never re-tunes the feed.** `/api/mobile/preferences` saves the fields but does **not** bust `jobFeedCache`, so the feed keeps serving the old ranked slice for up to ~2h. **Fix: on preferences write, null `jobFeedCache` (same as `?ungated`) so the next feed load reranks against the new profile.** This is what makes "update profile → feed changes" feel instant.

These two together are probably a big part of why it feels like "the profile isn't talking to the feed" — because right now, from the Profile tab, it literally isn't.

---

## 5. The "expand your exposure" design

The principle: **keep personalization as the default lane, add explicit lanes to reach the whole universe.** Concretely, four moves, roughly in priority order:

### A. Live job search (the keystone — spec in §6)
Give Scout and a search surface the ability to query the job providers **live**, unshackled from the feed and the scraped pool. This is the single highest-leverage fix: it turns "product manager in LA → nothing in your feed" into a real result set, for any role/location, regardless of profile. Ships as `POST /api/mobile/jobs/search`.

### B. Feed tabs / sections — break the single deck
Replace the one merged stack with lanes:
- **For You** — today's personalized deck (what exists now).
- **Explore / adjacent** — the same pool but *un-gated* and re-ranked to deliberately surface adjacent fields, new industries, other hub cities (call `/api/jobs/feed?ungated=true`, which already exists and already busts the cache). Zero backend work — just wire the toggle.
- **By company** — the per-company role decks already exist (`fetchRolesByCompany`); expose them as a browsable lane.

### C. In-app broaden controls
Let users widen without re-onboarding: multi-select target roles/industries, add cities, "include adjacent roles," pin dream companies. All of these already have backend fields — they just need UI + the persistence fix from §4. A quick win: a "Show me more than [field]" chip on the feed that flips to the ungated lane.

### D. Train on behavior
Send passes/saves to the server so the ranker learns (right now passes are thrown away client-side). Over time this widens exposure automatically — the feed learns you swipe on PM roles even though you onboarded as SE.

**Framing for the roadmap:** A + the two bug fixes in §4 are the fast-follow (small, high-impact, mostly wiring). B + C are the v1.x "exposure" release. D is ongoing.

---

## 6. Spec: `POST /api/mobile/jobs/search` (live job search)

**Goal:** a live job query, like the website, reachable from Scout's `find_jobs` and (later) a search bar — not filtered from the feed.

**What exists to reuse:** `fetch_jobs(query, location, num_results)` (`job_board.py:454`) → `search_jobs_live` (Perplexity `sonar`, `perplexity_client.py:257`) with a built-in 4h global cache (`enrichment_cache`) and a SerpAPI fallback. **No scoring, no ATS tags, no Firestore doc** — it returns a lean stub: `{title, company, location, url, summary}`.

**Request** (behind `@require_firebase_auth`, in `mobile_bp`):
```json
{ "query": "product manager", "location": "Los Angeles", "limit": 12 }
```

**Server:**
1. `jobs, _ = fetch_jobs(query, location, num_results=limit)` — gets Perplexity + 4h cache + fallback for free.
2. Normalize each stub to the **feed's snake_case job dict**: `url → apply_url` (critical — the app's `mapJob` and ATS detection both read `apply_url`), `summary → description`, synthesize a stable `job_id`.
3. Run through **`_serialize_jobs(...)`** so each job gets `ats_platform` + `auto_apply_eligible` stamped exactly like feed jobs (the hostname-based ATS detector handles the "aggregator link → real ATS" case correctly).

**Response** (mirror `/api/jobs/search` so the app reuses `mapJob` unchanged):
```json
{ "results": [ /* serialized feed-shape jobs */ ], "count": 12, "query": "product manager" }
```

**Latency:** ~3–8s per uncached query (one Perplexity call). Decision below on sync vs async.

### Two decisions to make before building

1. **Auto-apply on live jobs — the one real snag.** `POST /api/job-board/auto-apply/prepare` re-loads the job from `jobs/{id}` in Firestore. Live-searched jobs aren't in that collection → `prepare` 404s. So even when the eligibility badge shows ✓, actually auto-applying will fail. Options:
   - **(a) Persist each live result** to `jobs/{synth_id}` (or a user-scoped mirror) before returning, so `prepare` finds it. Makes auto-apply "just work," at the cost of writing ad-hoc jobs into the catalog (keep them flagged/ephemeral so they don't pollute the curated pool).
   - **(b) Live jobs are link-apply only** — badge honestly says "apply on site," open `apply_url` in-browser (the app already has this fallback). Simpler, ships faster.
   - *Recommendation:* ship **(b)** with the live search, add **(a)** as a follow-up. Don't let the auto-apply-persistence question block the search itself.
2. **Sync vs async.** ~3–8s is borderline for a blocking call. Either accept a synchronous spinner (simplest), or use the same `{pending:true}` 202 + poll pattern the company-intel endpoint already uses (`mobile.py`). *Recommendation:* start synchronous with a clear loading state; revisit if p95 latency hurts.

**App wiring:** in `index.tsx`, when `find_jobs` returns nothing from `matchJobs(allJobs,…)` (and/or always, for an explicit search), call the new endpoint and render results through the existing `mapJob` → job cards. This closes the "nothing in your feed" dead-end with real live results.

---

## 7. Sequencing

- **Fast-follow (v1.1, post-submission):** §4 bug fixes (persist Profile edits + bust feed cache) · §6 live job search endpoint + Scout wiring, link-apply variant.
- **Exposure release (v1.x):** §5B feed tabs (For You / Explore / By company) · §5C broaden controls.
- **Ongoing:** §5D behavioral training · §6 decision (a) auto-apply on live jobs.

None of this is a v1 submission blocker — the hero (contacts → drafts, full database) is unaffected. This is the "don't let personalization become a cage" track.
