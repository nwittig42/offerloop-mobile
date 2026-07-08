import { LinearGradient } from 'expo-linear-gradient';
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
 * One intensity dial drives every visual: idle breathes slow, listening swells
 * with mic volume, thinking spins tight, acting/done shrink to hand the stage
 * to the work. Scout's badge face lives at the center: present at rest,
 * recessed while the motion carries meaning, forward on done.
 * Pure Reanimated + SVG + LinearGradient — OTA-safe, no native modules.
 */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'done';

const FACE = require('../../../assets/images/scout-face.png');

function Blob({
  colors,
  size,
  duration,
  reverse,
  intensity,
}: {
  colors: [string, string];
  size: number;
  duration: number;
  reverse?: boolean;
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
    const radius = 14 + intensity.value * 26;
    return {
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius },
        { scale: 1 + intensity.value * 0.25 },
      ],
      opacity: 0.75 + intensity.value * 0.25,
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size }, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}

export default function ScoutOrb({
  state,
  size = 210,
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
    const breatheScale = interpolate(breathe.value, [0, 1], [1, 1.045]);
    const vol = state === 'listening' && volume ? volume.value * 0.12 : 0;
    const shrink = state === 'acting' || state === 'done' ? 0.66 : 1;
    return {
      transform: [{ scale: breatheScale * shrink * (1 + intensity.value * 0.06 + vol) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + intensity.value * 0.55 + (state === 'listening' && volume ? volume.value * 0.2 : 0),
    transform: [{ scale: 1 + intensity.value * 0.18 }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: state === 'listening' || state === 'thinking' ? 0.45 : 1,
    transform: [{ scale: state === 'listening' || state === 'thinking' ? 0.82 : state === 'done' ? 1.12 : 1 }],
  }));

  const blobDur = state === 'thinking' ? 0.35 : state === 'listening' ? 0.6 : 1;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: size * 2.1, height: size * 2.1 }, glowStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#5B7BFF" stopOpacity="0.55" />
              <Stop offset="55%" stopColor="#3B82F6" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#halo)" />
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
              backgroundColor: '#16264A',
              alignItems: 'center',
              justifyContent: 'center',
            },
            orbStyle,
          ]}>
          <Blob colors={['#4A60A8', '#3B82F6']} size={size * 0.82} duration={9000 * blobDur} intensity={intensity} />
          <Blob colors={['#7C5CFF', '#3B82F6']} size={size * 0.7} duration={6400 * blobDur} reverse intensity={intensity} />
          <Blob colors={['#22D3EE', '#4A60A8']} size={size * 0.58} duration={4800 * blobDur} intensity={intensity} />
          <Blob colors={['#FACC15', '#7C5CFF']} size={size * 0.34} duration={3600 * blobDur} reverse intensity={intensity} />
          <Animated.View style={faceStyle}>
            <Image
              source={FACE}
              style={{
                width: size * 0.42,
                height: size * 0.42,
                borderRadius: size * 0.21,
                borderWidth: 2,
                borderColor: 'rgba(160,190,255,0.45)',
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
              borderWidth: 1.5,
              borderColor: 'rgba(160,190,255,0.35)',
            }}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
