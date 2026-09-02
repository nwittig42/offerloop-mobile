import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

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
  // The live position, readable from any handler. `index` above is what the
  // overlay renders from; this is what the transitions decide from. Keeping
  // them separate is what makes a double tap harmless: two Next presses in
  // the same frame both read the same stale `index`, and each would push the
  // same screen and re-fire the same card (Rylan, 2026-09-01, "the tutorial
  // glitched when I clicked it twice").
  const indexRef = useRef(-1);
  const movedAt = useRef(0);
  // Anything faster than this is a double tap, not a decision.
  const MIN_STEP_GAP_MS = 400;

  const go = useCallback(
    (i: number) => {
      const step = TOUR_STEPS[i];
      if (!step) return;
      const now = Date.now();
      if (i === indexRef.current || now - movedAt.current < MIN_STEP_GAP_MS) return;
      indexRef.current = i;
      movedAt.current = now;
      if (step.route) router.push(step.route as never);
      setIndex(i);
      track('tour_step', { step: step.key, index: i });
    },
    [router],
  );

  const start = useCallback(() => {
    // Already running: a second start would replay card one on top of itself.
    if (indexRef.current >= 0) return;
    track('tour_started', {});
    go(0);
  }, [go]);

  const end = useCallback(
    (reason: 'done' | 'skip') => {
      if (indexRef.current < 0) return;
      track(reason === 'done' ? 'tour_completed' : 'tour_skipped', { index: indexRef.current });
      indexRef.current = -1;
      movedAt.current = Date.now();
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
    [router],
  );

  const next = useCallback(() => {
    const i = indexRef.current + 1;
    if (i >= TOUR_STEPS.length) {
      end('done');
      return;
    }
    go(i);
  }, [go, end]);

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
