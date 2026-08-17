import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
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
 */
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
  const colors = useColors();
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 52,
        width: '100%',
        backgroundColor: pressed ? colors.navyDeep : colors.ink,
        borderRadius: 8,
        paddingVertical: 16,
        opacity: off ? 0.45 : 1,
      })}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.paper} />
      ) : (
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.paper }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
