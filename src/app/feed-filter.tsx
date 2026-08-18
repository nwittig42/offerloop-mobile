import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAppliedJobs } from '@/api/endpoints/autoApply';
import { PEOPLE_SEARCH_BATCH } from '@/api/endpoints/peopleSearch';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { track } from '@/lib/analytics';
import { appliedCompanyKeys, buildAppliedPeoplePrompt } from '@/lib/appliedPeople';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { withRecentFilter } from '@/types';

/**
 * Feed settings: describe the feed you want, in a sentence (Nick 2026-08-16).
 *
 * One screen serves both decks because the interaction is identical, and two
 * copies would drift apart the first time either one got a tweak. What differs
 * is only what the sentence BUYS, so that lives in the DECKS table below rather
 * than in two files:
 *
 *   Jobs   a database query over the roles we already hold. Free, instant.
 *   People one PDL search. Free to surface, and the swipe is what costs.
 *
 * The People deck also carries the email template link, because "who do I write
 * to" and "what does the email say" are the two halves of one decision, and the
 * template screen had no other home once this became the gear's destination.
 *
 * It carries "People where you applied" for the same reason (Nick 2026-08-17).
 * That control shipped in Settings, which is where nobody looks for a way to
 * build a feed. It is a one-tap alternative to typing the sentence yourself, so
 * it belongs next to the box you would otherwise type it into.
 */

type DeckKey = 'jobs' | 'people';

const DECKS: Record<
  DeckKey,
  {
    title: string;
    label: string;
    placeholder: string;
    /** What actually happens when they save, stated plainly. No promises the
     *  deck cannot keep, and no unmentioned costs. */
    note: string;
    examples: string[];
    savedToast: string;
    clearedToast: string;
  }
> = {
  jobs: {
    title: 'Job feed',
    label: 'Describe the roles you want',
    placeholder: 'Internships in product management in San Francisco',
    note: 'We search every role we hold for the ones that match. Free, and it takes a second.',
    examples: [
      'Entry level finance roles in New York',
      'Software engineering internships, remote',
      'Product management new grad roles',
    ],
    savedToast: 'Feed updated. These are your roles now.',
    clearedToast: 'Back to your default feed.',
  },
  people: {
    title: 'People feed',
    label: 'Describe who you want to reach',
    placeholder: 'Investment banking analysts at Goldman Sachs in New York',
    note: `We find ${PEOPLE_SEARCH_BATCH} people who match. Finding them is free. Swiping right is what costs credits, same as always.`,
    examples: [
      'Consultants at McKinsey who went to USC',
      'Product managers at fintech startups in SF',
      'Recruiters hiring software engineering interns',
    ],
    savedToast: 'Finding people who match. Give it a moment.',
    clearedToast: 'Back to the people we ranked for you.',
  },
};

/** Long enough that the search has something to work with, short enough that
 *  the backend accepts it (it rejects under 3 and over 500). */
const MIN_PROMPT = 3;
const MAX_PROMPT = 500;

