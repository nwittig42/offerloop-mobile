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
  feedBg: '#E8F1FF', // light baby-blue screen wash (Feed, Loops)
} as const;

export type Palette = { [K in keyof typeof lightColors]: string };

/**
 * Dark palette, built on the brand navy. Surfaces step up from a deep navy
 * screen (#0E1320) through lifted cards; text steps down from near-white.
 * Brand/accent blues are lightened so they read as accents on dark, while
 * still working as button fills with white text. Semantic colors are brightened
 * a notch for contrast against the dark ground.
 */
export const darkColors: Palette = {
  paper: '#161C2B', // cards, header, raised surfaces
  paper2: '#1E2638', // subtly raised (neutral chips, scout circle, inputs)
  surface: '#0E1320', // screen background behind cards
  ink: '#F3F6FC', // primary text
  inkSecondary: '#B6BECE', // secondary text
  inkTertiary: '#7B8499', // tertiary text / icons
  navy: '#4E6BB0', // brand fill + accent (lightened to read on dark)
  navyDeep: '#3F5A97', // brand pressed
  heading: '#EAF0FA', // serif titles
  accent: '#8AA0DA', // accent text / tints / icons
  hairline: '#2A3343', // borders / dividers
  hairlineLight: '#222A39', // softer dividers
  positive: '#3DCB82',
  negative: '#FF6B6B',
  waiting: '#E2B53F',
  marketing: '#5B9BF4',
  applyLink: '#C4B0FF', // light purple, brightened to read on the dark ground
  coffee: '#C08552',
  bolt: '#FACC15',
  feedBg: '#0E1320', // keep the dark screen background in dark mode
};

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

// Fallback for any school not in the table yet, so the theme always works.
const DEFAULT_SCHOOL: SchoolPalette = { name: 'School', primary: '#990000', darkPrimary: '#E0484A', secondary: '#FFC72C' };

/** Resolve the user's school string to a color palette (always returns one). */
export function resolveSchool(school?: string): SchoolPalette {
  const s = (school ?? '').toLowerCase();
  for (const entry of SCHOOL_TABLE) {
    if (entry.match.some((m) => s.includes(m))) return entry.palette;
  }
  return DEFAULT_SCHOOL;
}

/**
 * Merge the school accent onto a base palette. Capped to the brand-hue keys so
 * a theme can never repaint backgrounds, text, or semantic colors.
 */
export function applyAccent(
  base: Palette,
  accent: AccentTheme,
  dark: boolean,
  school: SchoolPalette,
): Palette {
  if (accent === 'default') return base;
  const primary = dark ? school.darkPrimary : school.primary;
  return { ...base, navy: primary, navyDeep: primary, accent: primary, marketing: primary };
}
