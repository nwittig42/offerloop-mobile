import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { track } from '@/lib/analytics';
import { endTour } from '@/lib/tourFlag';
import { scoutThread } from '@/lib/scoutThread';
import { TOUR_CLOSER, TOUR_STEPS } from '@/components/tour/tourSteps';

/**
 * The first-run tour's state machine. Deliberately thin: which card is showing,
 * and the navigation that goes with it. The overlay renders from this, and
 * Scout starts it.
 *
 * It lives above the tab navigator (mounted in the root shell) for one reason:
 * the tour drives the user between tabs, so it cannot be owned by any one of
 * them.
 */
type TourValue = {
  active: boolean;
  index: number;
  total: number;
  start: () => void;
  next: () => void;
  end: (reason: 'done' | 'skip') => void;
};

const TourContext = createContext<TourValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [index, setIndex] = useState(-1);
  const active = index >= 0;

  const go = useCallback(
    (i: number) => {
      const step = TOUR_STEPS[i];
      if (!step) return;
      if (step.route) router.push(step.route as never);
      setIndex(i);
      track('tour_step', { step: step.key, index: i });
    },
    [router],
  );

  const start = useCallback(() => {
    track('tour_started', {});
    go(0);
  }, [go]);

  const end = useCallback(
    (reason: 'done' | 'skip') => {
      track(reason === 'done' ? 'tour_completed' : 'tour_skipped', { index });
      setIndex(-1);
      void endTour();
      // Answer the question the tour opened with, so the thread they land back
      // on reads as an exchange instead of an unanswered question.
      const last = scoutThread.entries().at(-1);
      if (last?.from === 'user') scoutThread.append({ from: 'scout', text: TOUR_CLOSER });
      // Always finish where they started, so the tour ends somewhere they can
      // act rather than on whatever tab the last card happened to explain.
      router.push('/(tabs)' as never);
    },
    [index, router],
  );

  const next = useCallback(() => {
    if (index + 1 >= TOUR_STEPS.length) {
      end('done');
      return;
    }
    go(index + 1);
  }, [index, go, end]);

  const value = useMemo<TourValue>(
    () => ({ active, index, total: TOUR_STEPS.length, start, next, end }),
    [active, index, start, next, end],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // The tour is optional furniture: a screen rendered outside the provider
    // (tests, a stray dev route) should no-op rather than crash.
    return {
      active: false,
      index: -1,
      total: TOUR_STEPS.length,
      start: () => {},
      next: () => {},
      end: () => {},
    };
  }
  return ctx;
}
