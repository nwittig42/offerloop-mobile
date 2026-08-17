import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileGapSurvey from '@/components/feed/ProfileGapSurvey';
import ScoutProfileNudge from '@/components/feed/ScoutProfileNudge';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { NudgeKey } from '@/lib/profileNudge';

/**
 * A direct door to the gap survey, for designing it.
 *
 * Reaching the real thing requires an account the ranker is blind to and an
 * empty People deck, which is a slow and destructive way to look at a layout:
 * answering the survey fixes the profile and you can never see the screen
 * again without breaking your own account. This route renders the same
 * components with throwaway callbacks, so it can be opened, judged, and
 * reloaded as many times as it takes.
 *
 * Every variant is switchable, because the two-question version and the
 * one-question version have different vertical rhythm and both ship.
 *
 * Open at /survey-preview (dev only — the tab bar never links here).
 */
type Variant = 'both' | 'companies-only' | 'school-only' | 'nudge';

const VARIANTS: { key: Variant; label: string }[] = [
  { key: 'both', label: 'All steps' },
  { key: 'school-only', label: 'School only' },
  { key: 'companies-only', label: 'Companies only' },
  { key: 'nudge', label: 'Scout nudge' },
];

const NUDGES: NudgeKey[] = ['school', 'dreamCompanies', 'targetRoles', 'locations'];

export default function SurveyPreviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [variant, setVariant] = useState<Variant>('both');
  const [nudge, setNudge] = useState<NudgeKey>('dreamCompanies');
  // Remounts the survey so "Not now" and a completed save can be replayed
  // without reloading the whole bundle.
  const [nonce, setNonce] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.feedBg, paddingTop: insets.top + 8 }}>
      {/* The switcher is preview chrome, not part of the design being judged.
          Kept visually plain so it never gets mistaken for the real thing. */}
      <View style={{ paddingHorizontal: 12, gap: 8, paddingBottom: 10 }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.6, color: colors.inkTertiary }}>
          SURVEY PREVIEW (DEV)
        </Text>
        {/* The Gmail step only renders when the signed-in account has no
            Gmail connected, so on a connected account this preview shows the
            question steps only. That is the real behaviour, not a bug. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {VARIANTS.map((v) => {
            const on = variant === v.key;
            return (
              <Pressable
                key={v.key}
                onPress={() => {
                  setVariant(v.key);
                  setNonce((n) => n + 1);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: on ? colors.ink : colors.paper,
                  borderWidth: 1,
                  borderColor: on ? colors.ink : colors.hairline,
                }}>
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 12,
                    color: on ? colors.paper : colors.inkSecondary,
                  }}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {variant === 'nudge' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {NUDGES.map((k) => {
              const on = nudge === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setNudge(k);
                    setNonce((n) => n + 1);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: on ? colors.accent : 'transparent',
                    borderWidth: 1,
                    borderColor: on ? colors.accent : colors.hairline,
                  }}>
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 11.5,
                      color: on ? colors.paper : colors.inkTertiary,
                    }}>
                    {k}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        {variant === 'nudge' ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
            <ScoutProfileNudge
              key={`${nudge}-${nonce}`}
              nudge={nudge}
              onClose={() => setNonce((n) => n + 1)}
            />
          </View>
        ) : (
          <ProfileGapSurvey
            key={`${variant}-${nonce}`}
            needsSchool={variant !== 'companies-only'}
            needsCompanies={variant !== 'school-only'}
            // Throwaway: replay instead of navigating away, so the screen is
            // still here after you press the button.
            onDone={() => setNonce((n) => n + 1)}
          />
        )}
      </View>
    </View>
  );
}
