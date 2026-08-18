import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LinkedInUrlHelp from '@/components/onboarding/LinkedInUrlHelp';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * DEV PREVIEW — the LinkedIn URL help popup, reachable without replaying
 * onboarding (the real step at /intake redirects once an account is past it).
 * Same component the intake screen renders, and the same input beside it, so
 * what you judge here is what ships. Not user-reachable: __DEV__ only.
 */
export default function LinkedInHelpPreview() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [linkedin, setLinkedin] = useState('');
  const [help, setHelp] = useState(false);

  // After the hooks, not before: an early return above them breaks the rule of
  // hooks even when the condition is a build-time constant.
  if (!__DEV__) return <Redirect href="/(tabs)/feed" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>
          LinkedIn help preview
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.inkSecondary }}>
            Close
          </Text>
        </Pressable>
      </View>

      <View style={{ padding: 20, gap: 4 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.inkTertiary }}>
          This is the LinkedIn block from onboarding, on its own. Tap the link under the box.
        </Text>

        <View style={{ height: 18 }} />

        <TextInput
          value={linkedin}
          onChangeText={setLinkedin}
          placeholder="LinkedIn link or handle"
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{
            height: 52,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.paper,
            paddingHorizontal: 16,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.ink,
          }}
        />

        <Pressable
          onPress={() => setHelp(true)}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            minHeight: 34,
            marginTop: 8,
          }}>
          <Ionicons name="help-circle-outline" size={16} color={colors.marketing} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.marketing }}>
            How do I find my LinkedIn URL?
          </Text>
        </Pressable>
      </View>

      {help ? <LinkedInUrlHelp onClose={() => setHelp(false)} /> : null}
    </View>
  );
}
