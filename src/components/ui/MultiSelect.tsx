import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import Input from '@/components/ui/Input';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * A tag multi-select: selected values show as removable chips, and a list of
 * suggestions reveals only when the input is focused (hidden until then, so
 * the form stays calm). Typing filters the suggestions; submitting adds a
 * custom value. Used for target roles and industries in Personal.
 */
export function MultiSelect({
  values,
  onChange,
  suggestions,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions
      .filter((s) => !values.includes(s) && (q === '' || s.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [query, suggestions, values]);

  const add = (value: string) => {
    const v = value.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setQuery('');
  };

  return (
    <View style={{ gap: 8 }}>
      {values.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {values.map((value) => (
            <Pressable key={value} onPress={() => onChange(values.filter((v) => v !== value))}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: colors.accent + '14',
                  borderWidth: 1,
                  borderColor: colors.accent + '26',
                }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                  {value}
                </Text>
                <Ionicons name="close" size={12} color={colors.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => add(query)}
        returnKeyType="done"
      />

      {focused && filtered.length ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 10,
            backgroundColor: colors.paper,
            overflow: 'hidden',
          }}>
          {filtered.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => add(s)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.hairlineLight,
              }}>
              <Ionicons name="add" size={14} color={colors.inkSecondary} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default MultiSelect;
