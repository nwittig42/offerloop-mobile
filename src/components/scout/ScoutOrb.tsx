import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

/**
 * The Scout circle. Plasma, not a ball (Rylan 2026-08-17, picked from three
 * directions in the orb lab: "make it futuristic and AI-like, not a solid
 * color").
 *
 * There is no hard edge anywhere in here. A hot core fades out through violet
 * into a cyan corona that dissolves into whatever background it sits on, so it
 * reads as light in the room rather than an object pasted on top of it. Three
 * coloured masses drift inside at different speeds and directions, which is
 * what keeps it from ever looking like one flat gradient. Two hairline arcs
 * orbit outside it: that is the deliberate bit of hardware in an otherwise
 * organic thing.
 *
 * Motion, one dial per state:
 *   idle       slow breathe
 *   listening  scales with LIVE mic volume; rings push out on the peaks
 *   thinking   the arcs speed up and the masses swirl wider
 *   speaking   steady pulse in time with Scout's voice
 *   acting     shrinks back and hands the stage to the work
 *
 * Everything is react-native-svg + Reanimated on purpose. Skia and real blur
 * would open up shaders, but both are native modules, and this has to keep
 * shipping over the air to builds already on people's phones.
 */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'done' | 'speaking';

/**
 * The cutout head, not scout-face.png. That one is a square illustration with
 * its own pale background baked in, so on the light it read as a sticker
 * pasted on (Rylan: "the yeti face looks pretty weird"). This one has a
 * transparent background, so Scout sits IN the light.
 */
const FACE = require('../../../assets/images/scout-yeti-head.png');

/** A soft mass of light drifting inside the corona. Fades to fully
 *  transparent well before its own edge, so several of them merge into one
 *  body instead of reading as overlapping discs. */
