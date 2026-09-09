/**
 * Turning a filter sentence into a job-index query.
 *
 * Its own module, with no imports, for two reasons: it is the only part of the
 * filtered feed that is pure logic worth checking directly, and everything
 * around it in endpoints/feed reaches for the network on import.
 */

/**
 * What the backend prompt parser gives back. Everything is optional: the parser
 * is built for CONTACT search, so it fills what it recognises and leaves the
 * rest alone. We read the three fields that also mean something for a job
 * (what, where, who for) and ignore schools, which only make sense for people.
 */
export type ParsedPrompt = {
  company?: string[] | string;
  roles?: string[] | string;
  location?: string[] | string;
  industries?: string[] | string;
};

function firstOf(v: unknown): string {
  if (Array.isArray(v)) return String(v.find((x) => typeof x === 'string' && x.trim()) || '').trim();
  if (typeof v === 'string') return v.trim();
  return '';
}

/** The query a filter prompt turns into, ready for /api/jobs/search. */
export type JobFilterQuery = {
  q: string;
  company?: string;
  location?: string;
  type?: string;
  seniority?: string;
};

/**
 * "internships in product management in SF" -> the search params the job index
 * actually understands.
 *
 * Employment type and seniority are read off the raw sentence rather than the
 * parser, because the parser was written for people and has no notion of either
 * (and they are the two words a student is most likely to lead with:
 * "internships", "entry level"). Everything else comes from the parser, with
 * the raw prompt kept as `q` so the full-text side still gets the nouns the
 * parser dropped.
 */
export function promptToJobQuery(prompt: string, parsed: ParsedPrompt | null): JobFilterQuery {
  const text = prompt.toLowerCase();

  let type: string | undefined;
  if (/\bintern(ship|ships|s)?\b/.test(text)) type = 'INTERNSHIP';
  else if (/\bpart[\s-]?time\b/.test(text)) type = 'PARTTIME';
  else if (/\bfull[\s-]?time\b/.test(text)) type = 'FULLTIME';

  let seniority: string | undefined;
  if (/\b(entry[\s-]?level|new grad|graduate|junior|associate)\b/.test(text)) seniority = 'entry';
  else if (/\b(senior|staff|principal|lead)\b/.test(text)) seniority = 'senior';
  else if (/\b(director|vp|vice president|head of|executive)\b/.test(text)) seniority = 'executive';

  // The role words are the useful part of `q`. Falling back to the sentence
  // is deliberate: an unparsed prompt should still search, just less
  // precisely, rather than quietly returning the unfiltered feed. But the
  // sentence gets cleaned first (Rylan 2026-09-08: "Entry level finance roles
  // in New York" found nothing because "roles", "level" and "York" all had to
  // appear in a job's search terms): the place comes out as its own filter,
  // and filler words that never appear in a job title are dropped.
  const roles = firstOf(parsed?.roles);
  const industries = firstOf(parsed?.industries);
  const fallback = fallbackParse(prompt);
  const q = roles || industries || fallback.q || prompt.trim();

  return {
    q,
    company: firstOf(parsed?.company) || undefined,
    location: firstOf(parsed?.location) || fallback.location || undefined,
    type,
    seniority,
  };
}

const PLACE_SHORTHAND: Record<string, string> = {
  la: 'los angeles',
  nyc: 'new york',
  ny: 'new york',
  sf: 'san francisco',
  dc: 'washington',
  bay: 'san francisco',
  chi: 'chicago',
};

/** Words a student puts in a search sentence that never appear in a job's
 *  title: the ask itself ("roles", "jobs"), the level words that already
 *  became `seniority` or `type`, and time ("this summer"). */
const FILLER = new Set([
  'role', 'roles', 'job', 'jobs', 'position', 'positions', 'opening', 'openings',
  'opportunity', 'opportunities', 'entry', 'level', 'new', 'grad', 'graduate', 'junior',
  'intern', 'interns', 'internship', 'internships', 'full', 'part', 'time', 'remote',
  'this', 'summer', 'fall', 'spring', 'winter', 'hiring', 'looking', 'find', 'me', 'near',
  'company', 'companies', 'firm', 'firms', 'startup', 'startups', 'at', 'in', 'for', 'the',
  'a', 'an', 'and', 'or', 'of', 'to', 'with', 'on',
]);

/** "Entry level finance roles in New York" -> { q: "finance", location: "new york" }. */
export function fallbackParse(prompt: string): { q: string; location?: string } {
  let text = prompt.toLowerCase().replace(/[^a-z0-9\s,]/g, ' ');
  let location: string | undefined;
  // The place is whatever follows the LAST "in" or a trailing ", City".
  const m = text.match(/\b(?:in|near|around)\s+([a-z][a-z\s.]{1,40})$/) || text.match(/,\s*([a-z][a-z\s.]{1,40})$/);
  if (m) {
    const raw = m[1].trim().replace(/\b(this|next)\s+(summer|fall|spring|winter)\b/g, '').trim();
    if (raw && raw !== 'remote') {
      location = PLACE_SHORTHAND[raw] || raw;
      text = text.slice(0, m.index);
    }
  }
  const q = text
    .split(/[\s,]+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ')
    .trim();
  return { q, location };
}

