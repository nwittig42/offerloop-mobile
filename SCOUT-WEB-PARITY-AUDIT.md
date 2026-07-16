# Scout Web-Parity Audit — 2026-07-09

Audit of the website Scout "blueprint" (scout.zip, received via Messages 2026-07-08) against the
mobile app's current Scout, plus the integration plan to close the gap. Companion artifacts:

- **Blueprint source snapshot**: `Final_offerloop/docs/scout-blueprint-2026-07-08/` (16 modules, 6,178 lines)
- **This app's contract docs**: `SCOUT-ACTION-CONTRACT.md` (v1.1), `PLAN-scout-voice.md`, `SCOUT-RISK-REGISTER.md`

---

## 1. What the zip is (and what it is missing)

The zip is the website backend's `app/services/scout/` package — **newer than any branch in git**
(action modules dated Jul 7–8, zipped Jul 8 10:39; `nick/scout-overhaul` doesn't have them either).
It is a teammate's latest working copy of the Scout brain.

Six modules exist nowhere in the web repo's history: `job_actions.py`, `prep_actions.py`,
`outreach_actions.py`, `contact_actions.py`, `company_actions.py`, plus major rewrites of
`tools.py` (20 helper tools vs our 8), `page_registry.py` (REGISTRY_VERSION 5 vs our 2, 25 routes),
`workflow_state.py` (7 read surfaces vs our 5), and `router.py`.

**2026-07-09 update — the blueprint is now complete.** The paired orchestrator
(`scout_assistant_service.py`, 3,216 lines) arrived via Messages and is saved alongside the
package in `Final_offerloop/docs/scout-blueprint-2026-07-08/`. Verified drop-in ready:

- It passes the consent context (`recent_user_text` / `last_assistant_text` / `user_message`)
  that the package's spend gates require — the fail-open trap flagged in the original audit
  only existed when pairing the new package with the OLD orchestrator; landing both together
  closes it.
- Public API is unchanged: `handle_chat` kwargs match the existing
  `routes/scout_assistant.py` call sites verbatim, and `handle_chat_stream`,
  `handle_search_help`, and the module singleton are all present — **no route changes needed
  for Phase 0**.
- Client envelope unchanged: `{tool, message, navigate, mode, intent, cta, plan, chat_id}`.
- All imports resolve against the current repo; compiles clean.
- Chat model is now `gpt-5-mini` by default (`SCOUT_MODEL` env override), with gpt-5 params
  passed via `extra_body` specifically to survive the repo's pinned openai 1.5x SDK.

---

## 2. Blueprint architecture (what "flawless on the website" actually is)

Four serving tiers, cost-ordered (`metrics.py`): regex router → navigate embedding cache →
answer embedding cache → LLM tool loop. The LLM loop has **no separate intent classifier for
execution** — intent = tool choice. 3 terminal tools (`navigate`, `answer`, `clarify`; exactly one
ends every turn) + 20 helpers dispatched through `run_helper_tool`.

### The 13 executable actions and their receipt shapes

| Action | Cost | Receipt (exact fields) |
|---|---|---|
| `find_contacts` | 5 cr/contact, saves to My Network | `{count, contacts:[{name,title,company,linkedin_url,email,warmth,personalization_hook}], saved_to_network, credits_charged}` |
| `get_company_intel` | free | `{company, overview{}, recent_news[≤5], recruiting_signals{}, divisions[≤8], alumni_at_your_school}` |
| `draft_outreach_emails` | free | `{drafted:[{name,company,recipient_email,subject,gmail_draft_url,contact_id}], skipped:[{name,reason}], count}` |
| `run_meeting_prep` | 30 cr | `{started:true, prep_id, contact_name, credits_charged, estimated_seconds:60}` — client polls `/api/coffee-chat-prep/<prep_id>` and posts digest+PDF back into chat |
| `find_jobs` | free (Firestore catalog) | `{count, jobs:[{job_id,title,company,location,auto_apply_eligible}], query}` |
| `auto_apply_to_job` | pro/elite, ≤3/turn | submit_service payload verbatim; job_id must come from a `find_jobs` result this conversation |
| `find_hiring_managers` | per-manager, saves to recruiters | `{count, managers:[{name,title,company,email,linkedin_url}], saved_to_tracker, credits_charged}` |
| `discover_companies` | 2 cr/company | `{count, companies:[{name,industry,location,size,employee_count,website,founded}], credits_charged, saved_to_history}` |
| `generate_cover_letter` | credits, auto-refund on failure | `{cover_letter, job_title, company, job_url, credits_charged}` |
| `tailor_resume_to_job` | free | `{fit_score, verdict, strengths[≤3], gaps[≤3], edits[≤4]:[{section,current,suggested}]}` |
| `save_strategy` / `update_strategy_progress` | free | strategy memory — one active multi-step plan per user, re-rendered into every turn's system prompt with stall detection |
| `parse_job_url` | free | `{company, job_title, location}` via Firecrawl |
| 7 read-only workflow tools | free | outbox / searches / firm searches / cover letters / preps / applications / loops status envelopes |

### The guardrails (the part that makes spend feel safe)

- **Consent gate**: execute tools require the user's own words to contain a trigger keyword, OR an
  affirmation ("yes", "go ahead") directly answering an assistant offer → else `code: CONSENT_REQUIRED`.
- **Count rule**: `find_contacts` / `discover_companies` refuse without a quantity token in the
  user's message (`COUNT_REQUIRED`) — the model invents counts and silently spends otherwise.
- Tier gate on auto-apply (`TIER_REQUIRED`), ≤3 applies/turn, charge-for-actual-results-only,
  auto-refund on generation failure.
- Cache poisoning guards: any personalized helper sets `workflow_state_touched` so the turn is
  never served cross-user.

### The polish mechanisms (what "feel" means, concretely)

1. **Receipts with deep links** — every execute returns `credits_charged` + where it wrote
   (`saved_to_network` / `saved_to_tracker` / `gmail_draft_url` + `/outbox?contact=<id>`).
2. **One CTA chip per answer** (`answer.cta = {label, route, prefill}`) — prose bridges
   ("want me to…?") are banned; the chip IS the bridge.
3. **Navigate is a plan, never an act** — approve card shows `reasoning` verbatim;
   `auto_submit: true` runs the search on landing but the card still gates spend.
4. **Error codes that never dead-end** — every failure carries a `code` plus the next move:
   `GMAIL_NOT_CONNECTED`→integrations, `INSUFFICIENT_CREDITS`→includes `credits_needed` +
   `current_credits`, `LIMIT_REACHED`→pricing, `NEEDS_RESUME`, `CONTACT_NOT_FOUND`→ask for URL once.
5. **Optimistic async ack** — meeting prep returns instantly with `prep_id` + real progress fields
   (`stage`, `stageLabel`, `progressPct`); the model must never claim it's done.
6. **Latency tiers** — regex 0ms, embedding cache one embed call, LLM only when needed;
   promotion to cache requires 3 distinct users in 24h.
7. **Continuity** — persisted chats (`users/{uid}/scoutChats`, free=24h TTL/1 chat, pro/elite=14d),
   LLM-generated titles, active strategy re-rendered each turn with `[next]` markers + stall flags.

---

## 3. Where the app actually is

Two disconnected Scout surfaces:

- **Scout tab** (`src/app/(tabs)/index.tsx`, 1,956 lines) — voice-first, well-engineered, but runs
  on an **interim client-side brain**: regex ladder + `/api/mobile/scout/ask` (a v0 translator the
  app team hand-rolled, serving only `classify` + `find_contacts`) + legacy execution endpoints
  (draft-jobs, prompt-search, find-hiring-manager, auto-apply submit).
- **Modal chat sheet** (`src/app/scout.tsx`) — opened from the header yeti on every non-tab
  screen; bare chat against `/api/scout-assistant/chat`, frozen pre-P2. Separate chat_id and
  history from the tab; the two conversations never see each other.

**The core structural fact**: the app never talks to the real brain. `/api/mobile/scout/ask` is a
stopgap whose own docstring says it's waiting for "Nick's brain" — and the zip IS that brain.
The SCOUT-ACTION-CONTRACT (8 action types, confirmedAction round-trip, error envelope) is mostly
aspiration: the app sends an invented `action`+`params` RPC dialect, never sends
`conversationId`/`confirmedAction`, inspects only `actions[0].results.items`, ignores the `type`
field, and silently drops companies/document results and unmappable nav chips.

### Hole list (all file:line refs verified)

**Modal sheet — weakest surface**
- `chat_message` chips are broken buttons: navigates on `a.href` unconditionally but href is
  undefined for chat chips (`scout.tsx:219-225` vs `scout.ts:29,95-100`).
- Chat-history sidebar is a "coming soon" stub (`scout.tsx:354-358`) — while the backend's saved
  chats endpoints (`GET /api/scout-assistant/chats`, `/chats/<id>`) already exist, unused.
- Unbounded history resent every turn (`scout.tsx:74-77`); no retry button; failed exchanges
  replayed as context (`scout.tsx:94-98`).

**Scout tab**
- **No visible transcript** — only the latest reply, auto-cleared after 20s (`index.tsx:338`);
  long answers and Scout's own questions vanish irrecoverably.
- `find_jobs` never touches the server — filters the already-loaded feed, cap 4
  (`index.tsx:984-1001`); off-feed roles dead-end.
- "Draft the best N" re-runs the search instead of drafting the previewed people
  (`index.tsx:1510-1523`) — the trust-debt item the risk register flags.
- Contact cards display-only; `linkedinUrl` fetched, never used (`index.tsx:1490-1509`).
- Re-hydration skips `auto_apply`/`meeting_prep` jobRefs (`index.tsx:488`) and invents
  `progressPct: 30` (`index.tsx:490,493`) despite the never-invent rule.
- Credit errors detected by regex on message text (`/credit/i`, `index.tsx:434`) — no
  `error.code` affordances (top-up, reconnect Gmail, cap_reached).
- `executeApplyIntent` says "Submitted N" when it only started N (`scoutActions.ts:663-667`);
  applyScope caps at 20 with no capNote (`scoutActions.ts:633-642`).
- `prep` intent is just a nav chip (`index.tsx:1020-1027`) — no `run_meeting_prep` execution.
- People-search failures always blame the connection (`index.tsx:977`).
- **PostHog key is empty** (`app.json:78`) — the entire scout_* instrumentation is a no-op;
  risk register #1 still live.
- Server ASR founder-allowlisted (`index.tsx:124-128`); voice needs post-07-07 native build.

---

## 4. Gap map — blueprint actions vs app boundary

App surfaces: Feed (swipe), Inbox, Scout (center tab), Network, Profile; plus meeting-prep,
outreach/[id], company/[name], apply-questions, saved/passed jobs, loops (unlisted), credits.

| Blueprint action | App scope | Notes |
|---|---|---|
| `find_contacts` | ✅ IN | App has preview-only free version today; brain version charges + saves to Network |
| `draft_outreach_emails` | ✅ IN | The app's hero flow; receipts → outreach/[id] + Inbox instead of gmail_draft_url web links |
| `run_meeting_prep` | ✅ IN | meeting-prep screens + polling pattern already exist; wire `prep_id` polling into chat |
| `find_jobs` | ✅ IN | Replaces the local-feed-only matcher; results deep-link into feed cards / saved-jobs |
| `auto_apply_to_job` | ✅ IN | App already has the auto-apply pipeline + apply-questions UI |
| `get_company_intel` | ✅ IN | Renders on/links to company/[name] |
| `find_hiring_managers` | ◑ PARTIAL | Render as contact cards; app has no recruiter tracker screen — receipts say "saved to your tracker on web" |
| 7 workflow reads | ◑ PARTIAL | outbox/applications/loops statuses map to Inbox/Applications; cover-letter + firm-search reads are web-only surfaces |
| `discover_companies` | ⛔ DEFER | No firm-search UI in app |
| `generate_cover_letter` | ⛔ DEFER | No cover-letter surface |
| `tailor_resume_to_job` | ⛔ DEFER | No resume surface (could later render as chat text) |
| `save_strategy` / strategist briefing | ⛔ DEFER | Web panel feature; candidate for a later "game plan" moment in the app |
| `navigate` + CTA chips | ✅ IN | Must route through the app's route translator (`scout.ts:39-54`); unmappable chips need a graceful fallback, not a silent drop |

Out-of-scope actions shouldn't be *broken* — the brain's system prompt for the mobile surface
should exclude their tools (a `surface: "mobile"` flag selecting a tool subset), so Scout never
offers what the app can't render.

---

## 5. Implementation plan

### Phase 0 — Land the brain in the backend (`Final_offerloop`) — PREREQUISITE
*De-risked 2026-07-09: the paired orchestrator arrived and every compatibility check passed.
Phase 0 is now a near-verbatim copy, not a reconciliation.*
1. On a fresh branch off `origin/main`: copy the blueprint snapshot
   (`docs/scout-blueprint-2026-07-08/`) over `backend/app/services/scout/` (16 modules — the
   5 `*_actions.py` are purely additive; nothing in the repo imports those names today) and
   `backend/app/services/scout_assistant_service.py`. No route changes required — the
   orchestrator's public API (`handle_chat` kwargs, `handle_chat_stream`,
   `handle_search_help`, singleton) matches the existing call sites verbatim.
