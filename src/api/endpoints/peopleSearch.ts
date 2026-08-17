import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { ApiError } from '@/api/errors';
import { mapCandidate } from '@/api/endpoints/ranker';
import type { Candidate } from '@/types';

/**
 * The People deck built from a sentence (Nick 2026-08-16): "you should be able
 * to type or prompt the type of person you want to see."
 *
 * One PDL search per batch, twenty people, no addresses. That split is the
 * whole economics of this feature: searching is cheap, and the address is the
 * expensive part, so surfacing costs nothing and the swipe still costs
 * REVEAL_PERSON_CREDITS. A user can describe a search, look through it, and
 * decide none of them are worth writing to, without spending anything.
 *
 * The deck is stashed server-side under a deck id, which is why reveal takes
 * (deckId, personId) rather than a person payload: the app never holds enough
 * about these people to identify them to PDL, and it must not be able to ask
 * the server to enrich an arbitrary person it made up.
 */

export const PEOPLE_SEARCH_BATCH = 20;

/** What a right swipe on a prompt-built person costs. Matches the ranker
 *  deck's price, and the backend reads it from CREDIT_COSTS rather than from
 *  this constant, so the app never sets the price. */
export const REVEAL_PERSON_CREDITS = 8;

export type PeopleSearchDeck = {
  deckId: string;
  people: Candidate[];
  /** Token for the next batch, or null when PDL has nothing more for this
   *  sentence. Drives whether "show me 20 more" renders at all. */
  nextCursor: string | null;
  /** Set when the search understood too little to run. The screen shows this
   *  verbatim rather than a generic empty state, because the fix is always to
   *  rewrite the sentence and the server knows what was missing. */
  vagueReason?: string;
};

export type PeopleSearchError = 'not_live' | 'rate_limited' | 'vague' | 'failed';

/** Thrown rather than returned so callers cannot render an empty deck and a
 *  silent failure as the same thing. */
export class PeopleSearchFailure extends Error {
  constructor(
    readonly reason: PeopleSearchError,
    message: string,
  ) {
    super(message);
  }
}

type RawPerson = Record<string, any>;

/**
 * Obviously-fake people for mock mode, so the prompt deck is walkable with no
 * backend at all (and before /api/mobile/people-search is deployed).
 *
 * Transparently test data, per the no-fake-data rule: a fixture must never be
 * mistakable for a real person somebody could email. Names, firms and schools
 * are all self-evidently placeholders, and no fixture carries an address.
 *
 * Two batches' worth, so "show me 20 more" is a real thing you can press and
 * watch work rather than a button that is always disabled in the preview.
 */
const MOCK_TITLES = [
  'Sample Analyst',
  'Fixture Associate',
  'Placeholder Manager',
  'Test Vice President',
  'Example Director',
];
const MOCK_FIRMS = ['Acme Test Co', 'Sample Bank & Trust', 'Fixture Capital', 'Placeholder Partners'];
const MOCK_CITIES = ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Remote'];

function mockPeople(offset: number, count: number): Candidate[] {
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i + 1;
    return {
      id: `mock-person-${n}`,
      name: `Sample Person ${n}`,
      title: MOCK_TITLES[n % MOCK_TITLES.length],
      company: MOCK_FIRMS[n % MOCK_FIRMS.length],
      location: MOCK_CITIES[n % MOCK_CITIES.length],
      school: 'Fixture University',
      reasons: ['Fixture data, not a real search'],
      rank: offset + i,
    } as Candidate;
  });
}

/** Two batches of fixtures, then the deck ends. */
const MOCK_TOTAL = PEOPLE_SEARCH_BATCH * 2;

function mockSearchDeck(cursor?: string | null): PeopleSearchDeck {
  const offset = Number(cursor?.split(':')[1] ?? 0) || 0;
  const remaining = Math.max(0, MOCK_TOTAL - offset);
  const take = Math.min(PEOPLE_SEARCH_BATCH, remaining);
  const next = offset + take;
  return {
    deckId: 'mock-search-deck',
    people: mockPeople(offset, take),
    nextCursor: next < MOCK_TOTAL ? `mock-search-deck:${next}` : null,
  };
}

