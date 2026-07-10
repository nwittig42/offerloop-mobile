import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

import { savePreferredLocations, saveReferralSource, saveTargetTrack } from '@/api/endpoints/preferences';
import { enrichLinkedin } from '@/api/endpoints/profile';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SnakeBorder from '@/components/ui/SnakeBorder';
import SwipeDeck from '@/components/feed/SwipeDeck';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { track } from '@/lib/analytics';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

const STEP_NAMES = ['welcome', 'goal', 'linkedin', 'plan', 'demo', 'gmail', 'referral', 'notifications', 'done'];

/**
 * First-run onboarding — ONE screen, internal step state (no routing between
 * steps). Activation-first: confirm what we know from /me, set the goal, feel
 * the aha (a real draft), prime notifications, then drop into the feed. No
 * paywall. Reached opt-in via the dev Replay button; never force-traps.
 */

const TOTAL = 9;

// Acquisition channels — tuned to how students actually find Offerloop (referral,
// social, Reddit, on-campus clubs). Drives marketing attribution.
const REFERRAL_OPTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'friend', label: 'Friend or classmate', icon: 'people-outline', color: '#3B82F6' },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#FE2C55' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', color: '#0A66C2' },
  { key: 'reddit', label: 'Reddit', icon: 'logo-reddit', color: '#FF4500' },
  { key: 'club', label: 'A campus club or event', icon: 'school-outline', color: '#16A34A' },
  { key: 'search', label: 'Google / search', icon: 'search-outline', color: '#4285F4' },
  { key: 'other', label: 'Somewhere else', icon: 'ellipsis-horizontal', color: '#8A8F9A' },
];

type Track = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; industries: string[]; roles: string[] };
const TRACKS: Track[] = [
  { key: 'ib', label: 'Investment Banking', icon: 'trending-up-outline', industries: ['Investment Banking'], roles: ['Investment Banking Analyst'] },
  { key: 'consulting', label: 'Consulting', icon: 'briefcase-outline', industries: ['Consulting'], roles: ['Consultant'] },
  { key: 'tech', label: 'Tech', icon: 'hardware-chip-outline', industries: ['Technology'], roles: ['Software Engineer'] },
  { key: 'other', label: 'Something else', icon: 'compass-outline', industries: [], roles: [] },
];
const SUGGESTED_LOCS = ['New York', 'San Francisco', 'Chicago', 'Los Angeles', 'Boston', 'Remote'];

/** The intro-being-written card: the same snake-border loading we use in the
 *  Inbox, with rotating research phrases so the wait reads as magic, not lag. */
