import { useEffect } from 'react';
import { AccessibilityInfo, Image, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * The hand that motions at the send button to start the tour.
 *
 * The asset is a single still keyed out of the Higgsfield render
 * (assets/images/tap-hand.png): white pixels, alpha carrying the shape, so the
 * colour is set here with tintColor and follows the theme instead of being
 * baked in. The tap is animated in code for the same reason the swipe hint is
 * (see SwipeDemoHint.tsx): shipping the mp4 would mean a native video
 * dependency and a new build, and the render's own pacing was far too slow.
 *
 * One cycle is deliberately quick: press, lift, breathe, again. A slow hand
 * reads as decoration; a quick one reads as an instruction.
 */
const PRESS_MS = 190;
const LIFT_MS = 260;
const REST_MS = 620;

export default function TapHand({
  size = 74,
  color,
  /** Fades out and stops when the user does the thing. */
  active = true,
  /**
   * Mirror it. The render points up and to the LEFT, so unflipped it has to
   * sit to the right of its target; against a button already on the screen's
   * right edge that puts half the hand off-screen. Flipped, it sits to the
   * left of the target and stays on the glass.
   */
  flip = false,
}: {
  size?: number;
  color: string;
  active?: boolean;
  flip?: boolean;
}) {
  const press = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    if (!active) {
      cancelAnimation(press);
      fade.value = withTiming(0, { duration: 180 });
      return;
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive) return;
        fade.value = withTiming(1, { duration: 260 });
        if (reduced) return; // still hand, no tapping
        press.value = withRepeat(
          withSequence(
            withTiming(1, { duration: PRESS_MS, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
            withDelay(REST_MS, withTiming(0, { duration: 1 })),
          ),
          -1,
          false,
        );
      })
      .catch(() => {
        fade.value = withTiming(1, { duration: 260 });
      });
    return () => {
      alive = false;
      cancelAnimation(press);
    };
  }, [active, press, fade]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      // Into the button and slightly up the way a real finger meets a target,
      // plus a touch of scale so the press reads at this size. The X push
      // follows the direction the finger points.
      { translateX: (flip ? 1 : -1) * press.value * 5 },
      { translateY: -press.value * 7 },
      { scale: 1 - press.value * 0.06 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size * 1.2 }, style]}>
      <View style={{ flex: 1 }}>
        <Image
          source={require('../../../assets/images/tap-hand.png')}
          style={{
            width: size,
            height: size * 1.2,
            tintColor: color,
            transform: flip ? [{ scaleX: -1 }] : undefined,
          }}
          resizeMode="contain"
          accessibilityLabel=""
        />
      </View>
    </Animated.View>
  );
}
