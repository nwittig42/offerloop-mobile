import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { NO_WEB_FOCUS_RING } from '@/theme/webFocus';

/**
 * Search, pick, and see what you picked. Used for both companies and roles in
 * the gap survey.
 *
 * The shape matters (Nick 2026-08-16: "once one is chosen it's visible in a
 * list ... in blue"). Before this, a selection just tinted one chip inside a
 * grid that also filtered as you typed, so a picked firm could scroll out of
 * view and the only way to audit your own answers was to hunt the grid. Now
 * the answers live in their own row directly under the search box: always
 * visible, always countable, each one removable in a tap.
 *
 * Suggestions stay below as discovery. They are a shortcut, not the menu —
 * anything typed can be added whether we have heard of it or not, because a
 * student at a firm we do not list is exactly the student we must not turn
 * away.
 *
 * Unbounded by design. The caller decides any cap; this component never
 * silently drops an answer.
 */
export default function TokenPicker({
  query,
  onQueryChange,
  selected,
  onToggle,
  onAddTyped,
  suggestions,
  placeholder,
  emptyHint,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  selected: string[];
  onToggle: (value: string) => void;
  /** Commit whatever is typed, matched or not. */
  onAddTyped: () => void;
  /** The full pool to search and to show when the box is empty. */
  suggestions: string[];
  placeholder: string;
  /** Shown under the tokens when nothing is picked yet. */
  emptyHint: string;
}) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const q = query.trim().toLowerCase();

  /**
   * Suggestions minus what they already picked (a chip that does nothing when
   * tapped is noise), and capped when not searching.
   *
   * The cap is the point: the full catalogue rendered as a wall of pills that
   * pushed the button three screens down, which is how a two-tap question
   * started feeling like a form. Twelve is a glance. Everything else is one
   * search away, which is what the box above is for.
   */
  const visible = useMemo(() => {
    const pool = suggestions.filter(
      (s) => !selected.includes(s) && (!q || s.toLowerCase().includes(q)),
    );
    return q ? pool.slice(0, 24) : pool.slice(0, 12);
  }, [suggestions, selected, q]);

  const exactish = suggestions.some((s) => s.toLowerCase() === q) || selected.some((s) => s.toLowerCase() === q);

  return (
    <View style={{ gap: 12 }}>
      {/* The search box. Looks like a place to type, because that was the
          whole complaint about the "+ Add your own" link it replaced. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 46,
          paddingHorizontal: 13,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          // Tracks FOCUS, not content. This is now the only focus indicator
          // on the field (the browser's own ring is suppressed below), so it
          // has to light up when the caret lands, not when a character does.
          borderColor: focused ? colors.accent : colors.hairline,
        }}>
        <Ionicons name="search" size={17} color={colors.inkTertiary} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onAddTyped}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            NO_WEB_FOCUS_RING,
            {
            flex: 1,
            fontFamily: fonts.sansMedium,
            fontSize: 14.5,
            color: colors.ink,
            paddingVertical: 0,
            },
          ]}
        />
        {query.trim() ? (
          <Pressable onPress={() => onQueryChange('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={colors.inkTertiary} />
          </Pressable>
        ) : null}
      </View>

      {/* Anything typed that we do not list. Offered rather than hidden: the
          alternative is a student concluding we do not support their firm. */}
      {q && !exactish ? (
        <Pressable
          onPress={onAddTyped}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Ionicons name="add-circle" size={18} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.accent }}>
            Add “{query.trim()}”
          </Text>
        </Pressable>
      ) : null}

      {/* The answers. Blue, removable, and never filtered away by the search
          box above them — this row is the receipt for what you have said. */}
      {selected.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {selected.map((value) => (
            <Pressable
              key={value}
              onPress={() => onToggle(value)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${value}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                height: 36,
                paddingLeft: 13,
                paddingRight: 10,
                borderRadius: 18,
                backgroundColor: colors.accent,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: '#FFFFFF' }}>
                {value}
              </Text>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
          {emptyHint}
        </Text>
      )}

      {/* Discovery. Quieter than the tokens above so the eye reads answers
          first and options second. */}
      {visible.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {visible.map((value) => (
            <Pressable
              key={value}
              onPress={() => onToggle(value)}
              accessibilityRole="button"
              style={{
                height: 38,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 19,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
