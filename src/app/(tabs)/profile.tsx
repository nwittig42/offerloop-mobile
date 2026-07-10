import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import CircleProgress from '@/components/ui/CircleProgress';
import CommaField from '@/components/ui/CommaField';
import {
  INDUSTRY_SUGGESTIONS,
  TARGET_ROLE_SUGGESTIONS,
} from '@/mocks/data';
import { useApp } from '@/store/app';
import { useColors, useTheme, type ThemePref } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** A soft, borderless personalization row with a hairline under it. */
function SoftRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairlineLight,
      }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary, marginBottom: 3 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * Profile completeness nudge (Sorce-style): a ring gauge + a CTA into the
 * Personal tab. Counts the fields that steer Scout's writing; once they're all
 * filled the card disappears entirely.
 */
function ProfileCompletion({
  profile,
  onFinish,
}: {
  profile: ReturnType<typeof useApp>['profile'];
  onFinish: () => void;
}) {
  const colors = useColors();

  const checks = [
    !!profile.linkedinUrl?.trim(),
    profile.targetRoles.length > 0,
    profile.industries.length > 0,
    !!profile.gradYear?.trim(),
    !!profile.about?.trim(),
    !!profile.resume?.name,
    profile.gmailConnected,
  ];
  const done = checks.filter(Boolean).length;
  const ratio = done / checks.length;
  const pct = Math.round(ratio * 100);

  if (pct >= 100) return null;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <CircleProgress size={54} progress={ratio} color={colors.positive} label={`${pct}%`} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            Complete your profile
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 18 }}>
            The more Scout knows, the better every draft sounds.
          </Text>
        </View>
      </View>
      <Button label="Finish profile" variant="brand" fullWidth onPress={onFinish} />
    </Card>
  );
}

const APPEARANCE: { key: ThemePref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/**
 * Appearance picker: a two-way segmented control (Light / Dark). The choice is
 * sticky; it drives the whole app through ThemeProvider.
 */
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
              Tint the app in your school's colors. Earned in Milestones.
            </Text>
          </View>
        </View>
        <Switch
          value={accentTheme === 'school'}
          onValueChange={(on) => setAccentTheme(on ? 'school' : 'default')}
          trackColor={{ true: colors.accent, false: colors.hairline }}
        />
      </View>
    </Card>
  );
}

/**
 * Profile, Sorce-style: credits banner, identity, then a horizontal tab
 * strip. Tab order: Personal, Resume, Settings. Personal is the
 * personalization that steers email writing (LinkedIn to parse, target
 * roles with suggestions, an About box). Resume shows what we parsed out of
 * the uploaded resume, collapsed by default so it does not crowd the view,
 * with Scout chilling in the space. No purchase flow (App Store 3.1.1).
 */