2. `REGISTRY_VERSION` 2→5 auto-invalidates the embedding caches — correct, no action.
3. Confirm `gpt-5-mini` is enabled on the OpenAI key (it's the website's running model, so it
   should be); `SCOUT_MODEL` / `SCOUT_REASONING_EFFORT` env overrides exist if not.
4. Run the pinning suites: `test_scout_assistant_cutover`, `test_scout_router`,
   `test_scout_cache`, `test_scout_workflow_state`, `test_scout_strategy*`, etc. Expect
   intentional failures where behavior changed (retired find-people regex rule, registry v5
   routes) — update those tests to pin the new behavior, investigate anything else.
5. Ship on main via the normal fast-forward flow. **This alone upgrades the app's modal sheet
   and tab chat fallback** — both already call `/api/scout-assistant/chat`, which gains all
   13 actions the moment the package lands.

### Phase 1 — Real brain behind the mobile contract (backend)
- Replace the v0 if/elif in `POST /api/mobile/scout/ask` (mobile.py:813) with the full chat loop,
  translated into the SCOUT-ACTION-CONTRACT envelope `{say, actions[], askId}`:
  terminal `answer.text` → `say`; helper receipts → typed `actions[].results`
  (contacts/jobs/companies/document); `navigate`/`cta` → nav actions through the route
  translator; error codes → the contract's `error` envelope.
