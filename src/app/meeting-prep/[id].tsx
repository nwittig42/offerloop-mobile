import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMeetingPrep } from '@/api/endpoints/meetingPreps';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * A meeting prep brief. The prep runs as a background job, so this screen polls
 * it to completion: a "preparing" state while it works, then the synopsis +
 * talking points the job produced (conversationStrategy + questions).
 */
export default function MeetingPrepDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const colors = useColors();

  const prepQuery = useQuery({
    queryKey: qk.meetingPrep(id),
    queryFn: () => fetchMeetingPrep(id),
    enabled: !!id,
    // Poll while the job runs; stop once it's done or failed.
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'completed' || s === 'failed' ? false : 4000;
    },
  });
  const prep = prepQuery.data;

  const Header = (
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
  );

  // Still working (or first load): show a calm preparing state.
  if (!prep || prep.status === 'processing') {
    const failedToLoad = prepQuery.isError;
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Image
            source={require('../../../assets/images/scout-prep.png')}
            style={{ width: 120, height: 96 }}
            resizeMode="contain"
          />
          {failedToLoad ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
              Could not load this prep. Pull back and try again.
            </Text>
          ) : (
            <>
              <ActivityIndicator color={colors.navy} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink, textAlign: 'center' }}>
                Prepping your brief
              </Text>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 280,
                }}>
                Scout is reading their LinkedIn and writing your talking points. This usually
                takes a moment.
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (prep.status === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.negative} />
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
            This prep didn't finish
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, textAlign: 'center' }}>
            Your credits were refunded. Try again from the Network tab.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {Header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>
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
              {prep.title}
              {prep.title && prep.company ? ' at ' : ''}
              {prep.company}
            </Text>
          </View>
          {prep.linkedinUrl ? (
            <Ionicons name="logo-linkedin" size={18} color={colors.accent} />
          ) : null}
        </Card>

        {prep.summary ? (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              The brief
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21 }}>
              {prep.summary}
            </Text>
          </Card>
        ) : null}

        {prep.talkingPoints.length > 0 ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              Questions to ask
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
        ) : null}

        <Text
          style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, textAlign: 'center' }}>
          Saved to your coffee library
        </Text>
      </ScrollView>
    </View>
  );
}
