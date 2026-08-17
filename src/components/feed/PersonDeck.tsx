import { forwardRef, memo, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import PersonCard from '@/components/feed/PersonCard';
import SwipeStack, {
  type StampSpec,
  type SwipeStackHandle,
} from '@/components/feed/SwipeStack';
import type { Candidate } from '@/types';

/**
 * The people deck. Same physics as the jobs deck (both sit on SwipeStack),
 * different meaning: right writes to the person (drafting, or sending, per the
 * bar), left passes and excludes them from future decks.
 *
 * Swipe-up is OFF here. On jobs, up means "save for later", but a person the
 * ranker already excludes on a left swipe has no meaningful third state, and
 * an extra direction on a card that can spend credits is a way to spend them
 * by accident.
 */

export type PersonDeckHandle = SwipeStackHandle;

type Props = {
  people: Candidate[];
  expanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  onSwiped: (direction: 'left' | 'right' | 'up', person: Candidate) => void;
  drag?: SharedValue<number>;
  /** True when the user cannot afford the swipe: the card bounces instead of
   *  flying out, so a right swipe never promises something it cannot deliver. */
  blockRight?: boolean;
  onBlockedRight?: () => void;
  /** What the right swipe is about to do, from the bar's draft/send choice. */
  action: 'draft' | 'send';
};

/**
 * The stamp names the OUTCOME, not the plumbing (Nick 2026-08-16). "REVEAL"
 * described the step the user does not care about, and it stopped being the
 * whole story the moment the swipe started writing the email too. Now the card
 * says which of the two things is about to happen, and it changes with the bar
 * so the gesture never contradicts the control above it.
 */
const DRAFT_STAMP: StampSpec = { label: 'DRAFTING', tone: 'accent' };
const SEND_STAMP: StampSpec = { label: 'SENDING', tone: 'positive' };
const PASS_STAMP: StampSpec = { label: 'PASS', tone: 'negative' };

export const PersonDeck = memo(
  forwardRef<PersonDeckHandle, Props>(
    (
      {
        people,
        expanded,
        onToggleExpand,
        onSwiped,
        drag,
        blockRight = false,
        onBlockedRight,
        action,
      },
      ref,
    ) => {
      const renderCard = useCallback(
        (person: Candidate, isExpanded: boolean, onCollapse: () => void) =>
          isExpanded ? (
            <PersonCard person={person} expanded onCollapse={onCollapse} />
          ) : (
            <PersonCard person={person} />
          ),
        [],
      );

      return (
        <SwipeStack<Candidate>
          ref={ref}
          items={people}
          keyOf={(person) => person.id}
          renderCard={renderCard}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onSwiped={onSwiped}
          drag={drag}
          blockRight={blockRight}
          onBlockedRight={onBlockedRight}
          rightStamp={action === 'send' ? SEND_STAMP : DRAFT_STAMP}
          leftStamp={PASS_STAMP}
          allowUp={false}
          a11yLabel={(person) =>
            [person.name, person.title, person.company].filter(Boolean).join(', ')
          }
          rightActionLabel={
            action === 'send'
              ? 'Send an email to this person'
              : 'Draft an email to this person'
          }
          leftActionLabel="Pass on this person"
        />
      );
    },
  ),
);

PersonDeck.displayName = 'PersonDeck';

export default PersonDeck;
