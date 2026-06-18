/**
 * A stable, pleasant accent color per company name. This is decorative only —
 * a deterministic pick from a curated palette so each company reads with its
 * own hue across the app (logo halo, monogram tint). It is NOT a claim about
 * the company's real brand color; it just adds life to otherwise white cards.
 */
const PALETTE = [
  '#2563EB', // blue
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#DB2777', // pink
  '#E11D48', // rose
  '#EA580C', // orange
  '#D97706', // amber
  '#059669', // emerald
  '#0891B2', // cyan
  '#0D9488', // teal
];

export function companyColor(name: string): string {
  let h = 0;
  const s = name || '';
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
