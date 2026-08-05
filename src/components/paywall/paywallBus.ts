import { router } from 'expo-router';

/**
 * Paywall presenter. Anything (the store's insufficient-credits catch, the
 * Feed bounce, Scout, the Credits screen) can summon the paywall without
 * threading props through the tree.
 *
 * The paywall is a ROUTE (/paywall, native formSheet), not a JS <Modal>: a
 * JS modal hosted at the root fails to present on iOS 26 when a native modal
 * (Credits, Scout, outreach detail) is already up, which read as "the Upgrade
 * button does nothing" in App Review. Native stack presentation composes
 * correctly from any screen, so every trigger site works the same way.
 */

export type PaywallContext = 'draft' | 'auto-apply' | 'scout' | 'credits-screen' | 'low-balance';

export type PaywallRequest = {
  context: PaywallContext;
  /** Open straight to the packs row (e.g. "Just need a few more drafts?"). */
  packsFirst?: boolean;
};

// Rapid double-taps (or two low-balance catches racing) must not stack two
// sheets; router.push has no built-in dedupe.
let lastPresentedAt = 0;

export function presentPaywall(req: PaywallRequest): void {
  const now = Date.now();
  if (now - lastPresentedAt < 700) return;
  lastPresentedAt = now;
  router.push({
    pathname: '/paywall',
    params: { context: req.context, ...(req.packsFirst ? { packsFirst: '1' } : {}) },
  });
}
