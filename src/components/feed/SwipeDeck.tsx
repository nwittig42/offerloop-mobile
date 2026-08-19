import { forwardRef, memo, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import JobCard from '@/components/feed/JobCard';
import SwipeStack, {
  type StampSpec,
  type SwipeStackHandle,
} from '@/components/feed/SwipeStack';
import type { Job } from '@/types';

/**
 * The jobs deck: the swipe physics live in SwipeStack, this only says what a
 * job card looks like and what the stamps read. Left = pass, right = apply or
 * draft, up = open reading mode (2026-08-18; it saved for later before that).
 *
 * The public shape is unchanged from when this file held the gesture code, so
 * the feed, the onboarding demo, and the company page all keep working as-is.
 */

export type SwipeDeckHandle = SwipeStackHandle;

type Props = {
  jobs: Job[];
  expanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  /** 'up' never fires any more (an up-commit expands instead of leaving);
   *  the union stays so the screen's handler keeps compiling unchanged. */
  onSwiped: (direction: 'left' | 'right' | 'up', job: Job) => void;
  /** Mirrors the live horizontal drag so the action buttons can react. */
  drag?: SharedValue<number>;
  /** When true, a right swipe cannot complete: the card hits an invisible
   *  wall and springs back, and onBlockedRight fires so the caller can say
   *  why (e.g. auto-apply is on but the application profile is unfinished). */
  blockRight?: boolean;
  onBlockedRight?: () => void;
  /** What a right swipe on the TOP card actually does: 'apply' when the ATS
   *  can take it, 'save' when it needs a manual application, 'draft' on the
   *  older outreach path. Honest per-card: an ineligible job never flashes a
   *  promise to apply. */
  rightStamp?: 'draft' | 'apply' | 'save';
  /** Passed straight to SwipeStack: veto the win toast for a swipe the screen
   *  is about to refuse (e.g. right swipe with an empty wallet). */
  shouldCelebrate?: (direction: 'left' | 'right' | 'up', job: Job) => boolean;
  /** Worn by the collapsed card's bottom-right corner ("10 credits"). */
  costLabel?: string;
};

const PASS_STAMP: StampSpec = { label: 'PASS', tone: 'negative' };
const SAVE_STAMP: StampSpec = { label: 'SAVE', tone: 'marketing' };
// Swipe-up opens reading mode now (Rylan 2026-08-18), so the up stamp names
// that, not a save.
const READ_STAMP: StampSpec = { label: 'READ', tone: 'accent' };
const APPLY_STAMP: StampSpec = { label: 'APPLY', tone: 'positive' };
const DRAFT_STAMP: StampSpec = { label: 'DRAFT', tone: 'accent' };

export const SwipeDeck = memo(
  forwardRef<SwipeDeckHandle, Props>(
    (
      {
        jobs,
        expanded,
        onToggleExpand,
        onSwiped,
        drag,
        rightStamp = 'draft',
        blockRight = false,
        onBlockedRight,
        shouldCelebrate,
        costLabel,
      },
      ref,
    ) => {
      const renderCard = useCallback(
        (job: Job, isExpanded: boolean, onCollapse: () => void) =>
          isExpanded ? (
            <JobCard job={job} expanded onCollapse={onCollapse} />
          ) : (
            <JobCard job={job} costLabel={costLabel} />
          ),
        [costLabel],
      );

      return (
        <SwipeStack<Job>
          ref={ref}
          items={jobs}
          keyOf={(job) => job.id}
          renderCard={renderCard}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onSwiped={onSwiped}
          drag={drag}
          blockRight={blockRight}
          onBlockedRight={onBlockedRight}
          rightStamp={
            rightStamp === 'apply'
              ? APPLY_STAMP
              : rightStamp === 'save'
                ? SAVE_STAMP
                : DRAFT_STAMP
          }
          leftStamp={PASS_STAMP}
          rightWin={
            rightStamp === 'apply'
              ? { title: 'Applying for you', caption: 'Track it in Network' }
              : rightStamp === 'save'
                ? { title: 'Saved', caption: 'Needs a manual application' }
                : { title: 'Drafting your email', caption: 'Lands in your Inbox' }
          }
          shouldCelebrate={shouldCelebrate}
          allowUp
          upAction="expand"
          upStamp={READ_STAMP}
          a11yLabel={(job) =>
            [job.title, job.company, job.location].filter(Boolean).join(', ')
          }
          rightActionLabel={rightStamp === 'apply' ? 'Apply to this job' : 'Save this job'}
          leftActionLabel="Pass on this job"
          upActionLabel="Read the full posting"
        />
      );
    },
  ),
);

SwipeDeck.displayName = 'SwipeDeck';

export default SwipeDeck;
