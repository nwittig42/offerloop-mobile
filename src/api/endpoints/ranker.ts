import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { ApiError } from '@/api/errors';
import { relationFor } from '@/lib/relation';
import { titleCase } from '@/lib/text';
import type { Candidate } from '@/types';

/**
 * The People deck: GET the ranked candidates, POST a signal on every swipe,
 * POST a paid reveal when the user wants the email.
 *
 * DEPLOYMENT NOTE (read before debugging an empty deck):
 * these routes ship on the WEB backend branch (main, via PRs #178/#179). The
 * app talks to the services deployed from staging/mobile-field, which does not
 * carry backend/app/routes/ranker.py yet. Until someone ports them over, every
 * call here 404s and the deck falls back to the fixtures below. That fallback
 * is deliberate: the swipe flow stays walkable in the local preview, and the
 * feed shows an honest banner saying the data is not live.
 */

/** Backend person payloads are loosely shaped; pull each field by likely name. */
type RawCandidate = Record<string, any>;

export type Deck = {
  deckId: string;
  candidates: Candidate[];
  /** True when these are fixtures, not the ranker. Drives the feed banner. */
  isMock: boolean;
  /**
   * Why the deck is empty, when it is. "sparse_profile" means the ranker had
   * nothing to search on (no school, no dream companies) — fixable by the
   * student in about three taps, which is what the gap survey is for.
   * "no_candidates" means we knew what to look for and found nobody, which
   * they cannot fix. Undefined whenever the deck has people in it.
   */
  emptyReason?: 'sparse_profile' | 'no_candidates';
};

export type SwipeSignal = 'right' | 'left' | 'skip';

export type RevealResult = {
  email: string | null;
  verified: boolean;
  cached: boolean;
  charged: boolean;
};

/** 8 credits per reveal, per the ranker handoff (section 5). Refunded by the
 *  backend on an unverified address or a no-hit, so a miss is free. */
export const REVEAL_EMAIL_CREDITS = 8;

function str(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : undefined;
}

/**
 * The ranker's reasons are SENTENCES built from lowercase PDL data ("fellow
 * university of southern california alum"). Title-casing a sentence is wrong,
 * so this capitalises the opening and restores the proper nouns we already
 * know — this person's company and school, in the cased form the card shows.
 */
function sentenceCase(v: string, propers: (string | undefined)[]): string {
  let out = v.charAt(0).toUpperCase() + v.slice(1);
  for (const proper of propers) {
    if (!proper) continue;
    const pattern = proper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(pattern, 'gi'), proper);
  }
  return out;
}

/**
 * The similarity score, normalized to the 1.0-10.0 the card draws.
 *
 * The ranker's own scale is not settled, so accept the shapes it plausibly
 * sends and convert rather than guess: a 0-1 similarity, a 0-100 percentage,
 * or an already-1-10 score. Anything outside those, or missing, returns
 * undefined and the card simply shows no badge. Clamped, because a 10.4 on a
 * card that says "out of 10" is worse than no number at all.
 */
function matchScoreFrom(raw: RawCandidate): number | undefined {
  const v = raw.match_score ?? raw.matchScore ?? raw.similarity ?? raw.score;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  const ten = v <= 1 ? v * 10 : v <= 10 ? v : v <= 100 ? v / 10 : NaN;
  if (!Number.isFinite(ten)) return undefined;
  return Math.round(Math.min(10, Math.max(1, ten)) * 10) / 10;
}

/**
 * Exported so the prompt-built People deck (endpoints/peopleSearch) can render
 * its people through the exact same mapping. Two mappers would drift, and the
 * cards would start disagreeing about casing, scores, or which reasons show.
 */
