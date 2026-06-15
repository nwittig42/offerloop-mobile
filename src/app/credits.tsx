import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Credits, styled to match the website, with its vibrant blue energy. The
 * top is a gradient card showing the current balance, plan, and a button to
 * change plans on the web (subscription changes belong on the site). Below
 * are the buyable one-time credit packs (real prices, never expire). Mock
 * purchases until real App Store in-app purchase wiring.
 */

const PACKS = [
  { key: 'starter', label: 'STARTER', credits: 500, price: '$4.99', amount: 500 },
  { key: 'best', label: 'BEST VALUE', credits: 1000, price: '$9.99', amount: 1000, best: true },
  { key: 'bulk', label: 'BULK', credits: 3000, price: '$24.99', amount: 3000 },
];

export default function CreditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, showToast } = useApp();

  const buy = (amount: number) => {
    updateProfile({ credits: profile.credits + amount });
    showToast(`Added ${amount.toLocaleString()} credits (mock)`);
  };

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
        <Chip label="Mock preview" tone="waiting" dot />
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 40 }}>
        {/* Vibrant balance + plan + change-on-web */}
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
            <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.paper, lineHeight: 50 }}>
              {profile.credits.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.paper, paddingBottom: 9 }}>
              left
            </Text>
          </View>

          {/* Usage bar: filled portion is what's still available this month. */}
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${Math.round((profile.credits / profile.maxCredits) * 100)}%`,
                backgroundColor: colors.paper,
              }}
            />
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: '#DCE6FB' }}>
            of {profile.maxCredits.toLocaleString()} a month · {profile.resetLabel}
          </Text>

          <Pressable
            onPress={() => Linking.openURL('https://offerloop.ai/pricing')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.28)',
              borderRadius: 10,
              paddingVertical: 11,
            }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.paper }}>
              Change your plan on offerloop.ai
            </Text>
            <Ionicons name="open-outline" size={15} color={colors.paper} />
          </Pressable>
        </LinearGradient>

        {/* Packs hero, website-style serif with an italic accent */}
        <View style={{ alignItems: 'center', gap: 4, paddingTop: 4 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.4, color: colors.marketing }}>
            CREDIT PACKS
          </Text>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              color: colors.heading,
              textAlign: 'center',
              lineHeight: 36,
            }}>
            Need more credits?{' '}
            <Text style={{ fontFamily: fonts.displayItalic, color: colors.marketing }}>Top up anytime.</Text>
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13.5,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 20,
            }}>
            One-time packs. Credits you buy never expire.
          </Text>
        </View>

        {/* The packs */}
        <View style={{ gap: 18 }}>
          {PACKS.map((pack) => {
            const addColors = (
              pack.best ? ['#A855F7', '#EC4899'] : ['#4A60A8', '#3B82F6']
            ) as readonly [string, string, ...string[]];

            const content = (
              <>
                <View>
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 10.5,
                      letterSpacing: 1,
                      color: pack.best ? '#A855F7' : colors.inkTertiary,
                    }}>
                    {pack.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 38, color: colors.heading, lineHeight: 42 }}>
                      {pack.credits.toLocaleString()}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary, paddingBottom: 8 }}>
                      credits
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.ink }}>
                    {pack.price}
                  </Text>
                  <Pressable onPress={() => buy(pack.amount)} accessibilityRole="button">
                    <LinearGradient
                      colors={addColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 8,
                        paddingHorizontal: 18,
                        paddingVertical: 9,
                      }}>
                      <Ionicons name="add" size={15} color={colors.paper} />
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.paper }}>
                        Add
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </>
            );

            if (pack.best) {
              // Pink/purple gradient border. The badge is a sibling outside
              // the gradient so its rounded corners do not clip it.
              return (
                <View key={pack.key}>
                  <LinearGradient
                    colors={['#A855F7', '#EC4899'] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ borderRadius: 11.5, padding: 1.5 }}>
                    <View style={{ backgroundColor: colors.paper, borderRadius: 10, padding: 20, gap: 12 }}>
                      {content}
                    </View>
                  </LinearGradient>
                  <LinearGradient
                    colors={['#A855F7', '#EC4899'] as const}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}>
                    <Ionicons name="star" size={9} color={colors.paper} />
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 9, color: colors.paper, letterSpacing: 0.5 }}>
                      BEST VALUE
                    </Text>
                  </LinearGradient>
                </View>
              );
            }
            return (
              <Card key={pack.key} style={{ gap: 12 }}>
                {content}
              </Card>
            );
          })}
        </View>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 17,
          }}>
          Preview only. Credit packs arrive through the App Store; plan changes are
          managed on offerloop.ai.
        </Text>
      </ScrollView>
    </View>
  );
}
