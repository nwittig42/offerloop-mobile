import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { listAppliedJobs } from '@/api/endpoints/autoApply';
import { appliedCompanyKeys } from '@/lib/appliedPeople';
import GlassBar from '@/components/GlassBar';
import DeckActions from '@/components/feed/DeckActions';
import DraftSendChoice from '@/components/feed/DraftSendChoice';
import PersonDeck, { type PersonDeckHandle } from '@/components/feed/PersonDeck';
import ProfileGapSurvey from '@/components/feed/ProfileGapSurvey';
import ScoutProfileNudge from '@/components/feed/ScoutProfileNudge';
import { ActionCircle } from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import {
  draftToCandidate,
  fetchCandidates,
  revealEmail,
  sendFeedback,
  REVEAL_EMAIL_CREDITS,
  type Deck,
} from '@/api/endpoints/ranker';
import {
  PeopleSearchFailure,
  PEOPLE_SEARCH_BATCH,
  revealAndWrite,
  searchPeople,
  type PeopleSearchDeck,
} from '@/api/endpoints/peopleSearch';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { hasSeenGhostHint, markGhostHintSeen } from '@/lib/ghostHint';
import SwipeDemoHint from '@/components/onboarding/SwipeDemoHint';
import { markNudgeShown, nextProfileNudge, type NudgeKey } from '@/lib/profileNudge';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Candidate } from '@/types';

/**
 * The People feed: swipe on humans the ranker picked for you.
 *
 * The money moment lives here. A right swipe unlocks the person's address and
 * WRITES to them (Nick 2026-08-16: "the default is draft an email to them").
 * There is no search step: the deck is ranked and cached before the user ever
 * swipes, so the app already holds this exact person and the server only has
 * to write. That is the whole reason this deck can feel instant where the Jobs
 * deck cannot.
 *
 * Drafts by default. Sending happens only when the bar says Send, which is a
 * confirmed, global choice shared with the Jobs deck.
 *
 * A swipe costs credits, so the deck refuses the gesture outright when the
 * balance cannot cover it. The backend refunds an unverified address or a
 * no-hit, so a miss is free, and the response (not a guess) decides what the
 * toast says. The deck never waits on the network: the card leaves on the
 * gesture and the work reports back by toast, so swipes can stack.
 */
