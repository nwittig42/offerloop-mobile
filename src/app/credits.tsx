import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Credits, web-first (Flo model). The app sells nothing through Apple IAP: it
 * reflects the real balance + plan from /api/mobile/me and links out to
 * offerloop.ai to manage the plan or buy credits. The website owns checkout;
 * whatever the user buys there shows up here automatically.
 */
export default function CreditsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const colors = useColors();

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

          <Pressable
            onPress={() => Linking.openURL('https://offerloop.ai/account-settings')}
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
              Manage credits & plan on offerloop.ai
            </Text>
            <Ionicons name="open-outline" size={15} color={colors.paper} />
          </Pressable>
        </LinearGradient>

        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            More credits, more reach
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            Credits power your swipes, drafts, and meeting preps. Manage your plan and credits on
            offerloop.ai and it updates here right away.
          </Text>
        </Card>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 17,
          }}>
          Plans and credits are managed on offerloop.ai.
        </Text>
      </ScrollView>
    </View>
  );
}
