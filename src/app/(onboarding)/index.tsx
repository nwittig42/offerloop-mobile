import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SwipeDeck from '@/components/feed/SwipeDeck';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import GmailLogo from '@/components/auth/GmailLogo';
import DraftPreviewCard from '@/components/onboarding/DraftPreviewCard';
import SwipeDemoHint from '@/components/onboarding/SwipeDemoHint';
import { track } from '@/lib/analytics';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/** This screen's slice of the shared flow (see lib/onboardingFlow). */
const STEP_NAMES = ONBOARDING_STEPS.slice(1);

/**
 * First-run onboarding, POST-account half. One screen, internal step state (no
 * routing between steps): locations, the aha demo swipe, Gmail, notifications,
 * then the feed. No paywall. Reached opt-in via the dev Replay button; never
 * force-traps.
 *
 * Was nine steps until 2026-08-13. The resume step and a feed preview moved to
 * the sibling route ./intake.tsx, which the auth gate enters FIRST; that screen
 * hands off here when it is done. The welcome, goal, and referral steps were
 * cut outright. By the time this runs, the profile already has the resume and
 * whatever target the resume implied.
 *
 * (Those two steps briefly lived in (auth), ahead of the account, with a
 * holding pen and a post-signup flush. Nick moved the account first and all of
 * that came out.) Attribution no longer has an onboarding home; if it comes
 * back, put it somewhere after activation, not before it.
 */

const TOTAL = 3;



