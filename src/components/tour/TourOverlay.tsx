import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { useTour } from '@/components/tour/TourProvider';
import { TOUR_STEPS } from '@/components/tour/tourSteps';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The tour card: one screen-dimming layer and one card near the bottom.
 *
 * Two deliberate choices:
 *  - The tab bar stays UNDIMMED. The whole point of walking someone through
 *    five tabs is that they see where they are being taken; dimming the one
 *    control that shows it would defeat that.
 *  - No spotlight cutout around individual buttons. It is a lot of fragile
 *    measuring code for a screen someone sees once, and the card plus the live
 *    screen behind it already reads.
 *
 * The last card doubles as the notification ask, because by then the user has
 * been told what we would notify them about. That is the only place in the app
 * outside Profile → Settings where permission is requested.
 */
const TAB_BAR_SPACE = 58;

export default function TourOverlay() {
  const { active, index, total, next, end } = useTour();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notificationsEnabled, setNotificationsEnabled } = useApp();

  if (!active) return null;
  const step = TOUR_STEPS[index];
  if (!step) return null;

  const last = index === total - 1;
  const askingForPush = last && !notificationsEnabled;
  const label = askingForPush ? step.cta || 'Turn on notifications' : last ? 'Done' : 'Next';

  const onPrimary = () => {
    if (askingForPush) setNotificationsEnabled(true);
    next();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}>
      {/* The dim. Stops short of the tab bar so the nav stays readable. */}
      <View
        pointerEvents="auto"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: TAB_BAR_SPACE + insets.bottom,
          backgroundColor: 'rgba(12,16,28,0.55)',
        }}
      />

      <Animated.View
        entering={FadeInDown.duration(260)}
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: TAB_BAR_SPACE + insets.bottom + 14,
          backgroundColor: colors.paper,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: 18,
          gap: 12,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.marketing + '1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={step.icon} size={16} color={colors.marketing} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink }}>
            {step.title}
          </Text>
          <Pressable onPress={() => end('skip')} hitSlop={10} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkTertiary }}>
              Skip
            </Text>
          </Pressable>
        </View>

        <Text style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.inkSecondary }}>
          {step.body}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
          {/* Dots, not "3 of 7": the count is reassurance, not information. */}
          <View style={{ flexDirection: 'row', gap: 5, flex: 1 }}>
            {TOUR_STEPS.map((s, i) => (
              <View
                key={s.key}
                style={{
                  width: i === index ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === index ? colors.marketing : colors.hairline,
                }}
              />
            ))}
          </View>
          <Pressable
            onPress={onPrimary}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.ink,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 18,
              minWidth: 96,
              alignItems: 'center',
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.paper }}>
              {label}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
