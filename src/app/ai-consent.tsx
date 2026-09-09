import { router, useLocalSearchParams } from 'expo-router';
import { Image, Linking, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEffect } from 'react';

import { setAIConsent, useAIConsent } from '@/lib/aiConsent';
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

/**
 * Copy rules, learned the expensive way:
 *  - Lead with what the user GETS. Reviewers reject generic framings like
 *    "Powered by AI" or "We use AI to enhance your experience"; what passes is
 *    purpose-first and specific ("your messages are sent to OpenAI to generate
 *    replies"). Tying it to the value is both better copy and safer.
 *  - Name the providers. That is the part Apple specifically wanted spelled
 *    out; a category like "our AI partners" is a rejection.
 *  - Say what is sent, and what is NOT.
 * Everything below carries one of those. Trim wording freely, do not trim
 * those four facts.
 */
const HEADLINE = 'Why your intros sound like you';

const BODY =
  'To write an email that actually lands, we read your resume and find what ' +
  'you and your contact have in common. That means your resume, your profile, ' +
  'and what you type go to our AI providers, OpenAI, Anthropic, and Perplexity, ' +
  'through our servers. Never your name, email, or account details.';

const ALSO = 'The same powers Scout, meeting prep, and auto-apply.';

export default function AIConsentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isPrompt = mode === 'prompt' || mode === 'settings';
  const { consent, consentLoaded } = useAIConsent();

  // First-run gate mode only: if a stored answer finishes loading while this
  // screen is up (the cold-start race that re-showed the popup every launch),
  // move on. Settings/prompt modes keep the screen open on purpose.
  useEffect(() => {
    if (!isPrompt && consentLoaded && consent !== null) {
      router.replace('/(tabs)/feed');
    }
  }, [isPrompt, consentLoaded, consent]);

  const finish = async (choice: 'granted' | 'declined') => {
    await setAIConsent(choice);
    if (isPrompt) {
      if (router.canGoBack()) router.back();
    } else {
      // First-run gate: hand control back to the auth gate, which routes to
      // onboarding or the tabs now that a choice exists.
      router.replace('/(tabs)/feed');
    }
  };

  return (
    // Sheet, not a full-page interstitial (Nick 2026-08-13). Nearly nobody
    // ships a whole screen for this; the usual shape is a compact bottom sheet
    // with the disclosure and two buttons, so it reads as a normal permission
    // moment rather than a legal roadblock.
    //
    // Deliberately NOT a formSheet presentation: the 0.88 detent clipped
    // content and left a white void when the paywall tried it. This is a plain
    // route that PAINTS itself as a sheet, so there is no navigation change,
    // no detent maths, and no chance of the gate looping.
    //
    // What must not be trimmed further (guidelines 5.1.1(i)/5.1.2(i), the
    // rejection of 2026-08-05): what is sent, the AI providers BY NAME, and a
    // genuine decline that leaves the rest of the app usable.
    <View style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.45)', justifyContent: 'flex-end' }}>
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: insets.bottom + 20,
          gap: 14,
        }}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.hairline,
            alignSelf: 'center',
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={require('../../assets/images/scout-yeti-head.png')}
            style={{ width: 32, height: 32 }}
            resizeMode="contain"
            accessibilityLabel="Scout"
          />
          <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
            {HEADLINE}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            lineHeight: 21,
            color: colors.inkSecondary,
          }}>
          {BODY}
        </Text>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            lineHeight: 19,
            color: colors.inkTertiary,
          }}>
          {ALSO}
        </Text>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.inkTertiary,
            lineHeight: 17,
          }}>
          Change this any time in Settings.{' '}
          <Text style={{ color: colors.accent }} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
        </Text>

        <View style={{ gap: 8 }}>
          <Button
            label="Allow"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => void finish('granted')}
          />
          <Button label="Not now" variant="ghost" fullWidth onPress={() => void finish('declined')} />
        </View>
      </View>
    </View>
  );
}
