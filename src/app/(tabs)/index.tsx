import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
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
import { ActionCircle, Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

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
  } = useApp();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [expanded, setExpanded] = useState(false);

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

  const handleSwiped = (direction: 'left' | 'right', job: { id: string }) => {
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

      {top ? (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {!outOfSwipes ? (
            <StaminaBar
              available={swipesAvailable}
              batchSize={swipeBatchSize}
              secondsLeft={cooldownSecondsLeft}
              onRecharge={rechargeNow}
            />
          ) : null}

          <View
            style={{ flex: 1, opacity: outOfSwipes ? 0.3 : 1 }}
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 26,
              color: colors.heading,
              textAlign: 'center',
            }}>
            That is the whole mock deck
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 21,
            }}>
            Real jobs arrive with backend wiring in Phase 3. Restart the fixtures to keep
            testing the swipe.
          </Text>
          <Button label="Restart mock deck" variant="outline" onPress={resetDeck} />
        </View>
      )}
    </View>
  );
}
