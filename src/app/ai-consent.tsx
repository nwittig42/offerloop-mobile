import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setAIConsent } from '@/lib/aiConsent';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * AI data-sharing disclosure + consent (guidelines 5.1.1(i)/5.1.2(i)). Shown
 * once after sign-in (mode absent: the gate), re-shown when an unconsented
 * user triggers an AI feature (mode=prompt), and openable read-write from
 * Profile > Settings (mode=settings). Plain copy, real provider names, a
 * genuine decline path. Scout's face keeps it friendly.
 */

const PRIVACY_URL = 'https://offerloop.ai/privacy';

const ROWS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'document-text-outline',
    title: 'What is shared',
    body: 'Your resume text, profile details (school, target roles, about), the jobs and contacts you act on, and messages you type to Scout.',
  },
  {
    icon: 'hardware-chip-outline',
    title: 'Who processes it',
    body: 'Our AI providers: OpenAI, Anthropic, and Perplexity. They process it through our servers, only to power the features below, and do not get your name, email, or account details beyond what appears in the content itself.',
  },
  {
    icon: 'sparkles-outline',
    title: 'What it powers',
    body: 'Drafting your outreach emails, parsing your resume, Scout answers, meeting prep briefs, and auto-apply.',
  },
];

export default function AIConsentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isPrompt = mode === 'prompt' || mode === 'settings';

  const finish = async (choice: 'granted' | 'declined') => {
    await setAIConsent(choice);
    if (isPrompt) {
      if (router.canGoBack()) router.back();
    } else {
      // First-run gate: hand control back to the auth gate, which routes to
      // onboarding or the tabs now that a choice exists.
      router.replace('/(tabs)');
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        paddingTop: insets.top + 28,
        paddingHorizontal: 28,
        paddingBottom: insets.bottom + 20,
      }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Image
            source={require('../../assets/images/scout-yeti-head.png')}
            style={{ width: 64, height: 64 }}
            resizeMode="contain"
            accessibilityLabel="Scout"
          />
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 28,
              color: colors.heading,
              textAlign: 'center',
              lineHeight: 33,
            }}>
            Offerloop runs on AI
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 21,
              maxWidth: 320,
            }}>
            Drafts, Scout, and meeting prep are powered by AI. Before anything is shared, here
            is exactly what leaves your device and where it goes.
          </Text>
        </View>

        <View style={{ gap: 18, marginBottom: 24 }}>
          {ROWS.map((r) => (
            <View key={r.title} style={{ flexDirection: 'row', gap: 14 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={r.icon} size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                  {r.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: colors.inkSecondary,
                    lineHeight: 19,
                    marginTop: 2,
                  }}>
                  {r.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 18,
            marginBottom: 18,
          }}>
          Your data is never sold. Full details in our{' '}
          <Text style={{ color: colors.accent }} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
          . Change this choice any time in Profile, then Settings.
        </Text>

        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Button
            label="Allow and continue"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => void finish('granted')}
          />
          <Button
            label="Not now"
            variant="ghost"
            fullWidth
            onPress={() => void finish('declined')}
          />
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11.5,
              color: colors.inkTertiary,
              textAlign: 'center',
              lineHeight: 16,
            }}>
            Choosing Not now keeps the AI features off. You can still browse jobs and your
            inbox, and turn AI on whenever you are ready.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
