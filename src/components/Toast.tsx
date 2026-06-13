import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useApp } from '@/store/app';
import { colors, fonts, shadows } from '@/theme/tokens';

/**
 * The optimistic confirmation that slides up after a right swipe.
 * Ink fill, white text, optional jump into the Inbox.
 */
export function Toast() {
  const { toast } = useApp();
  const router = useRouter();

  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 104,
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
            backgroundColor: colors.ink,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 11,
            maxWidth: '88%',
          },
          shadows.lg,
        ]}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.paper }}>
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
