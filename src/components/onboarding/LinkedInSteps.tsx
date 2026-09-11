import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * How to grab your LinkedIn link, as a stepping picture sequence (Rylan
 * 2026-09-08, swipeable 2026-09-11). Eight stills from his own screen
 * recording. Plays itself on a loop; drag it left or right like the swipe
 * deck cards to move through it by hand, and it never runs out either
 * direction — off the last step lands back on the first, and the reverse.
 * Tap pauses on the step you are looking at; tap again resumes. Plain Image
 * components on purpose: no video module in the binary, so this ships over
 * the air, and there is nothing to buffer or fail.
 */

const STEPS: { image: number; caption: string }[] = [
  { image: require('../../../assets/onboarding/linkedin-steps/01.jpg'), caption: 'Tap "Open LinkedIn to grab my link"' },
  { image: require('../../../assets/onboarding/linkedin-steps/02.jpg'), caption: 'In LinkedIn, tap your photo, top left' },
  { image: require('../../../assets/onboarding/linkedin-steps/03.jpg'), caption: 'Tap your name to open your profile' },
  { image: require('../../../assets/onboarding/linkedin-steps/04.jpg'), caption: 'Tap the three dots next to Add section' },
  { image: require('../../../assets/onboarding/linkedin-steps/05.jpg'), caption: 'Choose "Share via..."' },
  { image: require('../../../assets/onboarding/linkedin-steps/06.jpg'), caption: 'Tap Copy' },
  { image: require('../../../assets/onboarding/linkedin-steps/07.jpg'), caption: 'Back in Offerloop, tap the box and Paste' },
  { image: require('../../../assets/onboarding/linkedin-steps/08.jpg'), caption: 'That is it. Tap Continue.' },
];

const HOLD_MS = 1700;
const FRAME_W = 400;
const FRAME_H = 871;
// Same feel as the swipe deck (SwipeStack.tsx): a fast flick commits
// regardless of distance, a slow drag needs to clear the threshold. The
// frame here is much smaller than a full card, so the threshold is a flat
// distance rather than a fraction of the screen.
const COMMIT_THRESHOLD = 60;
const FLING_VELOCITY = 900;

/** Always forward — perpetual means it never runs out either direction. */
const wrap = (i: number) => (i + STEPS.length) % STEPS.length;

export default function LinkedInSteps() {
  const colors = useColors();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const tx = useSharedValue(0);
  const rotate = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${tx.value / 18}deg` }],
  }));

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => wrap(i + 1)), HOLD_MS);
    return () => clearInterval(id);
  }, [paused]);

  const step = STEPS[index];

  const advance = (dir: 1 | -1) => {
    setPaused(true);
    setIndex((i) => wrap(i + dir));
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      const committedLeft = tx.value < -COMMIT_THRESHOLD || e.velocityX < -FLING_VELOCITY;
      const committedRight = tx.value > COMMIT_THRESHOLD || e.velocityX > FLING_VELOCITY;
      if (committedLeft || committedRight) {
        // Fly the current still off, THEN swap the image and snap back to
        // center with no animation — it reads as the next still sliding in
        // from the edge it was dragged toward, the same illusion the swipe
        // deck's own card-replace uses.
        tx.value = withTiming(committedLeft ? -280 : 280, { duration: 160 }, () => {
          runOnJS(advance)(committedLeft ? 1 : -1);
          tx.value = 0;
        });
      } else {
        tx.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });
  // A plain no-argument callback, not an updater function passed through
  // runOnJS — functions are not safe to marshal across the worklet
  // boundary as arguments, only the invocation itself is.
  const togglePause = () => setPaused((p) => !p);
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(togglePause)();
  });

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View
          style={[
            {
              width: 210,
              aspectRatio: FRAME_W / FRAME_H,
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surface,
            },
            rotate,
          ]}>
          <Image source={step.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          {paused ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: 'rgba(17,19,24,0.55)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>

      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 13.5,
          lineHeight: 19,
          color: colors.ink,
          textAlign: 'center',
          minHeight: 38,
        }}>
        {index + 1}. {step.caption}
      </Text>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((_, i) => (
          <Pressable
            key={i}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}`}
            onPress={() => {
              setIndex(i);
              setPaused(true);
            }}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? colors.marketing : colors.hairline,
            }}
          />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
        {paused ? 'Swipe or tap to resume' : 'Swipe through, or tap to pause'}
      </Text>
    </View>
  );
}
