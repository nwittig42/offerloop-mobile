import { Ionicons } from '@expo/vector-icons';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { deleteAccount, saveTargetTrack } from '@/api/endpoints/preferences';
import ReferralCard from '@/components/ReferralCard';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { qk } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { OTA_NOTES, otaStamp, SHOW_BUILD_STAMP } from '@/lib/buildInfo';
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
import { useAIConsent } from '@/lib/aiConsent';
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

/** A step the completion card can act on: focus a field, or fire a flow. */
type StepAction = 'linkedin' | 'roles' | 'industries' | 'gradYear' | 'about' | 'resume' | 'gmail';

/**
 * Profile completeness nudge (Sorce-style): a ring gauge + a CTA into the
 * Personal tab. Counts the fields that steer Scout's writing; once they're all
 * filled the card disappears entirely.
 */
function ProfileCompletion({
  profile,
  onAction,
}: {
  profile: ReturnType<typeof useApp>['profile'];
  onAction: (action: StepAction) => void;
}) {
  const colors = useColors();

  // Each item names its action, not just a tab. Tab-switching alone left the
  // user hunting for the right field ("Add your LinkedIn" dropped you at the
  // top of Personal and stopped helping); the parent now focuses the exact
  // field, opens the resume picker, or starts the Gmail connect directly.
  const items: { label: string; done: boolean; action: StepAction }[] = [
    { label: 'Add your LinkedIn', done: !!profile.linkedinUrl?.trim(), action: 'linkedin' },
    { label: 'Pick target roles', done: profile.targetRoles.length > 0, action: 'roles' },
    { label: 'Pick target industries', done: profile.industries.length > 0, action: 'industries' },
    { label: 'Add your grad year', done: !!profile.gradYear?.trim(), action: 'gradYear' },
    { label: 'Write a short About', done: !!profile.about?.trim(), action: 'about' },
    { label: 'Upload your resume', done: profile.hasResume, action: 'resume' },
    { label: 'Connect Gmail', done: profile.gmailConnected, action: 'gmail' },
  ];
  const done = items.filter((i) => i.done).length;
  const ratio = done / items.length;
  const pct = Math.round(ratio * 100);
  const missing = items.filter((i) => !i.done);

  if (pct >= 100) return null;

  const first = missing[0];
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

      {/* What's actually left — tap any row to jump straight to it. */}
      <View style={{ gap: 2 }}>
        {missing.map((i) => (
          <Pressable
            key={i.label}
            onPress={() => onAction(i.action)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
            <Ionicons name="ellipse-outline" size={15} color={colors.inkTertiary} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>
              {i.label}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
          </Pressable>
        ))}
      </View>

      <Button
        label={first ? first.label : 'Finish profile'}
        variant="brand"
        fullWidth
        onPress={() => first && onAction(first.action)}
      />
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
  { key: 'feedback', label: 'Feedback', icon: 'chatbubbles-outline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const REVIEWER_REPLAY_EMAILS = ['applereview@offerloop.ai'];

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();
  const {
    profile,
    connection,
    resumeExperiences,
    unreadCount,
    draftsLeft,
    costPerSwipe,
    notificationsEnabled,
    setNotificationsEnabled,
    updateProfile,
    enrichLinkedin,
    resetOnboarding,
    showToast,
  } = useApp();
  const { signOut, user } = useAuth();

  const [tab, setTab] = useState<TabKey>('personal');
  const [resumeBusy, setResumeBusy] = useState(false);
  const queryClient = useQueryClient();

  // The Resume tab used to only DISPLAY a parse and tell people to upload on
  // offerloop.ai — so the app could never actually take a resume, and every
  // auto-apply left the Greenhouse "Resume" field empty. Pick + upload here.
  const onPickResume = async () => {
    if (resumeBusy) return;
    try {
      const file = await pickResume();
      if (!file) return; // cancelled
      setResumeBusy(true);
      showToast('Uploading your resume…');
      await uploadResume(file);
      await queryClient.invalidateQueries({ queryKey: qk.me });
      showToast('Resume saved');
    } catch (e) {
      showToast(
        e instanceof Error && e.message.includes('10MB')
          ? e.message
          : "Couldn't read that file. Try a PDF.",
      );
    } finally {
      setResumeBusy(false);
    }
  };
  const [parseOpen, setParseOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { consent: aiConsent } = useAIConsent();
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl);
  const [rolesText, setRolesText] = useState(profile.targetRoles.join(', '));
  const [industriesText, setIndustriesText] = useState(profile.industries.join(', '));
  const [gradYear, setGradYear] = useState(profile.gradYear);
  const [about, setAbout] = useState(profile.about);

  const scrollRef = useRef<ScrollView>(null);
  const fieldRefs = {
    linkedin: useRef<TextInput>(null),
    roles: useRef<TextInput>(null),
    industries: useRef<TextInput>(null),
    gradYear: useRef<TextInput>(null),
    about: useRef<TextInput>(null),
  };

  // Jump-to-field for the completion card: switch to Personal, then (after the
  // tab's fields mount) scroll the field under the header and open the keyboard
  // in it. If measuring fails we still focus; worst case the keyboard covers it.
  const focusField = (which: keyof typeof fieldRefs) => {
    setTab('personal');
    setTimeout(() => {
      const input = fieldRefs[which].current;
      const scroller = scrollRef.current;
      if (!input || !scroller) return;
      try {
        input.measureLayout(
          scroller.getInnerViewNode(),
          (_x, y) => scroller.scrollTo({ y: Math.max(0, y - 120), animated: true }),
          () => {},
        );
      } catch {}
      input.focus();
    }, 150);
  };

  // Completion-card steps ACT instead of just switching tabs: one-tap system
  // flows fire immediately, text fields get the cursor placed in them.
  const onCompletionAction = (action: StepAction) => {
    if (action === 'resume') {
      // Land on the Resume tab so upload progress and the parse are visible,
      // and open the picker right away, the step is the action.
      setTab('resume');
      void onPickResume();
    } else if (action === 'gmail') {
      setTab('settings');
      if (!profile.gmailConnected && !gmailConnecting) void connectGmail();
    } else {
      focusField(action);
    }
  };

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

  // Credits are the only meter — there is no stamina batch and no recharge timer
  // to count down. Say what's actually true: how many drafts the wallet affords.
  const swipesLabel =
    draftsLeft > 0
      ? `${draftsLeft} ${draftsLeft === 1 ? 'draft' : 'drafts'} left · ${costPerSwipe} credits each`
      : 'Out of credits';

  const dirty =
    linkedinUrl !== profile.linkedinUrl ||
    splitList(industriesText).join('|') !== profile.industries.join('|') ||
    gradYear !== profile.gradYear ||
    about !== profile.about ||
    splitList(rolesText).join('|') !== profile.targetRoles.join('|');

  const saveProfile = () => {
    const targetRoles = splitList(rolesText);
    const industries = splitList(industriesText);
    updateProfile({
      linkedinUrl,
      targetRoles,
      industries,
      gradYear,
      about,
    });
    // updateProfile only patches the LOCAL cache — without this the edit never
    // reaches the backend, so the feed never re-tunes and the change is lost on
    // the next refetch (the bug: "I updated my profile and nothing changed").
    // roles/industries were wired up; about/gradYear/linkedinUrl were still
    // being dropped on the floor even though Save collected them. Send all of
    // them. The backend busts jobFeedCache on the feed-relevant ones so the deck
    // reranks to the new goal. Best-effort — the UI already updated.
    void saveTargetTrack({
      targetRoles,
      industries,
      about,
      gradYear,
      linkedinUrl,
    }).catch(() => {});
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

      <View style={{ flex: 1 }}>
        {/* Watercolor mountains wash behind the whole page. A surface scrim (lighter
            up top, near-opaque lower down) keeps cards and copy legible while the
            painting still shows through — subtle in the forms, richer in the hero. */}
        <Image
          source={require('../../../assets/images/watercolor-mountains.webp')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          pointerEvents="none"
          colors={[colors.surface + '80', colors.surface + 'D9', colors.surface + 'EB'] as const}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 12 }}>
          {/* Credits hero banner (Rylan 2026-07-28): the doorway to the store
              gets the biggest weight on the page; serif balance up front. */}
          <Pressable onPress={() => router.push('/credits')}>
            <LinearGradient
              colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 20,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="flash" size={21} color={colors.bolt} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
                  <Text
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 28,
                      lineHeight: 30,
                      color: colors.paper,
                    }}>
                    {profile.credits.toLocaleString()}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 12,
                      letterSpacing: 0.6,
                      color: '#DCE6FB',
                      paddingBottom: 4,
                    }}>
                    CREDITS
                  </Text>
                  {profile.plan !== 'Free' ? (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        marginBottom: 3,
                        backgroundColor: 'rgba(255,255,255,0.22)',
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.paper }}>
                        {profile.plan.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: '#DCE6FB', marginTop: 3 }}>
                  {swipesLabel} · View credits and packs
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#DCE6FB" />
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
            {/* Share-your-progress, compacted to a gradient-outlined icon beside
                the name instead of a full-width card — same destination (/share),
                far less vertical space. The 1.5px gradient pad is the outline;
                the paper circle sits inside it. */}
            <Pressable
              onPress={() => router.push('/share')}
              accessibilityRole="button"
              accessibilityLabel="Share your progress">
              {/* Filled gradient chip — the color lives inside now, white glyph on
                  a blue→violet wash, so it reads as a bright action beside the name. */}
              <LinearGradient
                colors={['#5B9BF4', '#2563EB', '#7C4DFF'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="share-social" size={18} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>

          <ProfileCompletion profile={profile} onAction={onCompletionAction} />

          <ReferralCard compact />

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
                  // Feedback opens the full-screen chat instead of rendering
                  // cramped inside the profile layout — it's a proper screen.
                  onPress={() => (t.key === 'feedback' ? router.push('/feedback') : setTab(t.key))}
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
                    ref={fieldRefs.linkedin}
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
                    inputRef={fieldRefs.roles}
                    value={rolesText}
                    onChangeText={setRolesText}
                    suggestions={TARGET_ROLE_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Industries">
                  <CommaField
                    inputRef={fieldRefs.industries}
                    value={industriesText}
                    onChangeText={setIndustriesText}
                    suggestions={INDUSTRY_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Grad year">
                  <TextInput
                    ref={fieldRefs.gradYear}
                    value={gradYear}
                    onChangeText={setGradYear}
                    placeholderTextColor={colors.inkTertiary}
                    style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                  />
                </SoftRow>
                <SoftRow label="About you" last>
                  <TextInput
                    ref={fieldRefs.about}
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
                {resumeBusy ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : profile.hasResume ? (
                  <Chip label="Attached" tone="positive" dot />
                ) : (
                  <Chip label="Not added" tone="neutral" />
                )}
              </Card>

              <Button
                label={profile.hasResume ? 'Replace resume' : 'Upload resume'}
                variant={profile.hasResume ? 'outline' : 'brand'}
                fullWidth
                icon="cloud-upload-outline"
                disabled={resumeBusy}
                onPress={onPickResume}
              />

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
                    No resume on file yet. Upload one above and the parse shows up here.
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

              <Pressable onPress={() => router.push('/outreach-template')}>
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
                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Outreach template
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      How your drafted emails are written and signed
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

              {/* Legal + account controls. Privacy/Terms links and in-app account
                  deletion are App Store requirements (deletion is Apple 5.1.1(v),
                  a hard rejection without it). */}
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {/* AI data-sharing choice, reviewable and reversible any time
                    (guidelines 5.1.1(i)/5.1.2(i)). */}
                <Pressable
                  onPress={() => router.push({ pathname: '/ai-consent', params: { mode: 'settings' } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.inkSecondary} />
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
    </View>
  );
}
