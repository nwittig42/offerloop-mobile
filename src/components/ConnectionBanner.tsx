import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { useApp } from '@/store/app';
import { fonts, shadows } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/**
 * Connection status bar. The store renders MOCK_PROFILE whenever the live
 * /api/mobile/me call hasn't returned (profile = meQuery.data ?? MOCK_PROFILE),
 * so an unreachable or erroring backend would otherwise look like real "sample"
 * data. This makes that state explicit: an amber "connecting" hint on first
 * load, and a red "can't reach server — showing sample data · Retry" bar on
 * error. Sits flush at the top; the Toast floats below it.
 */
export function ConnectionBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { connection } = useApp();

  if (connection.status === 'ok') return null;

  // Red only for the true nothing-real-to-show case. A failed refetch while
  // real data is still on screen ('reconnecting') gets the softer amber and
  // never claims "sample data" (it would be false — the data shown is real).
  const isError = connection.status === 'error';
  const bg = isError ? colors.negative : colors.waiting;
  const label = isError
    ? 'Can’t reach Offerloop — showing sample data'
    : connection.status === 'reconnecting'
      ? 'Reconnecting to Offerloop…'
      : 'Connecting to Offerloop…';
  const showRetry = isError || connection.status === 'reconnecting';

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutUp}
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            paddingTop: insets.top + 8,
            paddingBottom: 10,
            paddingHorizontal: 16,
            backgroundColor: bg,
          },
          shadows.sm,
        ]}>
        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 12.5,
            color: '#FFFFFF',
            flexShrink: 1,
          }}>
          {label}
        </Text>
        {showRetry ? (
          <Pressable onPress={connection.retry} accessibilityRole="button" hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.sansSemibold,
                fontSize: 12.5,
                color: '#FFFFFF',
                textDecorationLine: 'underline',
              }}>
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default ConnectionBanner;
