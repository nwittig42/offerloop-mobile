import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Squiggle from '@/components/Squiggle';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Share your progress. A slick, brand-blue card a student can post to the
 * group chats and stories where they already talk recruiting. The rule:
 * brag about the GRIND (emails, replies, coffee chats), keep targets
 * private. Every number is real activity from the store, per the
 * no-fake-numbers rule. Scout rides along so the brand travels with it.
 * Mock note: real image capture and a true share-sheet image land in
 * Phase 3; for now Share sends a text summary.
 */

function Stat({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.paper }}>{value}</Text>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: '#DCE6FB', textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { outreach, meetingPreps } = useApp();
  const colors = useColors();

  const emailsSent = outreach.filter((o) => o.status === 'sent' || o.status === 'replied').length;
  const replies = outreach.filter((o) => o.status === 'replied').length;
  const coffeePreps = meetingPreps.length;

  const onShare = () => {
    Share.share({
      message: `My recruiting grind this week with Offerloop: ${emailsSent} outreach emails sent, ${replies} replies back, ${coffeePreps} coffee chats prepped. offerloop.ai`,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          Share your progress
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
        {/* The shareable card. */}
        <LinearGradient
          colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 22, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}>
              <Image
                source={require('../../assets/images/offerloop-logo.png')}
                style={{ width: 78, height: 19 }}
                resizeMode="contain"
                accessibilityLabel="Offerloop"
              />
            </View>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: '#DCE6FB' }}>
              my recruiting week
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Image
              source={require('../../assets/images/scout-share.png')}
              style={{ width: 150, height: 96 }}
              resizeMode="contain"
            />
          </View>

          <View style={{ alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.paper, textAlign: 'center' }}>
              The grind is paying off
            </Text>
            <Squiggle width={72} height={9} color="#9DC1F7" />
          </View>

          <View style={{ flexDirection: 'row', marginTop: 20, marginBottom: 4 }}>
            <Stat value={emailsSent} label="Emails sent" />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            <Stat value={replies} label="Replies back" />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            <Stat value={coffeePreps} label="Coffee chats prepped" />
          </View>

          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: 11,
              color: '#DCE6FB',
              textAlign: 'center',
              marginTop: 18,
            }}>
            made with offerloop.ai
          </Text>
        </LinearGradient>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
            Brag about the work, not who you are talking to. Companies you reached out to
            stay private, only your effort shows.
          </Text>
        </View>

        <Button label="Share" icon="share-outline" size="lg" fullWidth onPress={onShare} />
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
          Preview. Sharing the card as an image lands with real wiring in Phase 3.
        </Text>
      </ScrollView>
    </View>
  );
}
