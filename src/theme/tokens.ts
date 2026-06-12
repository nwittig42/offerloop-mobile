/**
 * Raw token values for places NativeWind classes cannot reach
 * (shadow objects, animation curves, navigator theming).
 * Keep in sync with tailwind.config.js.
 */

export const colors = {
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
} as const;

// Soft, near-black, low-opacity shadows from the web system.
// RN needs the iOS shadow* properties; elevation covers Android.
export const shadows = {
  sm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.ink,
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