/** Same mark and slot the resume step uses, replacing Skip. */
function OfferloopMark() {
  return (
    <Image
      source={require('../../../assets/images/offerloop-mark.png')}
      style={{ width: 30, height: 28 }}
      resizeMode="contain"
      accessibilityLabel="Offerloop"
    />
  );
}

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { profile, jobs, setNotificationsEnabled, completeOnboarding, showToast } = useApp();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [trackChoice] = useState<string | null>(null);
  const [swiped, setSwiped] = useState(false);
  // A LOCAL copy of the deck. The card used to advance only because draftJob
  // removed it from the store, which meant the teaching swipe was doing real
  // work: a live contact search, real credits, real outcome toasts. Holding
  // the three cards here lets them swipe freely and changes nothing.
  const [demoJobs, setDemoJobs] = useState<Job[]>([]);
  useEffect(() => {
    if (!demoJobs.length && jobs.length) setDemoJobs(jobs.slice(0, 3));
  }, [jobs, demoJobs.length]);
  const [applied, setApplied] = useState(false);
  const appliedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (appliedTimer.current) clearTimeout(appliedTimer.current);
  }, []);
  const [referral] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();
  const [gmailError, setGmailError] = useState<string | null>(null);


  // Funnel: one event per step view, so the CMO can see exactly where students
  // drop off in onboarding.
  useEffect(() => {
    track('onboarding_step_viewed', {
      step: stepNumber(STEP_NAMES[step]),
      total: ONBOARDING_TOTAL,
      name: STEP_NAMES[step],
    });
  }, [step]);

  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));

  /**
   * Back for EVERY step on this screen. Step 0 here is step 3 of the whole
   * flow, so it hands off to the intake screen at the feed preview instead of
   * clamping at zero and doing nothing, which is what it used to do.
   *
   * One handler on purpose: the demo step alone renders two different
   * scaffolds (pre-swipe and post-draft), and fixing them one at a time is how
   * the dead arrow survived the first attempt.
   */
  const back = () => {
    if (step > 0) {
      setStep((s) => Math.max(0, s - 1));
      return;
    }
    router.replace('/(onboarding)/intake?step=1');
  };

  const finish = () => {
    track('onboarding_completed', {
      target_track: trackChoice,
      referral_source: referral,
      // Whether they tried the teaching swipe. Nothing is drafted during
      // onboarding any more, so this is the swipe itself, not an outcome.
      swiped,
    });
    // Navigate via the auth gate, NOT a direct router.replace here: the gate
    // already routes onboardingDone + inOnboarding -> /(tabs). Two navigations
    // firing at once (this replace + the gate's) crashed react-native-screens
    // mid-transition. Setting the flag lets the gate own the single move.
    completeOnboarding();
  };

  // A real swipe in onboarding: right drafts (and fires the success state),
  // left passes. Same punchy haptics as the Feed so the aha feels real.
  const onDemoSwipe = (direction: 'left' | 'right' | 'up', j: Job) => {
    if (direction === 'up') return; // save isn't part of the onboarding demo
    // Left counts too: the lesson is the gesture, not which way they went.
    setSwiped(true);
    if (direction === 'right') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);
      // Deliberately does NOT draft. This is a teaching swipe: calling
      // draftJob ran a real contact search against the live backend, spent
      // credits, and surfaced its own outcome toasts ("No contact found at
      // SchoolMint"), which is a real result reported inside a demo. The
      // lesson is the gesture; the real thing happens on the Feed.
      // A pill that floats in and leaves, rather than a screen that interrupts
      // them mid-lesson. They can keep swiping the rest of the deck.
      setApplied(true);
      if (appliedTimer.current) clearTimeout(appliedTimer.current);
      appliedTimer.current = setTimeout(() => setApplied(false), 1800);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Advance the local deck. Nothing leaves the app.
    setDemoJobs((prev) => prev.filter((x) => x.id !== j.id));
  };

  // ── Step 3: aha demo swipe ─────────────────────────────────────────────
  if (step === 0) {
    // NOTE(2026-08-11): a PersonReveal teaching beat with fixture content
    // ("Sample Person at Acme Test Co") lived here for one release. Rylan
    // cut it: fake sample data read as hollow, not as teaching. The real
    // payoff stays the person-first toast when an actual contact lands.
    return (
      <OnboardingScaffold
        step={stepNumber(STEP_NAMES[step])}
        total={ONBOARDING_TOTAL}
      headerRight={<OfferloopMark />}
        onBack={back}
        title="Try one swipe"
        subtitle="Swipe right to apply, left to pass."
        footer={
          // Appears once they have swiped at least one card, so the lesson
          // happens before the exit exists. After that they can keep swiping
          // the rest of the deck or move on, their choice.
          swiped ? (
            <Button
              label="Continue"
              variant="brand"
              size="lg"
              fullWidth
              icon="arrow-forward"
              onPress={next}
            />
          ) : null
        }>
        {demoJobs.length ? (
          <View style={{ height: 520, marginHorizontal: -4 }}>
            {/* Wraps the deck so the card leans on the same clock as the hand. */}
            <SwipeDemoHint active={!swiped}>
              <SwipeDeck
                jobs={demoJobs}
                expanded={expanded}
                onToggleExpand={setExpanded}
                onSwiped={onDemoSwipe}
                rightStamp="apply"
              />
            </SwipeDemoHint>

            {/* Floats over the deck and leaves on its own, so the next card is
                already swipeable underneath it. */}
            {applied ? (
              <Animated.View
                entering={FadeInDown.duration(180)}
                exiting={FadeOut.duration(220)}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  top: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: colors.ink,
                }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.positive} />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.paper }}>
                  Applied
                </Text>
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>Your feed is loading</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>We’re pulling jobs that fit your targets. Your first swipe is waiting on the Feed.</Text>
          </Card>
        )}
      </OnboardingScaffold>
    );
  }

  // ── Step 4: how did you hear about us? (attribution) ───────────────────
  // ── Step 5: connect Gmail, the product runs ON their inbox ─────────────
  if (step === 1) {
    const already = profile.gmailConnected;
    // Straight to the last step, skipping notifications: every reason we give
    // for turning them on (a reply landed, a draft is ready) depends on Gmail
    // being connected, so without it the ask has nothing behind it.
    // Notifications only make sense once Gmail is connected (every reason we
    // give for them is a reply or a draft landing there), so declining Gmail
    // ends onboarding here rather than asking a question with nothing behind it.
    const skipNotifications = () => finish();

    // How they signed in decides how we ask (POST-BUILD19-ONBOARDING-EMAIL.md,
    // direction set by Rylan 2026-08-19). Sign-in grants identity only; the
    // mail scopes the product runs on come from THIS step, so the step never
    // disappears, it adapts:
    //   .edu Google sign-in    -> one tap, that same inbox, preselected
    //   personal-gmail sign-in -> school email first, their Gmail as the
    //                             quiet second path (the .edu opportunity)
    //   anything else          -> the original step, unchanged
    const signInEmail = (user?.email || '').trim().toLowerCase();
    const googleSignIn = !!user?.providerData?.some((p) => p.providerId === 'google.com');
    const eduSignIn = googleSignIn && signInEmail.endsWith('.edu');
    const personalGmailSignIn = googleSignIn && signInEmail.endsWith('@gmail.com');

    const doConnect = async (account?: 'other') => {
      setGmailError(null);
      const res = await connectGmail(account ? { account } : undefined);
      if (res === 'connected') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (account === 'other') {
          showToast('Nice. Your outreach now comes from your school address.');
        }
        next();
      } else if (res === 'failed') {
        setGmailError(
          account === 'other'
            ? "That inbox didn't connect. If your school runs Outlook, use the Gmail you signed in with below. Your outreach still comes from you."
            : "That didn't go through. You can connect Gmail anytime from Profile.",
        );
      }
    };

    const title = already
      ? 'Gmail is connected'
      : eduSignIn
        ? 'Connect the inbox you signed in with'
        : personalGmailSignIn
          ? 'Send from your school email'
          : 'Send from your own Email';
    const subtitle = already
      ? 'Drafts land in your Gmail and replies come back here. You are all set.'
      : eduSignIn
        ? `We draft and send from ${signInEmail}, and track every reply here. Your school address already says current student. One tap and you are set.`
        : personalGmailSignIn
          ? 'You signed in with your personal Gmail, which works fine. But recruiters take a message from a school address more seriously, it says current student before they read a word. If your school email runs on Gmail (most do), connect that one instead. It takes the same one tap.'
          : 'We draft and send personalized emails for you, directly from your own email address. When someone replies, we track it so you never miss a follow-up.';

    // The big ink primary this step has always used; label and target adapt.
    const primaryLabel = eduSignIn
      ? 'Connect this inbox'
      : personalGmailSignIn
        ? 'Connect my school email'
        : 'Connect Gmail';
    const primaryAccount = personalGmailSignIn ? ('other' as const) : undefined;

    return (
      <OnboardingScaffold
        step={stepNumber(STEP_NAMES[step])}
        total={ONBOARDING_TOTAL}
      headerRight={<OfferloopMark />}
        onBack={back}
        title={title}
        subtitle={subtitle}
        footer={
          already ? (
            <Button label="Continue" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={next} />
          ) : (
            <>
              <Pressable
                onPress={() => void doConnect(primaryAccount)}
                disabled={gmailConnecting}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                // Static object: function-form styles vanish in release bundles.
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  minHeight: 58,
                  borderRadius: 10,
                  backgroundColor: colors.ink,
                  shadowColor: colors.ink,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.22,
                  shadowRadius: 14,
                  elevation: 6,
                  opacity: gmailConnecting ? 0.7 : 1,
                }}>
                {gmailConnecting ? (
                  <ActivityIndicator size="small" color={colors.paper} />
                ) : personalGmailSignIn ? (
                  <Ionicons name="school" size={22} color={colors.paper} />
                ) : (
                  <GmailLogo size={24} />
                )}
                <Text
                  style={{ fontFamily: fonts.sansSemibold, fontSize: 17.5, color: colors.paper }}>
                  {gmailConnecting ? 'Opening Google...' : primaryLabel}
                </Text>
              </Pressable>
              {personalGmailSignIn ? (
                <Button
                  label="Use this Gmail instead"
                  variant="ghost"
                  fullWidth
                  disabled={gmailConnecting}
                  onPress={() => void doConnect()}
                />
              ) : null}
              <Button label="Not now" variant="ghost" fullWidth onPress={skipNotifications} />
            </>
          )
        }>
        {already ? (
          <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 18 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.marketing + '14', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={38} color={colors.positive} />
            </View>
          </View>
        ) : null}
        {already ? null : <DraftPreviewCard />}

        {gmailError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, textAlign: 'center', marginTop: 16 }}>{gmailError}</Text>
        ) : null}
      </OnboardingScaffold>
    );
  }

  // ── Step 5: notification priming ───────────────────────────────────────
  if (step === 2) {
    const enable = () => {
      setNotificationsEnabled(true);
      finish();
    };
    return (
      <OnboardingScaffold
        step={stepNumber(STEP_NAMES[step])}
        total={ONBOARDING_TOTAL}
      headerRight={<OfferloopMark />}
        onBack={back}
        title="Know the moment they reply"
        subtitle="Last one. Networking is won on fast follow-ups, so we'll tell you the moment someone writes back. Then your feed is waiting."
        footer={
          <>
            <Button
              label="Turn on notifications"
              variant="brand"
              size="lg"
              fullWidth
              onPress={enable}
            />
            <Button label="Not now, take me in" variant="ghost" fullWidth onPress={finish} />
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
            { icon: 'chatbubble-ellipses-outline' as const, text: 'A contact replied: follow up while you’re top of mind' },
            { icon: 'document-text-outline' as const, text: 'Your draft is ready to review and send' },
            { icon: 'flash-outline' as const, text: 'An auto-apply finished, or needs a decision from you' },
            { icon: 'cafe-outline' as const, text: 'Your meeting prep is ready before the chat' },
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

}
