import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';

/**
 * Loading primitives. A single pulsing block (`Skeleton`) plus two composed
 * placeholders that mirror the real layouts they stand in for, so the first
 * paint of a signed-in screen is the screen's own shape — never mock data
 * flashed as if it were real (see ConnectionBanner / the no-fake-data rule).
 */

export function Skeleton({
  width = '100%',
  height = 12,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const colors = useColors();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.hairline }, animated, style]}
    />
  );
}

/** A single job-card silhouette: the big swipe card plus the action row. */
export function FeedSkeleton() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 28,
          backgroundColor: colors.paper,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: 24,
          gap: 16,
          marginBottom: 90,
        }}>
        <Skeleton width={64} height={64} radius={16} />
        <Skeleton width="70%" height={22} radius={8} />
        <Skeleton width="45%" height={15} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Skeleton width={84} height={26} radius={13} />
          <Skeleton width={64} height={26} radius={13} />
        </View>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Skeleton width="100%" height={13} />
          <Skeleton width="92%" height={13} />
          <Skeleton width="96%" height={13} />
          <Skeleton width="60%" height={13} />
        </View>
      </View>
      <View style={{ position: 'absolute', bottom: 18, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
        <Skeleton width={50} height={50} radius={25} />
        <Skeleton width={64} height={64} radius={32} />
        <Skeleton width={64} height={64} radius={32} />
        <Skeleton width={50} height={50} radius={25} />
      </View>
    </View>
  );
}

function InboxRowSkeleton() {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 }}>
      <View style={{ width: 8 }} />
      <Skeleton width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="85%" height={12} />
      </View>
      <Skeleton width={28} height={11} />
    </View>
  );
}

/** A stack of conversation-row silhouettes for the inbox list. */
export function InboxSkeleton({ rows = 7 }: { rows?: number }) {
  const colors = useColors();
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i}>
          <InboxRowSkeleton />
          {i < rows - 1 ? (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 84 }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default Skeleton;
