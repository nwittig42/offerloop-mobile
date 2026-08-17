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

  // The role words are the useful part of `q`. Falling back to the whole
  // sentence is deliberate: an unparsed prompt should still search, just less
  // precisely, rather than quietly returning the unfiltered feed.
  const roles = firstOf(parsed?.roles);
  const industries = firstOf(parsed?.industries);
  const q = roles || industries || prompt.trim();

  return {
    q,
    company: firstOf(parsed?.company) || undefined,
    location: firstOf(parsed?.location) || undefined,
    type,
    seniority,
  };
}

