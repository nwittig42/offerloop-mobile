import type { ImageSourcePropType } from 'react-native';

/**
 * Hand-drawn decorative marks from the Offerloop Figma design system
 * (Illustrations tab). Used to give swipe cards branded character and fill
 * white space — a squiggle underline under the title and a faint loop
 * watermark behind the content. Pieces are picked deterministically per job
 * so each card keeps its own art but the deck varies as you swipe.
 */
const SQUIGGLES: ImageSourcePropType[] = [
  require('../../../assets/illustrations/squiggle-a.png'),
  require('../../../assets/illustrations/squiggle-b.png'),
];

const WATERMARKS: ImageSourcePropType[] = [
  require('../../../assets/illustrations/loop-a.png'),
  require('../../../assets/illustrations/loop-b.png'),
  require('../../../assets/illustrations/loop-c.png'),
  require('../../../assets/illustrations/loop-d.png'),
  require('../../../assets/illustrations/burst-l.png'),
  require('../../../assets/illustrations/burst-r.png'),
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Brand-adjacent header-wash tints, rotated per card so the deck feels
 *  alive instead of uniformly blue. All stay in the design system's family
 *  (slate blue, violet, teal, warm orange). */
const TINTS = ['#4C62A8', '#7C3AED', '#0D9488', '#DE8040'];

export function cardArt(id: string): {
  squiggle: ImageSourcePropType;
  watermark: ImageSourcePropType;
  tint: string;
} {
  const h = hash(id);
  return {
    squiggle: SQUIGGLES[h % SQUIGGLES.length],
    watermark: WATERMARKS[(h >> 3) % WATERMARKS.length],
    tint: TINTS[(h >> 7) % TINTS.length],
  };
}

export type CardFlair = {
  label: string;
  icon: string;
  colors: [string, string];
};

/**
 * The eye-catching ribbon at the top of a card, derived ONLY from real job
 * data (no-fake-data rule: nothing renders unless the field genuinely says
 * so). Priority order picks the most swipe-worthy true fact.
 */
/** Curated phrase → chip vocabulary for sparse cards: a chip renders ONLY
 *  when the phrase genuinely appears in the listing text (no-fake-data rule).
 *  Order matters; the first hits win the limited chip slots. */
const LISTING_TAGS: { pattern: RegExp; label: string }[] = [
  { pattern: /venture[- ]backed/i, label: 'Venture-backed' },
  { pattern: /series [abc]\b/i, label: 'VC-funded' },
  { pattern: /early[- ]stage/i, label: 'Early-stage' },
  { pattern: /\bstartup\b/i, label: 'Startup' },
  { pattern: /fortune 500/i, label: 'Fortune 500' },
  { pattern: /direct[- ]to[- ]consumer|\bdtc\b|\bd2c\b/i, label: 'Direct-to-consumer' },
  { pattern: /e[- ]?commerce/i, label: 'E-commerce' },
  { pattern: /\bsaas\b/i, label: 'SaaS' },
  { pattern: /\bfintech\b/i, label: 'Fintech' },
  { pattern: /health ?care|health[- ]tech/i, label: 'Healthcare' },
  { pattern: /\bbiotech\b/i, label: 'Biotech' },
  { pattern: /\bnonprofit\b|non[- ]profit/i, label: 'Nonprofit' },
  { pattern: /\bAI\b|artificial intelligence|machine learning/, label: 'AI' },
  { pattern: /\bB2B\b/, label: 'B2B' },
  { pattern: /\bB2C\b/, label: 'B2C' },
  { pattern: /\bequity\b/i, label: 'Equity offered' },
  { pattern: /401\s?\(?k\)?/i, label: '401k' },
  { pattern: /remote[- ]first/i, label: 'Remote-first' },
  { pattern: /fast[- ]paced/i, label: 'Fast-paced' },
  { pattern: /cross[- ]functional/i, label: 'Cross-functional' },
  { pattern: /mentorship|mentored/i, label: 'Mentorship' },
];

/** Real phrases pulled from the listing itself, for filling a sparse card. */
export function listingTags(text: string | undefined, max: number): string[] {
  if (!text || max <= 0) return [];
  const out: string[] = [];
  for (const t of LISTING_TAGS) {
    if (t.pattern.test(text)) {
      out.push(t.label);
      if (out.length >= max) break;
    }
  }
  return out;
}

/** The user's own stated targets (roles + industries) that appear in this
 *  job's title or description: a true, personal "why this might fit". */
export function targetMatches(
  text: string,
  targets: string[],
  max: number,
): string[] {
  const hay = text.toLowerCase();
  return targets
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && hay.includes(t.toLowerCase()))
    .slice(0, Math.max(0, max));
}

export function cardFlair(job: {
  compensation?: string;
  workArrangement?: string;
  experienceLevel?: string;
  autoApplyEligible?: boolean;
}): CardFlair | null {
  const arr = (job.workArrangement || '').toLowerCase();
  if (job.compensation) {
    return { label: 'Salary on the table', icon: 'cash', colors: ['#059669', '#10B981'] };
  }
  if (job.autoApplyEligible) {
    return { label: 'One-swipe apply', icon: 'flash', colors: ['#2563EB', '#7C3AED'] };
  }
  if (arr.includes('remote')) {
    return { label: 'Work from anywhere', icon: 'home', colors: ['#0D9488', '#14B8A6'] };
  }
  if (arr.includes('hybrid')) {
    return { label: 'Hybrid schedule', icon: 'globe', colors: ['#4C62A8', '#7C89C9'] };
  }
  return null;
}
