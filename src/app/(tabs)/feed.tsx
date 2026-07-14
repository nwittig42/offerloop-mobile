import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, Share, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { APP_DOWNLOAD_URL } from '@/lib/links';
import GlassBar from '@/components/GlassBar';
import Header from '@/components/Header';
import PlanBorder from '@/components/PlanBorder';
import CooldownView from '@/components/feed/CooldownView';
import PlayfulPass from '@/components/feed/PlayfulPass';
import SendButton from '@/components/feed/SendButton';
import StaminaBar from '@/components/feed/StaminaBar';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';
import { getApplicationProfile, isProfileReady } from '@/api/endpoints/autoApply';
import { ActionCircle } from '@/components/ui/Button';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
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
    swipesAvailable,
    swipeBatchSize,
    cooldownSecondsLeft,
    rechargeNow,
    passJob,
    saveJob,
    draftJob,
    autoApplyJob,
    undoLastPass,
    resetDeck,
    rerollFeed,
    rerolling,
    showToast,
    feedState,
  } = useApp();
  const colors = useColors();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [expanded, setExpanded] = useState(false);
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
  const canDraft = swipesAvailable >= 1;
  const outOfSwipes = swipesAvailable === 0;

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
        // Out of swipes: bounce, don't spend. The card snaps back.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast('Out of swipes, recharging');
        return;
      }
      // A punchy double-buzz on the commit so the draft feels real.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);
      draftJob(job.id);
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

  // Share the top card (native share sheet).
  //
  // This used to send a bare sentence with NO link — the most viral moment in
  // the app ("look at this role") and it handed the recipient nowhere to go.
  // Now it carries the job (title, company, location, comp) and a link to get
  // the app, so a share can actually become a user.
  const shareTopJob = useCallback(() => {
    const job = jobs[0];
    if (!job) return;
    const facts = [job.location, job.compensation, job.workArrangement]
      .filter(Boolean)
      .join(' · ');
    const message = [
      `${job.title} at ${job.company}`,
      facts,
      '',
      'Found it on Offerloop — it finds real people at the company and drafts your intro for you.',
      APP_DOWNLOAD_URL,
    ]
      .filter((l) => l !== undefined && l !== null)
      .join('\n');
    Share.share({
      message,
      // iOS renders a rich preview for the url and appends it; Android folds it
      // into the message above.
      ...(Platform.OS === 'ios' ? { url: APP_DOWNLOAD_URL } : {}),
    }).catch(() => {});
  }, [jobs]);

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
          {!outOfSwipes ? (
            <StaminaBar
              available={swipesAvailable}
              batchSize={swipeBatchSize}
              secondsLeft={cooldownSecondsLeft}
              onRecharge={rechargeNow}
            />
          ) : null}

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
              <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink }}>
                Set up your application profile to auto-apply
              </Text>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: colors.waiting }}>
                Set up
              </Text>
            </Pressable>
          ) : null}

          <View
            style={{ flex: 1, marginTop: 8, paddingBottom: 56, opacity: outOfSwipes ? 0.3 : 1 }}
            pointerEvents={outOfSwipes ? 'none' : 'auto'}>
            <SwipeDeck
              ref={deckRef}
              jobs={jobs}
              expanded={expanded}
              onToggleExpand={setExpanded}
              onSwiped={handleSwiped}
              drag={dragX}
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

          {outOfSwipes ? (
            <CooldownView secondsLeft={cooldownSecondsLeft} onRecharge={rechargeNow} />
          ) : (
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
              <GlassBar style={{ gap: 8 }}>
                <ActionCircle icon="share-outline" size={42} onPress={shareTopJob} />
                <ActionCircle
                  icon="bookmark-outline"
                  size={46}
                  onPress={() => deckRef.current?.save()}
                />
                <Animated.View style={passStyle}>
                  <PlayfulPass size={64} onPress={() => deckRef.current?.swipe('left')} />
                </Animated.View>
                <Animated.View style={draftStyle}>
                  <SendButton
                    size={64}
                    disabled={!canDraft}
                    onPress={() => deckRef.current?.swipe('right')}
                  />
                </Animated.View>
                {/* Auto-apply MODE toggle: lit purple gradient when ON (a right
                    swipe also auto-applies), muted when OFF (swipe just networks). */}
                <Pressable
                  onPress={() => updateSwipeSettings({ autoApply: !swipeSettings.autoApply })}
                  accessibilityLabel="Toggle auto-apply on swipe">
                  {swipeSettings.autoApply ? (
                    <LinearGradient
                      colors={['#2563EB', '#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="flash" size={20} color="#FFFFFF" />
                    </LinearGradient>
                  ) : (
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.paper2,
                        borderWidth: 1,
                        borderColor: colors.hairline,
                      }}>
                      <Ionicons name="flash-outline" size={20} color={colors.inkTertiary} />
                    </View>
                  )}
                </Pressable>
                <ActionCircle
                  icon="options-outline"
                  size={42}
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
    </View>
  );
}
