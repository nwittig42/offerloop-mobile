import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchPaywallData,
  fetchStorefrontCountry,
  hasAppleSubscription,
  iapAvailable,
  packActionCounts,
  packCreditAmount,
  purchasePackage,
  purchaseProduct,
  restorePurchases,
  type PaywallData,
} from '@/api/purchases';
import { qk } from '@/api/queryKeys';
import { type PaywallContext } from '@/components/paywall/paywallBus';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The one purchase sheet, two modes (SPEC-iap-v2 section 3):
 * - Free user: upgrade sheet. Pro trial CTA, Elite listed as the anchor,
 *   "Just need a few more drafts?" reveals the packs.
 * - Pro/Elite user: top-up sheet. Three packs, one tap, Face ID.
 * Every price string renders from the store offering, never hardcoded.
 * Purchases grant server-side; after buying we poll /me until the balance or
 * tier moves (webhook race, ~15s), then close.
 *
 * Rendered as the CONTENT of the /paywall route (native formSheet), never as
 * a JS <Modal>: root-hosted JS modals fail to present on iOS 26 when a native
 * modal is already up, which App Review read as an unresponsive button.
 *
 * Visual language mirrors the Credits screen shop (Rylan 2026-07-30): the
 * same purple-blue gradient banners with luminous rims, the watercolor
 * mountains wash, serif numbers, and gold price chips.
 */

const TERMS_URL = 'https://offerloop.ai/terms-of-service';
const PRIVACY_URL = 'https://offerloop.ai/privacy';

const MOUNTAINS = require('../../../assets/images/watercolor-mountains.webp');

/** Same family as the Credits screen PACK_STYLES; keep the two in sync. */
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

const PRO_STYLE = PACK_STYLES[0];
const ELITE_STYLE = PACK_STYLES[2];
const GOLD: readonly [string, string] = ['#FDE047', '#F59E0B'];

function Rim({
  rim,
  children,
  marginTop = 0,
}: {
  rim: readonly [string, string];
  children: React.ReactNode;
  marginTop?: number;
}) {
  return (
    <LinearGradient
      colors={rim}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 21, padding: 2, marginTop }}>
      {children}
    </LinearGradient>
  );
}

