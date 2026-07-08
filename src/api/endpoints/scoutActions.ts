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
];

export function normalizeAsk(raw: string): { text: string; corrected: boolean } {
  let text = raw;
  for (const [re, fix] of ASR_FIXES) text = text.replace(re, fix);
  return { text, corrected: text !== raw };
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
export type ScoutIntent = DraftIntent | ApplyIntent | PrepIntent | null;

export function parseIntent(ask: string): ScoutIntent {
  const lower = ask.toLowerCase().trim();

  // Question-shaped asks are conversations, not commands — let the chat brain
  // answer ("what should I say in a follow up email" must never spawn a job).
  if (/^(what|how|why|when|where|who|should|can|could|would|do|does|is|are|am)\b/.test(lower) || lower.endsWith('?')) {
    if (/(prep me|meeting prep|coffee chat)/.test(lower)) return { kind: 'prep' };
    return null;
  }

  if (/(coffee chat|meeting prep|prep me|prep for)/.test(lower)) return { kind: 'prep' };

  if (/\bapply\b/.test(lower) && /(saved|my jobs|job)/.test(lower)) return { kind: 'apply_saved' };

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
      // Verbless: everything before " at " is the role ("Manager at JPMorgan").
      const nm = ask.match(/^(?:\d{1,2}\s+)?([A-Za-z /\-]{3,40}?)\s+at\s+/i);
      if (nm) role = nm[1].trim();
    }
  }
  if (!role) role = hm ? 'hiring manager' : 'someone on the team';

  return { kind: 'draft', count, role, company, location, hm, wantedSend };
}

/** One clarify round, max (contract rule): a draft ask with no company is the
 *  only case broad enough to coach. Location stays optional — best effort. */
export function clarifyFor(intent: ScoutIntent): { question: string } | null {
  if (intent?.kind === 'draft' && !intent.company) {
    return { question: 'Which company should I look at?' };
  }
  return null;
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
