import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/lib/analytics';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Shared chrome for the first-run onboarding steps: a thin progress bar, an
 * optional back chevron, a display title + subtitle, a scrollable body, and a
 * pinned footer (the single CTA per step). Keeps every step visually identical
 * so the flow reads as one motion.
 */
export function OnboardingScaffold({
  step,
  total,
  title,
  subtitle,
  canBack = true,
  onBack,
  onSkip,
  headerRight,
  footer,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  canBack?: boolean;
  /** Override the back chevron (used for internal step state instead of routing). */
  onBack?: () => void;
  /** Override Skip. Required for the PRE-account intake, where the default
   *  (mark onboarding done, drop into the tabs) would push a signed-out person
   *  into the app. There it should hand off to the account step instead. */
  onSkip?: () => void;
  /** Replaces the Skip control entirely. Intake passes the Offerloop mark:
   *  there is nothing to skip TO before an account exists, so offering it was
   *  a dead end. The post-account steps keep Skip, where it is a real escape
   *  hatch that stops anyone being trapped in the flow. */
  headerRight?: ReactNode;
  footer: ReactNode;
  children?: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const pct = Math.max(0, Math.min(1, step / total));
  // Paper ground, matching Welcome (Nick 2026-08-13), rather than the Feed's
  // baby-blue wash: these are reading-and-typing screens and the tint competed
  // with the cards sitting on it. Dark keeps the night sky.
  const screenBg = scheme === 'dark' ? colors.surface : colors.paper;

  // Always-available escape: mark done + drop into the app. Guarantees the user
  // can never get trapped in the flow.
  const skip = () => {
    track('onboarding_skipped', { step, total });
    if (onSkip) {
      onSkip();
      return;
    }
    completeOnboarding();
    // Explicit /(tabs): bare '/' is ambiguous with this group's index and loops
    // back into onboarding.
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {/* Progress bar */}
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 28 }}>
          {canBack ? (
            <Pressable onPress={onBack ?? (() => router.back())} accessibilityLabel="Back" style={{ padding: 4, marginLeft: -4 }}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.hairline, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: 5, borderRadius: 3, backgroundColor: colors.marketing }} />
          </View>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary, width: 30, textAlign: 'right' }}>
            {step}/{total}
          </Text>
          {headerRight ?? (
            <Pressable onPress={skip} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSecondary }}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* KeyboardAvoidingView shrinks the scroll viewport above the keyboard:
          steps with inputs (LinkedIn, city search) were unscrollable while
          typing, hiding dropdowns and pinning the CTA under the keys. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading, lineHeight: 35 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.inkSecondary, lineHeight: 22, marginTop: 10 }}>
              {subtitle}
            </Text>
          ) : null}
          <View style={{ marginTop: 24, flex: 1 }}>{children}</View>
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, paddingTop: 8, gap: 10 }}>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
