# Crustdata vs PDL evaluation, findings + method handoff

For: Sid (website integration testing). From: Rylan + Claude, 2026-08-17.
Trial state when this doc was written: roughly 64 of 100 Crustdata trial
credits remain, roughly 950 PDL test credits remain. Both keys live in the
usual env locations (CRUSTDATA key: ask Rylan; do not commit it anywhere).

## 1. Verdict in one paragraph

Used label-aware, Crustdata beat PDL on every axis we could measure from
code: cost per usable contact ($0.39 measured, at the quoted $12,600 for
80k credits), bounce safety (their per-email "deliverable" label passed
independent SMTP verification 9 of 11 times), coverage (found every person
and every prompt we threw at it, including ones PDL whiffed on), latency
(0.5 to 1.3s), and API ergonomics (errors list every valid field, empty
results are free). PDL's emails bounced at roughly 50 percent across 21
verified addresses and carry no per-email quality signal at all, which is
the root cause of our bounce problem. Crustdata used blindly would be
mediocre too: the win comes specifically from filtering on their
deliverability labels. Pricing gets cheaper with volume (they showed
Rylan tiers; exact numbers TBD, get them in writing).

## 2. The numbers

### 2a. Funnel test (the one that matters)

Three app-realistic prompts, both providers pushed through the same gates
our production pipeline applies: search, currently-at-company check, email
in hand, Hunter SMTP verification as the send gate.

| Prompt | PDL usable | Crustdata usable |
|---|---|---|
| software engineer at DoorDash | 4 of 5 records | 2 of 2 enriched |
| marketing manager at Nike | 0 (five records, one email, risky) | 2 of 2 |
| consultant at Deloitte | 2 of 5 | 1 of 2 |
| totals | 6 usable from 15 credits | 5 usable from 12.45 credits ($1.96) |

Cost per usable contact: Crustdata $0.39 measured. PDL 2.5 credits per
usable; dollar figure depends on their negotiated rate (public PAYG rates
put it around $0.63).

### 2b. Matched pairs (controls for "different samples" bias)

Six identical humans (chosen from PDL's OWN best records, all with PDL
work emails) enriched in both providers. Crustdata found 6 of 6 people.
Raw email quality on this hostile sample (all Google, strict mail servers)
was a wash: PDL 3 of 6 deliverable, Crustdata 1 clean plus 2 no-email.
The differentiator: every weak Crustdata email arrived labeled "unknown",
so a label-aware pipeline discards them before sending. PDL gives no
signal, so its 3 bad emails would have been sent and bounced.

### 2c. Aggregate email quality across all batches

- PDL: 21 work emails verified via Hunter SMTP. 10 deliverable. Roughly
  half would bounce if sent blind. Quality varies wildly by company
  (great at DoorDash, zero usable at Nike).
- Crustdata: emails labeled "deliverable" by them passed Hunter 9 of 11
  times (82 percent). Emails labeled "unknown" were mostly junk. Their
  labels are the product.

### 2d. Pricing facts

- Quote: 80,000 credits for $12,600 = $0.1575 per credit. Volume tiers
  get cheaper (Rylan saw them; get the schedule in writing).
- Person search: 0.03 credits per result returned. Empty results free.
  Errored requests free.
- Person enrich with contact bundle: 2.0 credits when contact data comes
  back, 1.0 when the person matches but has no email (yes, charged with
  no email; contract question).
- Repeat enrich of the same person: charged again, no server-side cache.
- Credits expire 6 months after purchase.
- Rate limits: 15 to 30 requests per minute on search/enrich.

## 3. Gotchas that cost us credits (do not repeat)

1. The enrich param for emails is `fields: ["basic_profile", "contact"]`.
   NOT `include`, which the API accepts silently, ignores completely, and
   charges for. Three credits died teaching us this.
2. Persist every raw API response to disk BEFORE printing or truncating.
   Two responses were paid for and lost to a `head` pipe.
3. `contact.has_business_email` is not a filterable field. The filter you
   want is `experience.employment_details.current.business_email_verified`.
4. A deliberately invalid filter field is FREE and the 400 error lists
   every legal field name. Best API discovery trick available.
5. Watch the multi-position wrinkle: a person can match a search on
   current company X while their deliverable email is at current company
   Y (real example: matched as Deloitte, email at their own fund). Decide
   how the pipeline should treat those before integrating.

## 4. Method (rebuild this for the website)

The credibility of every number above comes from these rules:

1. Read pricing docs first, then verify empirically: check the FREE
   credits endpoint (`GET /account/credits`) before and after every paid
   call and record actual deltas. We caught two undocumented behaviors
   this way (silent include, charged no-email enrich).
2. Ground truth for emails is SMTP verification, not provider claims. We
   used Hunter's email-verifier (`GET /v2/email-verifier`), which does the
   handshake the receiving mail server would. Statuses: deliverable,
   risky (usually accept-all domains, unprovable without sending), and
   undeliverable (would hard-bounce). No test emails were sent to anyone.
3. Control the sample. Our first comparison accidentally used different
   people from different companies per provider and flattered Crustdata.
   The fix, in order of strength: (a) matched pairs, same human looked up
   in both providers by LinkedIn URL; (b) same prompt, both providers,
   identical downstream gates; (c) vary company mix deliberately, since
   Google-type strict domains and consultancy-type accept-all domains
   produce opposite verification profiles.
4. Test the funnel, not the API. Raw hit counts mean nothing; usable
   contacts after our actual gates (at-company, email present, SMTP pass)
   are what users get. Report cost per usable contact.
5. Budget discipline: set a hard ceiling, track a running total, quote it
   in every report, stop early when a finding stabilizes. Cheap failures
   first (free error probes before paid calls).

Suggested website-side additions Sid is better placed to run: a larger
labeled-deliverable sample (50-plus) across mid-market companies, the
accept-all domain question (only production bounce tracking truly answers
it), alumni-filter quality at scale (education.schools.school fuzzy match
vs our school alias list), and end-to-end drafting through the web
pipeline with Crustdata contacts swapped in behind the existing interface.

## 5. Open contract questions (unchanged, still blocking)

1. Written right to store and re-serve records indefinitely, including
   after termination. Our entire caching and warehouse architecture
   (pdl_search_cache, firm_employees) assumes this.
2. Behavior at the credit limit: warning thresholds and grace, not a
   silent hard 402 (PDL burned two production days that way).
3. Volume tier schedule in writing, and whether trial-observed behavior
   (2.0-credit contact enrich) matches production plans.
4. Credit-back policy for enriches that return no email, and for emails
   whose "deliverable" label fails immediate independent verification.

## 6. Artifacts

Session scratchpad (ask Claude in the mobile-repo session, or rebuild from
this doc): crustdata_test.py (client + credit tracking; NOTE: this one has
the trial key inline, so never commit it), matched_pairs_run.py (controlled
pairs), playbook_compare.py (funnel comparison), plus raw JSONL captures of
every response. Hunter and PDL keys come from the staging env at runtime.
Keep every key out of git.
