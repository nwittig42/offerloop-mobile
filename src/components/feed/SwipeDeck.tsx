import { forwardRef, memo, useImperativeHandle } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import JobCard from '@/components/feed/JobCard';
import Card from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * The swipe stack, Sorce-sized: the card fills the deck area. Left = pass
 * (red PASS stamp), right = draft outreach (slate-blue DRAFT stamp).
 * Tapping expands the card in place; the description scrolls while the
 * horizontal swipe stays live (the pan claims sideways drags, the scroll
 * keeps vertical ones). Action buttons drive the same animations through
 * the imperative handle.
 */

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const COMMIT_THRESHOLD = SCREEN_W * 0.32;
const FLING_VELOCITY = 900;

export type SwipeDeckHandle = {
  swipe: (direction: 'left' | 'right') => void;
  save: () => void;
};

type Props = {
  jobs: Job[];
  expanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  /** 'up' = swiped up to save for later. */
  onSwiped: (direction: 'left' | 'right' | 'up', job: Job) => void;
  /** Mirrors the live horizontal drag so the action buttons can react. */
  drag?: SharedValue<number>;
  /** What a right swipe on the TOP card actually does: 'apply' (green APPLY
   *  stamp) when auto-apply is on and this job is eligible, else 'draft'.
   *  Honest per-card: an ineligible job never flashes a promise to apply. */
  rightStamp?: 'draft' | 'apply';
};

function Stamp({ kind }: { kind: 'pass' | 'draft' | 'save' | 'apply' }) {
  const colors = useColors();
  const color =
    kind === 'pass'
      ? colors.negative
      : kind === 'save'
        ? colors.marketing
        : kind === 'apply'
          ? colors.positive
          : colors.accent;
  // pass tilts right (top-right), draft/apply tilt left (top-left), save sits centered.
  const centered = kind === 'save';
  return (
    <View
      style={{
        position: 'absolute',
        top: 22,
        left: centered ? 0 : kind === 'pass' ? undefined : 20,
        right: centered ? 0 : kind === 'pass' ? 20 : undefined,
        alignItems: centered ? 'center' : undefined,
      }}>
      <View
        style={{
          transform: [{ rotate: centered ? '0deg' : kind === 'pass' ? '12deg' : '-12deg' }],
          borderWidth: 3,
          borderColor: color,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 2,
          backgroundColor: colors.paper,
        }}>
        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: 26,
            letterSpacing: 2,
            color,
          }}>
          {kind === 'pass' ? 'PASS' : kind === 'save' ? 'SAVE' : kind === 'apply' ? 'APPLY' : 'DRAFT'}
        </Text>
      </View>
    </View>
  );
}

