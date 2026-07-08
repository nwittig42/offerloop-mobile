import { runSwipe, type DraftJobProgress, type SwipeResult } from '@/api/endpoints/swipe';
import { startAutoApply } from '@/api/endpoints/autoApply';
import type { Job } from '@/types';

/**
 * The INTERIM Scout brain (SCOUT-ACTION-CONTRACT.md, "Interim plan until the
 * brain lands"): a light client-side intent mapper that shapes the top asks
 * exactly as if Nick's /api/scout/ask had returned the contract. When the real
 * endpoint speaks the contract, this file is deleted and the UI doesn't
 * change. Everything here calls EXISTING endpoints — no new intelligence,
 * no new server surface.
 *
 * Contract rules honored:
 *  - Reversible (drafts, finds-that-draft, preps) run immediately.
 *  - Irreversible (auto-apply submit) always gets a Confirm (scope card).
 *  - Broad asks get at most ONE clarify round, then best effort.
 *  - "send" asks are downgraded to drafts (send_outreach is reserved pending
 *    the explicit product decision) and the say-text says so honestly.
 */

// ---------------------------------------------------------------------------
// Voice autocorrect
// ---------------------------------------------------------------------------

/** Common voice-recognition mishears of the firms our users actually chase
 *  (IB / consulting / tech). Deterministic word-boundary fixes, applied to
 *  the transcript BEFORE parsing and SHOWN corrected in the witnessed ask —
 *  the user sees the fix and can Edit if we guessed wrong. */
const ASR_FIXES: [RegExp, string][] = [
  [/\bgol?d?man\s*(sex|sacks|sachs?|sax|saks)\b/gi, 'Goldman Sachs'],
  [/\bj\.?\s*p\.?\s*morgan\b/gi, 'JPMorgan'],
  [/\bmorgan\s*stanl(ey|y|ee)\b/gi, 'Morgan Stanley'],
  [/\bmc\s*kin(sey|zee|zy|sy)\b/gi, 'McKinsey'],
  [/\bmickenzie\b/gi, 'McKinsey'],
  [/\bbane\s+(and|&)\s+(company|co)\b/gi, 'Bain'],
  [/\bdeloit\b/gi, 'Deloitte'],
  [/\bblack\s+stone\b/gi, 'Blackstone'],
  [/\bblack\s+rock\b/gi, 'BlackRock'],
  [/\bever\s+core\b/gi, 'Evercore'],
  [/\bcenter\s+view\b/gi, 'Centerview'],
  [/\bmo\s+(ellis|less|liss)\b/gi, 'Moelis'],
  [/\bjeff?er(ys|eys)\b/gi, 'Jefferies'],
  [/\bbark?l(eys|ies)\b/gi, 'Barclays'],
  [/\bcredit\s+swiss\b/gi, 'Credit Suisse'],
  [/\bcity\s+group\b/gi, 'Citigroup'],
  // Role-word mishears (Rylan field test: "Managers" heard as "Manners")
  [/\bmanners\b/gi, 'managers'],
  [/\bmangers\b/gi, 'managers'],
  [/\brecru(i)?ters?\b/gi, 'recruiters'],
];

export function normalizeAsk(raw: string): { text: string; corrected: boolean } {
  let text = raw;
  for (const [re, fix] of ASR_FIXES) text = text.replace(re, fix);
  return { text, corrected: text !== raw };
}

/** The firms our users actually target (IB / consulting / tech / PE-HF).
 *  Used ONLY for did-you-mean fuzzy rescue — an unknown company runs as-is
 *  (plenty of real startups aren't on any list; never block those). */
const KNOWN_FIRMS = [
  'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Bank of America', 'Citigroup',
  'Wells Fargo', 'Barclays', 'UBS', 'Deutsche Bank', 'RBC', 'Jefferies',
  'Evercore', 'Lazard', 'Centerview', 'Moelis', 'PJT Partners', 'Houlihan Lokey',
  'Rothschild', 'Guggenheim', 'Perella Weinberg', 'Qatalyst',
  'McKinsey', 'Bain', 'BCG', 'Deloitte', 'PwC', 'EY', 'KPMG', 'Accenture',
  'Oliver Wyman', 'Kearney', 'LEK', 'Alvarez and Marsal',
  'Blackstone', 'KKR', 'Apollo', 'Carlyle', 'TPG', 'Warburg Pincus',
  'Citadel', 'Point72', 'Millennium', 'Two Sigma', 'Jane Street', 'DE Shaw',
  'Bridgewater', 'Vista Equity', 'Silver Lake', 'General Atlantic', 'BlackRock',
  'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix', 'Nvidia',
  'Stripe', 'OpenAI', 'Anthropic', 'Databricks', 'Palantir', 'Salesforce',
  'Uber', 'Airbnb', 'LinkedIn', 'Snowflake', 'Figma', 'Ramp', 'Plaid',
  'Coinbase', 'Robinhood', 'DoorDash', 'Tesla', 'SpaceX', 'Scale AI',
];

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/** Did-you-mean rescue: if the parsed company is a near-miss of a firm we
 *  know (likely ASR damage the fix-map didn't cover), suggest the real name
 *  BEFORE spending a run on it. Exact/close-enough matches and true unknowns
 *  both return null — only genuine near-misses interrupt. */