export default function PeopleFeedView({ active = true }: { active?: boolean }) {
  const router = useRouter();
  const { profile, showToast, swipeSettings, updateSwipeSettings } = useApp();
  const { connect: connectGmail } = useGmailConnect();
  const colors = useColors();
  // The same global draft-or-send rule the Jobs bar edits, so the two decks can
  // never disagree about whether mail leaves the account.
  const action: 'draft' | 'send' = swipeSettings.action === 'send' ? 'send' : 'draft';
  const [confirmSend, setConfirmSend] = useState(false);

  // Set when the survey is answered OR skipped, so a "Not now" does not bounce
  // straight back to the same screen on the refetch.
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const [connectPrompt, setConnectPrompt] = useState(false);

  const undoLastPass = useCallback(() => {
    setPassed((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFront((f) => [last, ...f.filter((x) => x.id !== last.id)]);
      return prev.slice(0, -1);
    });
  }, []);
  // Scout's one-question nudge, for a profile that works but is thin. Asked at
  // a pause (a deck that ran out), never mid-swipe, and paced by
  // lib/profileNudge rather than by this screen.
  const [nudge, setNudge] = useState<NudgeKey | null>(null);
  const deckRef = useRef<PersonDeckHandle>(null);
  /** Live drag, mirrored into the floating verb circles so they grow with
   *  the gesture. */
  const dragX = useSharedValue(0);

  // First-entry ghost swipe on the live deck; once per install, gone on the
  // first real swipe or after the cycles run out.
  const [ghostHint, setGhostHint] = useState(false);
  useEffect(() => {
    void hasSeenGhostHint('people').then((seen) => {
      if (!seen) setGhostHint(true);
    });
  }, []);
  useEffect(() => {
    if (!ghostHint) return;
    const t = setTimeout(() => {
      setGhostHint(false);
      void markGhostHintSeen('people');
    }, 9000);
    return () => clearTimeout(t);
  }, [ghostHint]);
  /** Cards already swiped, held locally so the deck advances instantly rather
   *  than waiting on a refetch. */
  const [consumed, setConsumed] = useState<string[]>([]);
  /**
   * Undo, for passes only.
   *
   * A right swipe spends credits and writes an email; there is no unspending
   * it, so offering to "undo" one would be a lie. A pass costs nothing, and
   * passing the wrong person by a thumb-twitch is the mistake this deck makes
   * easiest — the card is gone before you finish reading the name.
   *
   * `passed` is the stack of undoable people; `front` holds a restored card
   * and is rendered ahead of the deck, since the original list order would
   * put them back wherever they started rather than in front of you.
   */
  const [passed, setPassed] = useState<Candidate[]>([]);
  const [front, setFront] = useState<Candidate[]>([]);

  const queryClient = useQueryClient();

  const [showingMore, setShowingMore] = useState(false);

  /** Show more from the same well: fetch the next ranked batch past
   *  everyone this session already saw. Reborn 2026-08-19 after the false-
   *  bottom fix (the fetch window used to stop at the first slice, so this
   *  button could never dig; it digs now). */
  const showMoreRanked = useCallback(async () => {
    if (showingMore) return;
    setShowingMore(true);
    try {
      const current = queryClient.getQueryData<Deck>(['rankerDeck']);
      const seen = [
        ...(current?.candidates?.map((c) => c.id) ?? []),
        ...consumed,
        ...passed.map((c) => c.id),
      ];
      const next = await fetchCandidates(undefined, [...new Set(seen)]);
      if (next.candidates.length) {
        queryClient.setQueryData(['rankerDeck'], next);
        setConsumed([]);
        setPassed([]);
        setFront([]);
        showToast(`${next.candidates.length} more people from your targets.`);
      } else {
        showToast('That really is everyone we hold at your targets, for now.');
      }
    } catch {
      showToast('Could not load more right now. Try again in a moment.');
    } finally {
      setShowingMore(false);
    }
  }, [showingMore, queryClient, consumed, passed, showToast]);


  /**
   * The sentence this deck was built from, or null for the ranked default.
   *
   * With a filter, the deck stops being "who we think you should meet" and
   * becomes "who matches this", which is a different question with a different
   * source: one PDL search instead of the ranker. The two never run at once,
   * hence the mirrored `enabled` flags below.
   */
  const peopleFilter = swipeSettings.peopleFilter?.trim() || null;

  /**
   * Everywhere this user has applied, for the card badge. Shared query key with
   * the tab bar's owed-applications count, so this is a cache read rather than
   * a second fetch, and it badges people in ANY deck: if you applied there, the
   * fact is true however they were surfaced.
   */
  const appliedQuery = useQuery({ queryKey: ['applied-jobs'], queryFn: () => listAppliedJobs() });
  const appliedCompanies = useMemo(
    () => appliedCompanyKeys(appliedQuery.data),
    [appliedQuery.data],
  );

  const deckQuery = useQuery<Deck>({
    queryKey: ['rankerDeck'],
    queryFn: ({ signal }) => fetchCandidates(signal),
    staleTime: 5 * 60 * 1000,
    enabled: !peopleFilter,
  });

  /**
   * The prompt-built deck. Cached for the session (a search is a real PDL call
   * and a real few seconds), so flipping to Jobs and back does not re-run it,
   * and no retries: a failed search should say so rather than quietly costing
   * three more searches against the daily cap.
   */
  const searchQuery = useQuery<PeopleSearchDeck>({
    queryKey: ['peopleSearch', peopleFilter],
    queryFn: ({ signal }) => searchPeople(peopleFilter as string, null, signal),
    enabled: !!peopleFilter,
    // A deck with people in it is worth holding for the session; an EMPTY
    // result is not. Caching the empty for 30 minutes meant "Change my
    // search" back to the same sentence silently replayed the cached
    // nothing instead of actually searching again (2026-08-18).
    staleTime: (q) => ((q.state.data?.people?.length ?? 0) > 0 ? 30 * 60 * 1000 : 0),
    retry: false,
  });

  /** Batches pulled by "show me 20 more", appended to the first one. Held here
   *  rather than in the query so asking for more never re-runs the first
   *  search, and so the people already on screen do not reshuffle. */
  const [extraPeople, setExtraPeople] = useState<Candidate[]>([]);
  const [moreCursor, setMoreCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const searchDeckId = searchQuery.data?.deckId;
  const firstCursor = searchQuery.data?.nextCursor ?? null;
  // A new search is a new deck: drop everything the old one accumulated, or the
  // first batch of the new sentence arrives underneath the last one's leftovers.
  useEffect(() => {
    setExtraPeople([]);
    setMoreCursor(firstCursor);
    setLoadingMore(false);
  }, [searchDeckId, firstCursor]);

  const loadMorePeople = useCallback(async () => {
    if (!peopleFilter || !moreCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const batch = await searchPeople(peopleFilter, moreCursor);
      setMoreCursor(batch.nextCursor);
      if (!batch.people.length) {
        showToast('That’s everyone matching that search.');
        return;
      }
      setExtraPeople((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...batch.people.filter((p) => !seen.has(p.id))];
      });
    } catch (err) {
      showToast(
        err instanceof PeopleSearchFailure ? err.message : 'Could not load more. Try again.',
      );
    } finally {
      setLoadingMore(false);
    }
  }, [peopleFilter, moreCursor, loadingMore, showToast]);

  // Whichever source is live, flattened to the two things the deck needs. The
  // id matters beyond display: it is what reveal and feedback are addressed to,
  // and the two sources address different backends.
  const deckId = peopleFilter ? searchQuery.data?.deckId : deckQuery.data?.deckId;
  const sourceCandidates = peopleFilter
    ? [...(searchQuery.data?.people ?? []), ...extraPeople]
    : (deckQuery.data?.candidates ?? []);

  // A fresh deck means a fresh deck_id, so the consumed list from the old one
  // no longer refers to anything. Clearing it prevents a new card being hidden
  // because a previous deck happened to reuse a candidate id.
  useEffect(() => {
    setConsumed([]);
    setPassed([]);
    setFront([]);
  }, [deckId]);

  const people = [
    ...front,
    ...sourceCandidates.filter(
      (c) => !consumed.includes(c.id) && !front.some((f) => f.id === c.id),
    ),
  ];
  const top = people[0];

  // Running out of people is the natural pause: they are between decks, not
  // mid-decision, and the thing Scout is about to ask for is the exact thing
  // that would have made the deck longer.
  const deckReady = !deckQuery.isLoading && !deckQuery.isError;
  useEffect(() => {
    if (!deckReady || top || nudge) return;
    const missing: NudgeKey[] = [];
    if (!profile.school?.trim()) missing.push('school');
    if (!profile.targetRoles?.length) missing.push('targetRoles');
    if (!profile.preferredLocations?.length) missing.push('locations');
    // dreamCompanies is always worth topping up: more firms, more people.
    missing.push('dreamCompanies');
    void nextProfileNudge(missing, Date.now()).then((key) => {
      if (!key) return;
      setNudge(key);
      void markNudgeShown(Date.now());
    });
  }, [deckReady, top, nudge, profile.school, profile.targetRoles, profile.preferredLocations]);
  const canReveal = profile.credits >= REVEAL_EMAIL_CREDITS;
  /**
   * A right swipe reveals the address (charged) and THEN writes the email. The
   * write needs Gmail, so without it the swipe bills for a reveal and the
   * draft it promised never exists — the student pays 8 credits for a
   * "couldn't write the draft" toast.
   *
   * So the gesture is blocked, not repaired after the fact. Same posture as
   * the Jobs deck's unfinished-application-profile wall: bounce the card,
   * explain, charge nothing.
   */
  const canDraft = !!profile.gmailConnected;

  // No `drag` shared value is threaded into the deck: it existed so the pass
  // and reveal circles could grow with the drag, and those circles are gone.
  // The stamps on the card carry the drag feedback now.

  const onBlockedRight = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Gmail first: it is the fixable one, and quoting a credit price to
    // someone whose real problem is a missing integration sends them to buy
    // credits that would not have helped.
    if (!canDraft) {
      setConnectPrompt(true);
      return;
    }
    if (iapAvailable()) presentPaywall({ context: 'draft' });
    else showToast(`Each swipe costs ${REVEAL_EMAIL_CREDITS} credits. Yours reset with your plan.`);
  }, [showToast, canDraft]);

  const dismissGhost = useCallback(() => {
    setGhostHint(false);
    void markGhostHintSeen('people');
  }, []);

  const handleSwiped = useCallback(
    (direction: 'left' | 'right' | 'up', person: Candidate) => {
      dismissGhost();
      const currentDeckId = deckId;
      setConsumed((prev) => (prev.includes(person.id) ? prev : [...prev, person.id]));
      setFront((prev) => prev.filter((f) => f.id !== person.id));

      // Off-hours guard, shared by both paths: a send fired outside 8am-10pm
      // device-local would land with a late-night timestamp, so it quietly
      // becomes a draft waiting in the Inbox. Mirrors beginDraft and the Loop
      // scheduler.
      const hour = new Date().getHours();
      const deferred = action === 'send' && (hour < 8 || hour >= 22);
      const intent: 'draft' | 'send' = deferred ? 'draft' : action;

      if (direction === 'left' || direction === 'up') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPassed((prev) => [...prev, person]);
        // Feedback trains the RANKER. A prompt deck was not ranked, so there is
        // nothing to train and no deck the server would recognise.
        if (currentDeckId && !peopleFilter) {
          void sendFeedback({
            deckId: currentDeckId,
            candidateId: person.id,
            signal: direction === 'left' ? 'left' : 'skip',
            rank: person.rank,
          });
        }
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Prompt deck: one call does both beats, because the server holds this
      // person (the app never had their address to begin with) and charging
      // for a reveal without the draft is the lookup tool this deck exists to
      // not be.
      if (peopleFilter) {
        if (!currentDeckId) {
          showToast('That search expired. Pull a fresh one from settings.');
          return;
        }
        revealAndWrite(currentDeckId, person.id, intent)
          .then((out) => {
            if (!out.email) {
              showToast(`No email found for ${person.name}. You were not charged.`);
              return;
            }
            if (!out.verified) {
              showToast(`Found an unverified address for ${person.name}. Refunded.`);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (out.sent) {
              showToast(`Sent to ${person.name}`);
              return;
            }
            if (out.drafted) {
              showToast(
                deferred
                  ? `Drafted to ${person.name}. Held for morning, send it from your Inbox.`
                  : `Drafted to ${person.name}, waiting in your Inbox`,
              );
              return;
            }
            showToast(`${person.name}'s email is ready. We couldn't write the draft.`);
          })
          .catch(() => {
            showToast('Could not reach that person. You were not charged.');
          });
        return;
      }

      if (currentDeckId) {
        void sendFeedback({
          deckId: currentDeckId,
          candidateId: person.id,
          signal: 'right',
          rank: person.rank,
        });
      }

      // The paid step, in two beats. Find the address, then write to them.
      // Render from the response fields, never from an assumption about what
      // the charge did.
      revealEmail(person.id)
        .then((result) => {
          if (!result.email) {
            showToast(`No email found for ${person.name}. You were not charged.`);
            return;
          }
          if (!result.verified) {
            showToast(`Found an unverified address for ${person.name}. Refunded.`);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // A revealed address the user has to go write to themselves is a
          // lookup tool, not the product (Nick 2026-08-16). The swipe writes
          // the email too, drafting by default and sending only when the bar
          // says so. `intent` carries the shared off-hours guard from above.
          return draftToCandidate(person.id, intent)
            .then((out) => {
              if (out.sent) {
                showToast(`Sent to ${person.name}`);
                return;
              }
              if (out.drafted) {
                showToast(
                  deferred
                    ? `Drafted to ${person.name}. Held for morning, send it from your Inbox.`
                    : `Drafted to ${person.name}, waiting in your Inbox`,
                );
                return;
              }
              // The address is unlocked either way, so say what the user got
              // rather than reporting a flat failure.
              showToast(`${person.name}'s email is ready. We couldn't write the draft.`);
            })
            .catch(() => {
              showToast(`${person.name}'s email is ready. We couldn't write the draft.`);
            });
        })
        .catch(() => {
          showToast('Could not reach that person. You were not charged.');
        });
    },
    [deckId, showToast, action, peopleFilter],
  );

  // Loading and error belong to whichever source is live. A filtered deck that
  // reported the ranker's state would say "couldn't load people" about a query
  // that never ran.
  const loading = peopleFilter ? searchQuery.isLoading : deckQuery.isLoading;
  const errored = peopleFilter ? searchQuery.isError : deckQuery.isError;

  /**
   * A search is a real wait, so it gets a real screen (Nick 2026-08-17).
   *
   * The skeleton the ranked deck uses is a lie here: it implies cards are a
   * moment away, and a PDL search with progressive relaxation runs half a
   * minute. Thirty seconds of shimmering placeholder reads as a hang, and the
   * student closes the app before it lands. So this says what is happening,
   * what it is looking for, and roughly how long, which is the whole difference
   * between waiting and being stuck.
   */
  if (peopleFilter && (loading || loadingMore)) {
    // On a white card: ink-on-navy was illegible once the stage went dark
    // (Rylan 2026-08-18 round 5).
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View
          style={{
            alignSelf: 'stretch',
            backgroundColor: colors.paper,
            borderRadius: 20,
            alignItems: 'center',
            padding: 32,
            gap: 14,
            shadowColor: '#000000',
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 5,
          }}>
          <ActivityIndicator color={colors.accent} />
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              color: colors.heading,
              textAlign: 'center',
            }}>
            {loadingMore ? 'Finding more' : 'Building your feed'}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13.5,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 20,
            }}>
            {`Finding ${PEOPLE_SEARCH_BATCH} ${loadingMore ? 'more people' : 'people'} who match “${peopleFilter}”. This usually takes 20 to 30 seconds.`}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) return <FeedSkeleton />;

  // A search that failed knows WHY, and the fix differs by reason: rewrite the
  // sentence, wait a day, or nothing the user can do. Say the server's reason
  // rather than a generic connection error.
  if (peopleFilter && errored) {
    const failure = searchQuery.error;
    const reason = failure instanceof PeopleSearchFailure ? failure.reason : 'failed';
    return (
      <StateView
        card
        icon={reason === 'vague' ? 'help-circle-outline' : 'cloud-offline-outline'}
        tone={reason === 'vague' ? 'neutral' : 'error'}
        title={reason === 'vague' ? 'Tell us a bit more' : 'Couldn’t run that search'}
        body={
          failure instanceof PeopleSearchFailure
            ? failure.message
            : 'We couldn’t reach Offerloop to run your search. Check your connection and try again.'
        }
        actionLabel="Change my search"
        onAction={() => router.push('/feed-filter?deck=people')}
        secondaryLabel="Back to my default feed"
        onSecondary={() => updateSwipeSettings({ peopleFilter: null })}
      />
    );
  }

  if (errored) {
    return (
      <StateView
        card
        icon="cloud-offline-outline"
        tone="error"
        title="Couldn’t load people"
        body="We couldn’t reach Offerloop to pull the people we ranked for you. Check your connection and try again."
        actionLabel="Try again"
        onAction={() => deckQuery.refetch()}
      />
    );
  }

  if (!top) {
    // A prompt deck that ran dry has its own two endings, and neither is the
    // ranker's. Either the sentence found nobody at all (rewrite it), or you
    // swiped through everyone it found (pull the next batch, still free).
    if (peopleFilter) {
      const noneAtAll = !sourceCandidates.length;
      return (
        <StateView
          card
          icon={noneAtAll ? 'search-outline' : 'checkmark-done-circle-outline'}
          tone={noneAtAll ? 'neutral' : 'success'}
          title={noneAtAll ? 'Nobody matched that' : 'That’s all of them'}
          body={
            noneAtAll
              ? searchQuery.data?.vagueReason ||
                `We couldn’t find anyone matching “${peopleFilter}”. Try a broader role, or drop the city.`
              : `You’ve been through everyone we found for “${peopleFilter}”.`
          }
          prominent={!!moreCursor}
          actionLabel={moreCursor ? 'Show more' : 'Change my search'}
          onAction={
            moreCursor ? loadMorePeople : () => router.push('/feed-filter?deck=people')
          }
          actionLoading={loadingMore}
          secondaryLabel="Back to my default feed"
          onSecondary={() => updateSwipeSettings({ peopleFilter: null })}
        />
      );
    }
    // Two different empty decks, two different screens. "We don't know enough
    // about you yet" is fixable in about three taps, and telling that student
    // to check back later is advice that would never come true — the ranker
    // has nothing to search on and never will until they answer. The survey
    // goes here, where the missing data is visibly costing them something.
    if (deckQuery.data?.emptyReason === 'sparse_profile' && !surveyDismissed) {
      return (
        <ProfileGapSurvey
          // sparse_profile means the RANKER sees neither a school nor a dream
          // company. The app's own profile.school can be non-empty and the
          // ranker still blind to it (that one is derived from the parsed
          // resume, and lives somewhere person_ranker does not read), so
          // trusting it here skips the question that would have fixed the
          // deck. The deck's own verdict wins.
          needsSchool
          needsCompanies
          onDone={() => {
            setSurveyDismissed(true);
            void deckQuery.refetch();
          }}
        />
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <StateView
          card
          icon="checkmark-done-circle-outline"
          tone="success"
          title="That’s everyone for now"
          body="That’s this batch from your targets. Describe who else you want, or let us run a fresh search from your profile."
          prominent
          actionLabel="Search my targets"
          onAction={() => {
            // One tap, no typing (Rylan 2026-08-18 round 5: "keep it going,
            // keep it quick"). Compose a real search from their own stated
            // targets; with nothing to compose from, fall through to the
            // editor rather than inventing a query.
            const role = profile.targetRoles[0]?.trim();
            const industry = profile.industries[0]?.trim();
            if (!role && !industry) {
              router.push('/feed-filter?deck=people');
              return;
            }
            const prompt = role && industry
              ? `${role}s at ${industry} companies`
              : role
                ? `${role}s at top companies`
                : `People at ${industry} companies`;
            // The 30-minute query cache replayed the identical sentence
            // instantly with the same people (Rylan 2026-08-19: "it doesn't
            // take the 20-30 seconds, it goes to the same ones"). Drop the
            // cached deck so this press is a real search.
            queryClient.removeQueries({ queryKey: ['peopleSearch', prompt] });
            if (peopleFilter === prompt) {
              void searchQuery.refetch();
            } else {
              updateSwipeSettings({ peopleFilter: prompt });
            }
            showToast('Building a fresh feed from your targets.');
          }}
          secondaryLabel={showingMore ? 'Digging deeper…' : 'Show more from your targets'}
          onSecondary={() => void showMoreRanked()}
          tertiaryLabel="Describe who to find"
          onTertiary={() => router.push('/feed-filter?deck=people')}
        />
        {/* Scout, under the empty state rather than over it: the answer to
            "that's everyone" is usually "because you only told me two firms",
            and this is where that lands without interrupting anything. */}
        {nudge ? (
          <View style={{ paddingHorizontal: 18, paddingBottom: 26 }}>
            <ScoutProfileNudge
              nudge={nudge}
              onClose={() => {
                setNudge(null);
                void deckQuery.refetch();
              }}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 18 }}>
      {/* Nothing sits between the Jobs/People switcher and the deck (Nick
          2026-08-16). The fixture banner and the credits readback both lived
          here; the balance is already in the header pill and the reveal cost is
          on the card face, so the strip was noise above the one thing the
          screen is for. */}
      {/* Same clearance as the jobs deck, so the card bottom lands in the same
          place when you flip between them: bar height (68) + float (26) + a
          16pt gap, instead of the card ending flush against the bar. */}
      <View style={{ flex: 1, marginTop: 10, zIndex: 2, paddingHorizontal: 0 }}>
        <SwipeDemoHint active={ghostHint && active}>
        <PersonDeck
          ref={deckRef}
          people={people}
          onSwiped={handleSwiped}
          drag={dragX}
          gesturesEnabled={active}
          blockRight={!canReveal || !canDraft}
          onBlockedRight={onBlockedRight}
          action={action}
          appliedCompanies={appliedCompanies}
          undo={{ visible: passed.length > 0, onPress: undoLastPass, position: 'bottom-right' }}
        />
        </SwipeDemoHint>
      </View>



      {/* Same cut as the jobs bar (Nick 2026-08-14): pass and reveal circles
          only duplicated the swipe, and refresh already exists on the empty
          state. What is left is the one thing a swipe cannot say for itself,
          plus the settings link, in the same spot it occupies on the jobs feed
          so the bar does not move when you switch decks.

          Pass and reveal remain reachable without a drag through the deck's
          accessibilityActions (HIG 5.7). */}
      {/* The bar RIDES the card (Rylan 2026-08-19): flat top tucked under
          the card's rounded bottom, static while cards swipe away, with the
          verb circles floating below it. */}
      {people.length ? (
        <View>
          <GlassBar
            solid
            style={{
              alignSelf: 'stretch',
              marginTop: 12,
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 8,
            }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46 }}>
            {/* No on/off switch beside it, unlike the Jobs bar: writing to the
                person is what a right swipe on this deck IS, not an add-on to
                applying. The only open question is whether you read it first. */}
            <View style={{ flex: 1 }}>
              <DraftSendChoice
                value={action}
                onChange={(next) => {
                  if (next === action) return;
                  if (next === 'draft') {
                    updateSwipeSettings({ action: 'draft' });
                    showToast('We’ll draft it. Nothing goes out without you.');
                    return;
                  }
                  setConfirmSend(true);
                }}
              />
            </View>
            {/* The gear opened the email template directly for one release
                (2026-08-16), on the reasoning that this deck never asks "who do
                we go find". It asks now. So the gear opens the settings screen,
                and the template is the first thing on it, one tap further than
                before and next to the search it belongs with. */}
            <ActionCircle
              icon="options-outline"
              size={46}
              onPress={() => router.push('/feed-filter?deck=people')}
              accessibilityLabel={
                peopleFilter ? `People feed filter: ${peopleFilter}` : 'People feed settings'
              }
            />
          </View>

          {/* Same job as the Jobs bar's filter row: name the search this deck
              came from, and put the way out of it one tap from the confusion. */}
          {peopleFilter ? (
            /* The whole row opens the prompt editor now (Rylan 2026-08-18
               round 3): the sentence IS the search, so tapping it should
               reopen it for a rewrite, not just sit there. */
            <Pressable
              onPress={() => router.push('/feed-filter?deck=people')}
              accessibilityRole="button"
              accessibilityLabel="Edit this people search"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="funnel" size={13} color={colors.inkTertiary} />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fonts.sans,
                  fontSize: 12.5,
                  color: colors.inkSecondary,
                }}>
                {peopleFilter}
              </Text>
              <Ionicons name="create-outline" size={15} color={colors.inkTertiary} />
              <Pressable
                onPress={() => {
                  updateSwipeSettings({ peopleFilter: null });
                  showToast('Back to the people we ranked for you.');
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear the people feed filter"
                hitSlop={10}>
                <Ionicons name="close-circle" size={17} color={colors.inkTertiary} />
              </Pressable>
            </Pressable>
          ) : null}
        
          </GlassBar>
          <View style={{ marginTop: 14, marginBottom: 8 }}>
            <DeckActions
              drag={dragX}
              onPass={() => deckRef.current?.swipe('left')}
              onCommit={() => deckRef.current?.swipe('right')}
              commitIcon={action === 'send' ? 'paper-plane' : 'checkmark'}
              passLabel="Pass on this person"
              commitLabel={
                action === 'send'
                  ? 'Send an email to this person'
                  : 'Draft an email to this person'
              }
            />
          </View>
        </View>
      ) : null}

      {/* Gmail is missing, so the swipe cannot finish what it starts. Shown
          on the blocked gesture rather than as a permanent banner: it is the
          moment the student is actually trying to do the thing. */}
      <ConfirmDialog
        visible={connectPrompt}
        icon="mail-outline"
        title="Connect Gmail to reach people"
        body="Your intro is written as a draft in your own account, from your own address, so it needs to be connected first. Nothing sends without you."
        confirmLabel="Connect Gmail"
        cancelLabel="Not now"
        onConfirm={async () => {
          const res = await connectGmail();
          if (res === 'connected') showToast('Gmail connected. Swipe away.');
          else if (res === 'failed') showToast('Could not connect Gmail. Try again.');
        }}
        onClose={() => setConnectPrompt(false)}
      />

      {/* Same ask-first step as the Jobs deck, and the same global rule behind
          it, so turning sending on here turns it on there too. */}
      <ConfirmDialog
        visible={confirmSend}
        icon="paper-plane-outline"
        tone="caution"
        title="Send these emails automatically?"
        body="Your intro goes out from your Gmail the moment you swipe, with nobody reading it first. This is your global outreach rule, so it applies everywhere in the app, not just this deck. Swipes between 10pm and 8am are saved as drafts instead."
        confirmLabel="Send automatically"
        cancelLabel="Keep drafting"
        onConfirm={() => {
          updateSwipeSettings({ action: 'send' });
          showToast('Auto-sending. Swipes go out without review.');
        }}
        onClose={() => setConfirmSend(false)}
      />
    </View>
  );
}
