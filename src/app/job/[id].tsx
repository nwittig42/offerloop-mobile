import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JobCard from '@/components/feed/JobCard';
import { ActionCircle } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Expanded job detail (tap a card in the deck). Full description plus the
 * same commit actions docked at the bottom, so a user can draft from here.
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { jobs, profile, passJob, draftJob } = useApp();
  const insets = useSafeAreaInsets();

  const job = jobs.find((j) => j.id === id);
  const draftsLeft = Math.max(0, profile.dailyDraftCap - profile.dailyDraftsUsed);

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary }}>
          This card is no longer in your deck.
        </Text>
      </View>
    );
  }

  const commit = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      draftJob(job.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(job.id);
    }
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        <JobCard job={job} expanded />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
          backgroundColor: colors.paper,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 18,
        }}>
        <ActionCircle icon="close" tone="negative" onPress={() => commit('left')} />
        <ActionCircle
          icon="paper-plane"
          tone="ink"
          disabled={draftsLeft === 0}
          onPress={() => commit('right')}
        />
      </View>
    </View>
  );
}
