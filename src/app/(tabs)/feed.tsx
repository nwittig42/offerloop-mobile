import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import GlassBar from '@/components/GlassBar';
import NightSky from '@/components/NightSky';
import Header from '@/components/Header';
import ReferralCard from '@/components/ReferralCard';
import { requestReviewIfDue } from '@/lib/appRating';
import { hasSeenGhostHint, markGhostHintSeen } from '@/lib/ghostHint';
import SwipeDemoHint from '@/components/onboarding/SwipeDemoHint';
import { shouldShowReferralPromptOnWin } from '@/lib/referralPrompt';
import { track } from '@/lib/analytics';
import { sendJobFeedback } from '@/api/endpoints/feed';
import FeedSearchBar from '@/components/feed/FeedSearchBar';
import FeedSwitcher, { type FeedMode } from '@/components/feed/FeedSwitcher';
import DeckActions from '@/components/feed/DeckActions';
import EmailSketch from '@/components/feed/EmailSketch';
import HiringManagerToggle from '@/components/feed/HiringManagerToggle';
import PeopleFeedView from '@/components/feed/PeopleFeedView';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';

import { getApplicationProfile, isProfileReady } from '@/api/endpoints/autoApply';
import { RESUME_BUILDER_LIVE } from '@/api/endpoints/resumeBuilder';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { AUTO_APPLY_CREDITS } from '@/api/endpoints/scoutActions';
import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * Feed: the hero surface, now two decks behind one switcher.
 *
 * JOBS (this file): a right swipe APPLIES, and that is all it does unless the
 * "Email HM" pill is on, in which case it also drafts to the role's hiring
 * manager. A job the ATS cannot take saves instead, so the swipe is never a
 * promise the app can't keep.
 *
 * PEOPLE (PeopleFeedView): a right swipe reveals a person's email.
 *
 * Chrome is unchanged: credits on the left of the banner, wordmark centered,
 * Scout and the bell on the right (via Header), and the action row floating in
 * a liquid-glass bar above the tab bar. Tapping a card expands it. Every number
 * comes from store state, never inline.
 */
/**
 * The watercolor ridgeline used to sit across the bottom 38% of this screen
 * (day art in light mode, NightSky's night art in dark). Pulled 2026-08-14.
 *
 * Two reasons. The art is a 900x299 panorama, and `cover` into a box that tall
 * cropped roughly 60% of its width away, so the screen showed a zoomed slice of
 * one peak rather than the wide vista that made the image worth using. And the
 * bottom third is now the busiest part of the feed (the glass action bar, and a
 * deck switcher above it), so the texture landed behind the controls instead of
 * behind empty space.
 *
 * assets/images/ridges-day.png is now referenced nowhere: the feed was its only
 * consumer. Kept on disk deliberately, because the art is worth reusing on a
 * screen with room for it (onboarding, welcome, an empty state), where it can
 * run full-width and uncropped. Delete it if that never happens.
 */

