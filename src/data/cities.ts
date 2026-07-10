/**
 * Curated recruiting-market cities. Onboarding's location step filters this
 * list instead of accepting free text — "Bosto" used to save as a real city
 * (no-fake-data rule). These are the US metros our users actually recruit
 * into, plus the handful of global finance/tech hubs, plus Remote.
 *
 * PDL matches on metro, so the label here is what the feed filter uses.
 */
export const RECRUITING_CITIES: string[] = [
  'Remote',
  'New York, NY',
  'San Francisco, CA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Boston, MA',
  'Seattle, WA',
  'Austin, TX',
  'Houston, TX',
  'Dallas, TX',
  'Atlanta, GA',
  'Charlotte, NC',
  'Washington, DC',
  'Miami, FL',
  'Denver, CO',
  'San Diego, CA',
  'San Jose, CA',
  'Philadelphia, PA',
  'Nashville, TN',
  'Minneapolis, MN',
  'Phoenix, AZ',
  'Portland, OR',
  'Raleigh, NC',
  'Salt Lake City, UT',
  'Detroit, MI',
  'Columbus, OH',
  'Pittsburgh, PA',
  'Baltimore, MD',
  'Tampa, FL',
  'Orlando, FL',
  'Sacramento, CA',
  'Kansas City, MO',
  'Indianapolis, IN',
  'Cincinnati, OH',
  'Cleveland, OH',
  'St. Louis, MO',
  'Milwaukee, WI',
  'Newark, NJ',
  'Stamford, CT',
  'London, UK',
  'Toronto, Canada',
  'Hong Kong',
  'Singapore',
];

/** Case-insensitive prefix + substring match, shortest labels first, capped. */
export function matchCities(query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const c of RECRUITING_CITIES) {
    const lc = c.toLowerCase();
    if (lc.startsWith(q)) starts.push(c);
    else if (lc.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}