function Mass({
  id,
  color,
  size,
  duration,
  reverse,
  orbit,
  intensity,
  peak,
}: {
  id: string;
  color: string;
  size: number;
  duration: number;
  reverse?: boolean;
  orbit: number;
  intensity: SharedValue<number>;
  peak: number;
}) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [duration, spin]);

  const style = useAnimatedStyle(() => {
    const a = spin.value * 2 * Math.PI * (reverse ? -1 : 1);
    const r = orbit * (0.5 + intensity.value * 0.7);
    return {
      transform: [
        { translateX: Math.cos(a) * r },
        { translateY: Math.sin(a) * r },
        { scale: 1 + intensity.value * 0.16 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={peak} />
            <Stop offset="50%" stopColor={color} stopOpacity={peak * 0.42} />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** A hairline arc orbiting the corona. Two of these, opposite directions:
 *  the one piece of hardware in an otherwise organic thing. */
function OrbitArc({
  size,
  color,
  dash,
  duration,
  reverse,
  intensity,
  base,
}: {
  size: number;
  color: string;
  dash: string;
  duration: number;
  reverse?: boolean;
  intensity: SharedValue<number>;
  base: number;
}) {
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(spin);
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [duration, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360 * (reverse ? -1 : 1)}deg` }],
    opacity: base + intensity.value * 0.45,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width="100%" height="100%">
        <Circle
          cx="50%"
          cy="50%"
          r="47%"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** A ring that pushes out of the corona and fades on the loud parts of what
 *  you are saying. Louder voice, brighter ring, so the circle reads as
 *  listening rather than decorating. */
function VoiceRing({
  size,
  delay,
  active,
  level,
}: {
  size: number;
  delay: number;
  active: boolean;
  level: SharedValue<number>;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (!active) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [active, delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: active ? (1 - t.value) * 0.32 * (0.35 + level.value * 0.9) : 0,
    transform: [{ scale: 0.9 + t.value * 0.55 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width="100%" height="100%">
        <Circle cx="50%" cy="50%" r="49%" fill="none" stroke="#7FB0FF" strokeWidth={1.5} />
      </Svg>
    </Animated.View>
  );
}

export default function ScoutOrb({
  state,
  size = 220,
  volume,
  onPress,
}: {
  state: OrbState;
  size?: number;
  /** Live mic loudness 0..1 while listening. This is what makes the circle
   *  move when someone talks. */
  volume?: SharedValue<number>;
  onPress?: () => void;
}) {
  const intensity = useSharedValue(0.15);
  const breathe = useSharedValue(0);
  const pulse = useSharedValue(0);
  const listening = state === 'listening';
  const speaking = state === 'speaking';
  const thinking = state === 'thinking';
  const quiet = state === 'acting' || state === 'done';

  // Smoothed microphone level. The raw value jumps every frame, which reads as
  // jitter; a short timing pass turns it into breath.
  const level = useDerivedValue(
    () => withTiming(listening ? (volume?.value ?? 0) : 0, { duration: 110 }),
    [listening, volume],
  );

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [breathe]);

  // Scout's own voice. No amplitude comes back from text-to-speech, so this is
  // a steady cadence: enough to read as talking, never a lip-sync claim.
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (!speaking) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [speaking, pulse]);

  useEffect(() => {
    const target = listening ? 0.75 : thinking ? 1 : speaking ? 0.6 : 0.15;
    intensity.value = withSpring(target, { damping: 15, stiffness: 90 });
  }, [listening, thinking, speaking, intensity]);

  const coronaStyle = useAnimatedStyle(() => {
    const breatheScale = interpolate(breathe.value, [0, 1], [1, 1.05]);
    const voice = level.value * 0.16;
    const talk = speaking ? interpolate(pulse.value, [0, 1], [0, 0.05]) : 0;
    const shrink = quiet ? 0.72 : 1;
    return {
      transform: [{ scale: breatheScale * shrink * (1 + intensity.value * 0.08 + voice + talk) }],
      opacity: 0.85 + intensity.value * 0.15,
    };
  });

  // Face at rest, light while talking. Anything that is not plain waiting
  // hands the circle over to the light.
  const faceStyle = useAnimatedStyle(() => {
    const busy = listening || speaking || thinking;
    return {
      opacity: withTiming(busy ? 0 : 1, { duration: 260 }),
      transform: [{ scale: withTiming(busy ? 0.86 : 1, { duration: 260 }) }],
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Grounding shadow: a soft dark-blue ellipse under the light, so the
          orb sits IN the room instead of floating flat on it. First child so
          everything else draws over it. */}
      <Svg
        pointerEvents="none"
        width={size * 0.8}
        height={size * 0.22}
        style={{ position: 'absolute', top: size * 0.92 }}>
        <Defs>
          <RadialGradient id="scout-ground" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.22" />
            <Stop offset="70%" stopColor="#1E3A8A" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#scout-ground)" />
      </Svg>
      {/* The body: a hot core through violet into a cyan corona, fading to
          nothing well inside its own box so there is never an edge. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: size * 1.5, height: size * 1.5 }, coronaStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="scout-corona" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#F2F7FF" stopOpacity="1" />
              <Stop offset="12%" stopColor="#A8C8FF" stopOpacity="0.95" />
              <Stop offset="26%" stopColor="#3B82F6" stopOpacity="0.9" />
              <Stop offset="38%" stopColor="#1D4ED8" stopOpacity="0.72" />
              <Stop offset="50%" stopColor="#38BDF8" stopOpacity="0.4" />
              <Stop offset="64%" stopColor="#60A5FA" stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#scout-corona)" />
        </Svg>
      </Animated.View>

      {/* All blue on purpose (Rylan 2026-08-17). The three masses are three
          different blues, not one: deep cobalt, sky, and a near-white
          highlight. Same blue three times would be the flat ball again. */}
      <Mass id="scout-m1" color="#1D4ED8" size={size * 0.9} duration={9000} orbit={size * 0.12} intensity={intensity} peak={0.5} />
      <Mass id="scout-m2" color="#38BDF8" size={size * 0.66} duration={7000} reverse orbit={size * 0.16} intensity={intensity} peak={0.45} />
      <Mass id="scout-m3" color="#C7DDFF" size={size * 0.44} duration={5400} orbit={size * 0.2} intensity={intensity} peak={0.32} />

      <OrbitArc
        size={size * 1.12}
        color="#7FB0FF"
        dash="42 220"
        duration={thinking ? 3400 : 9000}
        intensity={intensity}
        base={0.25}
      />
      <OrbitArc
        size={size * 1.3}
        color="#38BDF8"
        dash="20 300"
        duration={thinking ? 5200 : 13000}
        reverse
        intensity={intensity}
        base={0.18}
      />

      <VoiceRing size={size * 1.05} delay={0} active={listening} level={level} />
      <VoiceRing size={size * 1.05} delay={1000} active={listening} level={level} />

      {/* Specular sheen, upper-left: the one cue that says sphere instead of
          disc. Off-centre on purpose; light in this app comes from the top. */}
      <Svg
        pointerEvents="none"
        width={size}
        height={size}
        style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="scout-sheen" cx="36%" cy="26%" r="30%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.14" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill="url(#scout-sheen)" />
      </Svg>

      {/* Last child, so it sits over the light and the whole circle stays
          tappable even when the face has faded out. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Scout"
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={faceStyle}>
          <Image
            source={FACE}
            style={{ width: size * 0.46, height: size * 0.46, marginTop: size * 0.05 }}
            resizeMode="contain"
          />
          {/* No hemline overlay. A blue blend was tried over the asset's hard
              bottom crop and read as "a weird blue bar under the yeti"
              (Rylan 2026-08-18); the grounding shadow + sheen carry the depth. */}
        </Animated.View>
      </Pressable>
    </View>
  );
}
