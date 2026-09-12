/**
 * Raw token values for places NativeWind classes cannot reach
 * (this app styles inline via the `colors` object, plus shadow objects,
 * animation curves, navigator theming). Keep in sync with tailwind.config.js.
 *
 * Two palettes, same keys: `lightColors` and `darkColors`. Screens read the
 * active one through `useColors()` (see theme/ThemeProvider) so they react to
 * the appearance setting in Profile. `colors` stays exported as the light
 * palette for module-scope / non-reactive fallbacks (e.g. shadow color).
 */

export const lightColors = {
  paper: '#FFFFFF',
  paper2: '#FAFBFF',
  surface: '#F5F6F8',
  ink: '#111318',
  inkSecondary: '#4A4F5B',
  inkTertiary: '#8A8F9A',
  navy: '#1B2A44',
  navyDeep: '#243656',
  heading: '#1E2D4D',
  accent: '#4A60A8',
  hairline: '#E5E5E0',
  hairlineLight: '#F0F0ED',
  positive: '#16A34A',
  negative: '#DC2626',
  waiting: '#CA8A04',
  marketing: '#3B82F6',
  applyLink: '#8B5CF6', // "Apply on the site" status — light purple, distinct from amber "needs input"
  coffee: '#8B5A2B',
  bolt: '#FACC15',
  // Feed, Loops. Was a baby-blue wash (#E8F1FF) that read as a whole-screen
  // tint once the watercolor ridgeline came off it. Near-white rather than pure
  // white on purpose: cards are #FFFFFF, so the screen has to sit a step below
  // them or the card stops reading as a card and survives on its shadow alone.
  feedBg: '#F5F6F8',
} as const;

export type Palette = { [K in keyof typeof lightColors]: string };

/**
 * Dark palette = Scout's night room, app-wide (Rylan 2026-08-10). The Scout
 * tab's always-night look (deep navy sky, blue-tinted ink, periwinkle lines)
 * is the reference; dark mode everywhere reads as the same place instead of
 * inverted light screens. Values track the NIGHT constants in the Scout tab.
 * Semantic colors stay brightened a notch for contrast against the dark ground.
 */
export const darkColors: Palette = {
  paper: '#152137', // cards, header, raised surfaces (blue-lifted navy)
  paper2: '#1C2A46', // subtly raised (chips, scout circle, inputs)
  surface: '#0C1526', // screen background: Scout's NIGHT.bg
  ink: '#EAF0FF', // primary text: Scout's night ink
  inkSecondary: '#8FA3CC', // secondary text
  inkTertiary: '#5A6B8F', // tertiary text / icons
  navy: '#4E6BB0', // brand fill + accent (lightened to read on dark)
  navyDeep: '#3F5A97', // brand pressed
  heading: '#EAF0FA', // serif titles
  accent: '#8AA0DA', // accent text / tints / icons
  hairline: '#2C3A5C', // borders / dividers (periwinkle-leaning)
  hairlineLight: '#22304E', // softer dividers
  positive: '#3DCB82',
  negative: '#FF6B6B',
  waiting: '#E2B53F',
  marketing: '#5B9BF4',
  applyLink: '#C4B0FF', // light purple, brightened to read on the dark ground
  coffee: '#C08552',
  bolt: '#FACC15',
  feedBg: '#0C1526', // same night sky behind the Feed in dark mode
};

/** The Scout night-sky gradient stops, shared by NightSky and the Scout tab. */
export const darkSky = {
  top: '#12203A',
  mid: '#0C1526',
  bottom: '#0A111F',
} as const;

/** Default export stays the light palette (module-scope/back-compat reads). */
export const colors = lightColors;