- Implement the confirmation round-trip (`confirmedAction` on the same endpoint) so server-side
  `needsConfirm` replaces the client-only spend gate.
- Add a mobile tool-subset flag so out-of-scope tools are never offered.
- Keep `classify` + `transcribe-ask` untouched (voice leg is already good).

### Phase 2 — App consumes the contract
- Dispatch on `action.type` for all in-scope types; render receipts natively: contact cards
  (tappable → LinkedIn/outreach), drafted-email receipts → outreach/[id] + Inbox deep links,
  meeting-prep action card polling `prep_id` to completion (digest posted into chat),
  job results → feed/saved-jobs deep links, per-job apply outcomes.
- Replace the credit-regex with `error.code` affordances: `INSUFFICIENT_CREDITS`
  (+credits_needed/current_credits) → top-up sheet; `GMAIL_NOT_CONNECTED` → reconnect;
  `LIMIT_REACHED` → upgrade; `CONSENT_REQUIRED`/`COUNT_REQUIRED` → Scout asks naturally.
- Fix re-hydration: handle `auto_apply` + `meeting_prep` jobRefs; drop invented progressPct.
- Draft-the-previewed-people: pass the exact previewed contact ids into the draft action.

### Phase 3 — Conversation parity (app UX)
- **Visible, persistent transcript** on the tab (kill the 20s auto-clear; scrollable thread).
- **Unify the sheet and the tab**: one conversation (shared chat_id + history), one code path.
- Wire the saved-chats sidebar to the existing `GET /chats` endpoints (free=1 chat is the
  upgrade affordance, mirroring web).
