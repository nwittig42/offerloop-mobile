import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import GlassBar from '@/components/GlassBar';
import NightSky from '@/components/NightSky';
import Header from '@/components/Header';
import ReferralCard from '@/components/ReferralCard';
import { shouldShowReferralPromptOnWin } from '@/lib/referralPrompt';
import PlanBorder from '@/components/PlanBorder';
import PlayfulPass from '@/components/feed/PlayfulPass';
import SendButton from '@/components/feed/SendButton';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApplicationProfile, isProfileReady } from '@/api/endpoints/autoApply';
import { RESUME_BUILDER_LIVE } from '@/api/endpoints/resumeBuilder';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { AUTO_APPLY_CREDITS } from '@/api/endpoints/scoutActions';
import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { UpgradeNudgeCard } from '@/components/resume/UpgradeNudgeCard';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import { ActionCircle } from '@/components/ui/Button';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * Feed: the swipe-to-draft hero. Credits on the left of the banner, full
 * wordmark centered, Scout and the bell on the right (via Header). The
 * action row floats in a liquid-glass bar low on the screen, riding just
 * above the tab bar: undo, pass, draft, attach. Tapping anywhere on the
 * card expands it. Every number comes from store state, never inline.
 */
/** The same brand watercolor ridgeline as the Scout tab, but the DAY art — the
 *  original light periwinkle wash, not the night-tinted variant. Scout's version
 *  is baked dark for its deep-blue canvas; the feed's canvas is light, so the
 *  night art would read as a bruise across the bottom of the deck. Sits behind
 *  everything, purely decorative, and never eats a touch. */
const FEED_RIDGES = require('../../../assets/images/ridges-day.png');

