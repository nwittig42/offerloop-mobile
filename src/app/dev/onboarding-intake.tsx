import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import IntakeScreen from '@/app/(onboarding)/intake';
import { fonts } from '@/theme/tokens';

/**
 * DEV PREVIEW — the real onboarding intake step (resume, LinkedIn, build-one),
 * rendered outside the (onboarding) group so the root auth gate does not bounce
 * an already-onboarded account straight back to the tabs.
 *
 * This is the actual screen component, not a copy, so what you judge here is
 * what a new user sees. That also means Continue is LIVE: it uploads, parses,
 * and writes to the signed-in profile. The badge says so. Not user-reachable:
 * __DEV__ only.
 */
export default function OnboardingIntakePreview() {
  const [badge, setBadge] = useState(true);

  if (!__DEV__) return <Redirect href="/(tabs)/feed" />;

  return (
    <View style={{ flex: 1 }}>
      <IntakeScreen />
      {badge ? (
        <Pressable
          onPress={() => setBadge(false)}
          accessibilityRole="button"
          accessibilityLabel="Hide preview badge"
          style={{
            position: 'absolute',
            top: 6,
            alignSelf: 'center',
            backgroundColor: 'rgba(17,19,24,0.82)',
            borderRadius: 999,
            paddingVertical: 5,
            paddingHorizontal: 12,
          }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#FFFFFF' }}>
            preview · Continue is live · tap to hide
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
