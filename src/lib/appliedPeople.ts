import { normCompanyName } from '@/lib/company';
import type { AppliedJob } from '@/api/endpoints/autoApply';

/**
 * The People deck, seeded by where you actually applied (Rylan 2026-08-17).
 *
 * No new backend: the deck already runs on a sentence, and the server's parser
 * turns a sentence into companies plus the REAL job titles people at those
 * companies carry. So the whole feature is writing a good sentence out of the
 * applications, and letting the existing pipeline do what it already does.
 *
 * Keeping this in one function matters because the sentence is also what the
 * user sees in the filter chip: it has to read like something a person would
 * type, not like a serialized query.
 */

/** Companies do not repeat, and the sentence stays short enough to parse well.
 *  Five keeps every company's own titles in the sentence without blowing past
 *  the length the parser handles reliably, and more companies is the main lever
 *  on how many people the deck comes back with. */
const MAX_COMPANIES = 5;
/** Per company, not overall: the pairing is the whole point. */
const MAX_TITLES_PER_COMPANY = 2;
/** The server rejects anything longer (people_deck.PROMPT_MAX). */
const MAX_PROMPT = 500;

/** Applications that represent a real attempt. A failed submit still means the
 *  student wants to work there, so it counts; only never-started ones do not. */
function usable(a: AppliedJob): boolean {
  return !!a.company?.trim();
}

/**
 * Job-posting titles are not people titles. They carry location parentheticals
 * ("Investment & Strategy Associate (Madrid)"), req ids, and trailing
 * qualifiers after a dash or pipe, all of which the search parser reads as
 * signal: "(Madrid)" turns into a location filter nobody asked for. Strip to
 * the role itself and let the parser expand it into the titles people at that
 * company actually carry.
 */
function cleanTitle(raw: string): string {
  return (raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\-|–—].*$/, ' ')
    .replace(/\b(?:req|requisition|job)\s*#?\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Normalized company keys for everywhere you have applied. Drives the card
 *  badge, which is deliberately independent of how the deck was built: if you
 *  applied there, the badge is true no matter which deck surfaced them. */
export function appliedCompanyKeys(applied: AppliedJob[] | undefined): Set<string> {
  const keys = new Set<string>();
  for (const a of applied || []) {
    if (!usable(a)) continue;
    const key = normCompanyName(a.company);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * The sentence. Most recent applications first, because the ones you sent this
 * week are the ones worth a warm email today.
 *
 * `division` overrides the roles pulled from your own applications, for when a
 * company's titles do not match how it is actually organised ("show me product,
 * not engineering").
 */
export function buildAppliedPeoplePrompt(
  applied: AppliedJob[] | undefined,
  division?: string | null,
): string | null {
  const rows = (applied || []).filter(usable);
  if (!rows.length) return null;

  /**
   * Group by company and keep each company's OWN titles with it.
   *
   * The first version pooled every company and every title into one flat list,
   * which the search read as "anyone at any of these companies holding any of
   * these titles". Nobody is an Investment & Strategy Associate at Cloudflare,
   * so the honest answer was zero people. The parser supports per-company
   * titles, so the sentence has to express the pairs it actually means.
   */
  const byCompany = new Map<string, { name: string; titles: string[] }>();
  for (const a of rows) {
    const key = normCompanyName(a.company);
    if (!key) continue;
    let entry = byCompany.get(key);
    if (!entry) {
      if (byCompany.size >= MAX_COMPANIES) continue;
      entry = { name: a.company.trim(), titles: [] };
      byCompany.set(key, entry);
    }
    const title = cleanTitle(a.job_title || '');
    if (title && entry.titles.length < MAX_TITLES_PER_COMPANY) {
      if (!entry.titles.some((t) => t.toLowerCase() === title.toLowerCase())) {
        entry.titles.push(title);
      }
    }
  }
  const groups = [...byCompany.values()];
  if (!groups.length) return null;

  // An explicit division replaces the roles entirely: the user is telling us
  // their applications are the wrong signal for who they want to reach.
  const scope = (division || '').trim();
  if (scope) {
    return `People who work in ${scope} at ${joinWithAnd(groups.map((g) => g.name))}`.slice(
      0,
      MAX_PROMPT,
    );
  }

  const clauses = groups.map((g) =>
    g.titles.length ? `${joinWithAnd(g.titles)} at ${g.name}` : `people at ${g.name}`,
  );
  return `Find ${joinWithAnd(clauses)}`.slice(0, MAX_PROMPT);
}
