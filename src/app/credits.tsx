import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing as ReEasing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesStoreProduct } from 'react-native-purchases';

import {
  fetchPaywallData,
  fetchStorefrontCountry,
  hasAppleSubscription,
  iapAvailable,
  packActionCounts,
  packCreditAmount,
  PACK_CREDIT_AMOUNTS,
  purchaseProduct,
  showManageSubscriptions,
} from '@/api/purchases';
import { qk } from '@/api/queryKeys';
import { presentPaywall } from '@/components/paywall/paywallBus';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Credits: the real balance + plan from /api/mobile/me, and (when IAP is
 * live) the store itself: the three credit packs sit right on the screen as
 * vibrant one-tap tiles, no extra hop (Rylan 2026-07-28). Pack credit counts
 * come from the product ids (the webhook's own source of truth); every price
 * renders from StoreKit. Web management demotes to a small link inside the
 * balance card. Builds without IAP keep the old web-checkout card.
 */

/**
 * Pack banner styling (Rylan 2026-07-28, Clash-shop inspired but on-brand):
 * one purple-blue family riffing on the referral banner's #2563EB -> #7C3AED,
 * each banner shifting the grade direction and getting deeper as the pack
 * grows. Luminous gradient rims, a gold price button, and a watermark bolt
 * give the shop energy; serif numbers keep it Offerloop.
 */
const PACK_STYLES: {
  gradient: readonly [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
  rim: readonly [string, string];
  badge: string | null;
}[] = [
  {
    gradient: ['#2563EB', '#7C3AED'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    rim: ['#93C5FD', '#C4B5FD'],
    badge: null,
  },
  {
    gradient: ['#7C3AED', '#4338CA'],
    start: { x: 1, y: 0 },
    end: { x: 0, y: 1 },
    rim: ['#E9D5FF', '#818CF8'],
    badge: 'MOST POPULAR',
  },
  {
    gradient: ['#312E81', '#6D28D9'],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
    rim: ['#F0ABFC', '#A78BFA'],
    badge: 'BEST VALUE',
  },
];

/**
 * The moving gloss on a price button (Rylan 2026-08-18: "a cool moving
 * gradient on the actual price part"). A soft white band sweeps across every
 * few seconds, game-shop style: enough motion to say "this is the buy spot",
 * long enough a hold between sweeps that it never reads as strobing.
 */
function GlossSweep({ delay = 0 }: { delay?: number }) {
  const x = useSharedValue(-70);
  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withTiming(-70, { duration: delay }),
        withTiming(160, { duration: 1050, easing: ReEasing.inOut(ReEasing.quad) }),
        withTiming(160, { duration: 2200 }),
        withTiming(-70, { duration: 0 }),
      ),
      -1,
    );
  }, [delay, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: '16deg' }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: -24, bottom: -24, left: 0, width: 42 }, sweep]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** Plan chip gradients matched to PlanBorder's tier colors. */
const PLAN_CHIP: Record<string, readonly [string, string] | null> = {
  Elite: ['#7C3AED', '#A855F7'],
  Pro: ['#3B82F6', '#2563EB'],
  Free: null,
};

