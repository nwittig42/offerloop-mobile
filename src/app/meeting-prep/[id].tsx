import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMeetingPrep } from '@/api/endpoints/meetingPreps';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SnakeBorder from '@/components/ui/SnakeBorder';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** The prep-in-progress card: same treatment as a drafting email — a snake
 *  border (bright yellow to contrast the brown coffee theme) chasing the edge
 *  with rotating "what we're doing" phrases. */
function PrepLoadingCard({ company }: { company?: string }) {
  const colors = useColors();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const phrases = useMemo(() => {
    const base = [
      'Reading their LinkedIn',
      'Finding your common ground',
      company ? `Pulling recent ${company} news` : 'Pulling recent company news',
      'Mapping their career path',
      'Writing your talking points',
      company ? `Scanning ${company} for shared ground` : 'Scanning for shared experience',
    ];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    return base;
  }, [company]);
  const [pi, setPi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPi((p) => (p + 1) % phrases.length), 1700);
    return () => clearInterval(t);
  }, [phrases.length]);
  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        width: '100%',
        borderRadius: 16,
        backgroundColor: colors.paper,
        paddingVertical: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
        gap: 14,
      }}>
      {size.w > 0 ? <SnakeBorder w={size.w} h={size.h} color="#FACC15" radius={16} strokeWidth={3} /> : null}
      <Image
        source={require('../../../assets/images/scout-prep.png')}
        style={{ width: 120, height: 96 }}
        resizeMode="contain"
      />
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
        Prepping your brief
      </Text>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.coffee, textAlign: 'center' }}>
        {phrases[pi]}…
      </Text>
    </View>
  );
}

/** A titled prose section (icon + heading + body), only rendered when it has text. */
function PrepText({
  title,
  icon,
  color,
  body,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  body?: string;
}) {
  const colors = useColors();
  if (!body) return null;
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>{title}</Text>
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21 }}>
        {body}
      </Text>
    </Card>
  );
}

/** A titled bullet list, only rendered when it has items. */
function PrepBullets({
  title,
  icon,
  color,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: string[];
}) {
  const colors = useColors();
  if (!items.length) return null;
  return (
    <Card style={{ gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>{title}</Text>
      </View>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color, fontSize: 13.5, lineHeight: 20 }}>•</Text>
          <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
            {it}
          </Text>
        </View>
      ))}
    </Card>
  );
}

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
      <Ionicons name="cafe" size={20} color={colors.coffee} />
      <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
        Meeting prep
      </Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
        <Ionicons name="close" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );

  // Still working (or first load): show the snake-bordered preparing card.
  if (!prep || prep.status === 'processing') {
    const failedToLoad = prepQuery.isError;
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {Header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
          {failedToLoad ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
              Could not load this prep. Pull back and try again.
            </Text>
          ) : (
            <PrepLoadingCard company={prep?.company} />
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

        <PrepText
          title="Why you two connect"
          icon="sparkles-outline"
          color={colors.positive}
          body={prep.commonGround}
        />

        {prep.talkingPoints.length > 0 ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="chatbubbles-outline" size={16} color={colors.accent} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                Questions to ask
              </Text>
            </View>
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

        <PrepText
          title="How to steer the chat"
          icon="navigate-outline"
          color={colors.navy}
          body={prep.conversationStrategy}
        />
        <PrepText
          title="Company cheat sheet"
          icon="business-outline"
          color={colors.navy}
          body={prep.companyCheatSheet}
        />
        <PrepBullets
          title={`In the news`}
          icon="newspaper-outline"
          color={colors.marketing}
          items={prep.research?.companyNews ?? []}
        />
        <PrepBullets
          title="About the company"
          icon="information-circle-outline"
          color={colors.marketing}
          items={prep.research?.companyOverview ?? []}
        />
        <PrepBullets
          title="About them"
          icon="person-outline"
          color={colors.marketing}
          items={prep.research?.personMentions ?? []}
        />
        <PrepBullets
          title="Industry context"
          icon="trending-up-outline"
          color={colors.marketing}
          items={prep.research?.industryTrends ?? []}
        />

        {prep.pdfUrl ? (
          <Button
            label="Open the full prep"
            icon="document-text-outline"
            variant="outline"
            fullWidth
            onPress={() => Linking.openURL(prep.pdfUrl!)}
          />
        ) : null}

        <Text
          style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, textAlign: 'center' }}>
          Saved to your coffee library
        </Text>
      </ScrollView>
    </View>
  );
}
