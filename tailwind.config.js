/**
 * Offerloop design tokens, ported from the web app (connect-grow-hire).
 * Source of truth: OFFERLOOP_MOBILE_V1_BRIEF.md section 8.
 * The "stationery" system is the app system. Marketing blue is promo-only.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        'paper-2': '#FAFBFF',
        surface: '#F5F6F8',
        ink: {
          DEFAULT: '#111318',
          secondary: '#4A4F5B',
          tertiary: '#8A8F9A',
        },
        navy: {
          DEFAULT: '#1B2A44',
          deep: '#243656',
        },
        heading: '#1E2D4D',
        accent: {
          DEFAULT: '#4A60A8',
        },
        hairline: {
          DEFAULT: '#E5E5E0',
          light: '#F0F0ED',
        },
        positive: '#16A34A',
        negative: '#DC2626',
        waiting: '#CA8A04',
        marketing: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
      },
      borderRadius: {
        base: '3px',
        input: '6px',
        btn: '8px',
        chip: '8px',
        card: '10px',
        sheet: '14px',
        xl2: '16px',
        xl3: '24px',
        xl4: '32px',
      },
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        display: ['InstrumentSerif_400Regular'],
        'display-italic': ['InstrumentSerif_400Regular_Italic'],
        mono: ['JetBrainsMono_400Regular'],
      },
    },
  },
  plugins: [],
};
