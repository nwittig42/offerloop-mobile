import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';

import type { Deck } from '@/api/endpoints/ranker';
import Header from '@/components/Header';
import PeopleFeedView from '@/components/feed/PeopleFeedView';
import { SHOW_BUILD_STAMP } from '@/lib/buildInfo';
import { useColors } from '@/theme/ThemeProvider';
import type { Candidate } from '@/types';

/**
 * APP STORE SCREENSHOT STAGE, never user-reachable.
 *
 * Renders the real People deck UI with invented personas so store
 * screenshots never show a real person's name or face without consent
 * (Rylan 2026-09-01). The faces are AI-generated (synthetic humans, nobody's
 * privacy in play); the names are fictional; the firms are real because
 * "who you can reach" is the product's honest value proposition.
 *
 * This deliberately bends the obviously-fake-fixture rule: these personas
 * are styled to read natural because they exist ONLY to be photographed for
 * the store page, on a screen with no entry point in the UI. It is reachable
 * exclusively by deep link (offerloop://dev/screenshot-deck) and only on
 * dev/staging builds; production redirects to the feed.
 */

const photo = (mod: number) =>
  Image.resolveAssetSource(
    [
      require('../../../assets/images/screenshot/persona-0.png'),
      require('../../../assets/images/screenshot/persona-1.png'),
      require('../../../assets/images/screenshot/persona-2.png'),
      require('../../../assets/images/screenshot/persona-3.png'),
    ][mod],
  ).uri;

const PERSONAS: Candidate[] = [
  {
    id: 'shot-1',
    name: 'Alina Cho',
    title: 'Investment Banking Analyst',
    company: 'Goldman Sachs',
    location: 'New York, NY',
    school: 'University of Southern California',
    reasons: ['Went to USC like you', 'Joined this year'],
    photoUrl: photo(0),
    rank: 1,
    matchScore: 9.2,
    joinedYear: 2026,
  },
  {
    id: 'shot-2',
    name: 'Marcus Bell',
    title: 'Consultant',
    company: 'McKinsey',
    location: 'Chicago, IL',
    school: 'University of Southern California',
    reasons: ['USC alum', 'At your target firm'],
    photoUrl: photo(1),
    rank: 2,
    matchScore: 8.8,
  },
  {
    id: 'shot-3',
    name: 'Sofia Reyes',
    title: 'Software Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    reasons: ['At your target firm', 'Recently promoted'],
    photoUrl: photo(2),
    rank: 3,
    matchScore: 8.6,
  },
  {
    id: 'shot-4',
    name: 'Tom Whitfield',
    title: 'Vice President',
    company: 'Morgan Stanley',
    location: 'New York, NY',
    reasons: ['At your target firm'],
    photoUrl: photo(3),
    rank: 4,
    matchScore: 8.1,
  },
];

// isMock stays false ON PURPOSE: true renders the sample-data banner, which
// would end up in the store screenshots. The screen itself never ships to
// users, so there is no one to mislead.
const FIXTURE_DECK: Deck = {
  deckId: 'screenshot-stage',
  candidates: PERSONAS,
  isMock: false,
};

export default function ScreenshotDeck() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Seed the deck cache BEFORE PeopleFeedView mounts so its query renders
  // the personas instead of fetching the real ranker deck.
  useState(() => {
    queryClient.setQueryData(['rankerDeck'], FIXTURE_DECK);
    return true;
  });

  if (!SHOW_BUILD_STAMP) return <Redirect href="/(tabs)/feed" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title="Offerloop"
        logo
        unreadCount={0}
        onBellPress={() => router.push('/notifications')}
      />
      <PeopleFeedView active />
    </View>
  );
}
