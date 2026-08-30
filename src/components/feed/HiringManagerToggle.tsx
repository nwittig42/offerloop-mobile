import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

export type HiringManagerMode = 'off' | 'draft' | 'send';

/**
 * The one control that changes what a right swipe MEANS, in ONE row.
 *
 * History, because this has been rebuilt four times:
 *  - A narrow two-line "Email / HM" pill: cramped and abbreviated.
 *  - A label + ON/OFF badge + an (i) button: the label clamped.
 *  - A three-state Off/Draft/Send pill with no label: read as a mystery box.
 *  - A switch row plus a SEPARATE Draft-it/Send-it row underneath: two rows
 *    overflowed the glass bar's fixed height and the action circles drew on
 *    top of the second one, which read as a rendering glitch (Rylan
 *    2026-08-30, twice).
 *
 * So: back to three states, but with the label that made the pill legible.
 * "Hiring manager email" on the left names the thing; Off / Draft / Send on
 * the right say what a swipe does about it. One row, so it can never overflow
 * the bar again, and every option is visible without tapping anything.
 *
 * The caller confirms the expensive moves: turning on (extra credits) and
 * Send (auto-sending in the user's name) both go through dialogs before the
 * control's state actually changes. Off and Draft are instant.
 */
export default function HiringManagerToggle({
  mode,
  onSelect,
}: {
  mode: HiringManagerMode;
  onSelect: (next: HiringManagerMode) => void;
}) {
  const colors = useColors();

  const options: { key: HiringManagerMode; label: string }[] = [
    { key: 'off', label: 'Off' },
    { key: 'draft', label: 'Draft' },
    { key: 'send', label: 'Send' },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name="mail-outline" size={15} color={colors.inkSecondary} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: fonts.sansMedium,
          fontSize: 13,
          color: colors.ink,
        }}>
        Hiring manager email
      </Text>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 2,
          gap: 2,
        }}>
        {options.map((o) => {
          const active = mode === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                o.key === 'off'
                  ? 'Do not email the hiring manager'
                  : o.key === 'draft'
                    ? 'Draft an email to the hiring manager on every apply'
                    : 'Send the email automatically on every apply'
              }
              style={{
                paddingHorizontal: 11,
                paddingVertical: 5,
                borderRadius: 6,
                backgroundColor: active ? colors.ink : 'transparent',
              }}>
              <Text
                style={{
                  fontFamily: active ? fonts.sansSemibold : fonts.sansMedium,
                  fontSize: 12.5,
                  color: active ? colors.paper : colors.inkSecondary,
                }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
