import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

import {
  applyAccent,
  darkColors,
  lightColors,
  resolveSchool,
  type AccentTheme,
  type Palette,
  type SchoolPalette,
} from '@/theme/tokens';

/**
 * App-wide appearance. The user picks Light or Dark in Profile › Settings.
 * There is no "system" mode: the choice is a sticky Light/Dark toggle. On the
 * very first launch we seed the default from the device's current scheme (so a
 * dark-phone user lands in dark), then the explicit choice sticks.
 *
 * `pref` IS the resolved scheme ('light' | 'dark') that screens render against.
 * `colors` is the matching palette. Because this whole app styles inline from
 * the token object, `useColors()` is what makes a screen dark-aware: swap the
 * static `import { colors }` for `const colors = useColors()` inside the
 * component and every existing `colors.x` reference flips with the setting.
 *
 * Phase 1 keeps the preference in memory, consistent with the mock store; it
 * re-seeds from the device on cold start. Persistence wires in alongside the
 * rest of the store in Phase 3.
 */

export type ThemePref = 'light' | 'dark';
export type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
  scheme: Scheme;
  colors: Palette;
  /** Unlockable accent skin (milestone reward), layered on Light/Dark. */
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;
  /** The user's school colors (resolved from their profile), null until we
      actually know their school, which hides the skin entirely. */
  school: SchoolPalette | null;
  setSchool: (school: SchoolPalette | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalize(scheme: ColorSchemeName): Scheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Seed once from the device scheme, then it's a sticky Light/Dark choice.
  const [pref, setPref] = useState<ThemePref>(() => normalize(Appearance.getColorScheme()));
  const [accentTheme, setAccentTheme] = useState<AccentTheme>('default');
  // Synced from the user's profile.school by the app shell; default until then.
  const [school, setSchool] = useState<SchoolPalette | null>(() => resolveSchool());

  const scheme: Scheme = pref;
  const base = scheme === 'dark' ? darkColors : lightColors;
  const colors = useMemo(
    () => applyAccent(base, accentTheme, scheme === 'dark', school),
    [base, accentTheme, scheme, school],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ pref, setPref, scheme, colors, accentTheme, setAccentTheme, school, setSchool }),
    [pref, scheme, colors, accentTheme, school],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Sugar for the common case: just the active palette. */
export function useColors(): Palette {
  return useTheme().colors;
}
