/**
 * Company-name matching, shared by the Inbox reconcile and the company
 * screen's Reached-out filter. Names arrive spelled differently per source:
 * the app says "Moelis", PDL returns the legal "Moelis & Company", job cards
 * say "Janestreet" (field-tested 2026-07-09 — mismatches rendered duplicate
 * Inbox rows and hid contacts from the company module).
 */

const LEGAL_TAIL = new Set([
  'and', 'company', 'co', 'inc', 'incorporated', 'llc', 'llp', 'lp',
  'ltd', 'limited', 'corp', 'corporation', 'plc', 'holdings',
]);

/** Alnum-only, trailing legal suffixes stripped: "Moelis & Company" and
 *  "moelis" both normalize to "moelis". */
export function normCompanyName(s: string): string {
  const words = (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  while (words.length > 1 && LEGAL_TAIL.has(words[words.length - 1])) words.pop();
  return words.join('');
}

/** Same firm? Exact normalized match, or one a prefix of the other ("Meta"
 *  vs "Meta Platforms") — suffix-stripping can't know every legal variant,
 *  and for person-scoped comparisons erring toward a match means erring
 *  toward no-duplicates. */
export function sameCompany(a: string, b: string): boolean {
  const na = normCompanyName(a);
  const nb = normCompanyName(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}
