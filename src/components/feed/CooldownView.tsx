import { Ionicons } from '@expo/vector-icons';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/**
 * Shown over the greyed-out deck when swipes run out: Scout waits next to a
 * big countdown to the next batch, with the web escape hatch (bulk outreach
 * has no pacing on the site). Framed as a breather, not a wall.
 */
function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CooldownView({
  secondsLeft,
  onRecharge,
}: {
  secondsLeft: number;
  onRecharge: () => void;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        gap: 16,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image
          source={require('../../../assets/images/scout-prep.png')}
          style={{ width: 96, height: 78 }}
          resizeMode="contain"
        />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 46, color: colors.heading, lineHeight: 50 }}>
            {fmt(secondsLeft)}
          </Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
            until your next swipes
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 13.5,
          color: colors.inkSecondary,
          textAlign: 'center',
          lineHeight: 20,
        }}>
        Scout is lining up your next batch. We space your outreach out so it lands in
        inboxes, not spam.
      </Text>

      <Pressable
        onPress={() => Linking.openURL('https://offerloop.ai')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.ink,
          borderRadius: 10,
          paddingHorizontal: 18,
          paddingVertical: 11,
        }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.paper }}>
          Keep going on offerloop.ai
        </Text>
        <Ionicons name="open-outline" size={15} color={colors.paper} />
      </Pressable>

      <Pressable onPress={onRecharge} style={{ padding: 6 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
          Recharge now (demo)
        </Text>
      </Pressable>
    </View>
  );
}

export default CooldownView;
