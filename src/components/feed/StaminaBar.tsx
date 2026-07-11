import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The swipe stamina indicator. The metered unit is the swipe (gesture): one
 * swipe spends one token no matter how many people it reaches. The
 * multi-contact cost is paid in credits, not stamina, so the daily allowance
 * stays generous. A row of bolts for the batch (filled = available, hollow =
 * spent). When empty it becomes a "recharging" countdown with the web escape
 * hatch. Framed as recharging, not "out of credits."
 */
function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StaminaBar({
  available,
  batchSize,
  secondsLeft,
  onRecharge,
}: {
  available: number;
  batchSize: number;
  secondsLeft: number;
  onRecharge: () => void;
}) {
  const colors = useColors();
  const recharging = available === 0;

  if (recharging) {
    return (
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.paper2,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}>
          <Ionicons name="time-outline" size={14} color={colors.waiting} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink }}>
            Recharging · {fmt(secondsLeft)}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
            (demo timer)
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable onPress={onRecharge}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
              Recharge now (demo)
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 4, paddingBottom: 2 }}>
      {Array.from({ length: batchSize }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < available ? 'flash' : 'flash-outline'}
          size={16}
          color={i < available ? colors.bolt : colors.hairline}
        />
      ))}
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary, marginLeft: 4 }}>
        {available} swipe{available === 1 ? '' : 's'} ready
      </Text>
    </View>
  );
}

export default StaminaBar;
