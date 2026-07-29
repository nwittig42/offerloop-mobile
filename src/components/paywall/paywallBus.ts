/**
 * Tiny presenter bus so anything (the store's insufficient-credits catch, the
 * Feed bounce, Scout, the Credits screen) can summon the paywall sheet without
 * threading props through the tree. PaywallHost in the root layout listens.
 */

export type PaywallContext = 'draft' | 'auto-apply' | 'scout' | 'credits-screen' | 'low-balance';

export type PaywallRequest = {
  context: PaywallContext;
  /** Open straight to the packs row (e.g. "Just need a few more drafts?"). */
  packsFirst?: boolean;
};

type Listener = (req: PaywallRequest) => void;

const listeners = new Set<Listener>();

export function onPresentPaywall(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function presentPaywall(req: PaywallRequest): void {
  listeners.forEach((fn) => fn(req));
}