export function mapCandidate(raw: RawCandidate, index: number): Candidate | null {
  // The live route nests the human under `person` and keeps the ranking
  // fields (score, tier, reasons, briefing) as siblings of it:
  //   {person: {id, firstName, lastName, company, title, college, city,
  //             state, linkedinUrl, pdlId}, score, tier, reasons, briefing}
  // Read both shapes: `p` for who they are, `raw` for what the ranker
  // concluded about them. Without the unwrap every candidate lost its id and
  // name and got dropped, which looked exactly like an empty deck.
  const p: RawCandidate = raw.person && typeof raw.person === 'object' ? raw.person : raw;

  const id = str(p.candidate_id) || str(p.id) || str(p.person_id) || str(raw.candidate_id);
  const name =
    str(p.name) ||
    [str(p.firstName) || str(p.first_name), str(p.lastName) || str(p.last_name)]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    undefined;
  // No id or no name means nothing renderable. Drop it rather than showing a
  // card with a blank where the person should be.
  if (!id || !name) return null;

  const title = str(p.title) || str(p.job_title) || '';
  // Reasons arrive as OBJECTS from the live ranker ({type, hook, detail,
  // instruction, avoid} from personalization._detect_all_signals), not the
  // plain strings the fixtures use. Keeping only strings silently dropped
  // every reason a real deck produced, so the card's "Why we surfaced them"
  // section vanished exactly when it started having something true to say.
  const reasonSource = Array.isArray(raw.reasons) ? raw.reasons : p.reasons;
  const reasons = Array.isArray(reasonSource)
    ? reasonSource
        .map((r: unknown): string | null => {
          if (typeof r === 'string') return r.trim() || null;
          if (r && typeof r === 'object') {
            const o = r as Record<string, unknown>;
            const label = str(o.label) || str(o.hook) || str(o.detail);
            return label || null;
          }
          return null;
        })
        .filter((r): r is string => !!r)
    : undefined;

  // City and state are separate fields on the wire; the card wants one line.
  const location =
    str(p.location) ||
    [str(p.city), str(p.state)].filter(Boolean).join(', ') ||
    undefined;

  const company = titleCase(str(p.company) || str(p.company_name)) || '';
  const school = titleCase(str(p.college) || str(p.school) || str(p.university));
  const casedReasons = reasons?.map((r) => sentenceCase(r, [company, school]));

  return {
    id,
    name: titleCase(name) ?? name,
    title: titleCase(title) ?? title,
    company,
    location: titleCase(location),
    school,
    reasons: casedReasons?.length ? casedReasons : undefined,
    linkedinUrl: str(p.linkedinUrl) || str(p.linkedin_url) || str(p.linkedin),
    photoUrl: str(p.photo_url) || str(p.picture),
    department: str(p.department),
    relation: relationFor(title),
    joinedYear:
      typeof p.joinedYear === 'number' && p.joinedYear > 1900 ? p.joinedYear : undefined,
    // Score sits on the ITEM, not the person, so read the item first.
    matchScore: matchScoreFrom(raw) ?? matchScoreFrom(p),
    // Trust the server's rank when it sends one; the feedback call echoes it back.
    rank: typeof raw.rank === 'number' ? raw.rank : index,
  };
}

/**
 * Obviously-fake people, per the no-fake-data rule: a fixture must never be
 * mistakable for a real person the user could email. Names and companies are
 * transparently test data, and none of them carry a revealable address.
 */
const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'mock-cand-1',
    name: 'Taylor Test',
    title: 'Sample Analyst, Fixture Coverage',
    company: 'Sample Bank & Trust',
    location: 'New York, NY',
    school: 'Fixture University',
    reasons: ['Same school as you', 'Fixture data, not the ranker'],
    relation: 'Employee',
    // Fixture scores, spread across the color bands so the badge's whole scale
    // is visible in the preview. Fake, like everything else on these people.
    matchScore: 9.2,
    rank: 0,
  },
  {
    id: 'mock-cand-2',
    name: 'Sample Person',
    title: 'Fixture Engagement Manager',
    company: 'Acme Test Co',
    location: 'Chicago, IL',
    reasons: ['Fixture data, not the ranker'],
    relation: 'Hiring manager',
    matchScore: 7.4,
    rank: 1,
  },
  {
    id: 'mock-cand-3',
    name: 'Placeholder Example',
    title: 'Sample University Recruiter',
    company: 'Acme Test Co',
    location: 'Remote',
    school: 'Fixture University',
    reasons: ['Recruits from your school', 'Fixture data, not the ranker'],
    relation: 'Recruiter',
    matchScore: 5.8,
    rank: 2,
  },
];

function mockDeck(): Deck {
  return { deckId: 'mock-deck', candidates: MOCK_CANDIDATES, isMock: true };
}

/**
 * Fetch the ranked deck. Capture deckId: every feedback call must echo it or
 * the backend 400s.
 *
 * Falls back to fixtures when the route is missing (404) or the backend is
 * unreachable, so the deck is walkable before the routes land on the mobile
 * branch. Any other error propagates, because a real 500 from a live ranker is
 * something the user should see as an error state, not as fake people.
 */
