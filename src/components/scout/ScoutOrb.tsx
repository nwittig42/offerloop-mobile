import { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * The Scout orb — the voice tab's centerpiece (PLAN-scout-voice.md, P0 mock).
 * Soft radial-gradient plumes (never hard-edged shapes) drift inside the
 * sphere so the light reads as one glowing mass, matching the mock's blurred
 * look. One intensity dial drives everything: idle breathes slow, listening
 * swells with mic volume, thinking spins tight, acting/done shrink to hand
 * the stage to the work. Scout's badge face sits at the center.
 * Pure Reanimated + SVG — OTA-safe, no native modules.
 */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'done';

const FACE = require('../../../assets/images/scout-face.png');

/** A soft plume: an SVG circle whose radial gradient fades to fully
 *  transparent well before its edge — layered plumes visually merge. */
function Plume({
  id,
  color,
  size,
  duration,
  reverse,
  orbitRatio,
  intensity,
}: {
  id: string;
  color: string;
  size: number;
  duration: number;
  reverse?: boolean;
  orbitRatio: number;
  intensity: SharedValue<number>;
}) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [duration, spin]);

  const style = useAnimatedStyle(() => {
    const angle = spin.value * 2 * Math.PI * (reverse ? -1 : 1);
    const radius = size * orbitRatio * (0.55 + intensity.value * 0.75);
    return {
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius },
        { scale: 1 + intensity.value * 0.22 },
      ],
      opacity: 0.85,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <Stop offset="45%" stopColor={color} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill={`url(#${id})`} />
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
  /** Live mic loudness 0..1 while listening — drives the swell. */
  volume?: SharedValue<number>;
  onPress?: () => void;
}) {
  const intensity = useSharedValue(0.15);
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(breathe);
  }, [breathe]);

  useEffect(() => {
    const target =
      state === 'idle' ? 0.15 : state === 'listening' ? 0.7 : state === 'thinking' ? 1 : 0.4;
    intensity.value = withSpring(target, { damping: 14, stiffness: 90 });
  }, [state, intensity]);

  const orbStyle = useAnimatedStyle(() => {
    const breatheScale = interpolate(breathe.value, [0, 1], [1, 1.04]);
    const vol = state === 'listening' && volume ? volume.value * 0.12 : 0;
    const shrink = state === 'acting' || state === 'done' ? 0.66 : 1;
    return {
      transform: [{ scale: breatheScale * shrink * (1 + intensity.value * 0.05 + vol) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + intensity.value * 0.5 + (state === 'listening' && volume ? volume.value * 0.2 : 0),
    transform: [{ scale: 1 + intensity.value * 0.16 }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: state === 'listening' || state === 'thinking' ? 0.5 : 1,
    transform: [
      { scale: state === 'listening' || state === 'thinking' ? 0.84 : state === 'done' ? 1.12 : 1 },
    ],
  }));

  const speed = state === 'thinking' ? 0.32 : state === 'listening' ? 0.55 : 1;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo — reaches well past the sphere so it melts into the sky */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: size * 2.4, height: size * 2.4 }, glowStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="scout-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#6D7BFF" stopOpacity="0.5" />
              <Stop offset="45%" stopColor="#4A60D8" stopOpacity="0.22" />
              <Stop offset="75%" stopColor="#3B82F6" stopOpacity="0.07" />
              <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#scout-halo)" />
        </Svg>
      </Animated.View>

      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Scout">
        <Animated.View
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
              backgroundColor: '#131F3D',
              alignItems: 'center',
              justifyContent: 'center',
            },
            orbStyle,
          ]}>
          {/* Base wash so the sphere itself glows from within */}
          <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <Defs>
              <RadialGradient id="scout-base" cx="50%" cy="42%" r="62%">
                <Stop offset="0%" stopColor="#4A5BD6" stopOpacity="0.85" />
                <Stop offset="60%" stopColor="#2B3B78" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#131F3D" stopOpacity="0.2" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#scout-base)" />
          </Svg>

          <Plume id="p1" color="#7C5CFF" size={size * 0.95} duration={9000 * speed} orbitRatio={0.12} intensity={intensity} />
          <Plume id="p2" color="#3B82F6" size={size * 0.85} duration={6400 * speed} reverse orbitRatio={0.16} intensity={intensity} />
          <Plume id="p3" color="#22D3EE" size={size * 0.6} duration={4800 * speed} orbitRatio={0.2} intensity={intensity} />
          <Plume id="p4" color="#FACC15" size={size * 0.32} duration={3600 * speed} reverse orbitRatio={0.24} intensity={intensity} />

          <Animated.View style={faceStyle}>
            <Image
              source={FACE}
              style={{
                width: size * 0.42,
                height: size * 0.42,
                borderRadius: size * 0.21,
                borderWidth: 2,
                borderColor: 'rgba(190,205,255,0.55)',
              }}
              resizeMode="cover"
            />
          </Animated.View>

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: size / 2,
              borderWidth: 1.25,
              borderColor: 'rgba(170,195,255,0.4)',
            }}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
