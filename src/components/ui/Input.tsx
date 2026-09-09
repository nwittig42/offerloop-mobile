import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { NO_WEB_FOCUS_RING } from '@/theme/webFocus';

/**
 * Web Input recipe: height 36, radius 6, hairline border, white fill,
 * 12px horizontal pad, 14px text, placeholder in tertiary ink.
 * On focus: border goes ink and a 3px ink-at-6-percent ring appears.
 */
export function Input({
  multiline = false,
  style,
  ...rest
}: TextInputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        borderRadius: 9,
        borderWidth: 3,
        borderColor: focused ? colors.ink + '0F' : 'transparent',
      }}>
      <TextInput
        placeholderTextColor={colors.inkTertiary}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          NO_WEB_FOCUS_RING,
          {
            height: multiline ? undefined : 36,
            minHeight: multiline ? 96 : undefined,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: focused ? colors.ink : colors.hairline,
            backgroundColor: colors.paper,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 10 : 0,
            // iOS draws a multiline caret off the placeholder's line until
            // the first character lands unless the line height is explicit
            // (Rylan 2026-09-08, the search pop-up).
            lineHeight: multiline ? 20 : undefined,
            fontSize: 14,
            fontFamily: fonts.sans,
            color: colors.ink,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export default Input;
