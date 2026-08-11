import { Text, View } from 'react-native';

import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The payoff moment after a right swipe: the person appears (Rylan
 * 2026-08-11). This is the single beat that teaches what the app is, you
 * swiped, a human came back. Person first, always; the application is a
 * parenthetical when it happened at all.
 *
 * Deliberately airy: avatar, name in serif, one status line, one button.
 * Session A wires it to the contact result (full-card takeover for the
 * user's first few swipes, quieter after that) and only renders it with a
 * real found contact, never a placeholder person.
 */
export function PersonReveal({
  name,
  role,
  company,
  applied = false,
  onViewIntro,
  viewLabel = 'Read your intro',
}: {
  name: string;
  role?: string;
  company: string;
  /** True when auto-apply also submitted an application for this job. */
  applied?: boolean;
  onViewIntro: () => void;
  viewLabel?: string;
}) {
  const colors = useColors();

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Avatar name={name} size={64} />

      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 27,
            color: colors.heading,
            textAlign: 'center',
          }}>
          Meet {name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 13.5,
            color: colors.inkSecondary,
            textAlign: 'center',
          }}>
          {role ? `${role} at ${company}` : company}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: colors.inkSecondary,
          textAlign: 'center',
          lineHeight: 19,
          maxWidth: 260,
        }}>
        Your intro is drafted and waiting for your review.
        {applied ? ' (Application submitted too.)' : ''}
      </Text>

      <Button label={viewLabel} variant="brand" onPress={onViewIntro} />
    </View>
  );
}

export default PersonReveal;