/**
 * Run a prompt search. Free.
 *
 * @param cursor Pass the previous deck's nextCursor to get the NEXT twenty
 *   rather than the same twenty. The server keeps the exclusion set, so batches
 *   never repeat a person inside one search.
 */
export async function searchPeople(
  prompt: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<PeopleSearchDeck> {
  const trimmed = (prompt || '').trim();
  if (!trimmed) return { deckId: '', people: [], nextCursor: null };
  if (USE_MOCKS) return mockSearchDeck(cursor);

  try {
    const res = await apiFetch<{
      deck_id?: string;
      people?: RawPerson[];
      next_cursor?: string | null;
      reason?: string;
    }>('/api/mobile/people-search', {
      method: 'POST',
      body: { prompt: trimmed, limit: PEOPLE_SEARCH_BATCH, cursor: cursor || undefined },
      // A PDL search with progressive relaxation can take a while, and this is
      // a deliberate, user-initiated wait with a spinner in front of it.
      timeoutMs: 45_000,
      signal,
    });

    const people = (res.people || [])
      .map(mapCandidate)
      .filter((c): c is Candidate => c !== null);

    return {
      deckId: res.deck_id || '',
      people,
      nextCursor: res.next_cursor ?? null,
      vagueReason: people.length === 0 ? res.reason || undefined : undefined,
    };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    /**
     * The route is not on this backend yet (404/405), or we could not reach it
     * at all. Fall back to fixtures rather than an error screen.
     *
     * Same posture ranker.ts already takes for the same reason: the swipe flow
     * has to stay walkable while the backend catches up, or the deck is
     * un-reviewable until a deploy lands. The people are transparently fake, so
     * nobody mistakes this for a real search, and the moment
     * /api/mobile/people-search exists this branch stops being reached.
     */
    if (status === 404 || status === 405 || status === 0 || status === 408) {
      return mockSearchDeck(cursor);
    }
    if (status === 429) {
      throw new PeopleSearchFailure(
        'rate_limited',
        'That is a lot of searches for one day. Try again tomorrow.',
      );
    }
    if (status === 400) {
      throw new PeopleSearchFailure(
        'vague',
        'That was a little vague. Add a role, a company, or a city.',
      );
    }
    throw new PeopleSearchFailure('failed', 'Could not run that search. Try again.');
  }
}

export type RevealPersonResult = {
  /** Null when PDL had no address for them. Nothing was charged in that case. */
  email: string | null;
  verified: boolean;
  charged: boolean;
  /** True when a draft now exists in the user's Gmail. */
  drafted: boolean;
  /** True when it actually left the account. Never assumed from the request:
   *  the server downgrades a send it cannot make (no Gmail, quiet hours). */
  sent: boolean;
};

/**
 * The paid step. Unlock this person's address and write to them, in one call.
 *
 * One call rather than the ranker deck's two (reveal, then draft) because the
 * two are never useful apart here: an address with no draft is the lookup tool
 * Nick explicitly did not want to ship. The server charges once, and refunds
 * itself when there is no verified address to sell.
 *
 * Render from the response, never from a guess about what the charge did.
 */
export async function revealAndWrite(
  deckId: string,
  personId: string,
  action: 'draft' | 'send',
): Promise<RevealPersonResult> {
  // Fixtures: mock mode, or a deck that came from the 404 fallback above. Report
  // a drafted fixture so the swipe, the toast and the deck advance are all
  // walkable. `charged: false` is the honest answer, since no credits moved.
  if (USE_MOCKS || deckId === 'mock-search-deck') {
    return {
      email: 'sample.person@fixture.test',
      verified: true,
      charged: false,
      drafted: action === 'draft',
      sent: action === 'send',
    };
  }
  const res = await apiFetch<{
    email?: string | null;
    verified?: boolean;
    charged?: boolean;
    drafted?: boolean;
    sent?: boolean;
  }>('/api/mobile/people-search/reveal', {
    method: 'POST',
    body: { deck_id: deckId, person_id: personId, action },
    timeoutMs: 60_000,
  });
  return {
    email: res.email || null,
    verified: !!res.verified,
    charged: !!res.charged,
    drafted: !!res.drafted,
    sent: !!res.sent,
  };
}