export default function FeedScreen() {
  const router = useRouter();
  const {
    jobs,
    profile,
    unreadCount,
    canUndo,
    swipeSettings,
    updateSwipeSettings,
    costPerSwipe,
    passJob,
    saveJob,
    draftJob,
    autoApplyJob,
    outreach,
    undoLastPass,
    resetDeck,
    rerollFeed,
    rerolling,
    showToast,
    feedState,
  } = useApp();
  const colors = useColors();
  const isFocused = useIsFocused();
  const { scheme } = useTheme();
  // The navy stage (Rylan 2026-08-18, kept after seeing it; round 3 asked it
  // ~50% lighter and closer to the theme's accent family). ONE constant on
  // purpose: he flagged this color as a likely future redo.
  const STAGE_NAVY = '#324576';
  const stageBg = scheme === 'dark' ? colors.feedBg : STAGE_NAVY;
  const queryClient = useQueryClient();

  // Which deck is showing. People opens first (Rylan 2026-08-18): the person
  // deck is the differentiated surface, the one with names on it, and leading
  // with it teaches what the app IS. ?deck=jobs still opens Jobs directly.
  const { deck: deckParam } = useLocalSearchParams<{ deck?: string }>();
  const [mode, setMode] = useState<FeedMode>(deckParam === 'jobs' ? 'jobs' : 'people');
  // The tab is already mounted when a deep link arrives (the first-run tour
  // sends ?deck=people at someone who is looking at Jobs), so the initial
  // state above is not enough: follow the param when it CHANGES. It never
  // fights a manual toggle, because toggling does not touch the URL.
  useEffect(() => {
    if (deckParam === 'people') setMode('people');
    else if (deckParam === 'jobs') setMode('jobs');
  }, [deckParam]);

  // The hiring-manager add-on has three states, and both of the upgrades
  // between them are ask-first. Off -> draft spends credits beyond the apply
  // and writes in the user's name; draft -> send puts mail in a stranger's
  // inbox with no review step. Coming back down is instant, in one tap.
  //
  // The state is DERIVED, not stored: `emailHiringManager` says whether the
  // add-on runs at all, and `action` (the global draft/send rule, shared with
  // every other outreach surface) says what it does. Deriving keeps this pill
  // and the Swipe settings screen from ever disagreeing.
  const draftOrSend: 'draft' | 'send' = swipeSettings.action === 'send' ? 'send' : 'draft';

  // The sentence this deck was built from, or null for the ranked default. The
  // store owns the consequences (which route feeds the deck); this screen only
  // has to say so and offer the way out.
  const jobFilter = swipeSettings.jobFilter?.trim() || null;
  const clearJobFilter = useCallback(() => {
    updateSwipeSettings({ jobFilter: null });
    showToast('Back to your default feed.');
  }, [updateSwipeSettings, showToast]);

  // Both confirmations are in-app dialogs, not Alert.alert (2026-08-16).
  // Alert is a no-op on react-native-web, so in the browser preview this whole
  // control looked dead: the switch was tapped, nothing opened, nothing
  // changed. Which of the two is open, or null.
  const [hmConfirm, setHmConfirm] = useState<null | 'enable' | 'send'>(null);

  const enableHiringManagerEmail = useCallback(() => {
    updateSwipeSettings({
      emailHiringManager: true,
      priority: 'hiring_manager',
      // Always land on the safe rung first. Reaching auto-send takes a second
      // tap and a second dialog, deliberately.
      action: 'draft',
    });
    showToast('We’ll draft to the hiring manager on every apply');
  }, [updateSwipeSettings, showToast]);

  const enableHiringManagerSend = useCallback(() => {
    // Reachable straight from Off in the one-row control, so confirming Send
    // must also turn the feature on, not just flip the action.
    updateSwipeSettings({ action: 'send', emailHiringManager: true, priority: 'hiring_manager' });
    showToast('Auto-sending. Swipes go out without review.');
  }, [updateSwipeSettings, showToast]);

  // The switch: on/off. Turning on confirms (it spends credits); off is
  // instant.
  const toggleHiringManager = useCallback(() => {
    if (swipeSettings.emailHiringManager) {
      updateSwipeSettings({ emailHiringManager: false });
      showToast('Off. Swipes just submit the application.');
      return;
    }
    setHmConfirm('enable');
  }, [swipeSettings.emailHiringManager, updateSwipeSettings, showToast]);

  // The [Draft]/[Send] word in the sentence. While on it flips the action
  // (Send confirms first); while off it acts as turn-on, same dialog as the
  // switch, because tapping the sentence is clearly reaching for the feature.
  const tapHiringManagerVerb = useCallback(() => {
    if (!swipeSettings.emailHiringManager) {
      setHmConfirm('enable');
      return;
    }
    if (swipeSettings.action === 'send') {
      updateSwipeSettings({ action: 'draft' });
      showToast('We’ll draft it. Nothing goes out without you.');
      return;
    }
    setHmConfirm('send');
  }, [swipeSettings.emailHiringManager, swipeSettings.action, updateSwipeSettings, showToast]);

  // The auto-apply nudge card lived here for one release; Rylan cut it
  // 2026-08-11 (it ate feed space). Discovery of the swipe's add-on now rests
  // on the labeled pill in the action bar alone.
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [expanded, setExpanded] = useState(false);
  const [referralPromptOpen, setReferralPromptOpen] = useState(false);
  // App limit-model (2026-07-10): every tier can apply, bounded by credits
  // (AUTO_APPLY_CREDITS each), not walled by plan. The backend allows all tiers.

  // Now that a right swipe IS the apply, the application profile gates the
  // whole deck, not just an opt-in mode. So this is fetched unconditionally
  // rather than only when auto-apply was switched on.
  const appProfileQuery = useQuery({
    queryKey: ['applicationProfile'],
    queryFn: getApplicationProfile,
  });
  const profileReady = isProfileReady(appProfileQuery.data);
  // Show the "set up your profile" prompt only once we know it's incomplete.
  const needsApplyProfile = !!appProfileQuery.data && !profileReady;

  const top = jobs[0];
  // Credits are the only meter: a swipe is affordable, or it isn't. A right
  // swipe now buys the APPLY, plus the hiring-manager draft when that toggle
  // is on, so the affordability check has to cover both or the user commits to
  // an action the wallet cannot finish.
  const rightSwipeCost =
    AUTO_APPLY_CREDITS + (swipeSettings.emailHiringManager ? costPerSwipe : 0);
  const canRightSwipe = profile.credits >= rightSwipeCost;

  // The liquid-glass action bar shrinks and settles down when the job card
  // is enlarged, giving the reader room, then springs back on collapse.
  const barShrink = useSharedValue(0);
  useEffect(() => {
    barShrink.value = withTiming(expanded ? 1 : 0, {
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [expanded, barShrink]);
  // Live drag, mirrored into the floating verb circles.
  const dragX = useSharedValue(0);

  // First-entry ghost swipe (Rylan 2026-08-19): the onboarding hand, once,
  // on the live deck. Stops on the first real swipe and never returns.
  const [ghostHint, setGhostHint] = useState(false);
  useEffect(() => {
    void hasSeenGhostHint('jobs').then((seen) => {
      if (!seen) setGhostHint(true);
    });
  }, []);
  useEffect(() => {
    if (!ghostHint) return;
    const t = setTimeout(() => {
      setGhostHint(false);
      void markGhostHintSeen('jobs');
    }, 9000);
    return () => clearTimeout(t);
  }, [ghostHint]);

  // Reading mode is pure flow now: the attached bar and the verb row
  // unmount on expand and the card takes the column (LinearTransition on the
  // deck container animates the grow). The old shrink/clearance shared-value
  // choreography went with the floating bar.
  // Leaving the Jobs deck always closes reading mode, so People never opens
  // under a hidden switcher.
  useEffect(() => {
    if (mode !== 'jobs') setExpanded(false);
  }, [mode]);

  // The pass and draft circles used to grow with the drag, so the gesture and
  // the button felt like one motion. Both circles are gone, so no drag value is
  // threaded into the deck any more. The stamps on the card are the drag
  // feedback now.

  // Auto-apply is on but the application profile is unfinished: the card hit
  // the wall (SwipeDeck blockRight). The doors sheet routes each user through
  // whichever resume path they can actually walk (upload now, build from
  // LinkedIn once the backend flag flips, or bail politely).
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);

  // Backup App Store rating trigger (lib/appRating), for the students who are
  // grinding but have not had a reply yet. The primary ask lives on the reply
  // screen; this one needs a pause instead of a win, so it waits for a settled
  // Feed with nothing open over it, once per session. appRating enforces the
  // real thresholds (5 separate days, 10+ emails out) and the pacing.
  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = doorsOpen || referralPromptOpen || expanded || hmConfirm !== null;
  const sentCount = outreach.filter(
    (o) => o.status === 'sent' || o.status === 'replied',
  ).length;
  const sentCountRef = useRef(sentCount);
  sentCountRef.current = sentCount;
  const habitAskedRef = useRef(false);
  useEffect(() => {
    if (habitAskedRef.current) return;
    if (!jobs.length) return;
    habitAskedRef.current = true;
    const t = setTimeout(() => {
      if (sheetOpenRef.current) return;
      void requestReviewIfDue('habit', Date.now(), { sentCount: sentCountRef.current });
    }, 4000);
    return () => clearTimeout(t);
  }, [jobs.length]);
  const onApplyProfileBlocked = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDoorsOpen(true);
  }, []);

  const doorUpload = useCallback(async () => {
    if (resumeUploading) return;
    try {
      const file = await pickResume();
      if (!file) return;
      setResumeUploading(true);
      await uploadResume(file);
      setDoorsOpen(false);
      showToast('Resume added. One more minute of basics.');
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.push('/application-profile');
    } catch {
      showToast('Could not add that file. Try a PDF.');
    } finally {
      setResumeUploading(false);
    }
  }, [resumeUploading, showToast, queryClient, router]);

  const doorLinkedin = useCallback(() => {
    setDoorsOpen(false);
    if (!RESUME_BUILDER_LIVE) {
      showToast('Building from LinkedIn arrives this week. Upload works today.');
      return;
    }
    router.push('/resume-preview');
  }, [router, showToast]);

  // Stable across renders so SwipeDeck (memoized) doesn't re-render on every
  // store change / 60s poll — only when the swipe-relevant inputs change.
  /**
   * A right swipe on a job APPLIES. That is the whole meaning of this deck now
   * (it used to draft outreach, with applying as an optional extra). Outreach
   * to people moved to the People deck, and the one thing that still reaches a
   * human from here is the opt-in hiring-manager email riding along on the
   * apply.
   *
   * A job the ATS cannot take an auto-apply for saves instead of applying, so
   * the swipe still does something true rather than failing silently.
   */
  const handleSwiped = useCallback((direction: 'left' | 'right' | 'up', job: Job) => {
    setGhostHint(false);
    void markGhostHintSeen('jobs');
    track('job_swiped', { direction, company: job.company });
    if (direction === 'up') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      saveJob(job.id);
      showToast('Saved for later');
      return;
    }
    if (direction === 'right') {
      if (!canRightSwipe) {
        // Out of credits: bounce, don't spend. The card snaps back. With IAP
        // live this is the limit-hit moment, so offer the real fix.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (iapAvailable()) presentPaywall({ context: 'draft' });
        else showToast('Out of credits. Applying resumes when your credits reset.');
        return;
      }
      // A punchy double-buzz on the commit so the action feels real.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 60);

      // Teach the ranker. A right swipe is the strongest taste signal the
      // deck produces, and until now the server never heard it: only passes
      // were recorded, so the rank learned what you hate but not what you
      // want. Fire-and-forget, same as the pass signal.
      void sendJobFeedback(job.id, 'positive');

      if (job.autoApplyEligible) {
        // Deduped background submission (surfaces in Network › Applied).
        // autoApplyJob blocks a second apply to the same job.
        autoApplyJob(job);
      } else {
        // No ATS path for this one. Saving beats pretending we applied.
        saveJob(job.id);
        showToast(`Saved ${job.title}. This one needs a manual application.`);
      }

      // The opt-in extra: find the hiring manager and draft to them.
      if (swipeSettings.emailHiringManager) {
        draftJob(job.id, { silent: true });
      }

      // Peak-dopamine moment — paced referral nudge (every 3rd win, ~daily cap).
      void shouldShowReferralPromptOnWin(Date.now()).then((show) => {
        if (show) setReferralPromptOpen(true);
      });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      passJob(job.id);
    }
  }, [
    canRightSwipe,
    draftJob,
    passJob,
    saveJob,
    autoApplyJob,
    swipeSettings.emailHiringManager,
    showToast,
  ]);

  // The pill was an outline around empty space — a plan border with nothing
  // inside it, which read as unfinished rather than minimal. Fill it with a soft
  // brand wash so it has presence at a glance without shouting over the deck.
  // The PlanBorder still carries the tier; this just gives the card a body.
  return (
    <View style={{ flex: 1, backgroundColor: stageBg }}>
      {/* Sky gradient only: dark mode keeps the app's shared backdrop, but the
          ridgeline comes off here for the same reason the day art did. */}
      <NightSky showRidge={false} />
      <Header
        title="Offerloop"
        logo
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      {/* The switcher steps aside while a card is enlarged: reading mode gets
          the full column, and the exit is on the card itself. */}
      {!(mode === 'jobs' && expanded) ? (
        <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(160)}>
          <FeedSwitcher mode={mode} onChange={setMode} />
        </Animated.View>
      ) : null}

      {/* People stays MOUNTED while Jobs is showing (Rylan 2026-08-18 round
          5: flipping tabs reset the deck and replayed every card he had
          already passed — the swipe memory lived in component state that
          unmounting threw away). display:none keeps state and skips work. */}
      <View
        pointerEvents={mode === 'people' ? 'auto' : 'none'}
        style={
          mode === 'people'
            ? { flex: 1 }
            // height 0 + overflow hidden, not display none: display none let
            // the People bar and verbs PAINT THROUGH onto Apply after some
            // transitions (Rylan 2026-08-19, IMG_3057). Clipping cannot.
            : { height: 0, overflow: 'hidden', opacity: 0 }
        }>
        <PeopleFeedView active={isFocused && mode === 'people'} />
      </View>
      {mode !== 'jobs' ? null : feedState.loading ? (
        <FeedSkeleton />
      ) : feedState.error ? (
        <StateView
          card
          icon="cloud-offline-outline"
          tone="error"
          title="Couldn’t load your feed"
          body="We couldn’t reach Offerloop to pull your ranked jobs. Check your connection and try again."
          actionLabel="Try again"
          onAction={feedState.retry}
        />
      ) : top ? (
        <View style={{ flex: 1, paddingHorizontal: 18 }}>
          {/* The credits line that sat here is gone (Rylan 2026-08-18: it
              squished the deck, and the People tab already proved the clean
              version). The balance lives in the header pill; the per-swipe
              price now rides the card's own bottom corner. */}
          {/* A right swipe submits a real application to a real employer. The
              student should be able to see exactly what goes out BEFORE they
              send one, from the screen they send it from — not by hunting
              through Profile hoping to find it. Hidden while a card is
              enlarged, same as the switcher: reading mode owns the column. */}
          {!expanded ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(160)}>
              <Pressable
                onPress={() => router.push('/what-we-send')}
                accessibilityRole="button"
                style={{ alignSelf: 'center', paddingTop: 4, paddingBottom: 2 }}>
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 12.5,
                    // Light-on-navy now that the stage is dark in both modes.
                    color: '#AFC3F5',
                    textAlign: 'center',
                  }}>
                  What gets submitted?
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Auto-apply is on but the application profile isn't set up, so a
              right swipe can't actually apply yet — point them to finish it. */}
          {needsApplyProfile && !expanded ? (
            <Pressable
              onPress={() => router.push('/application-profile')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                marginTop: 8,
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.waiting + '1A',
                borderWidth: 1,
                borderColor: colors.waiting + '40',
              }}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.waiting} />
              {/* One line, not two. It used to wrap because it said "to
                  auto-apply", which is also stale now: applying is what a right
                  swipe does, not a mode you switch on. Wrapping cost the deck
                  ~20pt of height on the screen it is warning you about. */}
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>
                Finish your profile to apply
              </Text>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.waiting }}>
                Set up
              </Text>
            </Pressable>
          ) : null}

          {/* Out of credits used to grey out and DISABLE the whole deck. But
              passing and saving cost nothing, and browsing is how you line up
              tomorrow's targets, and only APPLYING is unaffordable. Keep the deck
              live; the right-swipe bounces on its own via canRightSwipe. */}
          {/* Clearance for the bar below, not a slice off the card (Nick
              2026-08-16: "the spacing is pretty awkward"). 72 left the card
              bottom landing within a few points of the bar's top edge, so two
              white rounded surfaces touched and read as one confused shape.
              This is the bar's full height, plus its 26 of float, plus a 16
              gap. The bar grows a second row when the hiring-manager switch is
              on (34 tall + 8 gap), so the clearance grows with it rather than
              letting the card get run over. */}
          <Animated.View
            layout={LinearTransition.duration(280)}
            style={{ flex: 1, marginTop: 8, zIndex: 2 }}>
            <SwipeDemoHint active={ghostHint && !expanded && mode === 'jobs'}>
            <SwipeDeck
              ref={deckRef}
              jobs={jobs}
              expanded={expanded}
              onToggleExpand={setExpanded}
              onSwiped={handleSwiped}
              drag={dragX}
              gesturesEnabled={isFocused && mode === 'jobs'}
              blockRight={needsApplyProfile && !!top?.autoApplyEligible}
              onBlockedRight={onApplyProfileBlocked}
              rightStamp={top?.autoApplyEligible ? 'apply' : 'save'}
              shouldCelebrate={(direction) => direction !== 'right' || canRightSwipe}
              undo={{ visible: canUndo, onPress: undoLastPass, position: 'bottom-right' }}
            />
            </SwipeDemoHint>

          </Animated.View>

          {/* The bar RIDES the card now (Rylan 2026-08-19): flat top tucked
              under the card's rounded bottom, rounded bottom of its own,
              static while the card swipes away. The verbs float below it. */}
          {!expanded ? (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(160)}>
              <GlassBar
                solid
                style={{
                  alignSelf: 'stretch',
                  marginTop: 12,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 8,
                }}>

                {/* The one add-on for this deck: also email the hiring manager
                    on an apply. Ask-first when turning ON, for the same reason
                    auto-apply used to be: it spends extra credits and it writes
                    in the user's name. Turning it OFF is instant.

                    The (i) that used to sit here is gone (2026-08-16). It cost
                    the label the room it needed to render in full, and the
                    confirm dialog on the way ON says the same thing, at the
                    only moment it changes a decision.

                    The gear came BACK 2026-08-16, with a different screen behind
                    it. It used to open a settings page about how a swipe
                    behaves, which the bar itself now answers. What it opens now
                    is the one question the bar cannot: which roles this deck is
                    made of. */}
                {/* The X and Apply circles left this bar 2026-08-18 (second
                    round): they now float ON the card's bottom edge with the
                    undo, where Rylan circled. The bar keeps what a swipe
                    cannot do: the add-on switch and the deck filter. */}
                {/* Search on top, the switch under it, no gear (Rylan
                    2026-09-08): the search row opens the pop-up the gear
                    used to, so the bar is two slim rows and nothing else. */}
                <FeedSearchBar mode="jobs" />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
                  <View style={{ flex: 1 }}>
                    <HiringManagerToggle
                      on={swipeSettings.emailHiringManager}
                      action={swipeSettings.action === 'send' ? 'send' : 'draft'}
                      onToggle={toggleHiringManager}
                      onActionTap={tapHiringManagerVerb}
                    />
                  </View>
                </View>

                {/* The active sentence used to be named here; the search bar
                    under the switcher shows and clears it now (2026-09-08). */}

              </GlassBar>
              {/* Draft-versus-send no longer exists as a second row here at
                  all (2026-08-30): it merged into the Off / Draft / Send
                  control inside the bar, because a second row kept colliding
                  with the floating action circles no matter where it stood. */}
              <View style={{ marginTop: 14, marginBottom: 8 }}>
                <DeckActions
                  drag={dragX}
                  onPass={() => deckRef.current?.swipe('left')}
                  onCommit={() => deckRef.current?.swipe('right')}
                  commitIcon="checkmark"
                  passLabel="Pass on this job"
                  commitLabel={top?.autoApplyEligible ? 'Apply to this job' : 'Save this job'}
                />
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : (
        /* Two empty decks, two different truths. Running out of a filtered
           feed is not "you have seen everything we have", it is "that is every
           role matching that sentence", and the useful next move is widening
           the sentence rather than pulling a deeper slice that does not exist. */
        jobFilter ? (
          <StateView
            card
            icon="funnel-outline"
            title="That’s every match"
            body={`You’ve been through every role matching “${jobFilter}”. Widen it, or go back to the feed we rank for you.`}
            actionLabel="Change my filter"
            onAction={() => router.push('/feed-filter?deck=jobs')}
            secondaryLabel="Back to my default feed"
            onSecondary={clearJobFilter}
          />
        ) : (
        <StateView
          card
          icon="checkmark-done-circle-outline"
          tone="success"
          title="You’re all caught up"
          body="You’ve been through the roles we ranked for you. Pull in a fresh set — including ones a little outside your usual field — or restart the deck to revisit the ones you passed."
          actionLabel="Show me new roles"
          onAction={rerollFeed}
          actionLoading={rerolling}
          secondaryLabel="Restart deck"
          onSecondary={resetDeck}
        />
        )
      )}

      {/* The two ask-first steps on the hiring-manager add-on. Turning it on
          spends extra credits per swipe; switching it from drafting to sending
          is the one genuinely irreversible thing the app can do, so that
          dialog names the three facts a user would be angry to learn after the
          fact: nobody reads it first, it is not limited to this deck, and the
          overnight hours are exempt. */}
      {/* No icon chip, no headline (Nick 2026-08-16): the pitch IS the dialog,
          and a chip plus "Also email the hiring manager?" above it just said
          the first sentence twice before anyone got to the reason. The credit
          number is read from costPerSwipe, never typed in, so it cannot drift
          from what the swipe actually charges. */}
      <ConfirmDialog
        visible={hmConfirm === 'enable'}
        body={`Every apply also finds that job's hiring manager and drafts them an intro email from you. Applicants who email the hiring manager land 10x more interviews. Adds ${costPerSwipe} credits per swipe.`}
        confirmLabel="Turn on"
        onConfirm={enableHiringManagerEmail}
        onClose={() => setHmConfirm(null)}
      />
      <ConfirmDialog
        visible={hmConfirm === 'send'}
        icon="paper-plane-outline"
        tone="caution"
        title="Send these emails automatically?"
        body="Your hiring-manager email goes out from your Gmail the moment you swipe, with nobody reading it first. Every email follows this shape. This is your global outreach rule, so it applies everywhere in the app; swipes between 10pm and 8am are saved as drafts instead."
        confirmLabel="Send automatically"
        cancelLabel="Keep drafting"
        onConfirm={enableHiringManagerSend}
        onClose={() => setHmConfirm(null)}>
        <EmailSketch onNavigate={() => setHmConfirm(null)} />
      </ConfirmDialog>

      {/* The resume doors: shown when the swipe wall blocks an auto-apply
          because the application profile is unfinished. Same bottom-sheet
          pattern as the referral nudge below. */}
      <Modal
        visible={doorsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDoorsOpen(false)}>
        <Pressable
          onPress={() => setDoorsOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 36,
            }}>
            <ResumeDoors
              hasResume={!!profile.hasResume}
              hasLinkedin={!!profile.linkedinUrl?.trim()}
              onUpload={doorUpload}
              onBuildFromLinkedin={doorLinkedin}
              onDescribe={() => {
                setDoorsOpen(false);
                router.push('/resume-from-text');
              }}
              onNotNow={() => setDoorsOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Post-win referral nudge — paced (every 3rd draft, ~daily cap) so it's a
          celebration, not a nag. Dismissible; ReferralCard hides itself if the
          endpoint isn't live. */}
      <Modal
        visible={referralPromptOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReferralPromptOpen(false)}>
        <Pressable
          onPress={() => setReferralPromptOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.5)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: 36,
              gap: 12,
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink }}>
              Nice — you’re on a roll.
            </Text>
            <ReferralCard />
            <Pressable onPress={() => setReferralPromptOpen(false)} style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkTertiary, textAlign: 'center' }}>
                Maybe later
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