function CraftingDraftCard({ who, company }: { who: string; company?: string }) {
  const colors = useColors();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const phrases = useMemo(() => {
    const base = [
      'Reading their LinkedIn',
      'Finding your common ground',
      company ? `Pulling recent ${company} news` : 'Pulling recent news',
      'Mapping shared experience',
      'Writing your intro',
    ];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [company]);
  const [pi, setPi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPi((p) => (p + 1) % phrases.length), 1500);
    return () => clearInterval(t);
  }, [phrases.length]);
  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ width: '100%', borderRadius: 16, backgroundColor: colors.paper, padding: 16, gap: 10, overflow: 'hidden' }}>
      {size.w > 0 ? <SnakeBorder w={size.w} h={size.h} color={colors.marketing} radius={16} strokeWidth={3} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="document-text-outline" size={15} color={colors.marketing} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
          Your intro to {who}
        </Text>
      </View>
      {/* Blurred lines shaped like an email: a short greeting, then a paragraph. */}
      <View style={{ height: 10, width: '34%', borderRadius: 5, backgroundColor: colors.hairline, opacity: 0.8 }} />
      <View style={{ gap: 8, marginTop: 2 }}>
        {['98%', '100%', '92%', '76%'].map((w, i) => (
          <View key={i} style={{ height: 9, width: w as any, borderRadius: 5, backgroundColor: colors.hairline, opacity: 0.62 - i * 0.08 }} />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.marketing, marginTop: 2 }}>{phrases[pi]}…</Text>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const colors = useColors();
  const { profile, updateProfile, jobs, outreach, draftJob, passJob, setNotificationsEnabled, completeOnboarding } =
    useApp();

  const [step, setStep] = useState(0);
  const [trackChoice, setTrackChoice] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>(profile.preferredLocations ?? []);
  const [drafted, setDrafted] = useState(false);
  const [referral, setReferral] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // LinkedIn: the one profile input a student can actually produce on a phone
  // (nobody has a resume handy). It powers the personalization the whole
  // product sells, so we ask for it BEFORE the demo draft is written.
  const [linkedin, setLinkedin] = useState(profile.linkedinUrl ?? '');
  const [enriching, setEnriching] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [locQuery, setLocQuery] = useState('');
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();
  const [gmailError, setGmailError] = useState<string | null>(null);

  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'there';
  const school = (profile.school || '').trim();
  const industry = (profile.industries?.[0] || 'your target roles').trim();
  const job = jobs[0];

  // Funnel: one event per step view, so the CMO can see exactly where students
  // drop off in onboarding.
  useEffect(() => {
    track('onboarding_step_viewed', { step: step + 1, total: TOTAL, name: STEP_NAMES[step] });
  }, [step]);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    track('onboarding_completed', {
      target_track: trackChoice,
      referral_source: referral,
      locations: locations.length,
      drafted,
    });
    completeOnboarding();
    // Explicit /(tabs) — bare '/' is ambiguous (both the feed and this screen
    // are group indexes at '/'), and from inside this group it resolves back
    // to the onboarding start, causing the "completed → back to start" loop.
    router.replace('/(tabs)');
  };

  const chooseTrack = () => {
    const t = TRACKS.find((x) => x.key === trackChoice);
    if (t && t.industries.length) {
      updateProfile({ industries: t.industries, targetRoles: t.roles });
      void saveTargetTrack({ targetRoles: t.roles, industries: t.industries }).catch(() => {});
    }
    // $set makes target_track a person property — segment ALL metrics by it.
    track('onboarding_goal_selected', { target_track: trackChoice, $set: { target_track: trackChoice } });
    next();
  };

  const saveLocations = () => {
    updateProfile({ preferredLocations: locations });
    void savePreferredLocations(locations).catch(() => {});
    next();
  };

  // A real swipe in onboarding: right drafts (and fires the success state),
  // left passes. Same punchy haptics as the Feed so the aha feels real.
  const onDemoSwipe = (direction: 'left' | 'right' | 'up', j: Job) => {
    if (direction === 'up') return; // save isn't part of the onboarding demo
    if (direction === 'right') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);
      draftJob(j.id);
      setDrafted(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(j.id);
    }
  };

  const chooseReferral = () => {
    if (referral) {
      void saveReferralSource(referral).catch(() => {});
      // $set referral_source as a person property — the channel attribution the
      // CMO can break every downstream metric (activation, conversion) down by.
      track('onboarding_referral_selected', { source: referral, $set: { referral_source: referral } });
    }
    next();
  };

  // ── Step 0: welcome / identity ─────────────────────────────────────────
  if (step === 0) {
    return (
      <OnboardingScaffold
        step={1}
        total={TOTAL}
        canBack={false}
        title={`Welcome, ${firstName}`}
        subtitle="A quick 30 seconds to tune Offerloop to your search — then you're swiping."
        footer={<Button label="Let's go" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />}>
        {school ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.marketing + '14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school-outline" size={20} color={colors.marketing} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>Signed in as</Text>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>{school}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.positive} />
          </Card>
        ) : null}
      </OnboardingScaffold>
    );
  }

  // ── Step 1: goal ───────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <OnboardingScaffold
        step={2}
        total={TOTAL}
        onBack={back}
        title="What are you recruiting for?"
        subtitle="This tunes who shows up in your feed and how your intros are written."
        footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" disabled={!trackChoice} onPress={chooseTrack} />}>
        <View style={{ gap: 12 }}>
          {TRACKS.map((t) => {
            const on = trackChoice === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTrackChoice(t.key);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.marketing : colors.hairline, backgroundColor: on ? colors.marketing + '0F' : colors.paper }}>
                <Ionicons name={t.icon} size={22} color={on ? colors.marketing : colors.inkSecondary} />
                <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>{t.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={22} color={colors.marketing} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 2: confirm + locations ────────────────────────────────────────
  // ── Step 2: LinkedIn — the personalization engine's fuel ───────────────
  if (step === 2) {
    const clean = linkedin.trim();
    const looksValid = /linkedin\.com\/in\//i.test(clean);
    const submit = async () => {
      if (!looksValid) {
        setLinkedinError('Paste the full URL of your LinkedIn profile.');
        return;
      }
      setLinkedinError(null);
      setEnriching(true);
      // Enrich in the background — never block the flow on a scrape. Whatever
      // lands by the time the demo draft writes makes it sharper; the rest
      // arrives before their first real send.
      void enrichLinkedin(clean)
        .catch(() => {})
        .finally(() => setEnriching(false));
      updateProfile({ linkedinUrl: clean });
      next();
    };
    return (
      <OnboardingScaffold
        step={3}
        total={TOTAL}
        onBack={back}
        title="Paste your LinkedIn"
        subtitle="This is what makes your intros sound like you — your school, your roles, your story. It takes one paste."
        footer={
          <>
            <Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={submit} />
            <Button label="I'll add it later" variant="ghost" fullWidth onPress={next} />
          </>
        }>
        <TextInput
          value={linkedin}
          onChangeText={(t) => {
            setLinkedin(t);
            if (linkedinError) setLinkedinError(null);
          }}
          placeholder="linkedin.com/in/yourname"
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: linkedinError ? colors.negative : colors.hairline, backgroundColor: colors.paper, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
        />
        {linkedinError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, marginTop: 8 }}>{linkedinError}</Text>
        ) : null}
        <Card style={{ gap: 6, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles-outline" size={16} color={colors.marketing} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>Why this matters</Text>
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            Generic cold emails get ignored. We read your background and find the
            overlap with the person you're writing to. Add your resume anytime in
            Profile for even sharper drafts.
          </Text>
        </Card>
      </OnboardingScaffold>
    );
  }

  if (step === 3) {
    const toggle = (loc: string) => {
      Haptics.selectionAsync();
      setLocations((p) => (p.includes(loc) ? p.filter((l) => l !== loc) : [...p, loc]));
    };
    return (
      <OnboardingScaffold
        step={4}
        total={TOTAL}
        onBack={back}
        title="Here's the plan"
        subtitle={school ? `We'll prioritize people from ${school} and warm paths into ${industry}.` : `We'll prioritize warm paths into ${industry}.`}
        footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={saveLocations} />}>
        <Card style={{ gap: 6, marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="people-outline" size={16} color={colors.marketing} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>Your edge</Text>
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            Shared background is the best opener in a cold email — so we use your school, path, and
            resume to find people likely to reply, and write the intro for you.
          </Text>
        </Card>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink, marginBottom: 4 }}>Where do you want to land?</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, marginBottom: 12 }}>Type any city, or tap a shortcut. This steers your feed.</Text>
        {/* Free-text entry: the six chips cover a fraction of where students
            recruit (Houston, Charlotte, Atlanta, London...). Type-and-add so
            nobody's city is unrepresentable. */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TextInput
            value={locQuery}
            onChangeText={setLocQuery}
            onSubmitEditing={() => {
              const v = locQuery.trim();
              if (v && !locations.includes(v)) {
                Haptics.selectionAsync();
                setLocations((prev) => [...prev, v]);
              }
              setLocQuery('');
            }}
            returnKeyType="done"
            placeholder="Add a city"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.paper, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 14.5, color: colors.ink }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {locations
            .filter((l) => !SUGGESTED_LOCS.includes(l))
            .map((loc) => (
              <Pressable key={loc} onPress={() => toggle(loc)} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: colors.marketing, backgroundColor: colors.marketing + '12', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.marketing }}>{loc}</Text>
                <Ionicons name="close" size={13} color={colors.marketing} />
              </Pressable>
            ))}
          {SUGGESTED_LOCS.map((loc) => {
            const on = locations.includes(loc);
            return (
              <Pressable key={loc} onPress={() => toggle(loc)} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.marketing : colors.hairline, backgroundColor: on ? colors.marketing + '12' : colors.paper }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: on ? colors.marketing : colors.ink }}>{loc}</Text>
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 3: aha demo swipe ─────────────────────────────────────────────
  if (step === 4) {
    if (drafted) {
      // Don't reveal here — keep the draft "behind the curtain" while it writes
      // in the background. The reveal lands on the final step, by which point the
      // rest of onboarding has bought the generation all the time it needs (full
      // quality, no waiting). This step just teases it and pulls them forward.
      const who = outreach[0]?.contact?.name || (job?.company ? `someone at ${job.company}` : 'your contact');
      return (
        <OnboardingScaffold
          step={5}
          total={TOTAL}
          canBack={false}
          title="That's the magic"
          subtitle="Offerloop is writing your personalized intro right now. Keep going — it's ready by the time you finish."
          footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />}>
          <View style={{ alignItems: 'center', paddingTop: 6, gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.positive + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={34} color={colors.positive} />
            </View>
            <CraftingDraftCard who={who} company={job?.company} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-open-outline" size={14} color={colors.marketing} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.marketing }}>
                Finish setup to see the full intro
              </Text>
            </View>
          </View>
        </OnboardingScaffold>
      );
    }
    return (
      <OnboardingScaffold
        step={5}
        total={TOTAL}
        onBack={back}
        title="Try one swipe"
        subtitle="Swipe right to draft, left to pass. This one's real."
        footer={<Button label="I'll try it on the Feed" variant="ghost" fullWidth onPress={next} />}>
        {job ? (
          <View style={{ height: 520, marginHorizontal: -4 }}>
            <SwipeDeck jobs={jobs.slice(0, 1)} expanded={expanded} onToggleExpand={setExpanded} onSwiped={onDemoSwipe} />
          </View>
        ) : (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>Your feed is loading</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>We're pulling jobs that fit your targets. Your first swipe is waiting on the Feed.</Text>
          </Card>
        )}
      </OnboardingScaffold>
    );
  }

  // ── Step 4: how did you hear about us? (attribution) ───────────────────
  // ── Step 5: connect Gmail — the product runs ON their inbox ────────────
  if (step === 5) {
    const already = profile.gmailConnected;
    const doConnect = async () => {
      setGmailError(null);
      const res = await connectGmail();
      if (res === 'connected') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        next();
      } else if (res === 'failed') {
        setGmailError("That didn't go through. You can connect Gmail anytime from Profile.");
      }
    };
    return (
      <OnboardingScaffold
        step={6}
        total={TOTAL}
        onBack={back}
        title={already ? 'Gmail is connected' : 'Send from your own Gmail'}
        subtitle={
          already
            ? 'Drafts land in your Gmail and replies come back here. You are all set.'
            : 'Offerloop writes the email. You send it from your address, so it lands like a real message and replies come back to you.'
        }
        footer={
          already ? (
            <Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />
          ) : (
            <>
              <Button
                label={gmailConnecting ? 'Opening Google...' : 'Connect Gmail'}
                variant="brand"
                size="lg"
                fullWidth
                icon="mail-outline"
                disabled={gmailConnecting}
                onPress={doConnect}
              />
              <Button label="Not now" variant="ghost" fullWidth onPress={next} />
            </>
          )
        }>
        <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 18 }}>
          {gmailConnecting ? (
            <ActivityIndicator size="small" color={colors.marketing} />
          ) : (
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.marketing + '14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={already ? 'checkmark-circle' : 'mail-outline'} size={38} color={already ? colors.positive : colors.marketing} />
            </View>
          )}
        </View>
        <View style={{ gap: 12 }}>
          {[
            { icon: 'send-outline' as const, text: 'Send real emails from your address, not ours' },
            { icon: 'file-tray-full-outline' as const, text: 'Every draft waits in your Gmail drafts for approval' },
            { icon: 'chatbubble-ellipses-outline' as const, text: 'Replies are tracked so you never miss a follow-up' },
          ].map((row) => (
            <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.marketing + '12', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={row.icon} size={18} color={colors.marketing} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{row.text}</Text>
            </View>
          ))}
        </View>
        {gmailError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, textAlign: 'center', marginTop: 16 }}>{gmailError}</Text>
        ) : null}
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center', marginTop: 16, lineHeight: 17 }}>
          Google's screen will ask you to allow drafting and sending. Nothing sends without you tapping send.
        </Text>
      </OnboardingScaffold>
    );
  }

  if (step === 6) {
    return (
      <OnboardingScaffold
        step={7}
        total={TOTAL}
        onBack={back}
        title="How'd you find Offerloop?"
        subtitle="Last thing — it helps us reach more students like you."
        footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" disabled={!referral} onPress={chooseReferral} />}>
        <View style={{ gap: 10 }}>
          {REFERRAL_OPTIONS.map((o) => {
            const on = referral === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReferral(o.key);
                }}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.marketing : colors.hairline, backgroundColor: on ? colors.marketing + '0F' : colors.paper }}>
                <Ionicons name={o.icon} size={20} color={o.color} />
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>{o.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={20} color={colors.marketing} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 5: notification priming ───────────────────────────────────────
  if (step === 7) {
    const enable = () => {
      setNotificationsEnabled(true);
      next();
    };
    return (
      <OnboardingScaffold
        step={8}
        total={TOTAL}
        onBack={back}
        title="Know the moment they reply"
        subtitle="Networking is won on fast follow-ups. We'll ping you the second someone writes back — and when a draft is ready."
        footer={
          <>
            <Button label="Turn on notifications" variant="brand" size="lg" fullWidth onPress={enable} />
            <Button label="Maybe later" variant="ghost" fullWidth onPress={next} />
          </>
        }>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Image
            source={require('../../../assets/images/scout-wave.png')}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
        </View>
        <View style={{ gap: 12 }}>
          {[
            { icon: 'chatbubble-ellipses-outline' as const, text: 'A contact replied — reply back while you’re top of mind' },
            { icon: 'document-text-outline' as const, text: 'Your draft is ready to review and send' },
            { icon: 'sync-outline' as const, text: 'A Loop found new people overnight' },
          ].map((row) => (
            <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.marketing + '12', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={row.icon} size={18} color={colors.marketing} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{row.text}</Text>
            </View>
          ))}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 6: done — the payoff. By now the demo draft has had the whole rest
  // of onboarding to generate, so reveal the real intro (full quality, no wait).
  const demo = drafted ? outreach[0] : undefined;
  const demoReady = !!demo && demo.status !== 'drafting' && demo.status !== 'queued';
  const demoBody = (demo?.body || demo?.snippet || '').trim();
  const demoWho = demo?.contact?.name || 'your first contact';
  return (
    <OnboardingScaffold
      step={9}
      total={TOTAL}
      canBack={false}
      title={firstName ? `You're set, ${firstName}` : "You're set"}
      subtitle={
        demoReady
          ? 'Here’s the intro you just drafted. It’s waiting in your Inbox to review and send.'
          : 'Your first intro is being written and will be waiting in your Inbox in a moment. Here’s how Offerloop works:'
      }
      footer={<Button label="Start swiping" variant="brand" size="lg" fullWidth icon="albums-outline" onPress={finish} />}>
      {demoReady ? (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="document-text-outline" size={15} color={colors.marketing} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
                Your intro to {demoWho}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color={colors.positive} />
            </View>
            {demo?.subject ? (
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>{demo.subject}</Text>
            ) : null}
            <Text numberOfLines={9} style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
              {demoBody || 'Your intro is ready in your Inbox.'}
            </Text>
          </Card>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, textAlign: 'center', lineHeight: 18 }}>
            Tweak a line if you want, then send. A few of these a week and the replies start coming.
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 16, gap: 18 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.marketing + '14', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="rocket-outline" size={42} color={colors.marketing} />
          </View>
          <View style={{ gap: 10, width: '100%' }}>
            {['Swipe right on a job → we draft the intro', 'Replies land in your Inbox for fast follow-ups', 'Loops keep finding people on autopilot'].map((t) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.positive} />
                <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </OnboardingScaffold>
  );
}
