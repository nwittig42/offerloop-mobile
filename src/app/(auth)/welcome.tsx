import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * First-download welcome. Sells the hero, then forks: returning users sign in
 * (email link), brand-new users go to offerloop.ai to create their account and
 * subscribe (Flo-style web-first), then come back and sign in. Deep setup lives
 * on the web; the app reflects the profile from /me once signed in.
 */
const SIGNUP_URL = 'https://offerloop.ai/signin?mode=signup';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'albums-outline', title: 'Swipe to draft', body: 'Right-swipe a job and Offerloop drafts a tailored intro to someone there.' },
  { icon: 'mail-outline', title: 'Replies in one place', body: 'Drafts, sends, and replies land in an inbox built for fast follow-ups.' },
  { icon: 'infinite', title: 'Loops on autopilot', body: 'Set a Loop and it finds people and drafts outreach while you go about your day.' },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.feedBg,
        paddingTop: insets.top + 36,
        paddingHorizontal: 28,
        paddingBottom: insets.bottom + 20,
      }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Image
          source={require('../../../assets/images/offerloop-logo.png')}
          style={{ width: 150, height: 37 }}
          resizeMode="contain"
          accessibilityLabel="Offerloop"
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.heading,
            textAlign: 'center',
            lineHeight: 34,
            marginTop: 4,
          }}>
          Your recruiting, in your pocket
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        {FEATURES.map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.marketing + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={f.icon} size={21} color={colors.marketing} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
                {f.title}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                {f.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Button
          label="Sign in"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Button
          label="Create your account"
          variant="outline"
          size="lg"
          icon="open-outline"
          fullWidth
          onPress={() => Linking.openURL(SIGNUP_URL)}
        />
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 18,
          }}>
          New here? You’ll set up your account on offerloop.ai, then sign in.
        </Text>
      </View>
    </View>
  );
}