export function suggestFirm(company: string): string | null {
  const c = company.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (c.length < 3) return null;
  for (const firm of KNOWN_FIRMS) {
    const f = firm.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if (c === f) return null; // already right
  }
  let best: string | null = null;
  let bestScore = Infinity;
  for (const firm of KNOWN_FIRMS) {
    const f = firm.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const d = editDistance(c, f);
    if (d < bestScore) {
      bestScore = d;
      best = firm;
    }
  }
  // Tolerance scales with length; "golman sax" → "goldman sachs" is d=3/13.
  const tolerance = Math.max(1, Math.floor(c.length * 0.3));
  return best && bestScore > 0 && bestScore <= tolerance ? best : null;
}

// ---------------------------------------------------------------------------
// Intent parsing (deliberately dumb — the real brain replaces this)
// ---------------------------------------------------------------------------

const NUM_WORDS: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export type DraftIntent = {
  kind: 'draft';
  count: number;
  role: string;
  company: string | null;
  location: string | null;
  hm: boolean;
  wantedSend: boolean;
};
export type ApplyIntent = { kind: 'apply_saved' };
export type PrepIntent = { kind: 'prep' };
export type JobSearchIntent = { kind: 'find_jobs'; query: string; location: string | null };
/** Browse-only: see people BEFORE deciding to draft (web-Find parity).
 *  Explicit browse phrasings only — "find me a hiring manager" still drafts
 *  (that behavior is field-validated); "show me / who works at" previews. */
export type FindPeopleIntent = { kind: 'find_people'; role: string; company: string; location: string | null };
export type ScoutIntent =
  | DraftIntent
  | ApplyIntent
  | PrepIntent
  | JobSearchIntent
  | FindPeopleIntent
  | null;

/** Spoken shorthand for roles — expanded before matching job titles. */
const ROLE_SYNONYMS: Record<string, string> = {
  pm: 'product manager',
  apm: 'associate product manager',
  swe: 'software engineer',
  sde: 'software engineer',
  ib: 'investment banking',
  ux: 'designer',
  ml: 'machine learning',
  bd: 'business development',
};

function parseJobSearch(ask: string, lower: string): JobSearchIntent | null {
  // "find me a PM role to apply to", "can you find me product manager jobs",
  // "apply to a consulting internship" — a role noun + job word IS the ask.
  const jobWordy = /(role|job|jobs|position|positions|internship|internships|opening|openings)/.test(lower);
  const searchy = /(find|get|show|search|look|apply|hunt)/.test(lower);
  if (!jobWordy || !searchy) return null;
  // "apply to my saved jobs" is the bulk-apply intent, not a search.
  if (/(saved|my jobs)/.test(lower)) return null;
  const m = lower.match(
    /(?:find|get|show|search(?: for)?|look(?: for)?|apply(?: to)?|hunt)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+)?([a-z /&\-]{2,40}?)\s*(?:roles?|jobs?|positions?|internships?|openings?)/,
  );
  let query = (m?.[1] || '').trim();
  if (!query) return null;
  query = query
    .split(/\s+/)
    .map((w) => ROLE_SYNONYMS[w] || w)
    .join(' ')
    .trim();
  let location: string | null = null;
  const loc = lower.match(/\bin\s+([a-z .\-]{2,32})[,.!?]?$/);
  if (loc) location = loc[1].trim();
  return { kind: 'find_jobs', query, location };
}

/** Score a job title against the expanded query — every query token must
 *  appear somewhere in title+company for a hit; eligible-to-auto-apply
 *  first, feed order (already location-ranked) breaking ties. */
export function matchJobs(jobs: Job[], query: string, location: string | null): Job[] {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!tokens.length) return [];
  const hits = jobs.filter((j) => {
    const hay = `${j.title} ${j.company}`.toLowerCase();
    const locOk = !location || (j.location || '').toLowerCase().includes(location.toLowerCase());
    return locOk && tokens.every((t) => hay.includes(t));
  });
  return [
    ...hits.filter((j) => j.autoApplyEligible),
    ...hits.filter((j) => !j.autoApplyEligible),
  ].slice(0, 4);
}

