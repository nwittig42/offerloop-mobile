/**
 * Canonical names for the firms students actually type, so "barclay" becomes
 * Barclays instead of a typo that quietly poisons the target list (the dig
 * anchors searches on this exact string, so spelling matters downstream).
 *
 * Matching is deliberately simple: case-insensitive prefix beats substring,
 * both live here rather than in the component so Profile's editor can reuse
 * it. Not exhaustive, and does not need to be: anything unmatched still saves
 * as typed.
 */
const FIRMS: string[] = [
  // Banking
  'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Bank of America', 'Citi',
  'Barclays', 'Deutsche Bank', 'UBS', 'Wells Fargo', 'RBC Capital Markets',
  'Jefferies', 'Lazard', 'Evercore', 'Moelis', 'PJT Partners', 'Centerview',
  'Perella Weinberg', 'Houlihan Lokey', 'Guggenheim Partners', 'Rothschild & Co',
  'BNP Paribas', 'HSBC', 'Nomura', 'Mizuho', 'Piper Sandler', 'Raymond James',
  'William Blair', 'Baird', 'Stifel', 'Truist Securities',
  // Consulting
  'McKinsey', 'Bain', 'Boston Consulting Group', 'Deloitte', 'Accenture',
  'EY', 'PwC', 'KPMG', 'Oliver Wyman', 'Kearney', 'LEK Consulting',
  'AlixPartners', 'ZS Associates',
  // Buy side
  'Blackstone', 'KKR', 'Apollo Global Management', 'Carlyle', 'TPG',
  'Warburg Pincus', 'Vista Equity Partners', 'Silver Lake', 'Thoma Bravo',
  'Citadel', 'Point72', 'Millennium', 'Two Sigma', 'Jane Street',
  'D.E. Shaw', 'Bridgewater Associates', 'AQR Capital', 'BlackRock',
  'Vanguard', 'Fidelity', 'T. Rowe Price', 'Wellington Management',
  // Tech
  'Google', 'Apple', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Nvidia',
  'Tesla', 'SpaceX', 'Stripe', 'Airbnb', 'Uber', 'Lyft', 'DoorDash',
  'Snowflake', 'Databricks', 'OpenAI', 'Anthropic', 'Palantir', 'Salesforce',
  'Adobe', 'Oracle', 'IBM', 'Intel', 'Qualcomm', 'LinkedIn', 'TikTok',
  'Snap', 'Pinterest', 'Coinbase', 'Robinhood', 'Plaid', 'Figma', 'Notion',
  'Anduril', 'Scale AI', 'Ramp', 'Brex', 'Datadog', 'MongoDB', 'Atlassian',
  'Shopify', 'Square', 'PayPal', 'Visa', 'Mastercard', 'American Express',
  // Media, consumer, industrials
  'Disney', 'Warner Bros. Discovery', 'NBCUniversal', 'Nike', 'Procter & Gamble',
  'Unilever', 'PepsiCo', 'Coca-Cola', 'Johnson & Johnson', 'Pfizer',
  'United Airlines', 'Delta Air Lines', 'Boeing', 'Lockheed Martin',
  'General Motors', 'Ford',
];

/** Top matches for a partial the user is typing, prefix matches first. */
export function suggestFirms(partial: string, exclude: string[] = [], limit = 5): string[] {
  const q = partial.trim().toLowerCase();
  if (q.length < 2) return [];
  const skip = new Set(exclude.map((x) => x.toLowerCase()));
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const f of FIRMS) {
    const fl = f.toLowerCase();
    if (skip.has(fl)) continue;
    if (fl.startsWith(q)) prefix.push(f);
    else if (fl.includes(q)) contains.push(f);
  }
  return [...prefix, ...contains].slice(0, limit);
}