function FeedRidgeline() {
  // Light mode only: in dark mode this day art reads as a washed-gray ghost
  // (Rylan flagged it); NightSky supplies the night ridgeline instead.
  const { pref } = useTheme();
  if (pref === 'dark') return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' }}>
      <Image
        source={FEED_RIDGES}
        resizeMode="cover"
        // Held back so it stays atmosphere, not decoration competing with the
        // card the user is actually reading.
        style={{ width: '100%', height: '100%', opacity: 0.55 }}
      />
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const {
    jobs,
    profile,
    unreadCount,
    canUndo,
    swipeSettings,
    updateSwipeSettings,
    draftsLeft,
    costPerSwipe,
    passJob,
    saveJob,
    draftJob,
    autoApplyJob,
    outreach,
    undoLastPass,
    resetDeck,
    rerollFeed,
    rerolling,
    showToast,
    feedState,
  } = useApp();
  const colors = useColors();
  const queryClient = useQueryClient();

  // Auto-apply ask-first flow, shared by the pill and the upgrade nudge.
  const askEnableAutoApply = useCallback(() => {
    Alert.alert(
      'Turn on auto-apply?',
      `When a job supports it, a right swipe will also submit an application for you (${AUTO_APPLY_CREDITS} credits per apply). You'll need your application profile set up, and we'll walk you through it if anything is missing.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Turn on',
          onPress: () => {
            updateSwipeSettings({ autoApply: true });
            showToast('Auto-apply on for eligible jobs');
          },
        },
      ],
    );
  }, [updateSwipeSettings, showToast]);

  // Earned-upgrade nudge: only after real drafting activity, only while
  // auto-apply is off, dismissed forever on request (persisted on device).
  const [nudgeDismissed, setNudgeDismissed] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem('offerloop.autoApplyNudgeDismissed')
      .then((v) => setNudgeDismissed(v === '1'))
      .catch(() => {});
  }, []);
  const dismissNudge = useCallback(() => {
    setNudgeDismissed(true);
    AsyncStorage.setItem('offerloop.autoApplyNudgeDismissed', '1').catch(() => {});
  }, []);
  const showNudge = !swipeSettings.autoApply && !nudgeDismissed && outreach.length >= 2;
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [expanded, setExpanded] = useState(false);
  const [referralPromptOpen, setReferralPromptOpen] = useState(false);
  // App limit-model (2026-07-10): every tier can auto-apply, bounded by credits
  // (AUTO_APPLY_CREDITS each), not walled by plan. The backend allows all tiers;
  // this used to be Pro/Elite-only and silently no-op'd auto-apply for free.
  const canAutoApply = true;

  // Application-profile readiness — gates auto-apply. Only fetched when the user
  // has auto-apply on and the tier for it; cached so the swipe path is instant.
  const appProfileQuery = useQuery({
    queryKey: ['applicationProfile'],
    queryFn: getApplicationProfile,
    enabled: swipeSettings.autoApply && canAutoApply,
  });
  const profileReady = isProfileReady(appProfileQuery.data);
  // Show the "set up your profile" prompt only once we know it's incomplete.
  const needsApplyProfile =
    swipeSettings.autoApply && canAutoApply && !!appProfileQuery.data && !profileReady;

  const top = jobs[0];
  // Credits are the only meter now — a swipe is affordable, or it isn't. There
  // is no separate stamina token and no cooldown to wait out.
  const canDraft = draftsLeft >= 1;
  const outOfCredits = draftsLeft === 0;

  // The liquid-glass action bar shrinks and settles down when the job card
  // is enlarged, giving the reader room, then springs back on collapse.
  const barShrink = useSharedValue(0);
  useEffect(() => {
    barShrink.value = withTiming(expanded ? 1 : 0, {
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [expanded, barShrink]);
  const barStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - 0.18 * barShrink.value },
      { translateY: 10 * barShrink.value },
    ],
    opacity: 1 - 0.15 * barShrink.value,
  }));

  // The active swipe button grows with the drag, so the gesture and the
  // button feel like one motion. The other button eases back slightly.
  const dragX = useSharedValue(0);
  const SWIPE_FULL = 110;
  const passStyle = useAnimatedStyle(() => {
    const t = interpolate(dragX.value, [-SWIPE_FULL, 0], [1, 0], Extrapolation.CLAMP);
    return { transform: [{ scale: 1 + 0.22 * t }] };
  });
  const draftStyle = useAnimatedStyle(() => {
    const t = interpolate(dragX.value, [0, SWIPE_FULL], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 1 + 0.22 * t }] };
  });

  // Auto-apply is on but the application profile is unfinished: the card hit
  // the wall (SwipeDeck blockRight). The doors sheet routes each user through
  // whichever resume path they can actually walk (upload now, build from
  // LinkedIn once the backend flag flips, or bail politely).
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const onApplyProfileBlocked = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDoorsOpen(true);
  }, []);

  const doorUpload = useCallback(async () => {
    if (resumeUploading) return;
    try {
      const file = await pickResume();
      if (!file) return;
      setResumeUploading(true);
      await uploadResume(file);
      setDoorsOpen(false);
      showToast('Resume added. One more minute of basics.');
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.push('/application-profile');
    } catch {
      showToast('Could not add that file. Try a PDF.');
    } finally {
      setResumeUploading(false);
    }
  }, [resumeUploading, showToast, queryClient, router]);

  const doorLinkedin = useCallback(() => {
    setDoorsOpen(false);
    if (!RESUME_BUILDER_LIVE) {
      showToast('Building from LinkedIn arrives this week. Upload works today.');
      return;
    }
    router.push('/resume-preview');
  }, [router, showToast]);

  // Stable across renders so SwipeDeck (memoized) doesn't re-render on every
  // store change / 60s poll — only when the swipe-relevant inputs change.
  const handleSwiped = useCallback((direction: 'left' | 'right' | 'up', job: Job) => {
    if (direction === 'up') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      saveJob(job.id);
      showToast('Saved for later');
      return;
    }
    if (direction === 'right') {
      if (!canDraft) {
        // Out of swipes: bounce, don't spend. The card snaps back. With IAP
        // live this is the limit-hit moment, so offer the real fix.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (iapAvailable()) presentPaywall({ context: 'draft' });
        else showToast('Out of credits — drafts resume when your credits reset');
        return;
      }
      // A punchy double-buzz on the commit so the draft feels real.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);
      draftJob(job.id);
      // Peak-dopamine moment — paced referral nudge (every 3rd win, ~daily cap).
      void shouldShowReferralPromptOnWin(Date.now()).then((show) => {
        if (show) setReferralPromptOpen(true);
      });
      // Auto-apply on + eligible → deduped background submission (surfaces in
      // Network › Applied). autoApplyJob blocks a second apply to the same job.
      if (swipeSettings.autoApply && job.autoApplyEligible && canAutoApply) {
        autoApplyJob(job);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(job.id);
    }
  }, [canDraft, draftJob, passJob, saveJob, autoApplyJob, swipeSettings.autoApply, canAutoApply, showToast]);

  // The pill was an outline around empty space — a plan border with nothing
  // inside it, which read as unfinished rather than minimal. Fill it with a soft
  // brand wash so it has presence at a glance without shouting over the deck.
  // The PlanBorder still carries the tier; this just gives the card a body.
  const creditsPill = (
    <Pressable onPress={() => router.push('/credits')} accessibilityRole="button">
      <PlanBorder plan={profile.plan} radius={9}>
        <LinearGradient
          colors={[colors.accent + '2E', colors.accent + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}>
          <Ionicons name="flash" size={12} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.ink }}>
            {profile.credits}
          </Text>
        </LinearGradient>
      </PlanBorder>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.feedBg }}>
      <NightSky />
      <FeedRidgeline />
      <Header
        title="Offerloop"
        logo
        left={creditsPill}
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      {feedState.loading ? (
        <FeedSkeleton />
      ) : feedState.error ? (
        <StateView
          icon="cloud-offline-outline"
          tone="error"
          title="Couldn’t load your feed"
          body="We couldn’t reach Offerloop to pull your ranked jobs. Check your connection and try again."
          actionLabel="Try again"
          onAction={feedState.retry}
        />
      ) : top ? (
        <View style={{ flex: 1, paddingHorizontal: 18 }}>
          {/* One number, and it's true: what the wallet can still pay for. The
              old stamina bar counted a token that no server enforced and that a
              force-quit reset anyway. */}
          <Pressable onPress={() => router.push('/credits')}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 13,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingTop: 6,
              }}>
              {draftsLeft} {draftsLeft === 1 ? 'draft' : 'drafts'} left
              <Text style={{ color: colors.inkTertiary }}>
                {'  ·  '}{costPerSwipe} credits each
              </Text>
            </Text>
          </Pressable>

          {/* Auto-apply is on but the application profile isn't set up, so a
              right swipe can't actually apply yet — point them to finish it. */}
          {needsApplyProfile ? (
            <Pressable
              onPress={() => router.push('/application-profile')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.waiting + '1A',
                borderWidth: 1,
                borderColor: colors.waiting + '40',
              }}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.waiting} />
              <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                Set up your application profile to auto-apply
              </Text>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.waiting }}>
                Set up
              </Text>
            </Pressable>
          ) : null}

          {/* Out of credits used to grey out and DISABLE the whole deck. But
              passing and saving cost nothing, and browsing is how you line up
              tomorrow's targets — only DRAFTING is unaffordable. Keep the deck
              live; the right-swipe bounces on its own via canDraft. */}
          {showNudge ? (
            <View style={{ marginTop: 8 }}>
              <UpgradeNudgeCard onTry={askEnableAutoApply} onDismiss={dismissNudge} />
            </View>
          ) : null}
          <View style={{ flex: 1, marginTop: 8, paddingBottom: 56 }}>
            <SwipeDeck
              ref={deckRef}
              jobs={jobs}
              expanded={expanded}
              onToggleExpand={setExpanded}
              onSwiped={handleSwiped}
              drag={dragX}
              blockRight={needsApplyProfile && !!top?.autoApplyEligible}
              onBlockedRight={onApplyProfileBlocked}
              rightStamp={
                swipeSettings.autoApply && canAutoApply && top?.autoApplyEligible
                  ? 'apply'
                  : 'draft'
              }
            />
            {/* Undo, top-right over the card (Sorce-style). Outside the deck's
                gesture so tapping it never swipes or expands. */}
            {canUndo && !expanded ? (
              <Pressable
                onPress={undoLastPass}
                accessibilityLabel="Undo last swipe"
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 18,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.paper,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="arrow-undo" size={17} color={colors.inkSecondary} />
              </Pressable>
            ) : null}
          </View>

          {outOfCredits ? null : (
            <Animated.View
              pointerEvents="box-none"
              style={[
                {
                  position: 'absolute',
                  bottom: 10,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                },
                barStyle,
              ]}>
              <GlassBar style={{ gap: 6 }}>
                {/* Shuffle replaced share here (Rylan 2026-08-10): sharing
                    confused people, and "show me new roles" deserved a spot
                    in reach instead of living deep in swipe settings. */}
                <ActionCircle
                  icon="shuffle-outline"
                  size={38}
                  onPress={() => {
                    if (!rerolling) rerollFeed();
                  }}
                />
                <ActionCircle
                  icon="bookmark-outline"
                  size={40}
                  onPress={() => deckRef.current?.save()}
                />
                <Animated.View style={passStyle}>
                  <PlayfulPass size={58} onPress={() => deckRef.current?.swipe('left')} />
                </Animated.View>
                <Animated.View style={draftStyle}>
                  <SendButton
                    size={58}
                    disabled={!canDraft}
                    onPress={() => deckRef.current?.swipe('right')}
                  />
                </Animated.View>
                {/* Auto-apply MODE control. A bare bolt read as "boost", not
                    "submit applications for me" (Rylan, 2026-08-10), so the
                    control says its name. Turning it ON asks first: it spends
                    credits and acts on the user's behalf. */}
                <Pressable
                  onPress={() => {
                    if (swipeSettings.autoApply) {
                      updateSwipeSettings({ autoApply: false });
                      showToast('Auto-apply off. Swipes just draft outreach.');
                      return;
                    }
                    askEnableAutoApply();
                  }}
                  accessibilityLabel="Auto-apply on swipe"
                  accessibilityState={{ selected: swipeSettings.autoApply }}>
                  {/* Compact two-line pill: the single-line label pushed the
                      outer buttons off screen edges (Rylan's screenshot,
                      2026-08-10), worse with enlarged text. Fixed-size chrome,
                      so font scaling is pinned here. */}
                  {swipeSettings.autoApply ? (
                    <LinearGradient
                      colors={['#2563EB', '#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        height: 46,
                        borderRadius: 23,
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}>
                      <Ionicons name="flash" size={15} color="#FFFFFF" />
                      <Text
                        maxFontSizeMultiplier={1}
                        style={{
                          fontFamily: fonts.sansSemibold,
                          fontSize: 10,
                          lineHeight: 12,
                          color: '#FFFFFF',
                        }}>
                        Auto{'\n'}apply
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View
                      style={{
                        height: 46,
                        borderRadius: 23,
                        paddingHorizontal: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        backgroundColor: colors.paper2,
                        borderWidth: 1,
                        borderColor: colors.hairline,
                      }}>
                      <Ionicons name="flash-outline" size={15} color={colors.inkTertiary} />
                      <Text
                        maxFontSizeMultiplier={1}
                        style={{
                          fontFamily: fonts.sansMedium,
                          fontSize: 10,
                          lineHeight: 12,
                          color: colors.inkTertiary,
                        }}>
                        Auto{'\n'}apply
                      </Text>
                    </View>
                  )}
                </Pressable>
                <ActionCircle
                  icon="options-outline"
                  size={38}
                  onPress={() => router.push('/swipe-settings')}
                />
              </GlassBar>
            </Animated.View>
          )}
        </View>
      ) : (
        <StateView
          icon="checkmark-done-circle-outline"
          title="You’re all caught up"
          body="You’ve been through the roles we ranked for you. Pull in a fresh set — including ones a little outside your usual field — or restart the deck to revisit the ones you passed."
          actionLabel="Show me new roles"
          onAction={rerollFeed}
          actionLoading={rerolling}
          secondaryLabel="Restart deck"
          onSecondary={resetDeck}
        />
      )}

      {/* The resume doors: shown when the swipe wall blocks an auto-apply
          because the application profile is unfinished. Same bottom-sheet
          pattern as the referral nudge below. */}
      <Modal
        visible={doorsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDoorsOpen(false)}>
        <Pressable
          onPress={() => setDoorsOpen(false)}
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
              hasResume={!!profile.hasResume}
              hasLinkedin={!!profile.linkedinUrl?.trim()}
              onUpload={doorUpload}
              onBuildFromLinkedin={doorLinkedin}
              onDescribe={() => {
                setDoorsOpen(false);
                router.push('/resume-from-text');
              }}
              onNotNow={() => setDoorsOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post-win referral nudge — paced (every 3rd draft, ~daily cap) so it's a
          celebration, not a nag. Dismissible; ReferralCard hides itself if the
          endpoint isn't live. */}
      <Modal
        visible={referralPromptOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReferralPromptOpen(false)}>
        <Pressable
          onPress={() => setReferralPromptOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 36,
              gap: 12,
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink }}>
              Nice — you’re on a roll.
            </Text>
            <ReferralCard />
            <Pressable onPress={() => setReferralPromptOpen(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkTertiary, textAlign: 'center' }}>
                Maybe later
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