export default function FeedFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { swipeSettings, updateSwipeSettings, showToast } = useApp();
  const params = useLocalSearchParams<{ deck?: string }>();
  const deck: DeckKey = params.deck === 'people' ? 'people' : 'jobs';
  const copy = DECKS[deck];

  const active = deck === 'jobs' ? swipeSettings.jobFilter : swipeSettings.peopleFilter;
  const recents =
    deck === 'jobs' ? swipeSettings.jobFilterRecents : swipeSettings.peopleFilterRecents;

  const queryClient = useQueryClient();
  const [buildingFromApplied, setBuildingFromApplied] = useState(false);
  const [draft, setDraft] = useState(active ?? '');
  const trimmed = draft.trim();
  const canSave = trimmed.length >= MIN_PROMPT && trimmed !== (active ?? '');

  /** Save `prompt` as the active filter for this deck, folding it into recents.
   *  Passing null clears the filter and restores the default deck. */
  const apply = (prompt: string | null) => {
    if (prompt === null) {
      updateSwipeSettings(
        deck === 'jobs' ? { jobFilter: null } : { peopleFilter: null },
      );
      showToast(copy.clearedToast);
      router.back();
      return;
    }
    const next = prompt.trim().slice(0, MAX_PROMPT);
    if (next.length < MIN_PROMPT) return;
    updateSwipeSettings(
      deck === 'jobs'
        ? { jobFilter: next, jobFilterRecents: withRecentFilter(recents, next) }
        : { peopleFilter: next, peopleFilterRecents: withRecentFilter(recents, next) },
    );
    showToast(copy.savedToast);
    router.back();
  };

  /**
   * "People where you applied": write the deck's sentence out of the
   * applications instead of making the student type it. Deliberately routed
   * through apply() rather than setting the filter directly, so the sentence
   * lands in recents and stays visible and editable in the box, exactly like
   * one they typed. Our guess is a starting point, not a cage.
   *
   * Divisions are a follow-up (Nick 2026-08-17): buildAppliedPeoplePrompt takes
   * a division override, but an application records a job title and not a
   * department, so there is nothing honest to pass yet. Today it uses the real
   * titles from your own applications.
   */
  const buildFromApplications = async () => {
    if (buildingFromApplied) return;
    setBuildingFromApplied(true);
    try {
      const applied = await queryClient.fetchQuery({
        queryKey: ['applied-jobs'],
        queryFn: () => listAppliedJobs(),
      });
      const prompt = buildAppliedPeoplePrompt(applied);
      if (!prompt) {
        showToast('Apply to a job first and this builds a deck from it.');
        return;
      }
      track('people_from_applications', { companies: appliedCompanyKeys(applied).size });
      apply(prompt);
    } catch {
      showToast('Could not read your applications. Try again in a moment.');
    } finally {
      setBuildingFromApplied(false);
    }
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
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          {copy.title}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            {copy.label}
          </Text>
          <Input
            multiline
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_PROMPT}
            placeholder={copy.placeholder}
            autoCapitalize="sentences"
            accessibilityLabel={copy.label}
          />
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12.5,
              color: colors.inkTertiary,
              lineHeight: 18,
            }}>
            {copy.note}
          </Text>
        </View>

        <Button
          label={active ? 'Update my feed' : 'Build my feed'}
          onPress={() => apply(trimmed)}
          disabled={!canSave}
          fullWidth
        />

        {/* Back to default. Only offered when there is something to go back
            FROM, so it is never a button that does nothing. */}
        {active ? (
          <Pressable
            onPress={() => apply(null)}
            accessibilityRole="button"
            style={{ paddingVertical: 6 }}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 14,
                color: colors.inkSecondary,
                textAlign: 'center',
              }}>
              Back to my default feed
            </Text>
          </Pressable>
        ) : null}

        {/* One tap instead of a sentence, and only on the People deck: the
            Jobs deck has no equivalent (you cannot search roles by where you
            already applied). A button, not a card, and worded as the thing it
            does rather than as a place you are going (Nick 2026-08-17). Sits
            under the box so typing stays the primary move and this reads as
            the shortcut. */}
        {deck === 'people' ? (
          <Button
            label={
              buildingFromApplied
                ? 'Finding people…'
                : 'Find people at companies you’ve applied to'
            }
            onPress={buildFromApplications}
            disabled={buildingFromApplied}
            fullWidth
          />
        ) : null}

        {/* Recents. The reason a filter is worth saving at all: last night's
            search comes back in one tap instead of being retyped. Tapping one
            applies it immediately, rather than filling the box and waiting for
            a second tap on Save. */}
        {recents.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              Your recent filters
            </Text>
            {recents.map((r) => {
              const isActive = r === active;
              return (
                <Pressable key={r} onPress={() => (isActive ? router.back() : apply(r))}>
                  <Card
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      borderColor: isActive ? colors.accent : colors.hairline,
                      borderWidth: isActive ? 1.5 : 1,
                    }}>
                    <Ionicons
                      name={isActive ? 'checkmark-circle' : 'time-outline'}
                      size={18}
                      color={isActive ? colors.accent : colors.inkTertiary}
                    />
                    <Text
                      numberOfLines={2}
                      style={{
                        flex: 1,
                        fontFamily: fonts.sans,
                        fontSize: 14,
                        color: colors.ink,
                        lineHeight: 19,
                      }}>
                      {r}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              For example
            </Text>
            {copy.examples.map((e) => (
              <Pressable key={e} onPress={() => setDraft(e)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {/* A magnifier, not a sparkle. Sparkles read as AI slop
                      (Rylan), and these rows are searches you can run, which
                      the magnifier actually says. */}
                  <Ionicons name="search-outline" size={17} color={colors.inkTertiary} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.sans,
                      fontSize: 14,
                      color: colors.inkSecondary,
                      lineHeight: 19,
                    }}>
                    {e}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {/* The other half of an outreach decision, and only on the deck that
            makes one. The Jobs deck writes to a hiring manager too, but that is
            an add-on it configures in its own bar; putting the template here as
            well would give the same screen two owners. */}
        {deck === 'people' ? (
          <Pressable
            onPress={() => router.push('/outreach-template')}
            accessibilityRole="button"
            accessibilityLabel="Email template">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="mail-outline" size={20} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                  Email template
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12.5,
                    color: colors.inkTertiary,
                    lineHeight: 18,
                    marginTop: 2,
                  }}>
                  What every draft asks for, and how it signs off.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkTertiary} />
            </Card>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
