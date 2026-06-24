import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import GlassBar from '@/components/GlassBar';
import Header from '@/components/Header';
import PlanBorder from '@/components/PlanBorder';
import CooldownView from '@/components/feed/CooldownView';
import PlayfulPass from '@/components/feed/PlayfulPass';
import SendButton from '@/components/feed/SendButton';
import StaminaBar from '@/components/feed/StaminaBar';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';
import {
  getApplicationProfile,
  isProfileReady,
  startAutoApply,
} from '@/api/endpoints/autoApply';
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
export default function FeedScreen() {
  const router = useRouter();
  const {
    jobs,
    profile,
    unreadCount,
    canUndo,
    swipeSettings,
    swipesAvailable,
    swipeBatchSize,
    cooldownSecondsLeft,
    rechargeNow,
    passJob,
    draftJob,
    undoLastPass,
    resetDeck,
    showToast,
    feedState,
  } = useApp();
  const colors = useColors();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const canAutoApply = profile.plan === 'Pro' || profile.plan === 'Elite';

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

  const handleSwiped = (direction: 'left' | 'right', job: Job) => {
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
      // Auto-apply on + eligible job → fire the real submission in the
      // BACKGROUND so swiping never blocks (Sorce-style). It surfaces in the
      // Applied tab with live status. If the application profile isn't set up
      // yet, we don't apply — the banner + toast point them to set it up.
      if (swipeSettings.autoApply && job.autoApplyEligible && canAutoApply) {
        if (!profileReady) {
          showToast('Set up your application profile to auto-apply');
        } else {
          showToast(`Auto-applying to ${job.title} — see Network › Applied`, true);
          startAutoApply(job.id)
            .then((r) => {
              if (r.ok) {
                queryClient.invalidateQueries({ queryKey: ['appliedJobs'] });
              } else if (r.code === 'PROFILE_REQUIRED' || r.code === 'WORK_AUTH_REQUIRED') {
                showToast('Set up your application profile to auto-apply');
              } else if (r.code === 'INSUFFICIENT_CREDITS') {
                showToast('Not enough credits to auto-apply');
              } else if (r.code !== 'INELIGIBLE') {
                showToast('Could not auto-apply, try again');
              }
            })
            .catch(() => showToast('Could not auto-apply, try again'));
        }
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(job.id);
    }
  };

  const creditsPill = (
    <PlanBorder plan={profile.plan} radius={9}>
      <View
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
      </View>
    </PlanBorder>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
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
              <GlassBar style={{ gap: 16 }}>
                <ActionCircle
                  icon="arrow-undo-outline"
                  size={50}
                  disabled={!canUndo}
                  onPress={undoLastPass}
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
                <ActionCircle
                  icon="options-outline"
                  size={50}
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
          body="You’ve been through every job we ranked for you. New roles get added as they’re posted — check back soon, or restart the deck to revisit ones you passed."
          actionLabel="Restart deck"
          onAction={resetDeck}
        />
      )}
    </View>
  );
}
