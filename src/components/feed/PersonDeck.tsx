import { forwardRef, memo, useCallback } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import PersonCard from '@/components/feed/PersonCard';
import { normCompanyName } from '@/lib/company';
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
  onSwiped: (direction: 'left' | 'right' | 'up', person: Candidate) => void;
  drag?: SharedValue<number>;
  /** True when the user cannot afford the swipe: the card bounces instead of
   *  flying out, so a right swipe never promises something it cannot deliver. */
  blockRight?: boolean;
  onBlockedRight?: () => void;
  /** What the right swipe is about to do, from the bar's draft/send choice. */
  action: 'draft' | 'send';
  /** Normalized names of companies the user has applied to, for the card
   *  badge. A Set so a hundred-card deck is a hundred lookups, not a hundred
   *  scans of the applications list. */
  appliedCompanies?: Set<string>;
  /** Undo on the card's top-right corner; travels with the swipe. */
  undo?: { visible: boolean; onPress: () => void };
};

/**
 * The stamp names the OUTCOME, not the plumbing (Nick 2026-08-16). "REVEAL"
 * described the step the user does not care about, and it stopped being the
 * whole story the moment the swipe started writing the email too. Now the card
 * says which of the two things is about to happen, and it changes with the bar
 * so the gesture never contradicts the control above it.
 */
/** Module-level so the identity is stable across renders. */
const NO_EXPAND = () => {};

const DRAFT_STAMP: StampSpec = { label: 'DRAFTING', tone: 'accent' };
const SEND_STAMP: StampSpec = { label: 'SENDING', tone: 'positive' };
const PASS_STAMP: StampSpec = { label: 'PASS', tone: 'negative' };

export const PersonDeck = memo(
  forwardRef<PersonDeckHandle, Props>(
    (
      {
        people,
        onSwiped,
        drag,
        blockRight = false,
        onBlockedRight,
        action,
        appliedCompanies,
        undo,
      },
      ref,
    ) => {
      // One face, always. A person card has no expanded state to render (see
      // PersonCard), so the stack's isExpanded/onCollapse arguments are ignored
      // here rather than branching on something that produces the same card.
      const renderCard = useCallback(
        (person: Candidate) => (
          <PersonCard
            person={person}
            appliedHere={
              !!appliedCompanies?.size && appliedCompanies.has(normCompanyName(person.company || ''))
            }
          />
        ),
        [appliedCompanies],
      );

      return (
        <SwipeStack<Candidate>
          ref={ref}
          items={people}
          keyOf={(person) => person.id}
          renderCard={renderCard}
          // Hard false with a no-op setter: the stack is shared with the jobs
          // deck, where expanding reveals the job description and is worth the
          // tap. On people there is nothing behind the tap, so the state is
          // pinned shut here rather than plumbed up to a screen that cannot use
          // it.
          expanded={false}
          onToggleExpand={NO_EXPAND}
          onSwiped={onSwiped}
          drag={drag}
          blockRight={blockRight}
          onBlockedRight={onBlockedRight}
          rightStamp={action === 'send' ? SEND_STAMP : DRAFT_STAMP}
          leftStamp={PASS_STAMP}
          undo={undo}
          rightWin={
            action === 'send'
              ? { title: 'Sending it', caption: 'Track it in your Inbox' }
              : { title: 'Drafting your email', caption: 'Lands in your Inbox' }
          }
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
