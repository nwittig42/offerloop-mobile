import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import LinkedInSteps from '@/components/onboarding/LinkedInSteps';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * "How do I find my LinkedIn URL?" — the popup behind the link on the intake
 * step (Rylan 2026-08-17: make it EXTREMELY clear).
 *
 * Written for someone who has never thought about what a URL is. Two routes,
 * because half of them are on a phone and half are at a laptop, and the phone
 * route is the one people get stuck on. Every step names the thing they are
 * looking for and where on the screen it sits.
 *
 * The last block is the real escape hatch: the handle alone is enough, because
 * normalizeLinkedin() in the intake screen accepts a bare handle and builds the
 * full URL from it. If that ever stops being true, this copy has to change.
 */

const LINKEDIN_BLUE = '#0A66C2';

function Step({ n, children, color }: { n: number; children: React.ReactNode; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: LINKEDIN_BLUE + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: LINKEDIN_BLUE }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color }}>
        {children}
      </Text>
    </View>
  );
}

export default function LinkedInUrlHelp({ onClose }: { onClose: () => void }) {
  const colors = useColors();

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(17,19,24,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
      }}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Animated.View
        entering={FadeInDown.duration(220)}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '86%',
          backgroundColor: colors.paper,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.hairline,
          overflow: 'hidden',
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 20,
            paddingRight: 12,
            paddingTop: 18,
            paddingBottom: 8,
          }}>
          <Text style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 19, color: colors.ink }}>
            Finding your LinkedIn URL
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={colors.inkSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 22, gap: 20 }}>
          {/* The walkthrough first (Rylan 2026-09-08): watching it beats
              reading it. The written routes stay below for laptop users. */}
          <LinkedInSteps />
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.inkSecondary }}>
            Your LinkedIn URL is your profile&apos;s web address. It looks like this:
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.hairline,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.ink }}>
              linkedin.com/in/jane-smith-8b21a4
            </Text>
          </View>

          {/* ── Phone ─────────────────────────────────────────────────── */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="phone-portrait-outline" size={17} color={LINKEDIN_BLUE} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                On your phone, in the LinkedIn app
              </Text>
            </View>
            <Step n={1} color={colors.inkSecondary}>
              Open the LinkedIn app and tap your <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>profile photo</Text> in the top left corner.
            </Step>
            <Step n={2} color={colors.inkSecondary}>
              Tap <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>View Profile</Text>. You should now see your own profile page.
            </Step>
            <Step n={3} color={colors.inkSecondary}>
              Tap the <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>three dots (•••)</Text> just under your name.
            </Step>
            <Step n={4} color={colors.inkSecondary}>
              Tap <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>Share profile</Text>, then <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>Copy</Text>. (Depending on your version it may say <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>Copy link to profile</Text>.) Your link is now copied.
            </Step>
            <Step n={5} color={colors.inkSecondary}>
              Come back to Offerloop, tap the box, hold your finger down, and tap <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>Paste</Text>.
            </Step>
          </View>

          {/* ── Computer ──────────────────────────────────────────────── */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="globe-outline" size={17} color={LINKEDIN_BLUE} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                In a browser, at linkedin.com
              </Text>
            </View>
            <Step n={1} color={colors.inkSecondary}>
              Open a browser (Safari, Chrome, anything), go to{' '}
              <Text style={{ fontFamily: fonts.mono, fontSize: 12.5, color: colors.ink }}>linkedin.com</Text>, and sign in.
            </Step>
            <Step n={2} color={colors.inkSecondary}>
              Click <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>Me</Text> (your photo, top right of the page), then click <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>View Profile</Text>.
            </Step>
            <Step n={3} color={colors.inkSecondary}>
              Look at the <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>address bar</Text> at the very top of your browser. That whole address IS your LinkedIn URL.
            </Step>
            <Step n={4} color={colors.inkSecondary}>
              Click it once to highlight it, copy it, and paste it here.
            </Step>
          </View>

          {/* ── The shortcut ──────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
              padding: 14,
              gap: 6,
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              Short on time? You only need the last part.
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.inkSecondary }}>
              If your profile is linkedin.com/in/
              <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>jane-smith-8b21a4</Text>, you can
              just type <Text style={{ fontFamily: fonts.sansSemibold, color: colors.ink }}>jane-smith-8b21a4</Text> in
              the box. We will build the rest of the link for you.
            </Text>
          </View>

          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.inkTertiary }}>
            Still stuck? Skip it. You can add your LinkedIn later from Profile, and a resume works just as well.
          </Text>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
