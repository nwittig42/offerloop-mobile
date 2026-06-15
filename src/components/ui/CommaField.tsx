import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/**
 * A soft, borderless comma field: the selected values live inside the text
 * box as a comma-separated string the user can edit freely. Suggestions
 * appear under it when focused and append on tap. Less boxy than a chip
 * pile, easier to read at a glance.
 */
export function CommaField({
  value,
  onChangeText,
  suggestions,
  placeholder,
}: {
  value: string;
  onChangeText: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);

  const selected = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const available = suggestions.filter((s) => !selected.includes(s)).slice(0, 6);

  const add = (s: string) => {
    const base = value.replace(/,\s*$/, '').trim();
    onChangeText(base ? `${base}, ${s}` : s);
  };

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkTertiary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline
        style={{
          fontFamily: fonts.sans,
          fontSize: 15,
          color: colors.ink,
          paddingVertical: 2,
          lineHeight: 21,
        }}
      />
      {focused && available.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {available.map((s) => (
            <Pressable
              key={s}
              onPress={() => add(s)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: colors.accent + '12',
              }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default CommaField;
