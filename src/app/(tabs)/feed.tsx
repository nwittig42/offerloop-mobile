import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import GlassBar from '@/components/GlassBar';
import NightSky from '@/components/NightSky';
import Header from '@/components/Header';
import ReferralCard from '@/components/ReferralCard';
import { requestReviewIfDue } from '@/lib/appRating';
import { shouldShowReferralPromptOnWin } from '@/lib/referralPrompt';
import FeedSwitcher, { type FeedMode } from '@/components/feed/FeedSwitcher';
import DraftSendChoice from '@/components/feed/DraftSendChoice';
import HiringManagerToggle from '@/components/feed/HiringManagerToggle';
import PeopleFeedView from '@/components/feed/PeopleFeedView';
import SwipeDeck, { type SwipeDeckHandle } from '@/components/feed/SwipeDeck';

import { getApplicationProfile, isProfileReady } from '@/api/endpoints/autoApply';
import { RESUME_BUILDER_LIVE } from '@/api/endpoints/resumeBuilder';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { AUTO_APPLY_CREDITS } from '@/api/endpoints/scoutActions';
import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { ActionCircle } from '@/components/ui/Button';
import { iapAvailable } from '@/api/purchases';
import { presentPaywall } from '@/components/paywall/paywallBus';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FeedSkeleton } from '@/components/ui/Skeleton';
import StateView from '@/components/ui/StateView';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
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
  const queryClient = useQueryClient();

  // Which deck is showing. Jobs opens first: it is the familiar surface, and
  // applying is the lower-commitment action of the two. ?deck=people opens on
  // the other one, which is how the first-run tour lands on it.
  const { deck: deckParam } = useLocalSearchParams<{ deck?: string }>();
  const [mode, setMode] = useState<FeedMode>(deckParam === 'people' ? 'people' : 'jobs');
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
    updateSwipeSettings({ action: 'send' });
    showToast('Auto-sending. Swipes go out without review.');
  }, [updateSwipeSettings, showToast]);

  const toggleHiringManager = useCallback(() => {
    if (swipeSettings.emailHiringManager) {
      updateSwipeSettings({ emailHiringManager: false });
      showToast('Off. Swipes just submit the application.');
      return;
    }
    setHmConfirm('enable');
  }, [swipeSettings.emailHiringManager, updateSwipeSettings, showToast]);

  // Draft is a free move. Send is not, so it goes through the dialog and the
  // segmented control only follows once that is answered.
  const chooseDraftOrSend = useCallback(
    (next: 'draft' | 'send') => {
      if (next === draftOrSend) return;
      if (next === 'draft') {
        updateSwipeSettings({ action: 'draft' });
        showToast('We’ll draft it. Nothing goes out without you.');
        return;
      }
      setHmConfirm('send');
    },
    [draftOrSend, updateSwipeSettings, showToast],
  );

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
  const barStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - 0.18 * barShrink.value },
      { translateY: 10 * barShrink.value },
    ],
    opacity: 1 - 0.15 * barShrink.value,
  }));

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
    <View style={{ flex: 1, backgroundColor: colors.feedBg }}>
      {/* Sky gradient only: dark mode keeps the app's shared backdrop, but the
          ridgeline comes off here for the same reason the day art did. */}
      <NightSky showRidge={false} />
      <Header
        title="Offerloop"
        logo
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <FeedSwitcher mode={mode} onChange={setMode} />

      {mode === 'people' ? (
        <PeopleFeedView />
      ) : feedState.loading ? (
        <FeedSkeleton />
      ) : feedState.error ? (
        <StateView
          icon="cloud-offline-outline"
          tone="error"
          title="Couldn’t load your feed"
          body="We couldn’t reach Offerloop to pull your ranked jobs. Check your connection and try again."
          actionLabel="Try again"
          onAction={feedState.retry}
        />
      ) : top ? (
        <View style={{ flex: 1, paddingHorizontal: 18 }}>
          {/* One number, and it's true: what the wallet can still pay for. The
              cost quoted is the cost of the swipe the user is about to make,
              so it moves when the hiring-manager toggle does. */}
          <Pressable onPress={() => router.push('/credits')}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 13,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingTop: 6,
              }}>
              {profile.credits} credits
              <Text style={{ color: colors.inkTertiary }}>
                {'  ·  '}{rightSwipeCost} per swipe
                {!swipeSettings.emailHiringManager
                  ? ' (apply)'
                  : draftOrSend === 'send'
                    ? ' (apply + send)'
                    : ' (apply + draft)'}
              </Text>
            </Text>
          </Pressable>

          {/* A right swipe submits a real application to a real employer. The
              student should be able to see exactly what goes out BEFORE they
              send one, from the screen they send it from — not by hunting
              through Profile hoping to find it. */}
          <Pressable
            onPress={() => router.push('/what-we-send')}
            accessibilityRole="button"
            style={{ alignSelf: 'center', paddingTop: 4, paddingBottom: 2 }}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 12.5,
                color: colors.accent,
                textAlign: 'center',
              }}>
              What gets submitted?
            </Text>
          </Pressable>

          {/* Auto-apply is on but the application profile isn't set up, so a
              right swipe can't actually apply yet — point them to finish it. */}
          {needsApplyProfile ? (
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
          <View
            style={{
              flex: 1,
              marginTop: 8,
              paddingBottom: swipeSettings.emailHiringManager ? 152 : 110,
            }}>
            <SwipeDeck
              ref={deckRef}
              jobs={jobs}
              expanded={expanded}
              onToggleExpand={setExpanded}
              onSwiped={handleSwiped}
              blockRight={needsApplyProfile && !!top?.autoApplyEligible}
              onBlockedRight={onApplyProfileBlocked}
              rightStamp={top?.autoApplyEligible ? 'apply' : 'save'}
            />

          </View>

          {/* The bar used to disappear at zero credits, back when everything in
              it cost money. Both survivors are free (one changes what the next
              swipe means, one opens settings), and hiding the way to turn OFF
              the thing pushing you over budget is exactly backwards. It stays. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              {
                position: 'absolute',
                // 10 put the bar's shadow almost against the tab bar's top
                // hairline, so the two chrome layers read as one stack. 26
                // gives it clear water and lets it read as floating.
                bottom: 26,
                left: 0,
                right: 0,
                alignItems: 'center',
              },
              barStyle,
            ]}>
              {/* Two controls, not six (Nick 2026-08-14). The four that left:
                  shuffle already exists as "Show me new roles" on the
                  all-caught-up state, bookmark duplicated swipe-up, and the
                  pass and apply circles duplicated the swipe the whole screen
                  is built around. What survives is the pair that a swipe
                  CANNOT do: change what the next swipe means, and open the
                  settings behind it.

                  The swipe is now the only pointing-device path to pass and
                  apply, so SwipeStack carries accessibilityActions for both.
                  That is what keeps this HIG-legal (rule 5.7: every custom
                  gesture needs a tap or menu equivalent), since VoiceOver and
                  Switch Control cannot perform a drag. */}
              {/* Undo, labelled and in the same spot as the People deck's.
                  It used to be a 34pt unlabelled circle in the card's top
                  corner, which is a poor answer to the moment it exists for:
                  a student passes a job by thumb-twitch, realises instantly,
                  and needs the way back to be the obvious thing on screen
                  rather than a glyph they have to go find. Passes only —
                  applying spends credits and cannot be taken back. */}
              {canUndo && !expanded ? (
                <Pressable
                  onPress={undoLastPass}
                  accessibilityRole="button"
                  accessibilityLabel="Bring back the last job you passed"
                  style={{
                    alignSelf: 'flex-start',
                    marginLeft: 18,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.paper,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}>
                  <Ionicons name="arrow-undo" size={15} color={colors.inkSecondary} />
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSecondary }}>
                    Undo
                  </Text>
                </Pressable>
              ) : null}

              {/* Bar width is tied to the DECK, not to its own contents. It
                  used to shrink-wrap its buttons, which left a short bar
                  floating under a full-width card. Now that it sits BELOW the
                  card instead of over it, it takes the card's exact 18pt
                  margins: same column, own row. The 4pt that buys also goes to
                  the label, which is the thing that was clamping. */}
              <GlassBar
                style={{
                  alignSelf: 'stretch',
                  marginHorizontal: 18,
                  // A column, because the bar grows a second row when the
                  // hiring-manager switch is on.
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <HiringManagerToggle
                      on={swipeSettings.emailHiringManager}
                      onPress={toggleHiringManager}
                    />
                  </View>
                  <ActionCircle
                    icon="options-outline"
                    size={46}
                    onPress={() => router.push('/feed-filter?deck=jobs')}
                    accessibilityLabel={
                      jobFilter ? `Job feed filter: ${jobFilter}` : 'Filter the job feed'
                    }
                  />
                </View>

                {/* The active filter, named. A deck that quietly stopped being
                    the general feed is the one thing here a user could not
                    work out from looking at it, and the fix has to be one tap
                    from the confusion, not buried back in the settings screen.
                    It sits in the bar rather than above the deck because
                    nothing goes between the switcher and the card. */}
                {jobFilter ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="funnel" size={13} color={colors.inkTertiary} />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontFamily: fonts.sans,
                        fontSize: 12.5,
                        color: colors.inkSecondary,
                      }}>
                      {jobFilter}
                    </Text>
                    <Pressable
                      onPress={clearJobFilter}
                      accessibilityRole="button"
                      accessibilityLabel="Clear the job feed filter"
                      hitSlop={10}>
                      <Ionicons name="close-circle" size={17} color={colors.inkTertiary} />
                    </Pressable>
                  </View>
                ) : null}

                {/* The follow-up, and only when it means something: we are
                    writing to this person, so do you want to read it first? */}
                {swipeSettings.emailHiringManager ? (
                  <DraftSendChoice value={draftOrSend} onChange={chooseDraftOrSend} />
                ) : null}
              </GlassBar>
          </Animated.View>
        </View>
      ) : (
        /* Two empty decks, two different truths. Running out of a filtered
           feed is not "you have seen everything we have", it is "that is every
           role matching that sentence", and the useful next move is widening
           the sentence rather than pulling a deeper slice that does not exist. */
        jobFilter ? (
          <StateView
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
          icon="checkmark-done-circle-outline"
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
        body={`When you swipe right, it doesn't just apply to the job for you. It also finds the exact hiring manager for that position and their contact info, then drafts an email to them introducing yourself and expressing interest in the role, an action known to 10x your chances of landing an interview. Costs an extra ${costPerSwipe} credits per swipe.`}
        confirmLabel="Turn on"
        onConfirm={enableHiringManagerEmail}
        onClose={() => setHmConfirm(null)}
      />
      <ConfirmDialog
        visible={hmConfirm === 'send'}
        icon="paper-plane-outline"
        tone="caution"
        title="Send these emails automatically?"
        body="Your hiring-manager email goes out from your Gmail the moment you swipe, with nobody reading it first. This is your global outreach rule, so it applies everywhere in the app, not just this deck. Swipes between 10pm and 8am are saved as drafts instead."
        confirmLabel="Send automatically"
        cancelLabel="Keep drafting"
        onConfirm={enableHiringManagerSend}
        onClose={() => setHmConfirm(null)}
      />

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
