import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';

/**
 * A password input with the eye toggle every password box on iOS has
 * (Rylan 2026-09-03). The TextInput keeps whatever style the screen passes,
 * so sign-in and create-account look exactly as before; the eye sits inside
 * the field's right edge.
 *
 * Static styles only: function-form Pressable styles vanish in release
 * bundles (see pressable-function-styles-broken).
 */
export default function PasswordField({
  style,
  ...rest
}: Omit<TextInputProps, 'secureTextEntry'>) {
  const colors = useColors();
  const [shown, setShown] = useState(false);
  return (
    <View style={{ justifyContent: 'center' }}>
      <TextInput
        {...rest}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        style={[style, { paddingRight: 46 }]}
      />
      <Pressable
        onPress={() => setShown((s) => !s)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 12,
          top: 0,
          bottom: 0,
          justifyContent: 'center',
        }}>
        <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.inkSecondary} />
      </Pressable>
    </View>
  );
}
