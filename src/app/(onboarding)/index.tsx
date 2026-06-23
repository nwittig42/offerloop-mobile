import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { savePreferredLocations, saveReferralSource, saveTargetTrack } from '@/api/endpoints/preferences';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * First-run onboarding — ONE screen, internal step state (no routing between
 * steps). Activation-first: confirm what we know from /me, set the goal, feel
 * the aha (a real draft), prime notifications, then drop into the feed. No
 * paywall. Reached opt-in via the dev Replay button; never force-traps.
 */

const TOTAL = 7;

// Acquisition channels — tuned to how students actually find Offerloop (referral,
// social, Reddit, on-campus clubs). Drives marketing attribution.
const REFERRAL_OPTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'friend', label: 'Friend or classmate', icon: 'people-outline' },
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' },
  { key: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
  { key: 'club', label: 'A campus club or event', icon: 'school-outline' },
  { key: 'search', label: 'Google / search', icon: 'search-outline' },
  { key: 'other', label: 'Somewhere else', icon: 'ellipsis-horizontal' },
];

type Track = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; industries: string[]; roles: string[] };
const TRACKS: Track[] = [
  { key: 'ib', label: 'Investment Banking', icon: 'trending-up-outline', industries: ['Investment Banking'], roles: ['Investment Banking Analyst'] },
  { key: 'consulting', label: 'Consulting', icon: 'briefcase-outline', industries: ['Consulting'], roles: ['Consultant'] },
  { key: 'tech', label: 'Tech', icon: 'hardware-chip-outline', industries: ['Technology'], roles: ['Software Engineer'] },
  { key: 'other', label: 'Something else', icon: 'compass-outline', industries: [], roles: [] },
];
const SUGGESTED_LOCS = ['New York', 'San Francisco', 'Chicago', 'Los Angeles', 'Boston', 'Remote'];