// Memoized: with stable callbacks from the feed, the deck only re-renders when
// the cards (jobs) or expand state actually change — not on every store/poll tick.
export const SwipeDeck = memo(
  forwardRef<SwipeDeckHandle, Props>(
  ({ jobs, expanded, onToggleExpand, onSwiped, drag, rightStamp = 'draft' }, ref) => {
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);

    const top = jobs[0];
    const next = jobs[1];

    const finish = (direction: 'left' | 'right' | 'up') => {
      const job = jobs[0];
      tx.value = 0;
      ty.value = 0;
      onToggleExpand(false);
      if (job) onSwiped(direction, job);
    };

    const flyOut = (direction: 'left' | 'right') => {
      'worklet';
      const target = (direction === 'right' ? 1 : -1) * SCREEN_W * 1.4;
      if (drag) drag.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(ty.value + 40, { duration: 240 });
      tx.value = withTiming(target, { duration: 240 }, (finished) => {
        if (finished) runOnJS(finish)(direction);
      });
    };

    // Swipe / fling up to save the card for later.
    const flyUp = () => {
      'worklet';
      if (drag) drag.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(-SCREEN_H * 1.2, { duration: 260 }, (finished) => {
        if (finished) runOnJS(finish)('up');
      });
    };

    useImperativeHandle(ref, () => ({
      swipe: (direction) => {
        flyOut(direction);
      },
      save: () => {
        flyUp();
      },
    }));

    // Pan handles horizontal (left/right) always, and — on a COLLAPSED card —
    // vertical UP too, so swipe-up-to-save gets the exact same drag-and-commit
    // physics as left/right (finger-follow, threshold, spring-back). On an
    // EXPANDED card we keep failOffsetY so the description scrolls instead.
    let pan = Gesture.Pan().activeOffsetX([-14, 14]);
    pan = expanded ? pan.failOffsetY([-16, 16]) : pan.activeOffsetY([-14, 100000]);
    pan = pan
      .onUpdate((e) => {
        tx.value = e.translationX;
        // Follow an upward save-drag fully (collapsed only); otherwise keep the
        // subtle downward drift used during a horizontal swipe.
        if (!expanded && e.translationY < 0 && Math.abs(e.translationY) > Math.abs(e.translationX)) {
          ty.value = e.translationY;
        } else {
          ty.value = e.translationY * 0.4;
        }
        if (drag) drag.value = e.translationX;
      })
      .onEnd((e) => {
        const upCommit =
          !expanded &&
          Math.abs(ty.value) > Math.abs(tx.value) &&
          (ty.value < -COMMIT_THRESHOLD || e.velocityY < -FLING_VELOCITY);
        if (upCommit) {
          flyUp();
        } else if (tx.value > COMMIT_THRESHOLD || e.velocityX > FLING_VELOCITY) {
          flyOut('right');
        } else if (tx.value < -COMMIT_THRESHOLD || e.velocityX < -FLING_VELOCITY) {
          flyOut('left');
        } else {
          tx.value = withSpring(0, { damping: 16, stiffness: 180 });
          ty.value = withSpring(0, { damping: 16, stiffness: 180 });
          if (drag) drag.value = withSpring(0, { damping: 16, stiffness: 180 });
        }
      });

    // A tap anywhere on a collapsed card expands it. Composed with the pan so
    // a deliberate tap reliably expands while drags still swipe.
    const tap = Gesture.Tap()
      .maxDistance(10)
      .onEnd(() => {
        if (!expanded) runOnJS(onToggleExpand)(true);
      });
    const gesture = Gesture.Simultaneous(pan, tap);

    const topStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${tx.value / 18}deg` },
      ],
    }));

    const draftStampStyle = useAnimatedStyle(() => ({
      opacity: interpolate(tx.value, [30, 110], [0, 1], Extrapolation.CLAMP),
    }));

    const passStampStyle = useAnimatedStyle(() => ({
      opacity: interpolate(tx.value, [-110, -30], [1, 0], Extrapolation.CLAMP),
    }));

    const saveStampStyle = useAnimatedStyle(() => ({
      opacity: interpolate(ty.value, [-110, -30], [1, 0], Extrapolation.CLAMP),
    }));

    const nextStyle = useAnimatedStyle(() => {
      const progress = interpolate(
        Math.abs(tx.value),
        [0, COMMIT_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP,
      );
      return {
        transform: [
          { scale: 0.95 + 0.05 * progress },
          { translateY: 14 - 14 * progress },
        ],
        opacity: 0.9 + 0.1 * progress,
      };
    });

    if (!top) return null;

    return (
      <View style={{ flex: 1 }}>
        {next && !expanded ? (
          <Animated.View
            key={next.id}
            style={[{ position: 'absolute', top: 10, left: 0, right: 0, bottom: 10 }, nextStyle]}>
            <Card elevated="md" padded style={{ flex: 1, borderRadius: 22, overflow: 'hidden' }}>
              <JobCard job={next} />
            </Card>
          </Animated.View>
        ) : null}

        <GestureDetector gesture={gesture}>
          <Animated.View key={top.id} style={[{ flex: 1, paddingVertical: 10 }, topStyle]}>
            {expanded ? (
              <Card elevated="lg" padded style={{ flex: 1, borderRadius: 22, overflow: 'hidden' }}>
                <JobCard job={top} expanded onCollapse={() => onToggleExpand(false)} />
              </Card>
            ) : (
              <Card elevated="lg" padded style={{ flex: 1, borderRadius: 22, overflow: 'hidden' }}>
                <JobCard job={top} />
              </Card>
            )}
            <Animated.View
              style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, draftStampStyle]}
              pointerEvents="none">
              <Stamp kind={rightStamp} />
            </Animated.View>
            <Animated.View
              style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, passStampStyle]}
              pointerEvents="none">
              <Stamp kind="pass" />
            </Animated.View>
            <Animated.View
              style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, saveStampStyle]}
              pointerEvents="none">
              <Stamp kind="save" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
  ),
);

SwipeDeck.displayName = 'SwipeDeck';

export default SwipeDeck;
