/**
 * One progress count across the whole first run.
 *
 * The flow is split over two screens: app/(onboarding)/intake.tsx owns the
 * first steps, app/(onboarding)/index.tsx owns the rest. Each used to number
 * itself, so the bar filled up, reset to empty, and filled again, which reads
 * as "you are only a third done" right after someone thought they were nearly
 * through.
 *
 * Both screens now offset into this list instead. Adding or removing a step
 * means editing here and nowhere else.
 */
export const ONBOARDING_STEPS = [
  'resume',
  'demo',
  'gmail',
  'notifications',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length;

/** 1-based position for the progress bar, e.g. stepNumber('gmail') === 4. */
export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}
