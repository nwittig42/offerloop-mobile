import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * A meeting prep brief: who they are plus talking points to walk in with.
 * The "Save to library" is implicit (it already lives in the store); this
 * screen just reads and presents.
 */
export default function MeetingPrepDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { meetingPreps, showToast } = useApp();

  const prep = meetingPreps.find((p) => p.id === id);

  if (!prep) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary }}>
          This prep no longer exists.
        </Text>
      </View>
    );
  }

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
        <Ionicons name="cafe" size={20} color={colors.navy} />
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
          Meeting prep
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: colors.paper2,
              borderWidth: 1,
              borderColor: colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.navy }}>
              {prep.name
                .split(' ')
                .map((p) => p.charAt(0))
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              {prep.name}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
              {prep.title} at {prep.company}
            </Text>
          </View>
          {prep.linkedinUrl ? (
            <Ionicons name="logo-linkedin" size={18} color={colors.accent} />
          ) : null}
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
            The brief
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21 }}>
            {prep.summary}
          </Text>
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
            Talking points
          </Text>
          {prep.talkingPoints.map((point, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent }}>
                  {i + 1}
                </Text>
              </View>
              <Text
                style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                {point}
              </Text>
            </View>
          ))}
        </Card>

        <Button
          label="Draft an intro to them"
          variant="accent"
          fullWidth
          onPress={() => showToast('Drafting from a prep arrives with real wiring')}
        />
        <Text
          style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, textAlign: 'center' }}>
          Saved to your coffee library
        </Text>
      </ScrollView>
    </View>
  );
}
