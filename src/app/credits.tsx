import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestWebHandoff } from '@/api/endpoints/upgrade';
import { iapAvailable } from '@/api/purchases';
import { qk } from '@/api/queryKeys';
import { presentPaywall } from '@/components/paywall/paywallBus';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Credits: the real balance + plan from /api/mobile/me, plus the web checkout
 * handoff. The app still sells nothing in-app (no IAP, no native checkout, no
 * price entry): "View plans" mints a one-time code and opens offerloop.ai in
 * Safari already signed in, where all payment happens (spec section 7 revised
 * the old "no upgrade links" guardrail to allow exactly this functional entry).
 */
export default function CreditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, showToast } = useApp();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);

  const openPlans = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const url = await requestWebHandoff();
      // One-shot foreground hook: when the user switches back from Safari,
      // refetch /me so a completed upgrade or top-up shows up right away
      // (the polished deep-link return needs a native rebuild, spec section 4).
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') {
          queryClient.invalidateQueries({ queryKey: qk.me });
          sub.remove();
        }
      });
      await Linking.openURL(url);
    } catch {
      showToast("Couldn't open plans right now. Try again.");
    } finally {
      setOpening(false);
    }
  };

  const usedPct = profile.maxCredits
    ? Math.round((profile.credits / profile.maxCredits) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.heading, flex: 1 }}>
          Credits
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 40 }}>
        {/* Balance + plan, reflected from the account. */}
        <LinearGradient
          colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.2, color: '#DCE6FB' }}>
              YOUR CREDITS
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
              <Ionicons name="ribbon-outline" size={11} color={colors.paper} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.paper }}>
                {profile.plan}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.bolt, lineHeight: 50 }}>
              {profile.credits.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.paper, paddingBottom: 9 }}>
              left
            </Text>
          </View>

          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${Math.max(0, Math.min(100, usedPct))}%`,
                backgroundColor: colors.bolt,
              }}
            />
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#DCE6FB' }}>
            of {profile.maxCredits.toLocaleString()} a month · {profile.resetLabel}
          </Text>
        </LinearGradient>

        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            How credits work
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            {/* Meeting preps are FREE (COFFEE_CHAT_CREDITS = 0, since 2026-07-07) —
                they're capped per month, not priced in credits. Saying credits pay
                for them made Rylan think a prep had charged him when it hadn't. */}
            Credits power your drafts and applications. Meeting preps are free. Your
            balance refreshes automatically each month —{' '}
            {profile.resetLabel || 'at the start of your cycle'}.
          </Text>
        </Card>

        {/* Native store (SPEC-iap-v2 section 3 trigger 4): the primary
            purchase path when IAP is live. Free users get the upgrade sheet
            (Pro trial CTA + Elite + packs); subscribers land on packs. */}
        {iapAvailable() && (
          <>
            <Pressable onPress={() => presentPaywall({ context: 'credits-screen' })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.navy,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="flash" size={19} color={colors.paper} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                    {profile.plan === 'Free' ? 'Upgrade your plan' : 'Buy a credit pack'}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                    {profile.plan === 'Free'
                      ? 'Monthly plans and one-time credit packs'
                      : 'One-time packs, credits never expire'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
              </Card>
            </Pressable>
            {profile.plan === 'Free' && (
              <Pressable
                onPress={() => presentPaywall({ context: 'credits-screen', packsFirst: true })}
                style={{ alignSelf: 'center', paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
                  Just need a few more drafts?
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* Web account handoff, demoted to plan management (spec: no steering,
            just status and where billing lives for web subscribers). Still the
            only purchase path on builds without IAP. */}
        <Pressable onPress={() => void openPlans()} disabled={opening}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: opening ? 0.6 : 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: colors.accent + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {opening ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="open-outline" size={19} color={colors.accent} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                {opening
                  ? 'Opening offerloop.ai…'
                  : iapAvailable()
                    ? 'Manage on the web'
                    : 'View plans on the web'}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                {iapAvailable()
                  ? 'Your account and billing on offerloop.ai'
                  : 'Upgrade or top up on offerloop.ai, already signed in'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 16,
          }}>
          Opens in Safari. Changes show up here as soon as you come back.
        </Text>
      </ScrollView>
    </View>
  );
}
