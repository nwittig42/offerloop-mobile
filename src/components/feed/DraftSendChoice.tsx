import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Do we write it, or do we write it AND send it?
 *
 * Shared by both decks (2026-08-16): it rides under the hiring-manager switch
 * on Jobs, and sits in the action bar on People, where a right swipe writes to
 * the person you just swiped on.
 *
 * A segmented control rather than a switch, because these are two ways of doing
 * one thing, not an extra thing to switch on. Both options stay visible, so the
 * consequence of the one you are NOT on is legible without touching anything.
 *
 * Moving to Send is confirmed by the caller before it takes effect. Moving back
 * to Draft is instant. Both decks read and write the same global rule, so the
 * two bars can never disagree.
 */
export function DraftSendChoice({
  value,
  onChange,
}: {
  value: 'draft' | 'send';
  onChange: (next: 'draft' | 'send') => void;
}) {
  const colors = useColors();

  const options: {
    key: 'draft' | 'send';
    label: string;
    icon: 'create-outline' | 'paper-plane-outline';
  }[] = [
    { key: 'draft', label: 'Draft it', icon: 'create-outline' },
    { key: 'send', label: 'Send it', icon: 'paper-plane-outline' },
  ];

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 3,
        gap: 3,
      }}>
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={
              o.key === 'draft'
                ? 'Draft the email for me to review'
                : 'Send the email automatically, without review'
            }
            style={{
              flex: 1,
              height: 34,
              borderRadius: 9,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: selected ? colors.paper : 'transparent',
              // Only the selected half lifts, which is what makes this read as a
              // switchable pair rather than two buttons.
              shadowColor: '#000',
              shadowOpacity: selected ? 0.1 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: selected ? 2 : 0,
            }}>
            <Ionicons
              name={o.icon}
              size={15}
              color={selected ? colors.accent : colors.inkTertiary}
            />
            <Text
              maxFontSizeMultiplier={1.1}
              style={{
                fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                fontSize: 13,
                color: selected ? colors.ink : colors.inkTertiary,
              }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default DraftSendChoice;
