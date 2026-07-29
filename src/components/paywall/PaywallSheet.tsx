import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchPaywallData,
  iapAvailable,
  packActionFraming,
  packCreditAmount,
  purchasePackage,
  purchaseProduct,
  restorePurchases,
  type PaywallData,
} from '@/api/purchases';
import { qk } from '@/api/queryKeys';
import { onPresentPaywall, type PaywallRequest } from '@/components/paywall/paywallBus';
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
 */

const TERMS_URL = 'https://offerloop.ai/terms-of-service';
const PRIVACY_URL = 'https://offerloop.ai/privacy';

export default function PaywallHost() {
  const [request, setRequest] = useState<PaywallRequest | null>(null);
  useEffect(() => onPresentPaywall((req) => setRequest(req)), []);
  if (!request) return null;
  return <PaywallSheet request={request} onClose={() => setRequest(null)} />;
}

function PaywallSheet({ request, onClose }: { request: PaywallRequest; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile, showToast } = useApp();

  const isSubscriber = profile.plan !== 'Free';
  const [data, setData] = useState<PaywallData | null>(null);
  const [showPacks, setShowPacks] = useState(isSubscriber || Boolean(request.packsFirst));
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchPaywallData().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  // After a successful purchase, the server grant lands via webhook. Poll /me
  // until credits or plan move, then celebrate and close. Give up politely at
  // ~16s; the balance still refreshes on the next normal refetch.
  const baseline = useRef({ credits: profile.credits, plan: profile.plan });
  const pollUntilGranted = useCallback(async () => {
    setProcessing(true);
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      await queryClient.refetchQueries({ queryKey: qk.me });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!processing) return;
    if (profile.credits !== baseline.current.credits || profile.plan !== baseline.current.plan) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('You are all set, balance updated');
      onClose();
    }
  }, [processing, profile.credits, profile.plan, showToast, onClose]);

  const buyPro = useCallback(async () => {
    if (!data?.proPackage || busy) return;
    setBusy(true);
    baseline.current = { credits: profile.credits, plan: profile.plan };
    const r = await purchasePackage(data.proPackage);
    setBusy(false);
    if (r.ok) {
      void pollUntilGranted();
    } else if (!r.cancelled) {
      showToast('Purchase did not go through, nothing was charged');
    }
  }, [data, busy, profile.credits, profile.plan, pollUntilGranted, showToast]);

  const buyElite = useCallback(async () => {
    if (!data?.elitePackage || busy) return;
    setBusy(true);
    baseline.current = { credits: profile.credits, plan: profile.plan };
    const r = await purchasePackage(data.elitePackage);
    setBusy(false);
    if (r.ok) void pollUntilGranted();
    else if (!r.cancelled) showToast('Purchase did not go through, nothing was charged');
  }, [data, busy, profile.credits, profile.plan, pollUntilGranted, showToast]);

  const buyPack = useCallback(
    async (productId: string) => {
      const product = data?.packs.find((p) => p.identifier === productId);
      if (!product || busy) return;
      setBusy(true);
      baseline.current = { credits: profile.credits, plan: profile.plan };
      const r = await purchaseProduct(product);
      setBusy(false);
      if (r.ok) void pollUntilGranted();
      else if (!r.cancelled) showToast('Purchase did not go through, nothing was charged');
    },
    [data, busy, profile.credits, profile.plan, pollUntilGranted, showToast],
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

  if (!iapAvailable()) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(10,14,24,0.45)' }}
        onPress={processing ? undefined : onClose}
      />
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          maxHeight: '86%',
        }}>
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.hairline,
            marginBottom: 12,
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
                    <View
                      style={{
                        borderWidth: 1.5,
                        borderColor: colors.navy,
                        borderRadius: 10,
                        padding: 16,
                        gap: 8,
                        marginBottom: 10,
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                        <Text
                          style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
                          Offerloop Pro
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.display,
                            fontSize: 24,
                            color: colors.heading,
                            marginLeft: 'auto',
                          }}>
                          {proPrice}
                          <Text style={{ fontSize: 14, fontFamily: fonts.sans, color: colors.inkSecondary }}>
                            /mo
                          </Text>
                        </Text>
                      </View>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary }}>
                        2,000 credits a month for drafts, contacts, and auto-applies.
                      </Text>
                      <Pressable
                        onPress={() => void buyPro()}
                        disabled={busy}
                        style={{
                          backgroundColor: colors.ink,
                          borderRadius: 8,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: busy ? 0.6 : 1,
                          marginTop: 4,
                        }}>
                        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.paper }}>
                          {hasTrial ? 'Start 7-day free trial' : `Get Pro for ${proPrice}/mo`}
                        </Text>
                      </Pressable>
                      {hasTrial && (
                        <Text
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 12,
                            color: colors.inkTertiary,
                            textAlign: 'center',
                          }}>
                          7 days free, then {proPrice}/mo. Cancel anytime.
                        </Text>
                      )}
                    </View>
                  )}

                  {elite && (
                    <Pressable
                      onPress={() => void buyElite()}
                      disabled={busy}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.hairline,
                        borderRadius: 10,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 14,
                        opacity: busy ? 0.6 : 1,
                      }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                          Offerloop Elite
                        </Text>
                        <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                          5,000 credits a month for a heavy recruiting push.
                        </Text>
                      </View>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                        {elite.product.priceString}/mo
                      </Text>
                    </Pressable>
                  )}

                  <Pressable onPress={() => setShowPacks((v) => !v)} style={{ paddingVertical: 4 }}>
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
                </>
              )}

              {showPacks &&
                data.packs.map((p) => {
                  const amount = packCreditAmount(p.identifier);
                  const badge =
                    amount === 400 ? 'Most popular' : amount === 1000 ? 'Best value' : null;
                  return (
                    <Pressable
                      key={p.identifier}
                      onPress={() => void buyPack(p.identifier)}
                      disabled={busy}
                      style={{
                        borderWidth: 1,
                        borderColor: badge === 'Most popular' ? colors.navy : colors.hairline,
                        borderRadius: 10,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 8,
                        opacity: busy ? 0.6 : 1,
                      }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                            {p.title || `${amount ?? ''} credits`}
                          </Text>
                          {badge && (
                            <View
                              style={{
                                backgroundColor: colors.navy,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                              }}>
                              <Text
                                style={{ fontFamily: fonts.sansSemibold, fontSize: 10.5, color: colors.paper }}>
                                {badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        {typeof amount === 'number' && (
                          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                            {packActionFraming(amount, profile.creditsPerSwipe)}
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                        {p.priceString}
                      </Text>
                    </Pressable>
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
    </Modal>
  );
}
