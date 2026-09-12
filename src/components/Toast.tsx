import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { useApp } from '@/store/app';
import { BRAND_CTA_BG, BRAND_CTA_FG, fonts, shadows } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/**
 * The optimistic confirmation. Drops in from the top (below the status bar)
 * so it never covers the Feed action buttons at the bottom. Ink fill, white
 * text, optional jump into the Inbox.
 */
export function Toast() {
  const colors = useColors();
  const { toast } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16)}
      exiting={FadeOutUp}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 78,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            // Fixed black, not colors.ink (Rylan 2026-09-11: the same
            // dark-mode wash-out as "Get started" — every toast in the app
            // was reading as a pale, near-invisible pill in dark mode).
            backgroundColor: BRAND_CTA_BG,
            borderRadius: 22,
            paddingHorizontal: 18,
            paddingVertical: 11,
            maxWidth: '92%',
          },
          shadows.lg,
        ]}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: BRAND_CTA_FG }}>
          {toast.message}
        </Text>
        {toast.showInboxAction ? (
          <Pressable onPress={() => router.push('/(tabs)/inbox')} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#9DB0DC' }}>
              View
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default Toast;
