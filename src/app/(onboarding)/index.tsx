import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** Step 1 — identity confirm. Personalized from /me so the first screen says
 *  "it already knows me." No ask, just a warm confirm + continue. */
export default function OnboardingWelcome() {
  const router = useRouter();
  const colors = useColors();
  const { profile } = useApp();

  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'there';
  const school = (profile.school || '').trim();

  return (
    <OnboardingScaffold
      step={1}
      total={6}
      canBack={false}
      title={`Welcome, ${firstName}`}
      subtitle="A quick 30 seconds to tune Offerloop to your search — then you're swiping."
      footer={
        <Button
          label="Let's go"
          variant="brand"
          size="lg"
          fullWidth
          icon="arrow-forward"
          onPress={() => router.push('/(onboarding)/goal')}
        />
      }>
      {school ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.accent + '14',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="school-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              Signed in as
            </Text>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
              {school}
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={colors.positive} />
        </Card>
      ) : null}
    </OnboardingScaffold>
  );
}
