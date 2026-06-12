import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme/tokens';

/**
 * Shared screen header: Instrument Serif title on the left, the notification
 * bell on the right (the hub opens from here in Phase 1), plus optional
 * per-screen actions. Badge count renders only when a real count exists.
 */
export function Header({
  title,
  unreadCount,
  onBellPress,
  left,
  right,
}: {
  title: string;
  unreadCount?: number;
  onBellPress?: () => void;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {left}
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.heading,
          }}>
          {title}
        </Text>
      </View>
      {right}
      <Pressable
        onPress={onBellPress}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        style={{ padding: 4 }}>
        <Ionicons name="notifications-outline" size={23} color={colors.ink} />
        {typeof unreadCount === 'number' && unreadCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 15,
              height: 15,
              borderRadius: 8,
              backgroundColor: colors.negative,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}>
            <Text
              style={{ color: colors.paper, fontSize: 9, fontFamily: fonts.sansSemibold }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default Header;
