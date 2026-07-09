# Scout risk register — predicted issues, triggers, and mitigations

*Written 2026-07-08 at the hardening phase-out. Each entry: what will go
wrong, the signal that says it's happening, and the prepared answer. Ordered
by expected time-to-bite.*

## 1. No analytics on the landing-tab bet  ⏰ bites first
Scout is the landing screen on a judgment call. The check was supposed to be
"watch first-tap behavior," but mobile PostHog isn't wired (`posthogKey` is
empty in app.json). **Trigger:** we're arguing about the landing screen with
anecdotes. **Mitigation:** wire PostHog (or a minimal event log to Firestore)
for: landing-tab first tap, Scout ask count/day, gate outcomes
(run/cancel/edit rates on pre-flight). The cancel-rate on the spend gate is
also the mishear-rate metric we currently can't see.

**INSTRUMENTED 2026-07-08 (OTA-able, no native deps):** the Scout tab now
emits `scout_first_action` (orb/typed/chip/notifications), `scout_ask`
(intent, voice/typed/chip/variant source, ASR-corrected flag),
`scout_ask_classified`, `scout_ask_edited`, `scout_gate` +
`scout_gate_outcome` (every trust-ladder card: spend / fishy_company /
preflight_coach / did_you_mean / clarify / refine / receipt / apply_one /
repeat / context_inferred — outcome run/cancel/variant, method tap/voice),
and `scout_action_completed` (draft/apply, ok, no_credits). Mishear rate =
`scout_gate_outcome` where gate in (spend, fishy_company) and outcome =
cancel. **Still needed to go live:** paste the web project's PostHog key
into app.json → expo.extra.posthogKey (grab `VITE_PUBLIC_POSTHOG_KEY` from
Render env or PostHog project settings), then OTA publish. Events no-op
until then.

## 2. PDL spend on free previews
Preview is uncharged but each browse costs a real PDL lookup. **Trigger:**
PDL line item grows without matching draft revenue (watch for 2 weeks —
Nick's caveat, blessed). **Mitigation, pre-agreed:** per-day preview cap
per user (server-side counter in the user doc), NOT credit charging. The
provider-spend Telegram alerting built in June is the natural place to add
a PDL meter.

## 3. Preview → draft mismatch (trust debt)
"Draft the best 3" re-runs the search rather than drafting the exact people
previewed; dedup/rank drift means occasional different names. **Trigger:**
a user says "that's not who you showed me." **Mitigation:** draft-by-contact
endpoint (web has the machinery — emails.py generates for selected
contacts); wire preview cards to carry contact ids and draft exactly those.
Medium backend lift; do it when previews get real usage.

## 4. The brain swap (Nick's translator)
When /api/scout/ask (Nick's) lands, the interim client mapper gets deleted
and intent moves server-side. **Trigger:** his skeleton behind a flag.
**Mitigations prepared:** the app already talks to the same path shape;
plan the cutover as a flag flip with the regex ladder retained as offline
fallback; run his say-mapping vs our classifier on the same 17-utterance
battery before flipping; keep the spend gate CLIENT-side (defense in depth
— never trust even our own brain with uncomfirmed spends).

## 5. New-user first-run lands on an empty Scout
Fresh signups now land on the orb with no loops, no saved jobs, maybe no
Gmail connection — drafts still work (contacts save, compose links exist)
but the magic is dimmer. **Trigger:** TestFlight feedback "what do I say?"
**Mitigation:** first-run overlay (one-time): three example asks + the mic
permission pre-prompt; suggestion chips already rotate, lean them toward
no-setup asks (find jobs, browse people) for users with no Gmail.

## 6. ASR quality ceiling
The fix-map + fuzzy + classifier ladder handles the common damage, but
Apple's on-device model will keep inventing phrases in loud rooms.
**Trigger:** spend-gate cancel rate stays high (see #1) or users retype
often. **Mitigations in order of cost:** feed the mic contextual strings
(expo-speech-recognition supports `contextualStrings` — seed with
KNOWN_FIRMS + the user's target companies; cheap, do next build);
server-Whisper fallback for final transcripts (privacy/latency tradeoff);
Nick's brain semantic repair (already specced).

## 7. TTS in the wrong room
Scout speaking replies aloud is delightful until it happens in a lecture.
Current guards: only voice-initiated asks get spoken replies; new
ask/tab-leave interrupts. **Trigger:** complaint or reflexive
volume-slamming. **Mitigation:** respect the iOS silent switch (expo-speech
honors the audio session — verify on device), plus a "Scout speaks" toggle
next to the spend toggle. One-line each; ship on first complaint.

## 8. Loop-propose flow is specced but unbuilt
Voice loop-creation was resolved as propose-only (opens setup pre-filled).
The loop setup screen doesn't accept prefill params yet. **Trigger:** Nick's
brain starts emitting propose_loop. **Mitigation:** add route params to
/loops setup (company/role/cadence prefill) — small, do it when the enum
activates.

## 9. Branch hygiene is still the prod blocker
Everything lives on staging/mobile-field lineage; main is behind. The
longer the divergence runs, the scarier the migration. **Trigger:**
TestFlight prep (already the agreed gate). **Mitigation unchanged:**
cherry-pick/reconcile before TestFlight; never merge the local WIP branch.

## 10. Two repos, one contract
The contract now lives in both repos (mobile + backend/docs). They WILL
drift. **Trigger:** any contract edit. **Rule:** mobile copy is canonical;
copy to backend/docs in the same session as any edit (one cp command —
this file is the reminder).

## Closed this session (for the record)
Mic hearing Scout's own TTS · out-of-credits generic error (now named +
Get-credits chip) · context-inferred confirms missing cost · garbage
companies reaching PDL via free preview · chip taps inheriting voice-ness ·
zombie job cards on open · false-promise chat replies for target-shaped
asks · stateless clarify forgetting Bain · mishear spend (the gate).
