import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Share, Text, View } from 'react-native';

import Header from '@/components/Header';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';
import { ActionCircle, Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Feed: the swipe-to-draft hero. Right swipe spends credits and kicks off
 * the (mock) find-and-draft job; the confirmation is instant, the work is
 * async. Every number on this screen comes from store state, never inline.
 */
export default function FeedScreen() {
  const router = useRouter();
  const { jobs, profile, unreadCount, canUndo, passJob, draftJob, undoLastPass, resetDeck } =
    useApp();
  const deckRef = useRef<SwipeDeckHandle>(null);

  const top = jobs[0];
  const draftsLeft = Math.max(0, profile.dailyDraftCap - profile.dailyDraftsUsed);

  const handleSwiped = (direction: 'left' | 'right', job: { id: string }) => {
    if (direction === 'right') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      draftJob(job.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(job.id);
    }
  };

  const creditsPill = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.paper2,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}>
      <Ionicons name="flash" size={12} color={colors.accent} />
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.ink }}>
        {profile.credits}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Offerloop"
        logo
        right={creditsPill}
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      {top ? (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <SwipeDeck
            ref={deckRef}
            jobs={jobs}
            onSwiped={handleSwiped}
            onPressCard={(job) => router.push(`/job/${job.id}`)}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              paddingTop: 14,
            }}>
            <ActionCircle
              icon="arrow-undo-outline"
              size={42}
              disabled={!canUndo}
              onPress={undoLastPass}
            />
            <ActionCircle icon="close" tone="negative" onPress={() => deckRef.current?.swipe('left')} />
            <ActionCircle
              icon="paper-plane"
              tone="ink"
              disabled={draftsLeft === 0}
              onPress={() => deckRef.current?.swipe('right')}
            />
            <ActionCircle
              icon="share-outline"
              size={42}
              onPress={() => Share.share({ message: `${top.title} at ${top.company}` })}
            />
          </View>

          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.inkTertiary,
              textAlign: 'center',
              paddingTop: 10,
              paddingBottom: 14,
            }}>
            1 draft = {profile.creditsPerSwipe} credits · {draftsLeft} drafts left today
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 26,
              color: colors.heading,
              textAlign: 'center',
            }}>
            That is the whole mock deck
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 21,
            }}>
            Real jobs arrive with backend wiring in Phase 3. Restart the fixtures to keep
            testing the swipe.
          </Text>
          <Button label="Restart mock deck" variant="outline" onPress={resetDeck} />
        </View>
      )}
    </View>
  );
}