export default function PaywallSheet({
  context: _context,
  packsFirst,
  onClose,
}: {
  context: PaywallContext | undefined;
  packsFirst: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile, showToast, connection } = useApp();

  const isSubscriber = profile.plan !== 'Free';
  const [data, setData] = useState<PaywallData | null>(null);
  const [showPacks, setShowPacks] = useState(isSubscriber || packsFirst);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Plan switching (Pro <-> Elite) renders ONLY for Apple-managed
  // subscriptions. A web (Stripe) subscriber must never see a path to a
  // second, parallel Apple subscription.
  const [appleManaged, setAppleManaged] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchPaywallData().then((d) => {
      if (alive) setData(d);
    });
    void hasAppleSubscription().then((v) => {
      if (alive) setAppleManaged(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  // After a successful purchase, the server grant lands via webhook. Poll /me
  // until credits or plan move, then celebrate and close. Give up politely at
  // ~16s; the balance still refreshes on the next normal refetch.
  // live: baseline came from real /me data, not the mock fallback. The grant
  // detector requires a live-to-live comparison so a mock flicker during
  // refetch cannot read as a balance change and celebrate falsely.
  const baseline = useRef({ credits: profile.credits, plan: profile.plan, live: false });
  const pollUntilGranted = useCallback(async () => {
    setProcessing(true);
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      await queryClient.refetchQueries({ queryKey: qk.me });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!processing) return;
    // Celebrate only on a real change between two live profiles: a balance
    // increase (pack) or a plan change (subscription).
    if (!baseline.current.live || connection.usingSampleData) return;
    if (
      profile.credits > baseline.current.credits ||
      profile.plan !== baseline.current.plan
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('You are all set, balance updated');
      onClose();
    }
  }, [processing, profile.credits, profile.plan, connection.usingSampleData, showToast, onClose]);

  // Staging diagnostic, same as the Credits screen: show the full reason so
  // sandbox failures are debuggable from a photo of the phone.
  const showFailure = useCallback(async (productId: string, error?: string) => {
    const storefront = await fetchStorefrontCountry();
    Alert.alert(
      'Purchase failed (staging diagnostics)',
      [
        `Product: ${productId}`,
        `Storefront: ${storefront ?? 'unknown'}`,
        `Error: ${error ?? 'no detail, nothing was charged'}`,
      ].join('\n\n'),
    );
  }, []);

  const buyPro = useCallback(async () => {
    if (!data?.proPackage || busy) return;
    // Elite -> Pro is a DOWNGRADE: Apple applies it at the next renewal, so
    // there is no server-side change to poll for. Acknowledge and close.
    const isDowngrade = profile.plan === 'Elite';
    setBusy(true);
    baseline.current = {
      credits: profile.credits,
      plan: profile.plan,
      live: !connection.usingSampleData,
    };
    const r = await purchasePackage(data.proPackage);
    setBusy(false);
    if (r.ok) {
      if (isDowngrade) {
        showToast('Switch scheduled: Pro starts at your next renewal');
        onClose();
      } else {
        void pollUntilGranted();
      }
    } else if (!r.cancelled) void showFailure(data.proPackage.product.identifier, r.error);
  }, [data, busy, profile.credits, profile.plan, connection.usingSampleData, pollUntilGranted, showFailure, showToast, onClose]);

  const buyElite = useCallback(async () => {
    if (!data?.elitePackage || busy) return;
    setBusy(true);
    baseline.current = {
      credits: profile.credits,
      plan: profile.plan,
      live: !connection.usingSampleData,
    };
    const r = await purchasePackage(data.elitePackage);
    setBusy(false);
    if (r.ok) void pollUntilGranted();
    else if (!r.cancelled) void showFailure(data.elitePackage.product.identifier, r.error);
  }, [data, busy, profile.credits, profile.plan, connection.usingSampleData, pollUntilGranted, showFailure]);

  const buyPack = useCallback(
    async (productId: string) => {
      const product = data?.packs.find((p) => p.identifier === productId);
      if (!product || busy) return;
      setBusy(true);
      baseline.current = {
      credits: profile.credits,
      plan: profile.plan,
      live: !connection.usingSampleData,
    };
      const r = await purchaseProduct(product);
      setBusy(false);
      if (r.ok) void pollUntilGranted();
      else if (!r.cancelled) void showFailure(productId, r.error);
    },
    [data, busy, profile.credits, profile.plan, connection.usingSampleData, pollUntilGranted, showFailure],
  );

  const onRestore = useCallback(async () => {
    setBusy(true);
    const ok = await restorePurchases();
    setBusy(false);
    if (ok) {
      await queryClient.refetchQueries({ queryKey: qk.me });
      showToast('Purchases restored');
    } else {
      showToast('Nothing to restore on this Apple ID');
    }
  }, [queryClient, showToast]);

  const pro = data?.proPackage ?? null;
  const elite = data?.elitePackage ?? null;
  const proPrice = pro?.product.priceString ?? '';
  const hasTrial = Boolean(pro?.product.introPrice && pro.product.introPrice.price === 0);

  // Store builds always have IAP; this only trips in Expo Go or a build made
  // before the SDK was added. Close instead of rendering a dead screen.
  const iapLive = iapAvailable();
  useEffect(() => {
    if (!iapLive) onClose();
  }, [iapLive, onClose]);
  if (!iapLive) return null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        paddingTop: 12,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 16,
      }}>
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.hairline,
            marginBottom: 14,
          }}
        />
        <ScrollView showsVerticalScrollIndicator={false}>
          {processing ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 14 }}>
              <ActivityIndicator color={colors.navy} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
                Confirming your purchase…
              </Text>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                }}>
                Processing. If this takes more than a minute, your balance updates the next time
                you open Credits.
              </Text>
            </View>
          ) : data === null ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={colors.navy} />
            </View>
          ) : !data.proPackage && !data.elitePackage && data.packs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
              <Ionicons name="cart-outline" size={26} color={colors.inkTertiary} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
                The store is warming up
              </Text>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  lineHeight: 19,
                }}>
                Apple is still preparing the plans and packs. This usually takes a few minutes for
                new items. Check back shortly.
              </Text>
              <Pressable
                onPress={() => {
                  setData(null);
                  void fetchPaywallData().then(setData);
                }}
                style={{ paddingVertical: 6, paddingHorizontal: 14 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.accent }}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!isSubscriber && (
                <>
                  <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading }}>
                    Keep the outreach going
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 13.5,
                      color: colors.inkSecondary,
                      marginTop: 4,
                      marginBottom: 16,
                    }}>
                    Student pricing, built for recruiting season.
                  </Text>

                  {pro && (
                    <Rim rim={PRO_STYLE.rim}>
                      <LinearGradient
                        colors={PRO_STYLE.gradient}
                        start={PRO_STYLE.start}
                        end={PRO_STYLE.end}
                        style={{ borderRadius: 19, padding: 18, overflow: 'hidden' }}>
                        <Image
                          source={MOUNTAINS}
                          resizeMode="cover"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0.16,
                          }}
                        />
                        <Ionicons
                          name="flash"
                          size={116}
                          color="rgba(255,255,255,0.10)"
                          style={{ position: 'absolute', right: -18, bottom: -22 }}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              fontFamily: fonts.sansSemibold,
                              fontSize: 12.5,
                              letterSpacing: 1.2,
                              color: 'rgba(255,255,255,0.9)',
                            }}>
                            OFFERLOOP PRO
                          </Text>
                          <Text
                            style={{
                              fontFamily: fonts.display,
                              fontSize: 32,
                              color: '#FFFFFF',
                              marginLeft: 'auto',
                            }}>
                            {proPrice}
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: fonts.sans,
                                color: 'rgba(255,255,255,0.8)',
                              }}>
                              /mo
                            </Text>
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 13,
                            color: 'rgba(255,255,255,0.85)',
                            marginTop: 6,
                          }}>
                          2,000 credits a month for drafts, contacts, and auto-applies.
                        </Text>
                        <Pressable
                          onPress={() => void buyPro()}
                          disabled={busy}
                          style={{ marginTop: 14, opacity: busy ? 0.6 : 1 }}>
                          <LinearGradient
                            colors={GOLD}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={{
                              borderRadius: 12,
                              height: 46,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 15.5,
                                color: '#451A03',
                              }}>
                              {hasTrial ? 'Start 7-day free trial' : `Get Pro for ${proPrice}/mo`}
                            </Text>
                          </LinearGradient>
                        </Pressable>
                        {hasTrial && (
                          <Text
                            style={{
                              fontFamily: fonts.sans,
                              fontSize: 12,
                              color: 'rgba(255,255,255,0.8)',
                              textAlign: 'center',
                              marginTop: 8,
                            }}>
                            7 days free, then {proPrice}/mo. Cancel anytime.
                          </Text>
                        )}
                      </LinearGradient>
                    </Rim>
                  )}

                  {elite && (
                    <Rim rim={ELITE_STYLE.rim} marginTop={10}>
                      <Pressable onPress={() => void buyElite()} disabled={busy}>
                        <LinearGradient
                          colors={ELITE_STYLE.gradient}
                          start={ELITE_STYLE.start}
                          end={ELITE_STYLE.end}
                          style={{
                            borderRadius: 19,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            overflow: 'hidden',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            opacity: busy ? 0.6 : 1,
                          }}>
                          <Image
                            source={MOUNTAINS}
                            resizeMode="cover"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              width: '100%',
                              height: '100%',
                              opacity: 0.14,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 12,
                                letterSpacing: 1.1,
                                color: 'rgba(255,255,255,0.9)',
                              }}>
                              OFFERLOOP ELITE
                            </Text>
                            <Text
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 12.5,
                                color: 'rgba(255,255,255,0.85)',
                                marginTop: 3,
                              }}>
                              5,000 credits a month for a heavy recruiting push.
                            </Text>
                          </View>
                          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: '#FFFFFF' }}>
                            {elite.product.priceString}
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: fonts.sans,
                                color: 'rgba(255,255,255,0.8)',
                              }}>
                              /mo
                            </Text>
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </Rim>
                  )}

                  <Pressable
                    onPress={() => setShowPacks((v) => !v)}
                    style={{ paddingVertical: 4, marginTop: 12 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.accent }}>
                      Just need a few more drafts?
                    </Text>
                  </Pressable>
                </>
              )}

              {isSubscriber && (
                <>
                  <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.heading }}>
                    Top up your credits
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 13.5,
                      color: colors.inkSecondary,
                      marginTop: 4,
                      marginBottom: 12,
                    }}>
                    Purchased credits never expire and sit on top of your monthly allowance.
                  </Text>

                  {/* Plan switching, Apple-managed subscriptions only (both
                      plans share one subscription group, so Apple handles
                      proration on upgrade and next-renewal timing on
                      downgrade). Web subscribers never see these. */}
                  {appleManaged && profile.plan === 'Pro' && elite && (
                    <Rim rim={ELITE_STYLE.rim} marginTop={2}>
                      <Pressable onPress={() => void buyElite()} disabled={busy}>
                        <LinearGradient
                          colors={ELITE_STYLE.gradient}
                          start={ELITE_STYLE.start}
                          end={ELITE_STYLE.end}
                          style={{
                            borderRadius: 19,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            overflow: 'hidden',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            opacity: busy ? 0.6 : 1,
                          }}>
                          <Image
                            source={MOUNTAINS}
                            resizeMode="cover"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              width: '100%',
                              height: '100%',
                              opacity: 0.14,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 12,
                                letterSpacing: 1.1,
                                color: 'rgba(255,255,255,0.9)',
                              }}>
                              UPGRADE TO ELITE
                            </Text>
                            <Text
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 12.5,
                                color: 'rgba(255,255,255,0.85)',
                                marginTop: 3,
                              }}>
                              5,000 credits a month. Applies right away, Apple prorates the
                              difference.
                            </Text>
                          </View>
                          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: '#FFFFFF' }}>
                            {elite.product.priceString}
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: fonts.sans,
                                color: 'rgba(255,255,255,0.8)',
                              }}>
                              /mo
                            </Text>
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </Rim>
                  )}
                  {appleManaged && profile.plan === 'Elite' && pro && (
                    <Rim rim={PRO_STYLE.rim} marginTop={2}>
                      <Pressable onPress={() => void buyPro()} disabled={busy}>
                        <LinearGradient
                          colors={PRO_STYLE.gradient}
                          start={PRO_STYLE.start}
                          end={PRO_STYLE.end}
                          style={{
                            borderRadius: 19,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            overflow: 'hidden',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            opacity: busy ? 0.6 : 1,
                          }}>
                          <Image
                            source={MOUNTAINS}
                            resizeMode="cover"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              width: '100%',
                              height: '100%',
                              opacity: 0.14,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 12,
                                letterSpacing: 1.1,
                                color: 'rgba(255,255,255,0.9)',
                              }}>
                              SWITCH TO PRO
                            </Text>
                            <Text
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 12.5,
                                color: 'rgba(255,255,255,0.85)',
                                marginTop: 3,
                              }}>
                              2,000 credits a month. Starts at your next renewal, Elite runs
                              until then.
                            </Text>
                          </View>
                          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: '#FFFFFF' }}>
                            {proPrice}
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: fonts.sans,
                                color: 'rgba(255,255,255,0.8)',
                              }}>
                              /mo
                            </Text>
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </Rim>
                  )}
                  {appleManaged && (
                    <View style={{ height: 10 }} />
                  )}
                </>
              )}

              {showPacks &&
                data.packs.map((p, i) => {
                  const amount = packCreditAmount(p.identifier);
                  const style = PACK_STYLES[i] ?? PACK_STYLES[0];
                  const counts =
                    typeof amount === 'number'
                      ? packActionCounts(amount, profile.creditsPerSwipe)
                      : null;
                  return (
                    <Rim key={p.identifier} rim={style.rim} marginTop={10}>
                      <Pressable onPress={() => void buyPack(p.identifier)} disabled={busy}>
                        <LinearGradient
                          colors={style.gradient}
                          start={style.start}
                          end={style.end}
                          style={{
                            borderRadius: 19,
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            overflow: 'hidden',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            opacity: busy ? 0.6 : 1,
                          }}>
                          <Image
                            source={MOUNTAINS}
                            resizeMode="cover"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              width: '100%',
                              height: '100%',
                              opacity: 0.14,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <Ionicons name="flash" size={15} color="#FDE047" />
                              <Text
                                style={{ fontFamily: fonts.display, fontSize: 24, color: '#FFFFFF' }}>
                                {typeof amount === 'number' ? amount.toLocaleString() : p.title}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: fonts.sansSemibold,
                                  fontSize: 11,
                                  letterSpacing: 1,
                                  color: 'rgba(255,255,255,0.85)',
                                }}>
                                CREDITS
                              </Text>
                              {style.badge && (
                                <View
                                  style={{
                                    backgroundColor: 'rgba(255,255,255,0.22)',
                                    borderRadius: 7,
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    marginLeft: 'auto',
                                  }}>
                                  <Text
                                    style={{
                                      fontFamily: fonts.sansSemibold,
                                      fontSize: 9.5,
                                      letterSpacing: 0.6,
                                      color: '#FFFFFF',
                                    }}>
                                    {style.badge}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {counts && (
                              <Text
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: 11.5,
                                  color: 'rgba(255,255,255,0.85)',
                                  marginTop: 3,
                                }}>
                                {'≈'} {counts.drafts} drafts {'·'} {counts.applies}{' '}
                                auto-applies
                              </Text>
                            )}
                          </View>
                          <LinearGradient
                            colors={GOLD}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={{
                              borderRadius: 10,
                              paddingHorizontal: 14,
                              paddingVertical: 9,
                            }}>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 14.5,
                                color: '#451A03',
                              }}>
                              {p.priceString}
                            </Text>
                          </LinearGradient>
                        </LinearGradient>
                      </Pressable>
                    </Rim>
                  );
                })}

              {showPacks && !isSubscriber && pro && (
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12.5,
                    color: colors.inkSecondary,
                    marginTop: 10,
                  }}>
                  Pro members get 2,000 credits a month for {proPrice}.
                </Text>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 18,
                  marginTop: 18,
                }}>
                <Pressable onPress={() => void onRestore()} disabled={busy}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                    Restore Purchases
                  </Text>
                </Pressable>
                <Pressable onPress={() => void Linking.openURL(TERMS_URL)}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                    Terms of Use
                  </Text>
                </Pressable>
                <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 11.5,
                  color: colors.inkTertiary,
                  textAlign: 'center',
                  marginTop: 8,
                }}>
                Subscriptions auto-renew until canceled. Manage in Settings.
              </Text>
              <Pressable onPress={onClose} style={{ alignSelf: 'center', padding: 10, marginTop: 2 }}>
                <Ionicons name="close" size={20} color={colors.inkTertiary} />
              </Pressable>
            </>
          )}
        </ScrollView>
    </View>
  );
}
