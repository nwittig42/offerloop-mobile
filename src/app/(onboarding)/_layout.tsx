import { Stack } from 'expo-router';

import { useColors } from '@/theme/ThemeProvider';

/** First-run onboarding stack. Gated in the root layout: a signed-in user who
 *  hasn't completed onboarding lands here before the tabs. Steps push forward;
 *  the final step marks complete and replaces to the feed. */
export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'slide_from_right',
      }}
    />
  );
}
