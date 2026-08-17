import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import GmailLogo from '@/components/auth/GmailLogo';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * An illustration of what lands in the user's Gmail drafts: a written intro,
 * their resume attached, ready to send.
 *
 * Rendered rather than a screenshot. A real screenshot of a real inbox meant
 * shipping a real person's email address and several real contacts' names to
 * everyone who installs the app, and it would have been fixed-resolution and
 * blurry when scaled. This is sharp at any size, follows dark mode, and the
 * words can be edited without a graphics tool.
 *
 * Deliberately identifies NOBODY: no email address, no company, no invented
 * funding rounds or statistics. The credibility comes from the SHAPE of the
 * email (a specific shared detail, one real question, a short ask) rather than
 * from fabricated specifics, which is also what the repo's no-fake-data rule
 * asks for.
 */
export default function DraftPreviewCard() {
  const colors = useColors();

  return (
    <View
      style={{
        borderRadius: 14,
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.hairline,
        overflow: 'hidden',
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 3,
      }}>
      {/* Gmail chrome, enough to place it without imitating the whole app. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 9,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}>
        <GmailLogo size={15} />
        <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.ink }}>
          Drafts
        </Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>
          Ready to send
        </Text>
      </View>

      <View style={{ padding: 14, gap: 8 }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
          Coffee chat about your path into product
        </Text>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            lineHeight: 19,
            color: colors.inkSecondary,
          }}>
          Hi Maya,{'\n\n'}I&apos;m a Marshall junior studying finance. I saw you moved from
          consulting into product, which is the exact jump I have been trying to understand.
          {'\n\n'}What surprised you most in the first six months?
        </Text>

        {/* The attachment is the point: the resume travels with every intro. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            alignSelf: 'flex-start',
            paddingVertical: 5,
            paddingHorizontal: 9,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.surface,
          }}>
          <Ionicons name="document-text-outline" size={13} color={colors.negative} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.ink }}>
            your_resume.pdf
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: '#0B57D0',
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: '#FFFFFF' }}>
              Send
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
            You send it, not us
          </Text>
        </View>
      </View>
    </View>
  );
}
