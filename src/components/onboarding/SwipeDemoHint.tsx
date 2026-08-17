import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Image, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * The swipe demo on the onboarding card: a 3D hand drifts right and the card
 * leans with it, then both reset.
 *
 * ONE shared value drives the hand and the card. That is the whole point of
 * wrapping the deck instead of overlaying a separate animation: two clocks
 * would drift apart within a couple of loops and the hand would look like it
 * was pushing nothing.
 *
 * The hand is assets/images/swipe-hand.png, a frame lifted from the Higgsfield
 * render with its light-grey plate unmultiplied out (the plate was ~246, not
 * white, and the hand only ~80 levels darker, so a plain white key would have
 * dissolved it). Kept as a still and animated in code rather than shipping the
 * mp4: video would mean a new native dependency, a new TestFlight build, and no
 * way to keep the card in sync with pre-rendered motion.
 *
 * Stops the moment the user swipes for themselves, and after a few cycles
 * regardless, so it teaches and then gets out of the way. Never runs under
 * Reduce Motion.
 */

/** One full cycle: hold, glide, settle, hold. */
const HOLD_MS = 420;
const GLIDE_MS = 950;
const RESET_MS = 300;
const CYCLES = 3;

export default function SwipeDemoHint({
  active,
  children,
}: {
  /** False once the user swipes; the demo stops and fades out. */
  active: boolean;
  /** The swipe deck. Leans with the hand. */
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  // Far enough to read as a swipe, short of the distance that commits one.
  const travel = Math.min(104, width * 0.24);

  const progress = useSharedValue(0); // 0 at rest, 1 at the end of the drift
  const fade = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    if (!active) {
      cancelAnimation(progress);
      fade.value = withTiming(0, { duration: 220 });
      progress.value = withTiming(0, { duration: 220 });
      return;
    }

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive || reduced) return;
      fade.value = withTiming(1, { duration: 260 });
      progress.value = withRepeat(
        withSequence(
          withTiming(0, { duration: HOLD_MS }),
          withTiming(1, { duration: GLIDE_MS, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: RESET_MS, easing: Easing.out(Easing.quad) }),
        ),
        CYCLES,
        false,
      );
      // Leave the card where it belongs once the lesson is over.
      setTimeout(
        () => {
          if (alive) fade.value = withTiming(0, { duration: 400 });
        },
        (HOLD_MS + GLIDE_MS + RESET_MS) * CYCLES,
      );
    });

    return () => {
      alive = false;
      cancelAnimation(progress);
      cancelAnimation(fade);
    };
  }, [active, progress, fade]);

  // The card leans a fraction of the hand's travel: enough to look pushed,
  // not enough to read as a real swipe in progress.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * travel * 0.34 * fade.value },
      { rotate: `${progress.value * 2.4 * fade.value}deg` },
    ],
  }));

  const handStyle = useAnimatedStyle(() => ({
    opacity: fade.value * 0.9,
    transform: [
      { translateX: progress.value * travel },
      // Presses in as it starts to move, releases as it returns.
      { scale: 1 - progress.value * 0.04 },
    ],
  }));

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, cardStyle]}>{children}</Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            // Sits over the middle of the card, left of centre, so the drift
            // crosses the card face rather than skimming its bottom edge.
            bottom: 132,
            left: '26%',
          },
          handStyle,
        ]}>
        <Image
          source={require('../../../assets/images/swipe-hand.png')}
          style={{ width: 136, height: 186 }}
          resizeMode="contain"
          accessibilityLabel=""
        />
      </Animated.View>
    </View>
  );
}