export default function CreditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, showToast, connection, draftsLeft, costPerSwipe } = useApp();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [howOpen, setHowOpen] = useState(false);

  // Store products for the inline tiles. null = still loading from Apple.
  const [packs, setPacks] = useState<PurchasesStoreProduct[] | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Apple-managed subscription: shows the native manage sheet row. Web
  // (Stripe) subscribers manage where they subscribed; no link from here.
  const [appleManaged, setAppleManaged] = useState(false);
  // live: baseline was captured from real /me data, not the mock fallback.
  // The grant detector requires live-to-live comparison; without it, a mock
  // flicker during refetch reads as a balance change and celebrates falsely.
  const baseline = useRef({ credits: profile.credits, plan: profile.plan, live: false });

  const loadPacks = useCallback(() => {
    if (!iapAvailable()) return;
    void fetchPaywallData().then((d) => setPacks(d.packs));
    void hasAppleSubscription().then(setAppleManaged);
  }, []);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const buyPack = useCallback(
    async (product: PurchasesStoreProduct) => {
      if (buyingId || confirming) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setBuyingId(product.identifier);
      baseline.current = {
        credits: profile.credits,
        plan: profile.plan,
        live: !connection.usingSampleData,
      };
      const r = await purchaseProduct(product);
      setBuyingId(null);
      if (r.ok) {
        // Grant lands server-side via the RevenueCat webhook; poll /me until
        // the balance moves (or give up politely, it catches up on its own).
        setConfirming(true);
        for (let i = 0; i < 8; i++) {
          await new Promise((res) => setTimeout(res, 2000));
          await queryClient.refetchQueries({ queryKey: qk.me });
        }
        setConfirming(false);
      } else if (!r.cancelled) {
        // Staging diagnostic: a full-detail alert instead of a toast. Shows
        // the product id, the App Store storefront country, and StoreKit's
        // underlying reason so sandbox failures are debuggable from a photo
        // of the screen.
        const storefront = await fetchStorefrontCountry();
        Alert.alert(
          'Purchase failed (staging diagnostics)',
          [
            `Product: ${product.identifier}`,
            `Storefront: ${storefront ?? 'unknown'}`,
            `Error: ${r.error ?? 'no detail, nothing was charged'}`,
          ].join('\n\n'),
        );
      }
    },
    [buyingId, confirming, profile.credits, profile.plan, connection.usingSampleData, queryClient, showToast],
  );

  useEffect(() => {
    if (!confirming) return;
    // Celebrate only on a real increase between two live profiles.
    if (
      baseline.current.live &&
      !connection.usingSampleData &&
      profile.credits > baseline.current.credits
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Credits added to your balance');
      setConfirming(false);
    }
  }, [confirming, profile.credits, connection.usingSampleData, showToast]);

  const usedPct = profile.maxCredits
    ? Math.round((profile.credits / profile.maxCredits) * 100)
    : 0;

  const iapLive = iapAvailable();

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

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}>
        {/* Balance + plan, reflected from the account. Web management lives
            here as a quiet link instead of its own card. */}
        <LinearGradient
          colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.2, color: '#DCE6FB' }}>
              YOUR CREDITS
            </Text>
            <LinearGradient
              colors={PLAN_CHIP[profile.plan] ?? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.18)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
              <Ionicons name="ribbon-outline" size={11} color={colors.paper} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.paper }}>
                {profile.plan}
              </Text>
            </LinearGradient>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.bolt, lineHeight: 50 }}>
              {profile.credits.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.paper, paddingBottom: 9 }}>
              left
            </Text>
            <View style={{ flex: 1 }} />
            {/* No web-management link when IAP is live: the web account page
                reaches Stripe checkout, and any road from the app to an
                external purchase is a 3.1.1 rejection (builds 11 to 14). */}
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
          {/* What the balance BUYS. This line used to live on the profile
              banner; the banner is gone, and the number is more use here,
              next to the balance it describes. */}
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: '#DCE6FB' }}>
            {draftsLeft > 0
              ? `${draftsLeft} ${draftsLeft === 1 ? 'draft' : 'drafts'} left · ${costPerSwipe} credits each`
              : 'Out of credits'}
          </Text>
        </LinearGradient>

        {/* Free users: the plans live in the sheet (Pro trial + Elite). */}
        {iapLive && profile.plan === 'Free' && (
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
                  Upgrade your plan
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  Monthly plans with a bigger credit allowance
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Card>
          </Pressable>
        )}

        {/* The packs, right here: three one-tap tiles. Credit counts come from
            the product ids; prices only ever from StoreKit. */}
        {iapLive && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                Credit packs
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                one-time, never expire
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {(packs && packs.length > 0 ? packs : [null, null, null]).map((p, i) => {
                const amount = p ? packCreditAmount(p.identifier) : PACK_CREDIT_AMOUNTS[i];
                const style = PACK_STYLES[i] ?? PACK_STYLES[0];
                const busyThis = p ? buyingId === p.identifier : false;
                return (
                  <Animated.View
                    key={p?.identifier ?? `pack-${i}`}
                    entering={FadeInDown.duration(380).delay(i * 90)}>
                    <Pressable
                      disabled={Boolean(buyingId) || confirming}
                      onPress={() => {
                        if (p) void buyPack(p);
                        else {
                          showToast('Prices are still syncing from Apple. Retrying…');
                          loadPacks();
                        }
                      }}
                      style={{
                        opacity: buyingId && !busyThis ? 0.55 : 1,
                        transform: [{ scale: 1 }],
                      }}>
                      {/* Luminous rim, Clash-panel style: a thin gradient frame. */}
                      <LinearGradient
                        colors={style.rim}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 21, padding: 2 }}>
                        <LinearGradient
                          colors={style.gradient}
                          start={style.start}
                          end={style.end}
                          style={{
                            borderRadius: 19,
                            // Bigger boxes (Rylan 2026-08-18): the shop is the
                            // page's whole job, so the tiles fill it.
                            paddingVertical: 30,
                            paddingHorizontal: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            overflow: 'hidden',
                          }}>
                          {/* Watercolor mountains wash (same art as Profile /
                              Milestones) + watermark bolt for depth. */}
                          <Image
                            source={require('../../assets/images/watercolor-mountains.webp')}
                            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: 0.16 }]}
                            resizeMode="cover"
                          />
                          <Ionicons
                            name="flash"
                            size={116}
                            color="rgba(255,255,255,0.10)"
                            style={{
                              position: 'absolute',
                              right: -16,
                              top: -14,
                              transform: [{ rotate: '-14deg' }],
                            }}
                          />

                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
                              <Ionicons
                                name="flash"
                                size={19}
                                color={colors.bolt}
                                style={{ marginBottom: 8 }}
                              />
                              <Text
                                style={{
                                  fontFamily: fonts.display,
                                  fontSize: 40,
                                  color: '#FFFFFF',
                                  lineHeight: 42,
                                }}>
                                {amount != null ? amount.toLocaleString() : ''}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: fonts.sansSemibold,
                                  fontSize: 11,
                                  letterSpacing: 1,
                                  color: 'rgba(255,255,255,0.85)',
                                  paddingBottom: 8,
                                }}>
                                CREDITS
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontFamily: fonts.sansMedium,
                                fontSize: 11.5,
                                color: 'rgba(255,255,255,0.88)',
                              }}>
                              {amount != null
                                ? (() => {
                                    const c = packActionCounts(amount, profile.creditsPerSwipe);
                                    return `≈ ${c.drafts} drafts · ${c.applies} auto-applies`;
                                  })()
                                : ''}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: 7 }}>
                            {style.badge && (
                              <View
                                style={{
                                  backgroundColor: 'rgba(255,255,255,0.24)',
                                  borderRadius: 6,
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                }}>
                                <Text
                                  style={{
                                    fontFamily: fonts.sansSemibold,
                                    fontSize: 9.5,
                                    letterSpacing: 0.7,
                                    color: '#FFFFFF',
                                  }}>
                                  {style.badge}
                                </Text>
                              </View>
                            )}
                            {/* Chunky gold price button, Clash-style, with a
                                looping gloss sweep. Staggered per tile so the
                                three don't flash in unison. */}
                            <LinearGradient
                              colors={['#FDE047', '#F59E0B'] as const}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={{
                                borderRadius: 12,
                                paddingHorizontal: 18,
                                paddingVertical: 11,
                                minWidth: 84,
                                alignItems: 'center',
                                overflow: 'hidden',
                              }}>
                              {busyThis || !p ? (
                                <ActivityIndicator size="small" color="#7C3AED" />
                              ) : (
                                <Text
                                  style={{
                                    fontFamily: fonts.sansSemibold,
                                    fontSize: 17,
                                    color: '#111318',
                                  }}>
                                  {p.priceString}
                                </Text>
                              )}
                              <GlossSweep delay={600 + i * 1100} />
                            </LinearGradient>
                          </View>
                        </LinearGradient>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {packs !== null && packs.length === 0 && (
              <Pressable onPress={loadPacks}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, textAlign: 'center' }}>
                  Apple is still preparing the store items. Tap to retry.
                </Text>
              </Pressable>
            )}
            {confirming && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                  Confirming your purchase, credits land in a moment…
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Apple-managed subscribers get Apple's native manage sheet (cancel,
            switch plans). Never a web link. */}
        {iapLive && appleManaged && profile.plan !== 'Free' && (
          <Pressable
            onPress={() => void showManageSubscriptions()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.inkSecondary }}>
              Manage subscription
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
          </Pressable>
        )}

        {/* How credits work, demoted to a quiet expandable row. */}
        <Pressable
          onPress={() => setHowOpen((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.inkSecondary }}>
            How credits work
          </Text>
          <Ionicons name={howOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkTertiary} />
        </Pressable>
        {howOpen && (
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              color: colors.inkSecondary,
              lineHeight: 20,
              marginTop: -8,
            }}>
            {/* Meeting preps are FREE (COFFEE_CHAT_CREDITS = 0, since 2026-07-07),
                capped per month, not priced in credits. */}
            Credits power your drafts and applications. Meeting preps are free. Your monthly
            allowance refreshes automatically{' '}
            {profile.resetLabel ? `(${profile.resetLabel})` : 'at the start of your cycle'}, and
            purchased pack credits never expire.
          </Text>
        )}

      </ScrollView>
    </View>
  );
}
