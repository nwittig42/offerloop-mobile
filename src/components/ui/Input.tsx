import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

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
          {
            height: multiline ? undefined : 36,
            minHeight: multiline ? 96 : undefined,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: focused ? colors.ink : colors.hairline,
            backgroundColor: colors.paper,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 10 : 0,
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