export async function fetchCandidates(
  signal?: AbortSignal,
  /** Candidate ids already shown this session: the server skips them, so a
   *  refresh EXTENDS the feed with new people instead of replaying it. */
  excludeIds?: string[],
): Promise<Deck> {
  if (USE_MOCKS) return mockDeck();
  try {
    const exclude = excludeIds?.length
      ? `?exclude=${encodeURIComponent(excludeIds.slice(0, 500).join(','))}`
      : '';
    const res = await apiFetch<any>(`/api/ranker/candidates${exclude}`, {
      signal,
      timeoutMs: 20000,
    });
    const rawList: RawCandidate[] = Array.isArray(res?.candidates)
      ? res.candidates
      : Array.isArray(res?.people)
        ? res.people
        : [];
    const deckId = str(res?.deck_id) || str(res?.deckId);
    const candidates = rawList
      .map(mapCandidate)
      .filter((c): c is Candidate => c !== null);
    // A live route that answers without a deck_id cannot accept feedback, so
    // treat it the same as no route at all rather than swiping into 400s.
    if (!deckId) return mockDeck();
    const reason = str(res?.reason);
    return {
      deckId,
      candidates,
      isMock: false,
      emptyReason:
        candidates.length === 0 && (reason === 'sparse_profile' || reason === 'no_candidates')
          ? reason
          : undefined,
    };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 404 || status === 405 || status === 0 || status === 408) {
      return mockDeck();
    }
    throw err;
  }
}

/**
 * Record a swipe. Left and skip auto-exclude the person from future decks;
 * right does not (saving them to My Network is what excludes them, via the
 * already-saved dedupe).
 *
 * Fire-and-forget by design: a lost signal degrades ranking slightly, but a
 * failed POST must never block the card from flying off or strand the user.
 */
export async function sendFeedback(args: {
  deckId: string;
  candidateId: string;
  signal: SwipeSignal;
  rank: number;
}): Promise<void> {
  if (USE_MOCKS || args.deckId === 'mock-deck') return;
  try {
    await apiFetch('/api/ranker/feedback', {
      method: 'POST',
      body: {
        candidate_id: args.candidateId,
        signal: args.signal,
        deck_id: args.deckId,
        rank: args.rank,
      },
      timeoutMs: 10000,
    });
  } catch {
    // Swallowed on purpose. See the doc comment above.
  }
}

/**
 * Pay to reveal an email on swipe-right. Cache-first with a 30-day TTL, and
 * the backend refunds on an unverified address or a no-hit, so `charged` tells
 * you what actually happened. Render from the response, never from a guess.
 */
export type CandidateOutreachResult = {
  /** True when a draft now exists in the user's Inbox. */
  drafted: boolean;
  /** True when it actually left the account. Never assumed from the request:
   *  the server downgrades a send it cannot make (no Gmail, quiet hours). */
  sent: boolean;
};

/**
 * Write to the person the user just swiped on.
 *
 * NOT YET ON ANY BACKEND. Every other drafting path in this app is
 * find-then-draft: you hand it a company and a role, it finds somebody and
 * writes to them (/api/prompt-search, /api/job-board/find-hiring-manager).
 * The People deck is the opposite case, and the only one that matters here:
 * the person is already chosen, by hand, by the user. Reusing the find
 * pipeline would go looking for "someone like them" and could mail a
 * different human than the one on the card.
 *
 * So this needs a route, and here is the contract it should honor:
 *
 *   POST /api/ranker/candidates/<candidate_id>/outreach   { action: draft|send }
 *   -> 200 { drafted: bool, sent: bool }
 *      402 INSUFFICIENT_CREDITS
 *      404 when the candidate is unknown or has no verified address
 *
 * It should reuse the same generator and template as the swipe drafts so the
 * voice matches, charge the same per-contact rate, and refuse to send (falling
 * back to a draft, reporting sent:false) when Gmail is not connected. Until it
 * exists this 404s, the caller says so plainly, and nothing is charged.
 */
export async function draftToCandidate(
  candidateId: string,
  action: 'draft' | 'send',
): Promise<CandidateOutreachResult> {
  if (USE_MOCKS) {
    // Fixture people have no revealable address, so there is nobody to write
    // to. Report the honest miss rather than a draft that does not exist.
    return { drafted: false, sent: false };
  }
  const res = await apiFetch<any>(
    `/api/ranker/candidates/${encodeURIComponent(candidateId)}/outreach`,
    { method: 'POST', body: { action }, timeoutMs: 60000 },
  );
  return { drafted: !!res?.drafted, sent: !!res?.sent };
}

export async function revealEmail(candidateId: string): Promise<RevealResult> {
  if (USE_MOCKS) {
    // Fixtures have no revealable address, and inventing one would be a fake
    // number in the UI. Report the honest free-miss shape instead.
    return { email: null, verified: false, cached: false, charged: false };
  }
  const res = await apiFetch<any>(
    `/api/ranker/candidates/${encodeURIComponent(candidateId)}/reveal-email`,
    { method: 'POST', timeoutMs: 30000 },
  );
  return {
    email: str(res?.email) ?? null,
    verified: !!res?.verified,
    cached: !!res?.cached,
    charged: !!res?.charged,
  };
}