// Soft, near-black, low-opacity shadows from the web system.
// RN needs the iOS shadow* properties; elevation covers Android.
// Shadow color is pinned to the light ink so dark mode does not invert it
// into a glow; on dark surfaces these read as a faint depth cue.
export const shadows = {
  sm: {
    shadowColor: lightColors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: lightColors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: lightColors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Web motion curves: ease-out-expo and a springy overshoot.
// Reanimated springs approximate these; keep the cubics for timing-based moves.
export const easing = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  mono: 'JetBrainsMono_400Regular',
} as const;

// Chip tint recipe from the web Badge: ~8 percent fill, ~15 percent border.
export function tint(hex: string) {
  return { fill: hex + '14', border: hex + '26' };
}

/**
 * The "school colors" accent theme (a milestone reward). There is no school
 * PICKER: the colors come from the school the user signed up with. Accent-only
 * by design, so a theme recolors ONLY the brand hue on top of the active
 * light/dark palette and leaves structure, neutrals, and typography untouched
 * (the brand identity holds). `darkPrimary` is a pre-lightened variant so the
 * color still reads as an accent on the dark ground; `secondary` drives the
 * decorative pennant stripe.
 */
export type AccentTheme = 'default' | 'school';

export type SchoolPalette = {
  name: string;
  primary: string;
  darkPrimary: string;
  secondary: string;
};

// Offerloop's target schools. Production swaps this for a real school->colors
// table (or lets the user pick their two colors); the lookup is the only thing
// that changes, not the theming.
const SCHOOL_TABLE: { match: string[]; palette: SchoolPalette }[] = [
  { match: ['southern california', 'usc'], palette: { name: 'USC', primary: '#990000', darkPrimary: '#E0484A', secondary: '#FFC72C' } },
  { match: ['ucla', 'los angeles'], palette: { name: 'UCLA', primary: '#2774AE', darkPrimary: '#5BA7E0', secondary: '#FFD100' } },
  { match: ['michigan'], palette: { name: 'Michigan', primary: '#00274C', darkPrimary: '#5C86C2', secondary: '#FFCB05' } },
  { match: ['new york university', 'nyu'], palette: { name: 'NYU', primary: '#57068C', darkPrimary: '#A45BD8', secondary: '#C77DFF' } },
  { match: ['georgetown'], palette: { name: 'Georgetown', primary: '#041E42', darkPrimary: '#5A7BA8', secondary: '#A7A8AA' } },
  { match: ['pennsylvania', 'upenn', 'penn'], palette: { name: 'Penn', primary: '#011F5B', darkPrimary: '#5E83C4', secondary: '#990000' } },
];

/**
 * Resolve the user's school string to a color palette, or null when we do not
 * actually know their school. The old fallback handed USC cardinal and gold
 * (labeled "School") to every unmatched user, which broke the no-fake-data
 * rule in spirit: the reward claimed colors we never verified. No match now
 * means the school theme simply is not offered.
 */
export function resolveSchool(school?: string): SchoolPalette | null {
  const s = (school ?? '').toLowerCase();
  if (!s.trim()) return null;
  for (const entry of SCHOOL_TABLE) {
    if (entry.match.some((m) => s.includes(m))) return entry.palette;
  }
  return null;
}

/**
 * Merge the school accent onto a base palette. Capped to the brand-hue keys so
 * a theme can never repaint backgrounds, text, or semantic colors.
 */
export function applyAccent(
  base: Palette,
  accent: AccentTheme,
  dark: boolean,
  school: SchoolPalette | null,
): Palette {
  if (accent === 'default' || !school) return base;
  const primary = dark ? school.darkPrimary : school.primary;
  return { ...base, navy: primary, navyDeep: primary, accent: primary, marketing: primary };
}

/**
 * The solid black CTA pill (Welcome's "Get started", every Continue through
 * intake, "Connect Gmail", "Build my resume from this LinkedIn"): a brand
 * mark, not a themed surface, so it stays identical in light and dark mode.
 *
 * NEVER build one from colors.ink / colors.paper. Those are TEXT and
 * SURFACE tokens — they swap brightness in dark mode (ink turns near-white,
 * paper turns dark navy), which is correct for text on a card and wrong for
 * a button whose whole identity is "black pill, white label." Doing that
 * silently inverted four buttons across Welcome and onboarding into pale,
 * barely-visible pills in dark mode (Rylan 2026-09-11 — three people hit
 * this on their very first open, and it recurred a second and third time in
 * onboarding after the first fix, because each button had its own inline
 * colors.ink/colors.paper instead of reading these two constants).
 */
export const BRAND_CTA_BG = '#111318';
export const BRAND_CTA_FG = '#FFFFFF';
