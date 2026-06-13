import { forwardRef, useImperativeHandle } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import JobCard from '@/components/feed/JobCard';
import Card from '@/components/ui/Card';
import { colors, fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * The swipe stack. Left = pass (red PASS stamp), right = draft outreach
 * (slate-blue DRAFT stamp). Physical, springy, undoable. Action buttons
 * drive the same animations through the imperative handle.
 */

const SCREEN_W = Dimensions.get('window').width;
const COMMIT_THRESHOLD = SCREEN_W * 0.32;
const FLING_VELOCITY = 900;

export type SwipeDeckHandle = {
  swipe: (direction: 'left' | 'right') => void;
};

type Props = {
  jobs: Job[];
  onSwiped: (direction: 'left' | 'right', job: Job) => void;
  onPressCard: (job: Job) => void;
};

function Stamp({ kind }: { kind: 'pass' | 'draft' }) {
  const isPass = kind === 'pass';
  const color = isPass ? colors.negative : colors.accent;
  return (
    <View
      style={{
        position: 'absolute',
        top: 18,
        left: isPass ? undefined : 16,
        right: isPass ? 16 : undefined,
        transform: [{ rotate: isPass ? '12deg' : '-12deg' }],
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
        {isPass ? 'PASS' : 'DRAFT'}
      </Text>
    </View>
  );
}

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(
  ({ jobs, onSwiped, onPressCard }, ref) => {
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);

    const top = jobs[0];
    const next = jobs[1];

    const finish = (direction: 'left' | 'right') => {
      const job = jobs[0];
      tx.value = 0;
      ty.value = 0;
      if (job) onSwiped(direction, job);
    };

    const flyOut = (direction: 'left' | 'right') => {
      'worklet';
      const target = (direction === 'right' ? 1 : -1) * SCREEN_W * 1.4;
      ty.value = withTiming(ty.value + 40, { duration: 240 });
      tx.value = withTiming(target, { duration: 240 }, (finished) => {
        if (finished) runOnJS(finish)(direction);
      });
    };

    useImperativeHandle(ref, () => ({
      swipe: (direction) => {
        flyOut(direction);
      },
    }));

    const pan = Gesture.Pan()
      .onUpdate((e) => {
        tx.value = e.translationX;
        ty.value = e.translationY * 0.4;
      })
      .onEnd((e) => {
        if (tx.value > COMMIT_THRESHOLD || e.velocityX > FLING_VELOCITY) {
          flyOut('right');
        } else if (tx.value < -COMMIT_THRESHOLD || e.velocityX < -FLING_VELOCITY) {
          flyOut('left');
        } else {
          tx.value = withSpring(0, { damping: 16, stiffness: 180 });
          ty.value = withSpring(0, { damping: 16, stiffness: 180 });
        }
      });

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
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {next ? (
          <Animated.View
            key={next.id}
            style={[{ position: 'absolute', left: 0, right: 0 }, nextStyle]}>
            <Card elevated="md" padded>
              <JobCard job={next} />
            </Card>
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View key={top.id} style={topStyle}>
            <Pressable onPress={() => onPressCard(top)}>
              <Card elevated="lg" padded>
                <JobCard job={top} />
              </Card>
            </Pressable>
            <Animated.View
              style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, draftStampStyle]}
              pointerEvents="none">
              <Stamp kind="draft" />
            </Animated.View>
            <Animated.View
              style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, passStampStyle]}
              pointerEvents="none">
              <Stamp kind="pass" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  },
);

SwipeDeck.displayName = 'SwipeDeck';

export default SwipeDeck;
