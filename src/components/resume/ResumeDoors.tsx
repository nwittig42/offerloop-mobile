import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The three doors into having a resume, shown when auto-apply needs one
 * (or the user asks for it). Consent-screen visual language: Scout up top,
 * serif title, icon rows. The door matching the user's situation is
 * emphasized; "Not now" stays quiet and always available.
 *
 * Standalone by design: Session A wires the callbacks and decides where this
 * renders (sheet, screen, wherever). No data fetching, no navigation.
 */

type Door = {
  key: 'upload' | 'linkedin' | 'describe';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const DOORS: Door[] = [
  {
    key: 'upload',
    icon: 'cloud-upload-outline',
    title: 'Upload my resume',
    body: 'Have the file handy? PDFs work best. It travels with every application.',
  },
  {
    key: 'linkedin',
    icon: 'logo-linkedin',
    title: 'Build from my LinkedIn',
    body: 'Scout turns your LinkedIn into a clean resume. You review it before anything uses it.',
  },
  {
    key: 'describe',
    icon: 'create-outline',
    title: 'Just describe what you have done',
    body: 'No file, thin LinkedIn? Tell Scout in your own words and he drafts one from that.',
  },
];

export function ResumeDoors({
  hasResume,
  hasLinkedin,
  onUpload,
  onBuildFromLinkedin,
  onDescribe,
  onNotNow,
}: {
  hasResume: boolean;
  hasLinkedin: boolean;
  onUpload: () => void;
  onBuildFromLinkedin: () => void;
  onDescribe: () => void;
  onNotNow: () => void;
}) {
  const colors = useColors();

  // Emphasize the door that matches where the user already is: a file on hand
  // beats generating one; LinkedIn next; with neither, the describe door is
  // the one that always works.
  const emphasized: Door['key'] = hasResume ? 'upload' : hasLinkedin ? 'linkedin' : 'describe';

  const pressFor = (key: Door['key']) =>
    key === 'upload' ? onUpload : key === 'linkedin' ? onBuildFromLinkedin : onDescribe;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Image
          source={require('../../../assets/images/scout-yeti-head.png')}
          style={{ width: 56, height: 56 }}
          resizeMode="contain"
          accessibilityLabel="Scout"
        />
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 26,
            color: colors.heading,
            textAlign: 'center',
            lineHeight: 31,
          }}>
          Applying needs a resume
        </Text>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 13.5,
            color: colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 300,
          }}>
          Real applications carry your resume. Pick whichever way is easiest, Scout handles
          the rest.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {DOORS.map((door) => {
          const strong = emphasized === door.key;
          return (
            <Pressable
              key={door.key}
              onPress={pressFor(door.key)}
              accessibilityRole="button"
              accessibilityLabel={door.title}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: strong ? colors.accent : colors.hairline,
                backgroundColor: strong ? colors.accent + '0A' : colors.paper,
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.85 : 1,
              })}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={door.icon} size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                  {door.title}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12.5,
                    color: colors.inkSecondary,
                    lineHeight: 18,
                  }}>
                  {door.body}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 16,
          }}>
          Anything Scout builds is shown to you first. Nothing is used until you approve it.
        </Text>
        <Pressable
          onPress={onNotNow}
          accessibilityRole="button"
          style={({ pressed }) => ({
            alignItems: 'center',
            paddingVertical: 10,
            opacity: pressed ? 0.6 : 1,
          })}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default ResumeDoors;
