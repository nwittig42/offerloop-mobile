import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * A miniature of the email that will go out, shown inside the auto-send
 * confirm (Rylan 2026-08-31): the warning told users mail would send in
 * their name, but never showed WHAT that mail looks like. This sketches
 * the structure, not a fake email (no invented content, per the no-fake-
 * data rule), and hands them the door to the template that shapes it.
 */
export default function EmailSketch({ onNavigate }: { onNavigate?: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const { profile } = useApp();
  const fromAddress = (profile.gmailAddress || '').trim();
  // A school address makes outreach land as "current student" before a word
  // is read; a casual personal handle can cost the open (Rylan 2026-08-31,
  // straight from a friend's onboarding question).
  const isEdu = fromAddress.toLowerCase().endsWith('.edu');

  const lines: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: 'sparkles-outline', text: 'Opener tied to their actual path' },
    { icon: 'school-outline', text: 'One line about you: school, major, goal' },
    { icon: 'cafe-outline', text: 'The ask: 15 minutes, a specific window' },
    { icon: 'document-attach-outline', text: 'Your signature, resume attached' },
  ];

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 2,
      }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}>
        {fromAddress ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.ink, marginBottom: 2 }}>
            From: {fromAddress}
          </Text>
        ) : null}
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkSecondary }}>
          Subject: written per person, named after their role or move
        </Text>
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        {lines.map((l) => (
          <View key={l.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={l.icon} size={14} color={colors.accent} />
            <Text
              style={{
                flex: 1,
                fontFamily: fonts.sans,
                fontSize: 12.5,
                color: colors.ink,
                lineHeight: 17,
              }}>
              {l.text}
            </Text>
          </View>
        ))}
      </View>
      {fromAddress && !isEdu ? (
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            lineHeight: 16,
            color: colors.inkSecondary,
            paddingHorizontal: 12,
            paddingBottom: 10,
          }}>
          Tip: a school address gets outreach taken most seriously. If your
          school email runs on Gmail, connect it from Profile, then Settings.
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          onNavigate?.();
          router.push('/outreach-template');
        }}
        accessibilityRole="button"
        accessibilityLabel="Edit the template these emails follow"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          backgroundColor: colors.surface,
        }}>
        <Ionicons name="create-outline" size={13} color={colors.accent} />
        <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
          Shaped by your template. Tap to edit it.
        </Text>
        <Ionicons name="chevron-forward" size={13} color={colors.accent} />
      </Pressable>
    </View>
  );
}
