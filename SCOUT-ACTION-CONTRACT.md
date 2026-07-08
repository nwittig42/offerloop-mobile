# Scout Action Contract v1

**The boundary between the Scout tab (app, Rylan/Claude) and the Scout brain
(backend, Nick).** The app renders and executes whatever conforms to this
shape; the brain can get infinitely smarter without a single UI change.
Bless this before building against it — changes after both sides ship are
10× the cost.

Companion docs: `PLAN-scout-voice.md` (product decisions), the interactive
mock (P0 sign-off artifact).

---

## Request — app → brain

`POST /api/scout/ask` (name negotiable — could also extend the existing
scout-assistant chat endpoint with a mode flag)

```json
{
  "ask": "send five emails to hiring managers in investment banking in LA",
  "source": "voice" | "typed" | "chip",
  "askId": "ask-<uuid>",            // idempotency, same pattern as swipe_id
  "conversationId": "…",            // optional: continue a thread
  "confirmedAction": null            // see Confirmation round-trip below
}
```

## Response — brain → app

```json
{
  "say": "On it — drafting 5 hiring managers in IB in LA.",
  "actions": [ Action, … ],          // zero or more
  "askId": "ask-<uuid>"
}
```

- `say` renders as Scout's reply (and later feeds TTS). Always present, even
  with no actions (pure conversation falls back to chat behavior).
- Zero actions = conversational answer only.

### Action

```json
{
  "type": "draft_outreach" | "send_outreach" | "auto_apply" | "meeting_prep" | "create_loop",
  "params": { …type-specific… },
  "needsConfirm": false | Confirm,
  "jobRef": null | { "kind": "draft_job" | "auto_apply" | "meeting_prep", "id": "…" }
}
```

**Execution rule (locked in design review):** reversible actions
(`draft_outreach`, `meeting_prep`, searches) run immediately —
`needsConfirm: false`, `jobRef` present in the SAME response. Irreversible
ones (`send_outreach`, `auto_apply` submit) and recurring ones
(`create_loop`) always carry a `Confirm` and NO jobRef until confirmed.

### Confirm — the receipt card, graduated (locked in design review)

```json
{
  "style": "targets" | "scope" | "recurring",
  "title": "Ready to send — 5 emails",
  "summary": "Hiring managers · Investment banking · Los Angeles",

  // style: "targets" (small concrete ask, ≤5): every name shown
  "targets": [ { "name": "Sarah Kim", "company": "Goldman Sachs" }, … ],

  // style: "scope" (big/vague ask): brain proposes options, FIRST is default
  "options": [
    { "id": "top20",  "label": "Top 20 matches",   "count": 20, "creditEstimate": 100 },
    { "id": "bayarea","label": "Bay Area only",     "count": 31 },
    { "id": "all",    "label": "All 94",            "count": 94 }
  ],
  "capNote": "20 applications per day — the rest queue for tomorrow",

  // style: "recurring" (create_loop)
  "cadence": "weekly",
  "declineLabel": "Just once",   // declining recurring can still run once
  "confirmLabel": "Start weekly"
}
```

### Confirmation round-trip

User taps confirm → app POSTs the SAME endpoint:

```json
{ "askId": "…", "confirmedAction": { "type": "…", "params": { …, "scopeOptionId": "top20" } } }
```

Brain executes and responds with `say` + the action now carrying a `jobRef`.
Unconfirmed = nothing committed, ever (abandonment is safe by design).
`askId` idempotency: replaying a confirmed ask must NOT double-execute
(same discipline as swipe_id on prompt-search).

## jobRef → live progress (already built, reuse as-is)

- `draft_job` → poll `GET /api/mobile/draft-jobs/{id}` (2.5s, rate-limit
  exempt): status/stage/stageLabel/progressPct/foundContacts + stage timings.
- `auto_apply` → existing auto-apply status endpoint.
- `meeting_prep` → existing coffee-chat-prep polling.
The app renders these as action cards with REAL stages (never invented
progress). Push notifications on completion already fire from these systems.

## Re-hydration (P2 requirement, small)

`GET /api/scout/active` → `[ { jobRef, title, startedAt } ]` — the app's
Scout tab redraws in-flight cards after a full app kill. Work already
survives server-side; this makes the cards survive too.

## Errors

```json
{ "say": "I couldn't find anyone matching that — want me to widen it?",
  "actions": [], "error": { "code": "no_results" | "insufficient_credits" | "gmail_disconnected" | "cap_reached", "detail": "…" } }
```

Errors speak in `say` (user-facing words, no codes on screen); `error.code`
lets the app add the right affordance (top-up link, reconnect Gmail, etc.).

## Interim plan until the brain lands

The app ships P2 with a CLIENT-SIDE mapper for the top 3 intents calling the
existing endpoints directly, shaped as if a brain had returned this contract.
The day the real endpoint speaks this shape, the mapper is deleted — the UI
doesn't change. Anything the brain can't fill yet (scope options, say-text
quality) degrades gracefully: a generic scope card, a templated say line.

## Open questions for Nick

1. Endpoint: new `/api/scout/ask` vs a mode on the existing scout-assistant
   chat? (App is agnostic; pick whatever fits your architecture.)
2. Streaming `say` (token-by-token) — nice for long replies; v1 can be
   non-streaming.
3. Multi-action responses (e.g. "draft 5 AND apply") — contract supports an
   array; confirm each Confirm renders as its own card, executed independently.
4. Who computes credit estimates on scope options — brain (preferred, it has
   the counts) or app?
