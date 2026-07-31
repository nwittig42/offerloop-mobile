# SPEC: Scout Intelligence v2, the loose conversational brain

**Status: proposal, waiting on Rylan's approval. Nothing in here is built yet.**
Written 2026-07-21. Companion docs: `SCOUT-VOICE-HANDOFF.md`, `SCOUT-ACTION-CONTRACT.md`,
`PLAN-scout-voice.md` (this spec IS the P3 "Scout the agent" phase, teched out).

---

## 1. The north star (what Rylan asked for)

A student picks up the phone and says any of these, and Scout just handles it:

- "Apply to five jobs for me"
- "Apply to a job in tech"
- "Find a person who works at Deloitte in Los Angeles who graduated from USC"
- "Who should I email at Goldman?"

No memorized commands, no niche phrasing rules, no dead ends. And critically: this
should not be a recurring maintenance problem where every new phrasing needs a new
rule added by hand.

## 2. Where we are today (the honest audit)

The current brain is a hand-written rule list in `src/api/endpoints/scoutActions.ts`
(873 lines). It checks the sentence against about 20 patterns in a fixed order:
does it contain a job word AND a search verb, does it end with a location, is the
company at most 4 words, and so on. It recognizes 5 things: find people, draft
outreach, find jobs, apply to saved jobs, meeting prep. The file's own header calls
it "deliberately dumb" and says it gets deleted when a real server brain lands.

It is actually pretty good at what it covers (firm-name autocorrect for about 20
finance firms, did-you-mean rescue, one-question clarify, spend confirm cards).
The problem is everything it does not cover. Real asks that fail or dead-end today:

| A student says | What happens today |
|---|---|
| "Apply to a few jobs for me" | No match. Falls through to the chat fallback. |
| "Apply to a job in tech" | No general path exists. Auto-apply only works on jobs already in the feed, saved, or in one of 16 hardcoded "vibe" sectors. |
| "Find me product manager jobs" | Searches only the jobs already loaded in the feed. If none match, it dead-ends with "nothing in today's feed." |
| "Who should I email at Goldman?" | Question-shaped, so the rules treat it as chat, not an action. |
| "Someone at Bain who went to USC" | The school part is silently dropped. There is no school slot in the parser at all. |
| "In LA at Goldman" | Location is lost, because the rules only find a location at the END of a sentence. |
| "Any openings at Stripe?" | No search verb, so it is not recognized as a job search. |
| "I need a summer analyst gig" | "Gig" is not on the job-word list. |

Every one of these is fixable by adding another rule. That is exactly the
whack-a-mole Rylan does not want. The fix is to stop playing.

## 3. The fix: flip the brain

### Plain-language version

Today: rules first, AI as a fallback. Tomorrow: AI first, rules as a speed shortcut.

We put a small, fast AI model on the server whose only job is translation. It gets
the student's sentence plus context (their target companies, their contacts, their
school, the job card on screen, the last few turns of conversation) and it must
answer in exactly one of three ways:

1. **An action**, filled in: `find_contacts(company: "Deloitte", location: "Los
   Angeles", school: "USC")`. The model does not run anything. It fills out a form.
2. **One clarifying question**, only if something essential is genuinely missing.
3. **Plain conversation**, if the student is just asking a question.

Then our existing machinery takes over: the same confirm cards, the same spend
guard, the same credit checks, the same endpoints. The AI plans, our code commits.
The model literally cannot invent an action we did not define, because the API
forces its answer into our fixed action schema (both OpenAI and Anthropic support
strict schema enforcement, and the backend already has both clients).

This is not experimental. It is the pattern the whole industry converged on
(OpenAI function calling, Anthropic tool use, Apple App Intents, and even Rasa,
the classic intent-classifier company, now ships an LLM layer). The old approach
of enumerating every phrasing is dead; the new approach enumerates ACTIONS with
typed parameters and lets the model do the language part. That is what makes
"apply to a job," "can you apply somewhere for me," and "just submit me to
something in tech" all land on the same action with zero new rules.

### Why the answer is not "train our own model"

At 300 users, fine-tuning a custom model is the wrong tool: expensive to build,
instantly stale, and worse than a good prompt on a frontier mini-model. What
"training" actually looks like at our scale is an **eval set**: a file of 150 to
300 real student utterances (mined from Scout logs, the regex misses, and the
corpus in section 7), each labeled with the correct action and parameters. Every
prompt change gets scored against it before shipping. That gives us the improvement
loop Rylan wants (Scout measurably gets smarter) without owning a model. If we
someday have tens of thousands of logged asks, fine-tuning a small router becomes
worth revisiting.

### What we keep (nothing user-facing gets thrown away)

- The confirm/scope/clarify/receipt cards in the Feed tab. They are the trust model.
- The action contract: reversible runs immediately, irreversible always confirms,
  voice never sends (draft only), max one clarify round, max one pending confirm.