export function parseIntent(ask: string): ScoutIntent {
  const lower = ask.toLowerCase().trim();

  // Job hunting reads as a question half the time ("can you find me a PM
  // role to apply to?") — check it BEFORE the question guard so it never
  // dead-ends at the chat brain asking for a job URL (Rylan field test
  // 2026-07-08: talk-and-go must not require URLs).
  const jobSearch = parseJobSearch(ask, lower);
  if (jobSearch) return jobSearch;

  // Browse-only people search: explicit look-don't-draft phrasings
  // (including bare "people at X" — it names a crowd, not a pick).
  if (
    (/(^|\b)(show me|who works|who do (i|we) know|look up|browse)\b/.test(lower) ||
      /\bpeople\s+at\s+\S/.test(lower)) &&
    /\bat\s+\S/.test(lower)
  ) {
    const atM = ask.match(/\bat\s+([A-Za-z0-9&.\-' ]{2,40}?)(?:\s+in\s+|[,.!?]|$)/i);
    const locM = ask.match(/\bin\s+([A-Za-z .\-]{2,32})[,.!?]?$/i);
    const roleM = ask.match(/(?:show me|look up|browse)\s+(?:the\s+|some\s+)?([A-Za-z /\-]{2,40}?)\s+at\s+/i);
    if (atM) {
      return {
        kind: 'find_people',
        role: (roleM?.[1] || '').trim().replace(/\b(people|folks|everyone|anyone)\b/gi, '').trim(),
        company: atM[1].trim(),
        location: locM ? locM[1].trim() : null,
      };
    }
  }

  // Question-shaped asks are conversations, not commands — let the chat brain
  // answer ("what should I say in a follow up email" must never spawn a job).
  if (/^(what|how|why|when|where|who|should|can|could|would|do|does|is|are|am)\b/.test(lower) || lower.endsWith('?')) {
    if (/(prep me|meeting prep|coffee chat)/.test(lower)) return { kind: 'prep' };
    return null;
  }

  if (/(coffee chat|meeting prep|prep me|prep for)/.test(lower)) return { kind: 'prep' };

  if (/\bapply\b/.test(lower) && /(saved|my jobs)/.test(lower)) return { kind: 'apply_saved' };

  const actiony = /(draft|email|write|reach out|message|find|outreach|connect|contact|get me|send)/.test(lower);
  // Noun-phrase commands count too: "Manager at JP Morgan", "2 analysts at
  // Bain in NYC" — a role + a target IS the ask. Without this, the chat brain
  // answers with words like "lining up managers for you" while nothing runs —
  // a false promise (Rylan field test 2026-07-08).
  const ROLE_WORDS = /(manager|recruiter|analyst|associate|banker|consultant|engineer|designer|marketer|director|vp\b|partner|principal|talent|founder)/;
  const nounCommand = ROLE_WORDS.test(lower) && /\bat\s+\S/.test(lower);
  if (!actiony && !nounCommand) return null;

  const hm = /(hiring manager|recruiter|talent)/.test(lower);
  const wantedSend = /\bsend\b/.test(lower);

  // count: first digit or number word
  let count = 1;
  const digit = lower.match(/\b(\d{1,2})\b/);
  if (digit) count = parseInt(digit[1], 10);
  else {
    const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (word) count = NUM_WORDS[word[1]];
  }
  count = Math.max(1, Math.min(count, 5));

  // company: after " at " up to " in " / end (original casing)
  let company: string | null = null;
  const at = ask.match(/\bat\s+([A-Za-z0-9&.\-' ]{2,40}?)(?:\s+in\s+|[,.!?]|$)/i);
  if (at) company = at[1].trim();

  // location: after " in " to end
  let location: string | null = null;
  const loc = ask.match(/\bin\s+([A-Za-z .\-]{2,32})[,.!?]?$/i);
  if (loc) location = loc[1].trim();

  // role: hiring managers get the curated HM flow; otherwise grab the words
  // between the verb and "at" ("draft 3 IB analysts at Goldman" → "IB analysts")
  let role = hm ? 'hiring manager' : '';
  if (!hm) {
    const m = ask.match(
      /(?:draft|email|write to|reach out to|message|find|connect with|contact|get me|send)\s+(?:\d{1,2}\s+|one\s+|two\s+|three\s+|four\s+|five\s+)?(?:emails?\s+to\s+)?([A-Za-z /\-]{3,40}?)(?:\s+at\s+|\s+in\s+|[,.!?]|$)/i,
    );
    if (m) role = m[1].trim().replace(/\b(emails?|people|someone|folks)\b/gi, '').trim();
    if (!role) {
      // Verbless: everything before " at " is the role ("Manager at JPMorgan",
      // "VP at Blackstone" — 2-char roles count).
      const nm = ask.match(/^(?:\d{1,2}\s+)?([A-Za-z /\-]{2,40}?)\s+at\s+/i);
      if (nm) role = nm[1].trim();
    }
  }
  if (!role) role = hm ? 'hiring manager' : 'someone on the team';

  return { kind: 'draft', count, role, company, location, hm, wantedSend };
}

/** Slots extractable from any utterance — the rolling-conversation memory
 *  (Rylan field test 2026-07-08: "find me people at Bain" … "find two hiring
 *  managers" must remember Bain). Both brains read these; answers fill gaps
 *  instead of starting over. */
export type AskSlots = {
  company?: string;
  role?: string;
  count?: number;
  location?: string;
  hm?: boolean;
};

export function extractSlots(ask: string): AskSlots {
  const lower = ask.toLowerCase();
  const out: AskSlots = {};
  const at = ask.match(/\bat\s+([A-Za-z0-9&.\-' ]{2,40}?)(?:\s+in\s+|[,.!?]|$)/i);
  if (at) out.company = at[1].trim();
  const loc = ask.match(/\bin\s+([A-Za-z .\-]{2,32})[,.!?]?$/i);
  if (loc) out.location = loc[1].trim();
  const digit = lower.match(/\b(\d{1,2})\b/);
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (digit) out.count = Math.max(1, Math.min(parseInt(digit[1], 10), 5));
  else if (word) out.count = NUM_WORDS[word[1]];
  if (/(hiring manager|recruiter|talent)/.test(lower)) {
    out.hm = true;
    out.role = 'hiring manager';
  } else {
    const roleM = lower.match(
      /\b(analysts?|associates?|managers?|consultants?|bankers?|engineers?|designers?|directors?|partners?|vps?|interns?)\b/,
    );
    if (roleM) out.role = roleM[1];
  }
  return out;
}

/** One clarify round, max (contract rule): a draft ask with no company is the
 *  only case broad enough to coach. Location stays optional — best effort. */
export function clarifyFor(intent: ScoutIntent): { question: string } | null {
  if (intent?.kind === 'draft' && !intent.company) {
    return { question: 'Which company should I look at?' };
  }
  return null;
}

/** The pre-flight coach (Rylan, 2026-07-08 — "Grammarly for asks", like web
 *  Find's query suggestions): pause BEFORE spending a run when either
 *  (a) the transcript was auto-corrected — compound fixes can compound
 *  errors, the user deserves one look — or (b) the ask targets seniors,
 *  where cold student emails rarely land. Suggest reply-friendly variants;
 *  running the original stays one tap. Clean junior asks skip this entirely. */
export type Preflight = {
  interpreted: string;
  heardRaw: string | null;
  variants: string[];
  note: string | null;
};

export function preflightFor(
  intent: DraftIntent,
  interpreted: string,
  heardRaw: string | null,
  preferredLocations: string[],
): Preflight | null {
  const senior =
    !intent.hm && /(^|\s)(manager|managers|director|vice president|vp|partner|principal|head)/i.test(intent.role);
  const corrected = !!heardRaw;
  if (!senior && !corrected) return null;

  const variants: string[] = [];
  if (intent.company) {
    variants.push(`Analysts at ${intent.company}`);
    variants.push(`Associates at ${intent.company}`);
    const loc = (preferredLocations || []).find((l) => l && l.length < 24);
    if (loc) variants.push(`Analysts at ${intent.company} in ${loc}`);
    if (!intent.hm) variants.push(`Hiring managers at ${intent.company}`);
  }
  const note = senior
    ? 'Heads up: senior people rarely reply to cold student emails — analysts and associates are the warm door. Want the senior search anyway? Run it below.'
    : null;
  return { interpreted, heardRaw, variants: variants.slice(0, 4), note };
}

/** The refine card (Rylan, 2026-07-08): when an ask names a target ("… at
 *  Goldman Sachs") but doesn't parse into anything runnable — usually a
 *  mishear like "Manners at Goldman Sachs" — NEVER hand it to the chat brain
 *  (which answers with false promises). Instead offer complete, tappable
 *  variants the user can pick or build on, personalized with their preferred
 *  locations. Returns null when the ask has no target (real conversation). */
export function refineOptions(ask: string, preferredLocations: string[]): string[] | null {
  const at = ask.match(/\bat\s+([A-Za-z0-9&.\-' ]{2,40}?)(?:\s+in\s+|[,.!?]|$)/i);
  if (!at) return null;
  const company = at[1].trim();
  // Honor what was actually heard: a location in the ask sticks to every
  // variant; browse-flavored asks get a browse variant first (Rylan
  // screenshot 2026-07-08: "people at Goldman Sachs in LA" must not lose
  // "in LA" or the show-me framing on the way to suggestions).
  const heardLoc = ask.match(/\bin\s+([A-Za-z .\-]{2,32})[,.!?]?$/i)?.[1]?.trim() ?? null;
  const browsey = /(show me|who works|people at|look up|browse)/i.test(ask);
  const tail = heardLoc ? ` in ${heardLoc}` : '';
  const opts: string[] = [];
  if (browsey) opts.push(`Show me people at ${company}${tail}`);
  opts.push(`Analysts at ${company}${tail}`, `Hiring managers at ${company}${tail}`);
  if (!heardLoc) {
    const loc = (preferredLocations || []).find((l) => l && l.length < 24);
    if (loc) opts.push(`Hiring managers at ${company} in ${loc}`);
  }
  return opts.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Execution against existing endpoints
// ---------------------------------------------------------------------------

export type ActionProgress = { stageLabel: string; progressPct: number; found?: string };

export function ackFor(intent: DraftIntent): string {
  const who = intent.hm
    ? `${intent.count === 1 ? 'a hiring manager' : `${intent.count} hiring managers`}`
    : `${intent.count === 1 ? 'the right person' : `${intent.count} people`}`;
  const at = intent.company ? ` at ${intent.company}` : '';
  const inLoc = intent.location ? ` in ${intent.location}` : '';
  const sendNote = intent.wantedSend
    ? ' Drafts land in your Inbox to review — sending from here is coming soon.'
    : '';
  return `On it — drafting ${who}${at}${inLoc}.${sendNote}`;
}

export async function executeDraftIntent(
  intent: DraftIntent,
  askId: string,
  onProgress: (p: ActionProgress) => void,
): Promise<{ say: string; names: string[] }> {
  const result: SwipeResult = await runSwipe(
    {
      company: intent.company || '',
      jobTitle: intent.location ? `${intent.role} in ${intent.location}` : intent.role,
      count: intent.count,
      action: 'draft', // send_outreach is reserved — voice never sends in v1
      priority: intent.hm ? 'hiring_manager' : 'employee',
      swipeId: askId,
    },
    (p: DraftJobProgress) => {
      onProgress({
        stageLabel: p.stageLabel || 'Working',
        progressPct: p.progressPct || 0,
        found: p.foundContacts?.[0]?.name,
      });
    },
  );
  const names = result.items.map((i) => i.contact?.name).filter(Boolean) as string[];
  const say = names.length
    ? `Done — ${names.length === 1 ? `drafted ${names[0]}` : `${names.length} drafts ready: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`}. They're in your Inbox.`
    : `I couldn't find anyone matching that — try a different company or broader role. No credits used.`;
  return { say, names };
}

/** Scope options for the auto-apply receipt (fixed tiers per contract v1.1 —
 *  no cheap preview-count; real counts come with the brain's preview path). */
export function applyScope(saved: Job[]) {
  const eligible = saved.filter((j) => j.autoApplyEligible);
  const tiers = [5, 10, 20]
    .filter((n) => n <= eligible.length || n === 5)
    .map((n) => ({
      id: `top${n}`,
      label: `Top ${Math.min(n, eligible.length)} saved`,
      count: Math.min(n, eligible.length),
      creditEstimate: Math.min(n, eligible.length) * 5,
    }));
  return { eligible, tiers };
}

export async function executeApplyIntent(
  jobs: Job[],
  onProgress: (p: ActionProgress) => void,
): Promise<{ say: string }> {
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i++) {
    onProgress({
      stageLabel: `Applying: ${jobs[i].title} · ${jobs[i].company}`,
      progressPct: Math.round((i / jobs.length) * 100),
    });
    try {
      const r = await startAutoApply(jobs[i].id);
      if (r.ok) ok += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  const say =
    ok > 0
      ? `Submitted ${ok} application${ok === 1 ? '' : 's'}${failed ? ` (${failed} couldn't start — check Applications)` : ''}. You'll get a push as each one finishes.`
      : `None of those could start — open Applications to see why.`;
  return { say };
}
