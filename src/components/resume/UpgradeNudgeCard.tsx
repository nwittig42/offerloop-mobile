import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { AUTO_APPLY_CREDITS } from '@/api/endpoints/scoutActions';
import { Card } from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The earned-upgrade nudge for auto-apply: a small dismissible card the Feed
 * can slot between jobs once the user qualifies. Sells the feature, never a
 * purchase (App Store 3.1.1): the only number is the real per-apply credit
 * cost, imported from the same constant the Feed already renders.
 *
 * Standalone: Session A decides when it appears and wires both callbacks.
 */

export function UpgradeNudgeCard({
  onTry,
  onDismiss,
}: {
  onTry: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.accent + '14',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="paper-plane-outline" size={17} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
            Scout can also apply for you
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12.5,
              color: colors.inkSecondary,
              lineHeight: 18,
            }}>
            Turn a right swipe into a real application, resume attached.{' '}
            {AUTO_APPLY_CREDITS} credits per apply, always drafted for your approval first.
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          style={{ opacity: 1, padding: 2 }}>
          <Ionicons name="close" size={16} color={colors.inkTertiary} />
        </Pressable>
      </View>
      <Pressable
        onPress={onTry}
        accessibilityRole="button"
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.accent,
          paddingHorizontal: 12,
          paddingVertical: 7,
          opacity: 1,
        }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent }}>
          Set it up
        </Text>
        <Ionicons name="arrow-forward" size={13} color={colors.accent} />
      </Pressable>
    </Card>
  );
}

export default UpgradeNudgeCard;
