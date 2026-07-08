# PLAN: Scout Voice Tab — talk to Scout, Scout does the work

**Owner:** Rylan (product) · cofounder (agentic Scout backend) · this doc is the shared contract
**Written:** 2026-07-07. References: Wispr Flow keyboard panel (waveform + confirm/cancel),
old-Siri revolving orb, Scout mascot. Replaces the Loops tab in the mobile tab bar.

---

## The product idea (as pitched)

Replace the Loops tab with a **Scout tab**: tap, talk ("craft and send five emails
to hiring managers in investment banking in LA"), Scout performs the action in
the platform. Voice is the *entry layer*; the agentic Scout backend (cofounder,
in progress) is the brain. Results funnel into the surfaces that already exist
(Inbox, Network, Applications). Loops mostly disappear as a user-facing concept.

## Verdict up front

The idea is right, and we're unusually well-positioned: **the hard part of a
voice agent isn't the voice — it's showing trustworthy, live progress on slow
actions, and we already built exactly that** (draft jobs, real stage labels,
push completion, honest failure/retry). The two ways this feature dies are
(1) an agent that mis-hears and sends real emails, and (2) an orb that spins
silently for 40 seconds. Both have concrete answers below.

---

## The holes, poked (and each one's answer)

### 1. Voice + irreversible actions = the trust cliff
ASR mishears ("Goldman" → "Coleman"); intent parsing misfires; and "send" is
irreversible email from the user's real Gmail. One wrong send kills trust in
the whole feature.
**Answer: the receipt card.** Scout NEVER fire-and-forgets an irreversible
action. Reversible actions (draft, search, prep) run immediately — that keeps
the magic. Irreversible ones (send, auto-apply submit) get a one-tap receipt:
"Sending to these 5 people at Goldman — go?" with the names visible. This is
the same philosophy as our send-mode quality gate, extended to voice. Speed
cost: one tap. Trust bought: all of it.

### 2. Voice sets Siri-speed expectations; our actions take 25s–2min
An orb that pulses silently while a 5-contact draft job cooks reads as broken —
the exact disease we just cured in the Inbox.
**Answer: instant acknowledgment + live action cards.** Scout replies in <1s
("On it — drafting 5 hiring managers in IB in LA…") and spawns **action cards**
in the tab that reuse the existing job plumbing: "Found Sarah Kim · Goldman —
writing…" with real stages, then deep-link chips into Inbox/Applications when
done. Push notifies if they leave. Nothing new to build server-side — this is
the instant-feel stack wearing a new face.

### 3. The frontend must not block on the agentic backend
Cofounder's action-Scout is in flight; building UI against an undefined
contract = rework, and shipping nothing until it lands = stall.
**Answer: a thin intent contract + a v1 that works TODAY.**
- **Contract (agree with cofounder this week):** Scout backend replies
  `{ say: string, actions: [{ type, params, needsConfirm, jobRef? }] }` —
  the app renders `say`, executes/confirms `actions`, and polls `jobRef`s
  with the existing job-status pattern. New action types = backend-only change.
- **v1 without the brain:** the app itself maps the 3 highest-value intents to
  EXISTING endpoints — draft outreach (draft-jobs API), auto-apply, meeting
  prep — with a light intent parse. Everything else falls through to the
  existing Scout chat endpoint as conversation. When the agentic backend
  lands, it takes over parsing and the UI doesn't change.

### 4. Do NOT build a custom dictation engine (v1)
Wispr Flow's engine is their whole company. Server-side Whisper streaming
means audio uploads on LTE, latency, cost, load on the small staging box, and
privacy review surface.
**Answer: Apple's on-device speech (SFSpeechRecognizer via the
expo-speech-recognition module).** Free, ~instant partial results (live
transcript animates as you speak — that's the Wispr feel), works offline,
private, zero server load, and genuinely strong for command-style speech.
Keep a server-Whisper upgrade path if real transcripts show quality gaps.
⚠️ **This is a native module: requires a NEW BUILD, not OTA** — new install
on both phones, mic + speech permission strings in the build. Plan it as the
one hard cutover (bundle the stale app.json cleanup into the same build).

### 5. Loops: kill the tab, keep the engine
Agreed with the instinct — Loops-as-UI is rough/unfinished; Loops-as-engine
(recurring autopilot) is exactly what "keep doing this weekly" needs.
**Answer:** Scout tab replaces Loops in the tab bar. The Loops screen stays
route-accessible (existing users, deep links) but unlisted. Later, a spoken
recurring intent ("do this every week") creates a loop under the hood,
surfaced as a small **"Ongoing"** section INSIDE the Scout tab (chips with
pause/stop) — no separate tab. Loop outputs already funnel to Inbox/Network;
nothing moves.

### 6. Voice-only tabs die of blank-screen syndrome
Users won't know what to say; gyms/libraries/class make talking awkward.
**Answer:** suggestion chips of real commands ("Draft 3 IB analysts at
Goldman", "Prep me for my 2pm", "Apply to this week's saved jobs"), a text
input fallback (type the same commands), and recent-actions history so the
tab always has content. Voice is the hero, never the only door.

### 7. App Store / privacy
Mic + speech-recognition permission prompts with honest usage strings;
NO wake word / always-listening in v1 (battery, review risk, privacy optics).
Tap-to-talk (toggle) with clear listening state. On-device recognition keeps
the privacy story clean ("audio never leaves your phone").

### 8. The orb + Scout mascot (the "looks really cool" requirement)
Old-Siri revolving orb: build it native with **react-native-skia** (shader
gradients / metaball blobs reacting to live mic amplitude) — NOT video files.
States: idle (slow breathing) → listening (amplitude-reactive swirl +
live transcript) → thinking (tight fast orbit) → acting (orb morphs into
progress ring around the action card) → done (Scout mascot pop + haptic).
Scout the koala integrates as reaction moments (peek on open, celebrate on
completion), not as a static logo on the orb. Design assets: Figma MCP for
frames/tokens; Higgsfield for mascot pose exploration; final in-app assets
are hand-tuned PNGs/Lottie, generated art as reference only.

---

## Phases

### P0 — Design sprint (2–3 days, parallel-friendly)
Figma frames for the tab (orb states, action cards, receipt card, chips,
Ongoing section); Higgsfield mascot pose exploration; Skia orb prototype in
isolation (amplitude-reactive). Output: one screen flow Rylan signs off.

### P1 — "Talk to Scout" (ship first; ~2–3 days + the NEW BUILD cutover)
Tab swap (Scout replaces Loops; Loops route unlisted). Voice capture with
live transcript (on-device speech) + orb listening/thinking states + text
fallback + suggestion chips → existing Scout **chat** endpoint → rendered
reply. No actions yet. This alone is filmable and demoable.

### P2 — "Scout acts" (~3–4 days, needs the intent contract)
App-side mapping of the top 3 intents to existing endpoints; receipt cards
for send/apply; live action cards on the job plumbing; results deep-link to
Inbox/Network/Applications; draft-ready pushes already work.

### P3 — "Scout the agent" (rides the cofounder's backend)
Agentic backend takes over intent parsing + multi-step plans via the
contract; recurring intents create loops (Ongoing section); optional TTS
voice replies (Scout talks back); Loops route fully retired.

## Decisions needed from Rylan
1. Sign-off on the receipt-card rule (one tap before send/apply — non-negotiable in my view).
2. P0 design direction call once frames exist.
3. Timing of the new-build cutover (it invalidates the OTA generation again — both phones reinstall).
4. Intent contract review with cofounder (I draft it, you two bless it).


---

## P0 review decisions (2026-07-07, Rylan)

- **Scout's room is always night.** The tab keeps its committed navy world in
  BOTH light and dark mode; the rest of the app stays light. Entering the tab
  is a mode switch (quick cross-fade on tab change). Real brand assets locked
  in: badge head in the orb, watercolor ridges as a duotone night-sky horizon
  reaching mid-screen, type bar directly under the suggestion chips.
- **Receipt card scales with the ask (graduated confirmation):**
  1. Reversible (draft/search/prep): NO stop, runs instantly.
  2. Small irreversible (≤5 sends/applies): every name listed, one tap.
  3. Big or vague ("apply to my saved jobs" = 94): a SCOPE step first —
     smart-default chips (Top 20 matches / filtered subset / All), cost
     estimate, and the daily-cap note ("20/day, rest queue for tomorrow").
  4. Recurring ("every week"): becomes an ongoing-loop confirm
     (Just once / Start weekly), surfaced under Ongoing.
- **Copy tone:** never say "irreversible" to users — "A quick look before it
  goes out." Buttons: "Not now" / "Send all 5", "Just once" / "Start weekly".
- Interactive mock (source of truth for the screen):
  https://claude.ai/code/artifact/7dca20af-6052-446c-b8ad-350011956d6a
