import { useState, type RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

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
  inputRef,
}: {
  value: string;
  onChangeText: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
  /** Lets a parent focus the field programmatically (profile "jump to this step"). */
  inputRef?: RefObject<TextInput | null>;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const selected = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // The fragment the user is mid-typing = text after the last comma (empty once
  // they've typed a separator). Filter suggestions by it so typing "ven" surfaces
  // "Venture Capital" — a real autocomplete, not a static list.
  const endsWithSep = /,\s*$/.test(value);
  const frag = endsWithSep ? '' : (value.split(',').pop() || '').trim().toLowerCase();
  const available = suggestions
    .filter((s) => !selected.some((sel) => sel.toLowerCase() === s.toLowerCase()))
    .filter((s) => !frag || s.toLowerCase().includes(frag))
    .slice(0, 6);

  const add = (s: string) => {
    const parts = value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    // If the pick completes the partial the user was typing ("Ven" → "Venture
    // Capital"), replace that partial instead of appending after it. A finished
    // value the user tapped past (last isn't a prefix of the pick) is kept.
    if (!endsWithSep && last && s.toLowerCase().startsWith(last.toLowerCase()) && last.toLowerCase() !== s.toLowerCase()) {
      parts.pop();
    }
    parts.push(s);
    onChangeText(parts.join(', '));
  };

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        ref={inputRef}
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
              // onPressIn, not onPress: tapping a chip blurs the TextInput, which
              // flips `focused` false and unmounts these chips — with onPress the
              // add() never fired (the classic "suggestion won't add" bug). Firing
              // on touch-down lands the add before the blur tears the chip down.
              onPressIn={() => add(s)}
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
