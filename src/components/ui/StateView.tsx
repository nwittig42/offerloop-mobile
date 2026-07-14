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
  tone?: 'neutral' | 'error';
}) {
  const colors = useColors();
  const iconColor = tone === 'error' ? colors.negative : colors.inkTertiary;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
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
}

export default StateView;
