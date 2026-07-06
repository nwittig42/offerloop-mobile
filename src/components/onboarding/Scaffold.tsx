import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/lib/analytics';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
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
  footer: ReactNode;
  children?: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const pct = Math.max(0, Math.min(1, step / total));

  // Always-available escape: mark done + drop into the app. Guarantees the user
  // can never get trapped in the flow.
  const skip = () => {
    track('onboarding_skipped', { step, total });
    completeOnboarding();
    // Explicit /(tabs): bare '/' is ambiguous with this group's index and loops
    // back into onboarding.
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.feedBg }}>
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
          <Pressable onPress={skip} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSecondary }}>Skip</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
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
    </View>
  );
}
