import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteAccount } from '@/api/endpoints/preferences';
import { useAuth } from '@/auth/AuthProvider';
import ReferralCard from '@/components/ReferralCard';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { useAIConsent } from '@/lib/aiConsent';
import { OTA_NOTES, otaStamp, SHOW_BUILD_STAMP } from '@/lib/buildInfo';
import { track } from '@/lib/analytics';
import { APP_STORE_REVIEW_URL, APP_STORE_REVIEW_URL_WEB } from '@/lib/links';
import { replayTour } from '@/lib/tourFlag';
import { useApp } from '@/store/app';
import { useColors, useTheme, type ThemePref } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Settings, on its own screen.
 *
 * Was the third tab of the Profile page, which put preferences, connections,
 * legal links and account deletion at the same level as the student's own
 * name. It is a different mode of use: you come here to change one thing and
 * leave. Pushed, with its own back affordance.
 */

/** Accounts that can re-enter onboarding without a reinstall (App Review). */
const REVIEWER_REPLAY_EMAILS = ['applereview@offerloop.ai'];

const APPEARANCE: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

function SettingsSection({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: fonts.sansSemibold,
        fontSize: 11,
        letterSpacing: 0.9,
        color: colors.accent,
        marginTop: 14,
        marginBottom: -2,
      }}>
      {label.toUpperCase()}
    </Text>
  );
}

