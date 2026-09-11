import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The compact "N suggested edits" card Scout drops under its answer when it
 * has concrete resume edits ready (Rylan 2026-09-10: a glance in the chat,
 * tap opens the full before/after screen to actually approve them). Sized
 * and styled apart from the small pill chips beside it — this is the thing
 * worth a second look, not a quick reply.
 */
export function ScoutEditsChip({ count, onPress }: { count: number; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review ${count} suggested resume edit${count === 1 ? '' : 's'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 12,
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: colors.marketing + '14',
        borderWidth: 1,
        borderColor: colors.marketing + '3D',
      }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.marketing,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
        {count} suggested resume edit{count === 1 ? '' : 's'}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.marketing} />
    </Pressable>
  );
}

export default ScoutEditsChip;
