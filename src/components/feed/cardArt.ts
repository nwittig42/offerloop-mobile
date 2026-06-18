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

export function cardArt(id: string): { squiggle: ImageSourcePropType; watermark: ImageSourcePropType } {
  const h = hash(id);
  return {
    squiggle: SQUIGGLES[h % SQUIGGLES.length],
    watermark: WATERMARKS[(h >> 3) % WATERMARKS.length],
  };
}
