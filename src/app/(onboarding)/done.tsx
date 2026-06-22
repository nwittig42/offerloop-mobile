import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** Step 6 — done. Mark onboarding complete (persists the per-user flag) and
 *  drop into the live feed. No paywall: the freemium model does the rest. */
export default function OnboardingDone() {
  const router = useRouter();
  const colors = useColors();
  const { profile, completeOnboarding } = useApp();

  const firstName = (profile.name || '').trim().split(/\s+/)[0] || '';

  const finish = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <OnboardingScaffold
      step={6}
      total={6}
      canBack={false}
      title={firstName ? `You're set, ${firstName}` : "You're set"}
      subtitle="Your feed is tuned to your targets. Swipe right to draft, check the Inbox for replies, and set a Loop to keep it running while you study."
      footer={<Button label="Start swiping" variant="brand" size="lg" fullWidth icon="albums-outline" onPress={finish} />}>
      <View style={{ alignItems: 'center', paddingTop: 16, gap: 18 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.accent + '14',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="rocket-outline" size={42} color={colors.accent} />
        </View>
        <View style={{ gap: 10, width: '100%' }}>
          {[
            'Swipe right on a job → we draft the intro',
            'Replies land in your Inbox for fast follow-ups',
            'Loops keep finding people on autopilot',
          ].map((t) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.positive} />
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink }}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingScaffold>
  );
}