- The spend guard (`scoutConfirmSpend`) and every credit check, all server-side.
- The `ScoutAskEnvelope` response shape and the re-hydration plumbing. The router
  slots in behind the existing `/api/mobile/scout/ask` surface.
- The regex layer survives as a demoted fast path: if the ask is an exact,
  unambiguous match ("prep me for this meeting", a bare known firm name), answer
  instantly and skip the server round trip. Everything else goes to the router.

### The consequential flag (borrowed from OpenAI's GPT Actions)

Every action in the catalog carries one bit: consequential or not.

| Tier | Actions | What the user experiences |
|---|---|---|
| Read, reversible | find contacts, find jobs, company intel | Runs immediately, results appear |
| Write, reversible | draft outreach (draft only, never send) | Runs, draft appears with undo |
| Consequential | auto-apply submit, anything spending credits by voice | Read-back card with a verb button: "Apply to these 3 · 15 credits", one tap |

The model cannot flip this bit. It lives in our action catalog, not in the prompt.

## 4. "Apply to jobs for me": a three-level ladder

**Level 1, from the feed (buildable now, client-only, no backend).** This is
`apply_some` from SCOUT-VOICE-HANDOFF.md section 3. "Apply to a few jobs" pulls
candidates from the current feed, filters `autoApplyEligible`, prefers the
profile's target roles, defaults to an honest 3 when no count is given, shows the
scope card with the actual job list and real credit cost, then runs the existing
`startAutoApply` per job with per-job honest results ("2 applied, 1 needs a
work-authorization answer" with a deep link to fix it).

**Level 2, from the full pool ("apply to a job in tech").** The backend already
holds a ~129k-job pool, but Scout can only query it through 16 hardcoded sector
keys. One new backend endpoint unlocks this: free-text job search over the pool
(role, location, company, seniority as optional filters), returning real job IDs
with `autoApplyEligible`. Then "apply to a job in tech," "find remote marketing
internships," and "anything at Stripe" all become: router fills the search form,
pool returns candidates, scope card confirms, auto-apply runs. Half of this
already exists (`/api/jobs/search?company=X` works today and is simply not wired
into Scout).

**Level 3, anything on the internet.** The pool is a fixed scraped employer list;
a company not on it can never appear. Live ATS-wide search is real engineering
and is explicitly out of scope for now. Scout should be honest at the boundary:
"I do not see open roles I can apply to at that company yet" beats pretending.

## 5. The Deloitte-USC ask (people search that matches the website)

"Find a person at Deloitte in LA who went to USC" needs a school parameter end to
end. The web Find already searches by university through People Data Labs, so the
capability exists server-side. Work: add `school` (and optionally grad year and
major) to the router's `find_contacts` schema and pass it through the mobile
search path. "My school" resolves from the profile automatically. This is the
single highest wow-per-effort item in the spec, because alumni outreach is the
core student behavior and today the phrase "went to USC" is silently discarded.

## 6. What we take from Wispr Flow (Rylan's stated bar)

Researched how Flow actually gets its quality. Four mechanisms, all extrapolatable:

1. **Context beats better ears.** Flow does not have magic speech recognition; it
   feeds surrounding context (the app you are in, nearby text, recipient names) to
   a correction model so proper nouns come out right. Scout equivalent: inject the
   on-screen job card, the user's target companies, saved contacts, and school into
   the router call. "Dell Oyt" becomes Deloitte because Deloitte is on the user's
   own list. This replaces our hardcoded 20-firm autocorrect table with something
   personal and unbounded. (The free layer, iOS `contextualStrings` biasing, is
   already shipped in the staging build. This is the smart layer on top.)
2. **Intent-preserving correction.** Flow drops false starts and honors mid-sentence
   repairs ("5pm, actually 6" becomes 6pm). Our router absorbs this for free with
   one prompt instruction: honor repairs, so "find someone at Bain, no wait, BCG"
   means BCG.
3. **Personal dictionary.** Flow lets users teach it words. Ours builds itself:
   every saved contact, target company, and the user's school feed both the speech
   biasing list and the router's correction vocabulary. No settings screen needed.
4. **Perceived speed via streaming.** Flow feels instant because partials stream.
   We already show live partial transcripts while the student talks. Add: optimistic
   "thinking" state the moment the router identifies the action, and stream the
   spoken/text reply. A 600 to 800ms server round trip feels fine when the screen
   is already moving. (Flow hits sub-500ms with in-house models; we do not need to.)

Latency budget honesty: mini-model router calls land around 300 to 800ms. The
regex fast path stays at 0ms for the easy cases. Cost is fractions of a cent per
ask; at our volume the router is noise next to PDL spend.

## 7. The student utterance corpus (seed for the eval set)

The categories below become the eval file. Each line gets labeled with the correct
action and parameters. Target 150 to 300 lines before the router ships; grow it
from real logs after (risk register #1: paste the PostHog key so we actually
capture asks).

**Apply, no discovery first:** apply to five jobs for me · apply to a job in tech ·
just apply somewhere · can you submit some applications tonight · apply to
anything that fits my resume · apply to that Google job (screen context) · finish
my applications · apply to consulting internships in Chicago.

**People, with constraints:** find someone at Deloitte in LA who went to USC ·
alumni from my school at Bain · a USC grad in banking in New York · who do I know
at McKinsey · someone on the Google recruiting team · a VP at Evercore · find me
three people in consulting who went to Michigan.

**Question-shaped actions (today these fall to chat):** who should I email at
Goldman · can you find me a recruiter at Meta · is there anyone at JPMorgan I
should talk to · what jobs are open at Stripe · should I reach out to someone at
Bain (this one IS a question; the router should answer, then offer the action).

**Vague or emotional (clarify or coach, never dead-end):** help me get a job ·
I have not heard back from anyone · do everything for me · I have an interview
Friday and I am not ready · make me sound less desperate · what should I do today.

**Compound (v2 stretch, router can propose the first step honestly):** find three
people at Deloitte and draft emails to all of them · apply to that job and email
the recruiter · prep me for my Bain coffee chat and remind me tomorrow.

**Repairs and follow-ups:** no, I meant BCG · actually make it five · not that
one, the one in Chicago · same thing but at Morgan Stanley.

## 8. Conversation shape (what changes in the thread)

- **One clarify, maximum, and only when a required field is truly ambiguous.**
  Research on clarifying agents backs what the contract already says: one good
  question works, chains of questions kill voice UX. The prompt rule is: if you
  can pick a most-likely value, pick it and let the confirmation card display it.
  The card IS the second chance; that is why it exists.
- **Repair is a first-class move.** The router keeps the last action in the
  conversation state, so "no, I meant Bain" patches the company field and re-runs,
  instead of starting a new conversation.
- **Suggestion chips come from the router.** Today's refine options are hand-built
  variants. The router returns up to 3 context-aware next-move chips with every
  reply ("Draft the best 2", "Only alumni", "Different city"), which makes the
  thread feel alive without the user having to know the command language.
- **Slot memory stays.** The rolling company/role/count/location context (already
  built, decays after 3 turns) is passed into the router so "make it five" works.

## 9. Phasing, ownership, effort

**Phase A: client-only, this staging session, days.**
`apply_some` from the feed (section 4 level 1), per the handoff doc. Plus: route
question-shaped asks that name a firm to the server classifier instead of chat.
No new native modules, no backend.

**Phase B: the router, backend + mobile, the real build, 1 to 2 weeks of backend
work.** New or evolved `/api/mobile/scout/ask`: small model (GPT-4o-mini or
Haiku), strict-schema action catalog (find_contacts with school, draft_outreach,
find_jobs, apply_jobs, meeting_prep, ask_clarification, chat), user vocabulary
injection, consequential flags, cross-provider fallback, plus the eval harness.
This is Nick's server-brain territory per the parallel-session boundaries; the
cutover deletes `scoutActions.ts` wholesale, exactly as its header predicts. The
contract envelope means mobile changes are small: mostly deleting code.

**Phase C: pool job search + apply-cold (level 2), backend, after B.** Free-text
pool search endpoint, wire `fetchRolesByCompany` into Scout, honest boundary
messaging for off-pool companies.

**Phase D: voice polish, ongoing.** TTS silent-switch handling and a "Scout
speaks" toggle (risk #7), streaming replies, barge-in, and eventually the full
Wispr-style always-listening dictation mode Rylan wants down the road. Turn-based
push-to-talk stays the model for v1; full-duplex realtime voice is a separate
project and not worth it yet.

## 10. Risks and guardrails carried forward

- **Credits and irreversibility:** the model never executes. Auto-apply keeps its
  always-confirm scope card. All credit math stays server-side. No price is ever
  hardcoded (read from profile/config).
- **PDL spend on free previews** (risk #2, still open): the router will make people
  previews EASIER to trigger, so the per-day preview cap should ship with Phase B.
- **App Store 3.1.1:** nothing here sells anything. Confirm cards show credit
  costs, never purchase links.
- **No fake numbers:** scope cards show only real candidate lists and real costs;
  per-job results report what actually happened, including failures.
- **Contract drift** (risk #10): the action catalog lives in one place server-side;
  mobile renders whatever the envelope says. This spec makes drift less likely,
  not more.
- **Privacy:** context injection sends the user's own targets/contacts/screen job
  to our backend and on to the model API. Same data we already send for drafting,
  but it should be a line in the privacy policy before Phase B ships.

## 11. Open questions for Rylan

1. Default count when a student says "a few jobs": 3 feels honest. Confirm.
2. Apply-cold candidate policy: only `autoApplyEligible` and target-role matches,
   or is a looser "best available" acceptable when the strict filter finds nothing?
3. Phase B owner and timing: this is server work in Nick's lane. Do we brief Nick
   with this spec as-is, or does the mobile session prototype the router against
   staging first (doable, but it doubles the throwaway code)?
4. Eval set: OK to start logging full ask transcripts (with the PostHog key
   finally pasted in) so the corpus grows from real usage?