function AppearanceSelector() {
  const colors = useColors();
  const { pref, setPref, accentTheme, setAccentTheme, school } = useTheme();

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="contrast-outline" size={18} color={colors.inkSecondary} />
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
          Appearance
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
        Choose how Offerloop looks on this device.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          backgroundColor: colors.paper2,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: 4,
        }}>
        {APPEARANCE.map((opt) => {
          const selected = opt.key === pref;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setPref(opt.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 9,
                borderRadius: 7,
                backgroundColor: selected ? colors.navy : 'transparent',
              }}>
              <Ionicons
                name={opt.icon}
                size={15}
                color={selected ? colors.paper : colors.inkSecondary}
              />
              <Text
                style={{
                  fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                  fontSize: 13,
                  color: selected ? colors.paper : colors.inkSecondary,
                }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Only offered when the profile matched a real school: with no match
          the old fallback tinted everyone in USC colors, which is fake data
          wearing a reward costume. */}
      {school ? (
        <>
          <View style={{ height: 1, backgroundColor: colors.hairlineLight, marginVertical: 2 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="color-palette-outline" size={18} color={colors.inkSecondary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    {school.name} colors
                  </Text>
                  <Chip label="Milestone reward" tone="accent" />
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  Tint the app in your school&apos;s colors. Earned in Milestones.
                </Text>
              </View>
            </View>
            <Switch
              value={accentTheme === 'school'}
              onValueChange={(on) => setAccentTheme(on ? 'school' : 'default')}
              trackColor={{ true: colors.accent, false: colors.hairline }}
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, notificationsEnabled, setNotificationsEnabled, resetOnboarding, showToast } =
    useApp();
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();
  const { consent: aiConsent } = useAIConsent();
  const { signOut, user } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Centered title, lone back chevron: the app's sub-page header pattern
          (established on What's in auto apply; Rylan 2026-08-18, "make it a
          recurring thing across the app"). */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          hitSlop={10}
          style={{ width: 40, alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fonts.display,
            fontSize: 26,
            color: colors.heading,
          }}>
          Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}>
        <SettingsSection label="Your outreach" />

        <Pressable onPress={() => router.push('/attachments')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="attach-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                Attached to every email
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                What travels with your outreach
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>

        {/* "People where you applied" moved to the People feed screen
            (Nick 2026-08-17): it builds a feed, so it belongs next to the box
            you would otherwise type that feed into, not in Settings. */}

        <Pressable onPress={() => router.push('/outreach-template')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Filled mail identity (Rylan 2026-08-18 round 3: "email
                template is a big thing people could take advantage of" and
                needed color, not a gray glyph). */}
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.marketing,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.marketing,
                shadowOpacity: 0.3,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}>
              <Ionicons name="mail" size={19} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                Email template
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                What every draft asks for, and how it signs off
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="mail-outline" size={18} color={colors.inkSecondary} />
              <View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                  Gmail
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  {profile.gmailConnected ? profile.gmailAddress : 'Not connected'}
                </Text>
              </View>
            </View>
            {/* Real in-app OAuth: the product runs on the user's Gmail
                (sends, drafts, reply tracking), so connecting must never
                require a detour to the website. */}
            <Pressable
              onPress={() => {
                if (!profile.gmailConnected && !gmailConnecting) void connectGmail();
              }}
              disabled={profile.gmailConnected || gmailConnecting}>
              <Chip
                label={
                  profile.gmailConnected
                    ? 'Connected'
                    : gmailConnecting
                      ? 'Connecting...'
                      : 'Connect'
                }
                tone={profile.gmailConnected ? 'positive' : 'accent'}
                dot={profile.gmailConnected}
              />
            </Pressable>
          </View>
        </Card>

        <SettingsSection label="App" />

        <AppearanceSelector />

        {/* Replay the first-run tour. Cheap, and the only way to see it
            again without burning a fresh account. */}
        <Card>
          <Pressable
            onPress={async () => {
              await replayTour();
              showToast('Tour ready. Tap send on the Scout tab.');
              router.push('/(tabs)');
            }}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 }}>
            <Ionicons name="map-outline" size={18} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
              Replay the app tour
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Pressable>
        </Card>

        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="notifications-outline" size={18} color={colors.inkSecondary} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                Push notifications
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: colors.accent, false: colors.hairline }}
            />
          </View>
        </Card>

        <SettingsSection label="Privacy and legal" />

        {/* Legal + account controls. Privacy/Terms links and in-app account
            deletion are App Store requirements (deletion is Apple 5.1.1(v),
            a hard rejection without it). */}
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {/* AI data-sharing choice, reviewable and reversible any time
              (guidelines 5.1.1(i)/5.1.2(i)). */}
          <Pressable
            onPress={() => router.push({ pathname: '/ai-consent', params: { mode: 'settings' } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
              AI and your data
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              {aiConsent === 'granted' ? 'Allowed' : 'Off'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.inkTertiary} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
          <Pressable
            onPress={() => Linking.openURL('https://offerloop.ai/privacy')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
              Privacy Policy
            </Text>
            <Ionicons name="open-outline" size={15} color={colors.inkTertiary} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
          <Pressable
            onPress={() => Linking.openURL('https://offerloop.ai/terms-of-service')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
            <Ionicons name="document-text-outline" size={18} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
              Terms of Service
            </Text>
            <Ionicons name="open-outline" size={15} color={colors.inkTertiary} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
          <Pressable
            disabled={deletingAccount}
            onPress={() =>
              Alert.alert(
                'Delete account',
                'This permanently deletes your account and all your data — contacts, drafts, applications, and settings. This can’t be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      setDeletingAccount(true);
                      try {
                        await deleteAccount();
                        await signOut();
                      } catch {
                        setDeletingAccount(false);
                        Alert.alert('Couldn’t delete', 'Something went wrong — try again, or email us at team@offerloop.ai.');
                      }
                    },
                  },
                ],
              )
            }
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
            <Ionicons name="trash-outline" size={18} color={colors.negative} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.negative }}>
              {deletingAccount ? 'Deleting…' : 'Delete account'}
            </Text>
          </Pressable>
        </Card>

        <SettingsSection label="More" />

        {/* Invite friends lives under the identity band on the Profile tab
            now (Rylan 2026-08-30): buried at the bottom of More, the one
            growth loop we have was invisible. */}
        <Pressable onPress={() => router.push('/feedback')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                Send feedback
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Tell us what is broken or missing
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>

        {/* The always-available way to rate us, below Send feedback on
            purpose: someone who is annoyed should find the private channel
            first. Unlike the native popup (lib/appRating) this has no yearly
            cap and no cooldown, and it still works for anyone who switched
            in-app ratings off in iOS Settings. */}
        <Pressable
          onPress={async () => {
            track('rating_settings_row_tapped');
            try {
              await Linking.openURL(APP_STORE_REVIEW_URL);
            } catch {
              // itms-apps unavailable (simulator, web preview). https lands in
              // the same place on a real device.
              Linking.openURL(APP_STORE_REVIEW_URL_WEB).catch(() => {});
            }
          }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="star-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                Rate Offerloop
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Leave a review on the App Store
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>
        {/* Swipe settings is gone (Nick 2026-08-16): draft-or-send moved
            onto the feed bars, applying is simply what a right swipe
            does, and the rest of that screen configured a find step the
            decks no longer expose. This row now points at the one thing
            from it that had nowhere else to live. */}

        <SettingsSection label="Account" />

        <Card>
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => setConfirmSignOut(true)}
          />
        </Card>
        {__DEV__ ? (
          <Button label="Design gallery" variant="outline" onPress={() => router.push('/design')} />
        ) : null}
        {/* P0 prototype for the voice tab (PLAN-scout-voice.md) — here so
            the orb can be felt on-device before the design locks. Dev
            builds only: both screens carry placeholder fixture content
            (Apple 2.2 risk in a store build; sweep blocker #2). */}
        {__DEV__ ? (
          <Button
            label="Scout orb preview"
            variant="outline"
            onPress={() => router.push('/dev/scout-orb' as never)}
          />
        ) : null}
        {__DEV__ ||
        REVIEWER_REPLAY_EMAILS.includes((user?.email || '').toLowerCase()) ? (
          <Button
            label="Replay onboarding"
            variant="outline"
            onPress={() => {
              // Onboarding is opt-in now (not force-gated), so enter it
              // explicitly. resetOnboarding clears the completion flag so
              // a future new-user gate would show it again. Exposed for
              // reviewer/founder accounts to re-test without a reinstall.
              resetOnboarding();
              router.push('/(onboarding)');
            }}
          />
        ) : null}
        {/* Which OTA is this phone actually running? Bumped on every
            publish (src/lib/buildInfo.ts) so testers can tell at a
            glance whether the change they are checking has landed.
            Hidden on store builds; it is a staging QA affordance. */}
        {SHOW_BUILD_STAMP && (
          <View style={{ gap: 2, paddingTop: 6 }}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 11.5,
                color: colors.inkTertiary,
                textAlign: 'center',
              }}>
              {otaStamp()}
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 11,
                color: colors.inkTertiary,
                textAlign: 'center',
              }}>
              {OTA_NOTES}
            </Text>
          </View>
        )}
        {/* Data heritage line: the FullEnrich reseller agreement requires
            visible attribution for email data, placement agreed over email
            2026-09-01 (quiet footer on the legal surface). Keep the exact
            wording; it is the contractual sentence. */}
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            color: colors.inkTertiary,
            textAlign: 'center',
            paddingTop: 10,
            paddingBottom: 4,
          }}>
          Email data provided by FullEnrich
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        body="You can sign back in any time. Nothing is deleted."
        confirmLabel="Sign out"
        onClose={() => setConfirmSignOut(false)}
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
      />
    </View>
  );
}
