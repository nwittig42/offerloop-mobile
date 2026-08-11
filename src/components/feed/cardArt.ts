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
