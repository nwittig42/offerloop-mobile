import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveTargetTrack } from '@/api/endpoints/preferences';
import { Button } from '@/components/ui/Button';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Step 2 — the goal anchor. A single high-commitment choice ("what are you
 * recruiting for") that drives the demo + the feed and lifts activation. Writes
 * industries/targetRoles to the cached profile so the rest of the flow + the
 * feed personalize immediately.
 */

type Track = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  industries: string[];
  roles: string[];
};

const TRACKS: Track[] = [
  { key: 'ib', label: 'Investment Banking', icon: 'trending-up-outline', industries: ['Investment Banking'], roles: ['Investment Banking Analyst'] },
  { key: 'consulting', label: 'Consulting', icon: 'briefcase-outline', industries: ['Consulting'], roles: ['Consultant'] },
  { key: 'tech', label: 'Tech', icon: 'hardware-chip-outline', industries: ['Technology'], roles: ['Software Engineer'] },
  { key: 'other', label: 'Something else', icon: 'compass-outline', industries: [], roles: [] },
];

export default function OnboardingGoal() {
  const router = useRouter();
  const colors = useColors();
  const { updateProfile } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  const next = () => {
    const track = TRACKS.find((t) => t.key === selected);
    if (track && track.industries.length) {
      // Optimistic in-session personalization...
      updateProfile({ industries: track.industries, targetRoles: track.roles });
      // ...plus a real persist. The backend accepts targetRoles/industries on
      // /api/mobile/preferences (see save_preferences); ignored harmlessly if
      // that accept hasn't shipped yet.
      void saveTargetTrack({ targetRoles: track.roles, industries: track.industries }).catch(() => {});
    }
    router.push('/(onboarding)/confirm');
  };

  return (
    <OnboardingScaffold
      step={2}
      total={6}
      title="What are you recruiting for?"
      subtitle="This tunes who shows up in your feed and how your intros are written."
      footer={
        <Button
          label="Continue"
          variant="brand"
          size="lg"
          fullWidth
          icon="arrow-forward"
          disabled={!selected}
          onPress={next}
        />
      }>
      <View style={{ gap: 12 }}>
        {TRACKS.map((t) => {
          const on = selected === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setSelected(t.key)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 14,
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.accent : colors.hairline,
                backgroundColor: on ? colors.accent + '0F' : colors.paper,
              }}>
              <Ionicons name={t.icon} size={22} color={on ? colors.accent : colors.inkSecondary} />
              <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
                {t.label}
              </Text>
              {on ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}
