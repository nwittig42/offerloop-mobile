import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * How to grab your LinkedIn link, as a stepping picture sequence (Rylan
 * 2026-09-08). Eight stills from his own screen recording, each held long
 * enough to read, looping. Tap pauses on the step you are looking at; tap
 * again resumes. Plain Image components on purpose: no video module in the
 * binary, so this ships over the air, and there is nothing to buffer or fail.
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

export default function LinkedInSteps() {
  const colors = useColors();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % STEPS.length), HOLD_MS);
    return () => clearInterval(id);
  }, [paused]);

  const step = STEPS[index];

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={() => setPaused((p) => !p)}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Resume the walkthrough' : 'Pause the walkthrough'}
        style={{
          width: 210,
          aspectRatio: FRAME_W / FRAME_H,
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.surface,
        }}>
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
      </Pressable>

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
        {paused ? 'Tap the picture to resume' : 'Tap the picture to pause'}
      </Text>
    </View>
  );
}
