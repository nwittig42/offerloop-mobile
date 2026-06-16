import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Compact iMessage-style search field: a rounded pill on the surface tint with
 * a leading magnifier and a clear button once there's text. Used to tame the
 * long Inbox and Contacts lists.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 36,
      }}>
      <Ionicons name="search" size={15} color={colors.inkTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={{
          flex: 1,
          fontFamily: fonts.sans,
          fontSize: 14.5,
          color: colors.ink,
          paddingVertical: 0,
        }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={16} color={colors.inkTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default SearchBar;
