import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Centered empty / error placeholder. One shape for "nothing here yet" and
 * "couldn't load it" so the feed, inbox, and detail screens read the same when
 * there's no content: an icon, a serif line, a soft explainer, and — for the
 * error case — a single retry. The icon tints red when `tone="error"`.
 */
export function StateView({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionLoading,
  secondaryLabel,
  onSecondary,
  tone = 'neutral',
  card = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Show the primary action in a loading/disabled state. */
  actionLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** 'success' tints the icon green: a finished deck is a win, not an
   *  absence (Rylan 2026-08-18 round 4). */
  tone?: 'neutral' | 'error' | 'success';
  /** Render on a white card. For placements over the feed's navy stage,
   *  where bare ink-on-navy text was unreadable (Rylan 2026-08-18 round 4,
   *  "absolute dead end... really hard to read"). */
  card?: boolean;
}) {
  const colors = useColors();
  const iconColor =
    tone === 'error' ? colors.negative : tone === 'success' ? colors.positive : colors.inkTertiary;
  const inner = (
    <View
      style={{
        flex: card ? undefined : 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 14,
      }}>
      <Ionicons name={icon} size={42} color={iconColor} />
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 24,
          color: colors.heading,
          textAlign: 'center',
        }}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            color: colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 21,
            maxWidth: 320,
          }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLoading ? 'Loading…' : actionLabel}
          variant="outline"
          disabled={actionLoading}
          onPress={onAction}
        />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} variant="ghost" onPress={onSecondary} />
      ) : null}
    </View>
  );
  if (!card) return inner;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View
        style={{
          alignSelf: 'stretch',
          backgroundColor: colors.paper,
          borderRadius: 20,
          paddingVertical: 14,
          shadowColor: '#000000',
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        }}>
        {inner}
      </View>
    </View>
  );
}

export default StateView;
