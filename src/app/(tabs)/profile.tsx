import { Ionicons } from '@expo/vector-icons';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { saveTargetTrack } from '@/api/endpoints/preferences';

import { getApplicationProfile } from '@/api/endpoints/autoApply';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { RESUME_BUILDER_LIVE } from '@/api/endpoints/resumeBuilder';
import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { qk } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CircleProgress from '@/components/ui/CircleProgress';
import CommaField from '@/components/ui/CommaField';
import {
  INDUSTRY_SUGGESTIONS,
  TARGET_ROLE_SUGGESTIONS,
} from '@/mocks/data';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** A soft, borderless personalization row with a hairline under it. */

/**
 * A group heading in Settings.
 *
 * Settings had grown to thirteen unlabelled rows in one flat stack, with Sign
 * out buried inside the same card as the Gmail connection. Grouping is the
 * whole fix: a student looking for one thing now scans five short headings
 * instead of reading thirteen rows.
 */
/**
 * Everything that gets submitted, stated plainly.
 *
 * Label above, value below, at full width. The first version put label and
 * value on one line, which truncated the two things a student most needs to
 * check are right — their email and their LinkedIn — into "deena.bandi004@gmail…"
 * and "https://www.linkedin.co…". A page whose whole job is showing exactly
 * what goes out cannot hide the values.
 *
 * Anything missing says "Not set" in amber rather than sitting blank: a blank
 * row reads as "nothing to do" when it is the exact reason an application
 * stalls and comes back asking for answers.
 */

function ResumeDrop({
  hasResume,
  resumeName,
  busy,
  onPress,
}: {
  hasResume: boolean;
  /** The attached file's name, so the card says WHICH resume rides along
   *  (Rylan 2026-08-19: "I want to be able to see which resume I'm working
   *  with"). */
  resumeName?: string;
  busy: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button">
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: busy ? 0.6 : 1 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: hasResume ? colors.positive + '18' : colors.accent + '14',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name={hasResume ? 'document-text' : 'cloud-upload-outline'}
              size={18}
              color={hasResume ? colors.positive : colors.accent}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
            {hasResume ? 'Resume attached' : 'Add your resume'}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
            {busy
              ? 'Uploading and reading it…'
              : hasResume
                ? resumeName || 'Replace it, or build a fresh one'
                : 'Upload one, or we build it with you'}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent }}>
          {hasResume ? 'Replace' : 'Upload'}
        </Text>
      </Card>
    </Pressable>
  );
}


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

/**
 * Appearance picker: a two-way segmented control (Light / Dark). The choice is
 * sticky; it drives the whole app through ThemeProvider.
 */

/**
 * Profile, Sorce-style: credits banner, identity, then a horizontal tab
 * strip. Tab order: Personal, Resume, Settings. Personal is the
 * personalization that steers email writing (LinkedIn to parse, target
 * roles with suggestions, an About box). Resume shows what we parsed out of
 * the uploaded resume, collapsed by default so it does not crowd the view,
 * with Scout chilling in the space. No purchase flow (App Store 3.1.1).
 */



