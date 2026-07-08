import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { fonts } from '@/theme/tokens';

/**
 * P0 DESIGN PROTOTYPE — the Scout voice orb (PLAN-scout-voice.md).
 * Not user-reachable in production: opened from a preview-channel-only row in
 * Profile → Settings. Tap the orb to cycle states; this exists so the orb can
 * be FELT on-device before we commit to the design. Pure Reanimated + SVG +
 * LinearGradient (no native modules → OTA-able). The "listening" amplitude is
 * simulated here; the real build drives it from mic metering.
 */

type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'done';

const ORDER: OrbState[] = ['idle', 'listening', 'thinking', 'acting', 'done'];

const STATE_HINT: Record<OrbState, string> = {
  idle: 'Tap and ask Scout for anything',
  listening: 'Listening…',
  thinking: 'Thinking…',
  acting: 'On it — drafting 5 hiring managers…',
  done: 'Done — 5 drafts in your Inbox',
};

const TRANSCRIPT_WORDS =
  'Draft five emails to hiring managers in investment banking in Los Angeles'.split(' ');

const ORB_SIZE = 230;

/** One drifting gradient blob inside the orb. Speed/size/palette per blob so
 *  the composite feels alive instead of mechanical. */
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
    spin.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
  }, [duration, spin]);

  const style = useAnimatedStyle(() => {
    const angle = spin.value * 2 * Math.PI * (reverse ? -1 : 1);
    // Orbit radius grows with intensity — calm drift when idle, wide swirl
    // when listening/thinking.
    const radius = 18 + intensity.value * 30;
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

/** Amplitude bars under the orb while listening (Wispr-style waveform). */
function WaveBars({ active }: { active: boolean }) {
  const bars = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 34 }}>
      {bars.map((i) => (
        <WaveBar key={i} index={i} active={active} />
      ))}
    </View>
  );
}

function WaveBar({ index, active }: { index: number; active: boolean }) {
  const h = useSharedValue(6);
  useEffect(() => {
    if (!active) {
      h.value = withTiming(6, { duration: 200 });
      return;
    }
    // Pseudo-random per-bar rhythm — the real build maps mic metering here.
    const base = 8 + ((index * 37) % 14);
    h.value = withRepeat(
      withSequence(
        withTiming(base + 16, { duration: 240 + ((index * 53) % 160) }),
        withTiming(base, { duration: 200 + ((index * 31) % 140) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(h);
  }, [active, h, index]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[{ width: 4, borderRadius: 2, backgroundColor: '#9DB4FF' }, style]}
    />
  );
}

export default function ScoutOrbPreview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<OrbState>('idle');
  const [wordCount, setWordCount] = useState(0);

  // 0 = calm, 1 = fully lit. Everything visual keys off this one dial.
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
      state === 'idle' ? 0.15 : state === 'listening' ? 0.85 : state === 'thinking' ? 1 : 0.45;
    intensity.value = withSpring(target, { damping: 14, stiffness: 90 });
  }, [state, intensity]);

  // Fake live transcript while listening — words land one by one.
  useEffect(() => {
    if (state !== 'listening') {
      setWordCount(0);
      return;
    }
    const t = setInterval(
      () => setWordCount((c) => Math.min(c + 1, TRANSCRIPT_WORDS.length)),
      240,
    );
    return () => clearInterval(t);
  }, [state]);

  const orbStyle = useAnimatedStyle(() => {
    const breatheScale = interpolate(breathe.value, [0, 1], [1, 1.045]);
    const shrink = state === 'acting' || state === 'done' ? 0.62 : 1;
    return { transform: [{ scale: breatheScale * shrink * (1 + intensity.value * 0.06) }] };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + intensity.value * 0.55,
    transform: [{ scale: 1 + intensity.value * 0.18 }],
  }));

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0C1526' }}>
      {/* Ambient wash so the navy isn't flat */}
      <LinearGradient
        colors={['#12203A', '#0C1526', '#0A111F']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          paddingTop: insets.top + 14,
          paddingHorizontal: 22,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#EAF0FF' }}>Scout</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: '#8FA3CC' }}>
            Close
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        {/* Glow halo */}
        <Animated.View
          style={[
            { position: 'absolute', width: ORB_SIZE * 2.1, height: ORB_SIZE * 2.1 },
            glowStyle,
          ]}>
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

        {/* The orb */}
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Scout orb">
          <Animated.View
            style={[
              {
                width: ORB_SIZE,
                height: ORB_SIZE,
                borderRadius: ORB_SIZE / 2,
                overflow: 'hidden',
                backgroundColor: '#16264A',
                alignItems: 'center',
                justifyContent: 'center',
              },
              orbStyle,
            ]}>
            <Blob colors={['#4A60A8', '#3B82F6']} size={190} duration={9000} intensity={intensity} />
            <Blob colors={['#7C5CFF', '#3B82F6']} size={165} duration={6400} reverse intensity={intensity} />
            <Blob colors={['#22D3EE', '#4A60A8']} size={135} duration={4800} intensity={intensity} />
            <Blob colors={['#FACC15', '#7C5CFF']} size={80} duration={3600} reverse intensity={intensity} />
            {/* Inner rim light */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: ORB_SIZE / 2,
                borderWidth: 1.5,
                borderColor: 'rgba(160,190,255,0.35)',
              }}
            />
            {state === 'done' ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <Image
                  source={require('../../../assets/images/scout-wave.png')}
                  style={{ width: 96, height: 96 }}
                  resizeMode="contain"
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Pressable>

        {/* Listening extras: waveform + live transcript */}
        {state === 'listening' ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOut.duration(150)}
            style={{ alignItems: 'center', gap: 14, paddingHorizontal: 36 }}>
            <WaveBars active />
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 17,
                lineHeight: 25,
                color: '#DCE6FF',
                textAlign: 'center',
              }}>
              {TRANSCRIPT_WORDS.slice(0, wordCount).join(' ')}
              <Text style={{ color: '#5B7BFF' }}>▍</Text>
            </Text>
          </Animated.View>
        ) : (
          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: 15,
              color: '#8FA3CC',
              textAlign: 'center',
              paddingHorizontal: 40,
            }}>
            {STATE_HINT[state]}
          </Text>
        )}

        {/* Acting: a live action card in the app's light card language */}
        {state === 'acting' ? (
          <Animated.View
            entering={FadeInDown.duration(260)}
            exiting={FadeOut.duration(150)}
            style={{
              marginTop: 4,
              width: '84%',
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderColor: 'rgba(160,190,255,0.25)',
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              gap: 6,
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#EAF0FF' }}>
              Drafting 5 hiring managers · IB · Los Angeles
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: '#9DB4FF' }}>
              Found Sarah Kim at Goldman Sachs — writing your outreach…
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 12,
          color: '#5A6B8F',
          textAlign: 'center',
          paddingBottom: insets.bottom + 14,
        }}>
        Design prototype — tap the orb to cycle: {ORDER.join(' → ')}
      </Text>
    </View>
  );
}