const TABS = [
  { key: 'personal', label: 'Personal', icon: 'person-outline' },
  { key: 'resume', label: 'Resume', icon: 'document-text-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    profile,
    connection,
    resumeExperiences,
    unreadCount,
    swipesAvailable,
    swipeBatchSize,
    cooldownSecondsLeft,
    notificationsEnabled,
    setNotificationsEnabled,
    updateProfile,
    enrichLinkedin,
    resetOnboarding,
    showToast,
  } = useApp();
  const { signOut } = useAuth();

  const [tab, setTab] = useState<TabKey>('personal');
  const [parseOpen, setParseOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl);
  const [rolesText, setRolesText] = useState(profile.targetRoles.join(', '));
  const [industriesText, setIndustriesText] = useState(profile.industries.join(', '));
  const [gradYear, setGradYear] = useState(profile.gradYear);
  const [about, setAbout] = useState(profile.about);

  // When the profile refetches (e.g. after LinkedIn enrichment populates it),
  // fill any *empty* form fields from it — never clobber what the user typed.
  useEffect(() => {
    setLinkedinUrl((cur) => cur || profile.linkedinUrl);
    setGradYear((cur) => cur || profile.gradYear);
    setAbout((cur) => cur || profile.about);
    setRolesText((cur) => cur || profile.targetRoles.join(', '));
    setIndustriesText((cur) => cur || profile.industries.join(', '));
  }, [profile.linkedinUrl, profile.gradYear, profile.about, profile.targetRoles, profile.industries]);

  const handleEnrich = async () => {
    if (!linkedinUrl.trim() || enriching) return;
    setEnriching(true);
    try {
      const res = await enrichLinkedin(linkedinUrl);
      showToast(
        res?.enriched
          ? 'Pulled your details from LinkedIn'
          : res?.error || "Couldn't read that LinkedIn — double-check the URL",
      );
    } finally {
      setEnriching(false);
    }
  };

  const swipesLabel =
    swipesAvailable > 0
      ? `${swipesAvailable} of ${swipeBatchSize} swipes ready`
      : `Recharging · ${Math.floor(cooldownSecondsLeft / 60)}:${String(cooldownSecondsLeft % 60).padStart(2, '0')}`;

  const dirty =
    linkedinUrl !== profile.linkedinUrl ||
    splitList(industriesText).join('|') !== profile.industries.join('|') ||
    gradYear !== profile.gradYear ||
    about !== profile.about ||
    splitList(rolesText).join('|') !== profile.targetRoles.join('|');

  const saveProfile = () => {
    updateProfile({
      linkedinUrl,
      targetRoles: splitList(rolesText),
      industries: splitList(industriesText),
      gradYear,
      about,
    });
    showToast('Saved');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Profile"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 12 }}>
          <Pressable onPress={() => router.push('/credits')}>
            <LinearGradient
              colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="flash" size={17} color={colors.bolt} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.paper }}>
                    {profile.credits} credits
                  </Text>
                  {profile.plan !== 'Free' ? (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        backgroundColor: 'rgba(255,255,255,0.22)',
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.paper }}>
                        {profile.plan.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: '#DCE6FB' }}>
                  {swipesLabel} · Get more credits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#DCE6FB" />
            </LinearGradient>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
            {profile.photoUrl ? (
              <Image
                source={{ uri: profile.photoUrl }}
                style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.paper2 }}
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.paper }}>
                  {profile.name
                    .split(' ')
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink }}>
                  {profile.name}
                </Text>
                {profile.plan !== 'Free' ? (
                  <View
                    style={{
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      backgroundColor: colors.marketing,
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.paper }}>
                      {profile.plan.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary }}>
                {profile.school}
              </Text>
            </View>
            {connection.usingSampleData ? <Chip label="Sample data" tone="waiting" dot /> : null}
          </View>

          <ProfileCompletion profile={profile} onFinish={() => setTab('personal')} />

          <Pressable onPress={() => router.push('/share')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.accent + '40' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="share-social-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                  Share your progress
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                  A clean card of your week, for the group chat
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Card>
          </Pressable>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }}>
            {TABS.map((t) => {
              const selected = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderBottomWidth: 2,
                    borderBottomColor: selected ? colors.navy : 'transparent',
                  }}>
                  <Ionicons name={t.icon} size={15} color={selected ? colors.navy : colors.inkTertiary} />
                  <Text
                    style={{
                      fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                      fontSize: 13.5,
                      color: selected ? colors.navy : colors.inkTertiary,
                    }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          {tab === 'personal' ? (
            <>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
                This is what Offerloop uses to write like you. Keep it loose and human.
              </Text>

              {/* Application profile lives here too (also in Settings) — it's what
                  auto-apply fills on every job, so keep it easy to reach. */}
              <Pressable onPress={() => router.push('/application-profile')}>
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
                    <Ionicons name="briefcase-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Application profile
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      What auto-apply fills in for you on every job
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>

              {/* One soft card, rows separated by hairlines, no boxy inputs. */}
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <SoftRow label="LinkedIn">
                  <TextInput
                    value={linkedinUrl}
                    onChangeText={setLinkedinUrl}
                    placeholder="linkedin.com/in/you"
                    placeholderTextColor={colors.inkTertiary}
                    autoCapitalize="none"
                    style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                  />
                </SoftRow>
                <SoftRow label="Target roles">
                  <CommaField
                    value={rolesText}
                    onChangeText={setRolesText}
                    suggestions={TARGET_ROLE_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Industries">
                  <CommaField
                    value={industriesText}
                    onChangeText={setIndustriesText}
                    suggestions={INDUSTRY_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Grad year">
                  <TextInput
                    value={gradYear}
                    onChangeText={setGradYear}
                    placeholderTextColor={colors.inkTertiary}
                    style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                  />
                </SoftRow>
                <SoftRow label="About you" last>
                  <TextInput
                    value={about}
                    onChangeText={setAbout}
                    multiline
                    placeholder="Interests, goals, the color a resume misses."
                    placeholderTextColor={colors.inkTertiary}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 15,
                      color: colors.ink,
                      paddingVertical: 2,
                      lineHeight: 22,
                      minHeight: 70,
                      textAlignVertical: 'top',
                    }}
                  />
                </SoftRow>
              </Card>

              {/* One tap pulls grad year, school, experiences, and the LinkedIn
                  view from the entered profile via the enrichment service. */}
              <Pressable
                onPress={handleEnrich}
                disabled={!linkedinUrl.trim() || enriching}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  borderRadius: 10,
                  paddingVertical: 12,
                  opacity: !linkedinUrl.trim() || enriching ? 0.5 : 1,
                }}>
                {enriching ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="logo-linkedin" size={17} color={colors.accent} />
                )}
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent }}>
                  {enriching ? 'Pulling from LinkedIn…' : 'Auto-fill from LinkedIn'}
                </Text>
              </Pressable>

              <Button
                label={dirty ? 'Save changes' : 'Saved'}
                variant="brand"
                fullWidth
                disabled={!dirty}
                onPress={saveProfile}
              />
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Deeper personalization, templates, and tone live on offerloop.ai
              </Text>
            </>
          ) : null}

          {tab === 'resume' ? (
            <>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.accent + '14',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="document-text-outline" size={19} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                    {profile.resume.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                    {profile.resume.updatedLabel}
                  </Text>
                </View>
                <Chip label="Attached" tone="positive" dot />
              </Card>

              {/* LinkedIn, the second source we gather from, above the parse.
                  Only expandable when we actually have gathered highlights —
                  otherwise it's an honest status row (no fabricated bullets). */}
              <Pressable
                onPress={() => profile.linkedinHighlights.length && setLinkedinOpen((v) => !v)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="logo-linkedin" size={17} color={colors.accent} />
                  <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    {!linkedinUrl.trim()
                      ? 'Add your LinkedIn in Personal'
                      : profile.linkedinHighlights.length
                        ? 'What we gathered from your LinkedIn'
                        : linkedinUrl.trim()}
                  </Text>
                  {linkedinUrl.trim() && profile.linkedinHighlights.length ? (
                    <Ionicons
                      name={linkedinOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.inkTertiary}
                    />
                  ) : null}
                </Card>
              </Pressable>

              {linkedinOpen && profile.linkedinHighlights.length ? (
                <Card style={{ gap: 6 }}>
                  {profile.linkedinHighlights.map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                      <Text
                        style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                        {h}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Pressable onPress={() => setParseOpen((v) => !v)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="scan-outline" size={17} color={colors.navy} />
                  <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    Here is what we gathered from your resume
                  </Text>
                  <Ionicons
                    name={parseOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.inkTertiary}
                  />
                </Card>
              </Pressable>

              {parseOpen && resumeExperiences.length === 0 ? (
                <Card>
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12.5,
                      color: colors.inkTertiary,
                      lineHeight: 18,
                    }}>
                    No resume on file yet. Upload one on offerloop.ai and the parse shows up
                    here.
                  </Text>
                </Card>
              ) : null}

              {parseOpen && resumeExperiences.length > 0 ? (
                resumeExperiences.map((exp) => (
                  <Card key={exp.id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink, flex: 1 }}>
                        {exp.role}
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                        {exp.dates}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
                      {exp.org}
                      {exp.location ? `  ·  ${exp.location}` : ''}
                    </Text>
                    <View style={{ gap: 6, marginTop: 2 }}>
                      {exp.bullets.map((b, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                          <Text
                            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                            {b}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              ) : !parseOpen ? (
                <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
                  <Image
                    source={require('../../../assets/images/scout-prep.png')}
                    style={{ width: 130, height: 104 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12.5,
                      color: colors.inkTertiary,
                      textAlign: 'center',
                      maxWidth: 250,
                      lineHeight: 18,
                    }}>
                    Scout read your resume so every draft sounds like you. Tap above to see
                    what we picked up.
                  </Text>
                </View>
              ) : null}

              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Rebuild your resume or update your LinkedIn on offerloop.ai and the parse
                updates here.
              </Text>
            </>
          ) : null}

          {tab === 'settings' ? (
            <>
              <Pressable onPress={() => router.push('/swipe-settings')}>
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
                    <Ionicons name="options-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Swipe settings
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      Draft or send, how many contacts, auto-apply
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>

              <Pressable onPress={() => router.push('/location-preferences')}>
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
                    <Ionicons name="location-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Location preferences
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      {profile.preferredLocations?.length
                        ? profile.preferredLocations.slice(0, 3).join(' · ') +
                          (profile.preferredLocations.length > 3 ? ' …' : '')
                        : 'Where you’d actually take a job'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>

              <Pressable onPress={() => router.push('/application-profile')}>
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
                    <Ionicons name="briefcase-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Application profile
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      Work authorization + details for auto-apply
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>

              <AppearanceSelector />

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
                  {/* Gmail OAuth lives on the website; the chip opens it
                      there instead of sitting dead (sweep blocker #3). */}
                  <Pressable
                    onPress={() => {
                      if (!profile.gmailConnected) {
                        void Linking.openURL('https://offerloop.ai/account-settings');
                      }
                    }}
                    disabled={profile.gmailConnected}>
                    <Chip
                      label={profile.gmailConnected ? 'Connected' : 'Connect on offerloop.ai'}
                      tone={profile.gmailConnected ? 'positive' : 'accent'}
                      dot={profile.gmailConnected}
                    />
                  </Pressable>
                </View>
                <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
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
                <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
                <Button
                  label="Sign out"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert('Sign out', 'Sign out of Offerloop?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
                    ])
                  }
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
              {__DEV__ ? (
                <Button
                  label="Replay onboarding"
                  variant="outline"
                  onPress={() => {
                    // Onboarding is opt-in now (not force-gated), so enter it
                    // explicitly. resetOnboarding clears the completion flag so
                    // a future new-user gate would show it again.
                    resetOnboarding();
                    router.push('/(onboarding)');
                  }}
                />
              ) : null}
            </>
          ) : null}

          {/* Which JS bundle is this phone actually running? Answers
              "did the OTA land" at a glance — updateId is null while on
              the build's embedded bundle. Outside the segment conditionals
              on purpose: visible from any Profile segment. */}
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: colors.inkTertiary,
              textAlign: 'center',
              marginTop: 4,
            }}>
            {Updates.updateId
              ? `Update ${Updates.updateId.slice(0, 8)}${
                  Updates.createdAt ? ` · ${new Date(Updates.createdAt).toLocaleString()}` : ''
                }`
              : 'Embedded bundle — no OTA applied yet'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