export default function Onboarding() {
  const router = useRouter();
  const colors = useColors();
  const { profile, updateProfile, jobs, draftJob, setNotificationsEnabled, completeOnboarding } = useApp();

  const [step, setStep] = useState(0);
  const [track, setTrack] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>(profile.preferredLocations ?? []);
  const [drafted, setDrafted] = useState(false);
  const [referral, setReferral] = useState<string | null>(null);

  const firstName = (profile.name || '').trim().split(/\s+/)[0] || 'there';
  const school = (profile.school || '').trim();
  const industry = (profile.industries?.[0] || 'your target roles').trim();
  const job = jobs[0];

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    completeOnboarding();
    // Explicit /(tabs) — bare '/' is ambiguous (both the feed and this screen
    // are group indexes at '/'), and from inside this group it resolves back
    // to the onboarding start, causing the "completed → back to start" loop.
    router.replace('/(tabs)');
  };

  const chooseTrack = () => {
    const t = TRACKS.find((x) => x.key === track);
    if (t && t.industries.length) {
      updateProfile({ industries: t.industries, targetRoles: t.roles });
      void saveTargetTrack({ targetRoles: t.roles, industries: t.industries }).catch(() => {});
    }
    next();
  };

  const saveLocations = () => {
    updateProfile({ preferredLocations: locations });
    void savePreferredLocations(locations).catch(() => {});
    next();
  };

  const doDemoSwipe = () => {
    if (job) draftJob(job.id);
    setDrafted(true);
  };

  const chooseReferral = () => {
    if (referral) void saveReferralSource(referral).catch(() => {});
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
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="school-outline" size={20} color={colors.accent} />
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
        footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" disabled={!track} onPress={chooseTrack} />}>
        <View style={{ gap: 12 }}>
          {TRACKS.map((t) => {
            const on = track === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTrack(t.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.hairline, backgroundColor: on ? colors.accent + '0F' : colors.paper }}>
                <Ionicons name={t.icon} size={22} color={on ? colors.accent : colors.inkSecondary} />
                <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>{t.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 2: confirm + locations ────────────────────────────────────────
  if (step === 2) {
    const toggle = (loc: string) => setLocations((p) => (p.includes(loc) ? p.filter((l) => l !== loc) : [...p, loc]));
    return (
      <OnboardingScaffold
        step={3}
        total={TOTAL}
        onBack={back}
        title="Here's the plan"
        subtitle={school ? `We'll prioritize people from ${school} and warm paths into ${industry}.` : `We'll prioritize warm paths into ${industry}.`}
        footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={saveLocations} />}>
        <Card style={{ gap: 6, marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>Your edge</Text>
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            Shared background is the strongest opener in a cold email. Offerloop leans on your school,
            path, and resume to find people most likely to reply — and writes the intro for you.
          </Text>
        </Card>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink, marginBottom: 4 }}>Where do you want to land?</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, marginBottom: 12 }}>Optional — nudges your feed toward those cities.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED_LOCS.map((loc) => {
            const on = locations.includes(loc);
            return (
              <Pressable key={loc} onPress={() => toggle(loc)} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.accent : colors.hairline, backgroundColor: on ? colors.accent + '12' : colors.paper }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: on ? colors.accent : colors.ink }}>{loc}</Text>
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 3: aha demo swipe ─────────────────────────────────────────────
  if (step === 3) {
    if (drafted) {
      return (
        <OnboardingScaffold
          step={4}
          total={TOTAL}
          canBack={false}
          title="That's the magic"
          subtitle="We're drafting a personalized intro right now — it'll be waiting in your Inbox. That's all a swipe does."
          footer={<Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />}>
          <View style={{ alignItems: 'center', paddingTop: 12, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.positive + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={38} color={colors.positive} />
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
              Review it, tweak a line if you want, and send. Do that a few times a week and the replies start coming.
            </Text>
          </View>
        </OnboardingScaffold>
      );
    }
    return (
      <OnboardingScaffold
        step={4}
        total={TOTAL}
        onBack={back}
        title="Try one swipe"
        subtitle="Swipe right on a job and Offerloop drafts a tailored intro to someone who works there. Here's a real one from your feed."
        footer={
          job ? (
            <Button label="Draft my first intro" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={doDemoSwipe} />
          ) : (
            <Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />
          )
        }>
        {job ? (
          <Card style={{ gap: 10 }}>
            <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.accent + '14' }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.accent, letterSpacing: 0.4 }}>FROM YOUR FEED</Text>
            </View>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.heading, lineHeight: 23 }}>{job.title}</Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
              {job.company}
              {job.location ? <Text style={{ color: colors.inkTertiary }}>{`  ·  ${job.location}`}</Text> : null}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
              <Ionicons name="person-add-outline" size={15} color={colors.inkSecondary} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>We'll find someone here worth reaching and write the intro.</Text>
            </View>
          </Card>
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
  if (step === 4) {
    return (
      <OnboardingScaffold
        step={5}
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
                onPress={() => setReferral(o.key)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.hairline, backgroundColor: on ? colors.accent + '0F' : colors.paper }}>
                <Ionicons name={o.icon} size={20} color={on ? colors.accent : colors.inkSecondary} />
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>{o.label}</Text>
                {on ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 5: notification priming ───────────────────────────────────────
  if (step === 5) {
    const enable = () => {
      setNotificationsEnabled(true);
      next();
    };
    return (
      <OnboardingScaffold
        step={6}
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
        <View style={{ gap: 12 }}>
          {[
            { icon: 'chatbubble-ellipses-outline' as const, text: 'A contact replied — reply back while you’re top of mind' },
            { icon: 'document-text-outline' as const, text: 'Your draft is ready to review and send' },
            { icon: 'sync-outline' as const, text: 'A Loop found new people overnight' },
          ].map((row) => (
            <View key={row.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent + '12', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={row.icon} size={18} color={colors.accent} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{row.text}</Text>
            </View>
          ))}
        </View>
      </OnboardingScaffold>
    );
  }

  // ── Step 6: done ───────────────────────────────────────────────────────
  return (
    <OnboardingScaffold
      step={7}
      total={TOTAL}
      canBack={false}
      title={firstName ? `You're set, ${firstName}` : "You're set"}
      subtitle="Your feed is tuned to your targets. Swipe right to draft, check the Inbox for replies, and set a Loop to keep it running while you study."
      footer={<Button label="Start swiping" variant="brand" size="lg" fullWidth icon="albums-outline" onPress={finish} />}>
      <View style={{ alignItems: 'center', paddingTop: 16, gap: 18 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent + '14', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="rocket-outline" size={42} color={colors.accent} />
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
    </OnboardingScaffold>
  );
}
