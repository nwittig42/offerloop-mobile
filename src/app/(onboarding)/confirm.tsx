import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { savePreferredLocations } from '@/api/endpoints/preferences';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Step 3 — confirm the targets and capture preferred locations (a real,
 * persisted ask via /api/mobile/preferences that the feed actually uses). The
 * payoff is qualitative — we never invent an alumni count (no fake numbers).
 */

const SUGGESTED = ['New York', 'San Francisco', 'Chicago', 'Los Angeles', 'Boston', 'Remote'];

export default function OnboardingConfirm() {
  const router = useRouter();
  const colors = useColors();
  const { profile, updateProfile } = useApp();

  const school = (profile.school || '').trim();
  const industry = (profile.industries?.[0] || 'your target roles').trim();
  const [locations, setLocations] = useState<string[]>(profile.preferredLocations ?? []);

  const toggle = (loc: string) =>
    setLocations((prev) => (prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]));

  const next = () => {
    // Real persist — the feed reads preferredLocations as a soft geo signal.
    updateProfile({ preferredLocations: locations });
    void savePreferredLocations(locations).catch(() => {});
    router.push('/(onboarding)/demo');
  };

  return (
    <OnboardingScaffold
      step={3}
      total={6}
      title="Here's the plan"
      subtitle={
        school
          ? `We'll prioritize people from ${school} and warm paths into ${industry}.`
          : `We'll prioritize warm paths into ${industry}.`
      }
      footer={
        <Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />
      }>
      <Card style={{ gap: 6, marginBottom: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
            Your edge
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
          Shared background is the strongest opener in a cold email. Offerloop leans on your school,
          path, and resume to find people most likely to reply — and writes the intro for you.
        </Text>
      </Card>

      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink, marginBottom: 4 }}>
        Where do you want to land?
      </Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, marginBottom: 12 }}>
        Optional — nudges your feed toward those cities. You can change this anytime.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SUGGESTED.map((loc) => {
          const on = locations.includes(loc);
          return (
            <Pressable
              key={loc}
              onPress={() => toggle(loc)}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? colors.accent : colors.hairline,
                backgroundColor: on ? colors.accent + '12' : colors.paper,
              }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: on ? colors.accent : colors.ink }}>
                {loc}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}