- Fix the sheet's chat_message chip bug; cap sheet history at 8 turns like the tab; add retry.

### Phase 4 — Measurement + voice ungating
- Paste the PostHog key (`app.json:78`) — every debate about Scout is currently data-blind.
- Ship the mic-permission-copy build; lift the founder allowlist on server ASR.
- TTS/receipt polish per PLAN-scout-voice P3 leftovers.

### Quick wins shippable today (independent of the brain)
sheet chip bug · sheet history cap · retry affordance · 20s auto-clear · invented progressPct ·
"Submitted N" → "Started N" honesty fix · PostHog key.

---

## 6. Open questions for the team

1. ~~Get the paired `scout_assistant_service.py`~~ — **received 2026-07-09, verified, saved
   to the snapshot dir.** (`routes/scout_assistant.py` / `routes/mobile.py` from the same
   machine no longer needed for Phase 0 — existing routes are call-compatible — but still
   worth grabbing before Phase 1 in case the author's mobile translator evolved too.)
2. Is production web actually running the blueprint code (manual deploy?), or is it ahead of
   prod too? origin/main does not contain it.
3. Confirm the mobile contract endpoint path: contract says `/api/scout/ask`, reality is
   `/api/mobile/scout/ask`. Lock one.
4. `find_hiring_managers` receipts on mobile: OK to save to the web recruiters tracker with a
   "view on web" note, or hold until the app grows a surface?
