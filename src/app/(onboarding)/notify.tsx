import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Step 5 — notification priming, deliberately AFTER the aha (a just-drafted
 * intro makes the value of a reply alert obvious). Soft ask → the OS prompt
 * fires from setNotificationsEnabled. "Maybe later" never blocks.
 */
export default function OnboardingNotify() {
  const router = useRouter();
  const colors = useColors();
  const { setNotificationsEnabled } = useApp();

  const goNext = () => router.push('/(onboarding)/done');

  const enable = () => {
    setNotificationsEnabled(true);
    goNext();
  };

  return (
    <OnboardingScaffold
      step={5}
      total={6}
      title="Know the moment they reply"
      subtitle="Networking is won on fast follow-ups. We'll ping you the second someone writes back — and when a draft is ready."
      footer={
        <>
          <Button label="Turn on notifications" variant="brand" size="lg" fullWidth onPress={enable} />
          <Button label="Maybe later" variant="ghost" fullWidth onPress={goNext} />
        </>
      }>
      <View style={{ gap: 12 }}>
        {[
          { icon: 'chatbubble-ellipses-outline' as const, text: 'A contact replied — reply back while you’re top of mind' },
          { icon: 'document-text-outline' as const, text: 'Your draft is ready to review and send' },
          { icon: 'sync-outline' as const, text: 'A Loop found new people overnight' },
        ].map((row) => (
          <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.accent + '12',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={row.icon} size={18} color={colors.accent} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>
              {row.text}
            </Text>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}