export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();
  const {
    profile,
    connection,
    unreadCount,
    draftsLeft,
    costPerSwipe,
    updateProfile,
    enrichLinkedin,
    showToast,
  } = useApp();
  const { signOut } = useAuth();

  // ?tab=settings opens straight on a tab, the same way Network already
  // works. The first-run tour uses it to land on Settings.
  const [resumeBusy, setResumeBusy] = useState(false);
  // The answers auto-apply actually submits. Read-only here; the edit screen
  // owns writing them.
  const appProfileQuery = useQuery({
    queryKey: ['application-profile'],
    queryFn: getApplicationProfile,
  });
  const appProfile = appProfileQuery.data;

  // How many of the submitted fields are still blank. Drives the amber count
  // on the "What we send" row, and it is the same nine fields that screen
  // lists, so the two can never disagree about how much is left.
  const blankAnswers = useMemo(() => {
    const wa = appProfile?.workAuthorization;
    const prefs = appProfile?.preferences;
    const values = [
      profile.hasResume ? 'y' : null,
      profile.name || null,
      profile.gmailAddress || null,
      profile.linkedinUrl || null,
      wa?.authorizedToWorkUS ?? null,
      wa?.requiresSponsorship ?? null,
      prefs?.openToRelocation ?? null,
      prefs?.openToRemote ?? null,
      prefs?.earliestStartDate || null,
    ];
    return values.filter((v) => v === null || v === undefined).length;
  }, [appProfile, profile.hasResume, profile.name, profile.gmailAddress, profile.linkedinUrl]);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const queryClient = useQueryClient();
  // Replace/Add resume opens the three doors (upload / build from LinkedIn /
  // describe) instead of jumping straight to the file picker. The build paths
  // existed but were "a little rough to get into" from here (Rylan 2026-08-18).
  const [resumeDoorsOpen, setResumeDoorsOpen] = useState(false);

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
  // Same removal the Attachments screen offers (backend deletes the stored
  // file AND the parsed data), surfaced here because this tab is where people
  // actually manage their resume (Rylan, 2026-08-10). Ask first: destructive.
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

  // Jump-to-field for the completion card. If measuring fails we still focus;
  // worst case the keyboard covers it.
  const focusField = (which: keyof typeof fieldRefs) => {
    // The fields live on this screen now, so there is no tab to switch to
    // first: scroll the field under the header and open the keyboard in it.
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

  // Completion-card steps ACT rather than just pointing: one-tap system flows
  // fire immediately, text fields get the cursor placed in them. Gmail lives
  // on the Settings screen now, so that one pushes and connects on arrival.
  const onCompletionAction = (action: StepAction) => {
    if (action === 'resume') {
      void onPickResume();
    } else if (action === 'gmail') {
      if (!profile.gmailConnected && !gmailConnecting) void connectGmail();
      router.push('/settings');
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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title="Profile"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <View style={{ flex: 1 }}>
        {/* Plain paper. The watercolor mountains and their scrim came off here:
            the page is a record you read and edit, and a painting behind a
            column of white cards was doing nothing but competing with them.
            Cards carry their own hairline, so they still read on white. */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: colors.paper }}
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 12 }}>
          <Card padded={false} style={{ overflow: 'hidden' }}>
          {/* The identity band wears the brand gradient (same ramp as the
              Network progress card, so the app's two "this is you" surfaces
              rhyme). The page below stays paper; this is the one vibrant
              thing on it (Rylan 2026-08-18: "so much white on this page"). */}
          <LinearGradient
            colors={['#2563EB', '#4F46E5', '#7C3AED'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {profile.photoUrl ? (
              <Image
                source={{ uri: profile.photoUrl }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.paper2,
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.75)',
                }}
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: '#FFFFFF' }}>
                  {profile.name
                    .split(' ')
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: '#FFFFFF' }}>
                {profile.name}
              </Text>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.sans, fontSize: 13, color: '#DDE3FB' }}>
                {profile.school}
              </Text>

            </View>
            {connection.usingSampleData ? <Chip label="Sample data" tone="waiting" dot /> : null}

            {/* Credits, as a ring. The arc is what is LEFT: a full ring means a
                full wallet and it drains as you spend, which is the direction
                people read a gauge. The number inside repeats it for anyone
                who wants the figure. Replaced a full-width gradient banner
                that shouted the same fact and matched nothing else here. */}
            <Pressable
              onPress={() => router.push('/credits')}
              accessibilityRole="button"
              accessibilityLabel={`${profile.credits} credits left of ${profile.maxCredits}. ${swipesLabel}`}
              style={{ alignItems: 'center', gap: 2 }}>
              {/* The tier crowns the ring (Rylan 2026-08-19), serif like the
                  website; the ring drops a touch beneath it. */}
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 19,
                  lineHeight: 22,
                  color: '#F3E8FF',
                  marginBottom: 4,
                }}>
                {profile.plan}
              </Text>
              <CircleProgress
                size={58}
                strokeWidth={6}
                progress={
                  profile.maxCredits
                    ? Math.min(1, profile.credits / profile.maxCredits)
                    : profile.credits > 0
                      ? 1
                      : 0
                }
                // Health at a glance (Rylan 2026-08-19): green while the
                // month is comfortable, gold in the middle, red on the last
                // quarter. Real ratio only; no max means no judgment.
                color={
                  !profile.maxCredits
                    ? '#FBBF24'
                    : profile.credits / profile.maxCredits > 0.5
                      ? '#34D399'
                      : profile.credits / profile.maxCredits > 0.25
                        ? '#FBBF24'
                        : '#F87171'
                }
                trackColor="rgba(255,255,255,0.24)"
                labelColor="#FFFFFF"
                label={
                  profile.credits >= 1000
                    ? `${Math.round(profile.credits / 100) / 10}k`
                    : String(profile.credits)
                }
              />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10.5, color: '#DDE3FB' }}>
                credits left
              </Text>
            </Pressable>
            {/* Share-your-progress, compacted to a gradient-outlined icon beside
                the name instead of a full-width card — same destination (/share),
                far less vertical space. The 1.5px gradient pad is the outline;
                the paper circle sits inside it. */}
            <Pressable
              onPress={() => router.push('/share')}
              accessibilityRole="button"
              accessibilityLabel="Share your progress">
              {/* Frosted glass (round 4 color diet: pink + gold + purple +
                  blue on one band was "a lot going on"; the gold credits ring
                  is now the band's single accent). */}
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.55)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
          </LinearGradient>
          {/* One line, one job (Rylan 2026-08-19): the centered action under
              the band. The ring above already says the balance; the exact
              count and the bar were restating it. */}
          <View style={{ padding: 14 }}>
            {iapAvailable() ? (
              <Pressable
                onPress={() => router.push('/credits')}
                accessibilityRole="button"
                style={{
                  borderRadius: 10,
                  shadowColor: '#3B82F6',
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 4,
                }}>
                <LinearGradient
                  colors={['#4B8AF9', '#3B82F6', '#2563EB'] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    height: 44,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#FFFFFF' }}>
                    {profile.plan === 'Free' ? 'Upgrade' : 'Get more credits'}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/credits')}
                accessibilityRole="button"
                style={{ alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent }}>
                  See credits
                </Text>
              </Pressable>
            )}
          </View>
          </Card>

          {/* Resume, reachable from the top of the page at any time. It used
              to live only inside the Application tab, so "drop in my resume"
              meant knowing which of three tabs it was behind. Every draft and
              every auto-apply depends on this one file. The full tools (edit
              the parse, build one from LinkedIn, write one from a
              description) stay in the Application tab. */}
          <ResumeDrop
            hasResume={profile.hasResume}
            resumeName={profile.resume?.name}
            busy={resumeBusy}
            onPress={() => setResumeDoorsOpen(true)}
          />

          <Modal
            visible={resumeDoorsOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setResumeDoorsOpen(false)}>
            <Pressable
              onPress={() => setResumeDoorsOpen(false)}
              style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.5)', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: colors.paper,
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  padding: 20,
                  paddingBottom: 36,
                }}>
                <ResumeDoors
                  hasResume={profile.hasResume}
                  hasLinkedin={!!profile.linkedinUrl?.trim()}
                  onUpload={() => {
                    setResumeDoorsOpen(false);
                    void onPickResume();
                  }}
                  onBuildFromLinkedin={() => {
                    setResumeDoorsOpen(false);
                    if (!RESUME_BUILDER_LIVE) {
                      showToast('Building from LinkedIn arrives this week. Upload works today.');
                      return;
                    }
                    router.push('/resume-preview');
                  }}
                  onDescribe={() => {
                    setResumeDoorsOpen(false);
                    router.push('/resume-from-text');
                  }}
                  onNotNow={() => setResumeDoorsOpen(false)}
                />
              </Pressable>
            </Pressable>
          </Modal>

          {/* Checklist reads the LIVE typed values, not just the saved
              profile: Rylan typed his grad year and the list still nagged him
              because he had not hit Save yet. Saving still persists; the
              checkmark just should not wait for the round trip. */}
          <ProfileCompletion
            profile={{
              ...profile,
              linkedinUrl: linkedinUrl || profile.linkedinUrl,
              gradYear: gradYear || profile.gradYear,
              about: about || profile.about,
              targetRoles: splitList(rolesText).length ? splitList(rolesText) : profile.targetRoles,
              industries: splitList(industriesText).length
                ? splitList(industriesText)
                : profile.industries,
            }}
            onAction={onCompletionAction}
          />

        </View>


        <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 8 }}>
          {/* GO TO: the two doors out of this page. The old build made these
              tabs, which put "delete my account" at the same level as "my
              name" and buried the application payload behind a coined label.
              They are destinations, so they look like destinations. */}
          {/* Section headers upgraded from whisper-caps to real headings with
              a blue tick under them (Rylan 2026-08-18: the page "reads like
              it's scrolling", sections need to actually section). */}
          <View style={{ gap: 5, paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.heading }}>
              Go to
            </Text>
            <View style={{ width: 30, height: 3, borderRadius: 2, backgroundColor: '#8B5CF6' }} />
          </View>
          {/* Doors as TILES (Rylan 2026-08-18 round 3): big colored icons,
              one tap each, instead of a list that reads like scrolling.
              Feedback promoted to a first-class door: hearing from users is
              the point of a staging build. */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push('/what-we-send')}
              accessibilityRole="button"
              style={{
                flex: 1,
                backgroundColor: colors.paper,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                gap: 8,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 12.5,
                  color: colors.ink,
                  textAlign: 'center',
                }}>
                Auto apply kit
              </Text>
              {blankAnswers > 0 ? (
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.waiting }}>
                  {blankAnswers} blank
                </Text>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              style={{
                flex: 1,
                backgroundColor: colors.paper,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                gap: 8,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="settings-sharp" size={20} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 12.5,
                  color: colors.ink,
                  textAlign: 'center',
                }}>
                Settings
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/feedback')}
              accessibilityRole="button"
              style={{
                flex: 1,
                backgroundColor: colors.paper,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                gap: 8,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.positive,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="megaphone" size={20} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 12.5,
                  color: colors.ink,
                  textAlign: 'center',
                }}>
                Feedback
              </Text>
            </Pressable>
          </View>
        </View>


        <View style={{ padding: 20, gap: 16 }}>
          <>
              <View style={{ gap: 5 }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.heading }}>
                  Your details
                </Text>
                <View style={{ width: 30, height: 3, borderRadius: 2, backgroundColor: '#8B5CF6' }} />
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19, marginTop: -6 }}>
                Used to find the right people and to draft outreach in your voice.
              </Text>

              {/* One soft card, rows separated by hairlines, no boxy inputs. */}
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <SoftRow label="LinkedIn">
                  {/* The gathered highlights expand inline under the field
                      (Rylan 2026-08-10) instead of a separate card elsewhere.
                      Chevron only when there is real gathered content. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      ref={fieldRefs.linkedin}
                      value={linkedinUrl}
                      onChangeText={setLinkedinUrl}
                      placeholder="linkedin.com/in/you"
                      placeholderTextColor={colors.inkTertiary}
                      autoCapitalize="none"
                      style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                    />
                    {profile.linkedinHighlights.length ? (
                      <Pressable
                        onPress={() => setLinkedinOpen((v) => !v)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Show what we gathered from your LinkedIn">
                        <Ionicons
                          name={linkedinOpen ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.inkTertiary}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                  {linkedinOpen && profile.linkedinHighlights.length ? (
                    <View style={{ gap: 6, marginTop: 10 }}>
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary }}>
                        What we gathered from your LinkedIn
                      </Text>
                      {profile.linkedinHighlights.map((h, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                          <Text
                            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                            {h}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
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
        </View>
      </ScrollView>

      {/* Outside the ScrollView so it centers over the whole screen rather than
          over wherever the list happens to be scrolled to. */}
      <ConfirmDialog
        visible={confirmSignOut}
        icon="log-out-outline"
        title="Sign out?"
        body="You'll need to sign back in to reach your feed, drafts, and credits."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={() => void signOut()}
        onClose={() => setConfirmSignOut(false)}
      />
      </View>
    </View>
  );
}
