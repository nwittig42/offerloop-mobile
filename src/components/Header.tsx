import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/theme/tokens';
import { useColors } from '@/theme/ThemeProvider';

/**
 * Shared screen header. The title (Instrument Serif) or the full Offerloop
 * wordmark sits centered. The clean icon mark sits top-left on the inner
 * tabs (Inbox, Loops, Network, Profile); the Feed uses the full wordmark
 * centered with credits on the left. Scout (the Yeti) and the notification
 * bell sit on the right of every page. Badge renders only on a real count.
 */
export function Header({
  title,
  logo = false,
  mark = false,
  unreadCount,
  onBellPress,
  left,
  right,
}: {
  title: string;
  logo?: boolean;
  mark?: boolean;
  unreadCount?: number;
  onBellPress?: () => void;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: insets.top + 50,
      }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 6,
          bottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {logo ? (
          <Image
            source={require('../../assets/images/offerloop-logo.png')}
            style={{ width: 118, height: 29 }}
            resizeMode="contain"
            accessibilityLabel={title}
          />
        ) : (
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 26,
              color: colors.heading,
            }}>
            {title}
          </Text>
        )}
      </View>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {mark ? (
          <Image
            source={require('../../assets/images/offerloop-mark.png')}
            style={{ width: 30, height: 30 }}
            resizeMode="contain"
            accessibilityLabel="Offerloop"
          />
        ) : null}
        {left}
      </View>

      {right}

      <Pressable
        onPress={() => router.push('/scout')}
        accessibilityRole="button"
        accessibilityLabel="Ask Scout"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.paper2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <Image
          source={require('../../assets/images/scout-yeti-head.png')}
          style={{ width: 27, height: 27, marginTop: 3 }}
          resizeMode="contain"
          accessibilityLabel="Scout"
        />
      </Pressable>

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
            <Text style={{ color: colors.paper, fontSize: 9, fontFamily: fonts.sansSemibold }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default Header;
