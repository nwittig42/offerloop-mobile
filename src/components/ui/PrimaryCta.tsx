import { ActivityIndicator, Pressable, Text } from 'react-native';

import { fonts } from '@/theme/tokens';

/**
 * The full-width ink-black call to action that carries the signed-out flow:
 * Welcome's "Get started" and every Continue through intake.
 *
 * Deliberately NOT ui/Button. That component's `lg` size is 44 tall with 15px
 * text, tuned for in-app actions sitting among other controls. These screens
 * have exactly one thing to do, so the button is bigger (52 / 17px) and black
 * rather than brand navy. Sharing it here keeps Welcome and intake identical;
 * they were built separately and drifted on the first pass.
 *
 * Fixed black/white, NOT colors.ink / colors.paper (Rylan 2026-09-11, "washed
 * out in dark mode"): those two tokens are text/surface colors that swap
 * brightness in dark mode (ink turns near-white, paper turns dark navy), so
 * borrowing them for a button fill silently inverted this into a pale pill
 * with dark text instead of the bold black CTA it is everywhere else. This
 * button is a brand mark, not a themed surface — it stays identical in both
 * appearances on purpose.
 */
const CTA_BG = '#111318';
const CTA_FG = '#FFFFFF';

export default function PrimaryCta({
  label,
  onPress,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      // Static object on purpose: function-form Pressable styles are dropped
      // in release bundles (see pressable-function-styles-broken), which left
      // "Get started" as white text on white on the 1.2.0 store build.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 52,
        width: '100%',
        backgroundColor: CTA_BG,
        borderRadius: 8,
        paddingVertical: 16,
        opacity: off ? 0.45 : 1,
      }}>
      {busy ? (
        <ActivityIndicator size="small" color={CTA_FG} />
      ) : (
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: CTA_FG }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
