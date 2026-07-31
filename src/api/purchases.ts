import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  STOREKIT_VERSION,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { AUTO_APPLY_CREDITS } from '@/api/endpoints/scoutActions';

/**
 * RevenueCat plumbing (SPEC-iap-v2 section 6). The client only purchases and
 * refreshes; credits and tier are granted SERVER-SIDE by the RevenueCat
 * webhook. Nothing in here writes credit or tier fields.
 *
 * Availability gating: IAP is live only when the public SDK key env var is
 * present AND Purchases.configure succeeded. Builds without the key (or the
 * pre-IAP store build) keep every purchase surface hidden and fall back to
 * the old toasts, so this file is safe to ship over any runtime.
 */

const RC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

let configured = false;
let configureFailed = false;

export function iapAvailable(): boolean {
  return configured && !configureFailed;
}

/** Idempotent. Call once at app start; a missing key leaves IAP off. */
export function configurePurchases(): void {
  if (configured || configureFailed || !RC_KEY) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    // StoreKit 2 (RevenueCat's default). The v11 SK1 fallback was a guess
    // made before the real bug surfaced (the 400 pack had no Availability in
    // App Store Connect); SK1 is deprecated since iOS 18 and unreliable on
    // newer iOS, so staying on it is its own risk.
    Purchases.configure({ apiKey: RC_KEY, storeKitVersion: STOREKIT_VERSION.DEFAULT });
    configured = true;
  } catch {
    // Native module absent (Expo Go without preview API, or a build made
    // before the SDK was added). IAP stays off, app works as before.
    configureFailed = true;
  }
}

/** RC app_user_id MUST equal the Firebase uid so webhooks land on the right
 *  Firestore doc (shared with web Stripe). */
export async function logInPurchases(firebaseUid: string): Promise<void> {
  if (!iapAvailable()) return;
  try {
    await Purchases.logIn(firebaseUid);
  } catch {
    // Non-fatal: purchase attempts will surface their own errors.
  }
}

export async function logOutPurchases(): Promise<void> {
  if (!iapAvailable()) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already logged out / anonymous. Fine.
  }
}

/** Pack identity comes from the product id suffix, the same source of truth
 *  Sid's webhook grant table keys on. Never a display guess. */
const PACK_SUFFIXES = ['credits.150', 'credits.400', 'credits.1000'] as const;

/** The known pack sizes (derived from the ids above) so tiles can render the
 *  real credit counts while StoreKit prices are still loading. */
export const PACK_CREDIT_AMOUNTS: number[] = PACK_SUFFIXES.map((s) => Number(s.split('.')[1]));

function bundleId(): string {
  return Constants.expoConfig?.ios?.bundleIdentifier ?? 'ai.offerloop.app.preview';
}

export function packCreditAmount(productId: string): number | undefined {
  const m = productId.match(/credits\.(\d+)$/);
  return m ? Number(m[1]) : undefined;
}

/** Rounded-down action counts derived from the server-served per-action
 *  costs; every "N drafts" string in purchase UI builds from these. */
export function packActionCounts(
  credits: number,
  creditsPerSwipe: number,
): { drafts: number; applies: number } {
  return {
    drafts: Math.floor(credits / Math.max(1, creditsPerSwipe)),
    applies: Math.floor(credits / Math.max(1, AUTO_APPLY_CREDITS)),
  };
}

export function packActionFraming(credits: number, creditsPerSwipe: number): string {
  const { drafts, applies } = packActionCounts(credits, creditsPerSwipe);
  return `about ${drafts} drafts or ${applies} auto-applies`;
}

export type PaywallData = {
  proPackage: PurchasesPackage | null;
  elitePackage: PurchasesPackage | null;
  packs: PurchasesStoreProduct[];
};

/** One fetch for everything the sheets render. Prices come ONLY from here. */
export async function fetchPaywallData(): Promise<PaywallData> {
  if (!iapAvailable()) return { proPackage: null, elitePackage: null, packs: [] };
  let offerings: PurchasesOfferings | null = null;
  try {
    offerings = await Purchases.getOfferings();
  } catch {
    offerings = null;
  }
  const current = offerings?.current ?? null;
  const proPackage =
    current?.monthly ??
    current?.availablePackages.find((p) => p.product.identifier.includes('.pro.')) ??
    null;
  const elitePackage =
    current?.availablePackages.find((p) => p.product.identifier.includes('.elite.')) ?? null;

  let packs: PurchasesStoreProduct[] = [];
  try {
    const ids = PACK_SUFFIXES.map((s) => `${bundleId()}.${s}`);
    packs = await Purchases.getProducts(ids, 'NON_SUBSCRIPTION' as never);
    packs.sort((a, b) => (packCreditAmount(a.identifier) ?? 0) - (packCreditAmount(b.identifier) ?? 0));
  } catch {
    packs = [];
  }
  return { proPackage, elitePackage, packs };
}

export type PurchaseResult = { ok: boolean; cancelled: boolean; error?: string };

function purchaseError(e: unknown): string {
  const err = e as {
    message?: string;
    code?: string | number;
    userCancelled?: boolean;
    readableErrorCode?: string;
    underlyingErrorMessage?: string;
    userInfo?: { readableErrorCode?: string; underlyingErrorMessage?: string };
  };
  const readable = err?.userInfo?.readableErrorCode ?? err?.readableErrorCode;
  // The underlying message is where StoreKit says WHY (wrong storefront,
  // agreement problem, unapproved product). The RN bridge nests it under
  // userInfo, with a deprecated top-level copy on some paths; check both.
  const underlying = err?.userInfo?.underlyingErrorMessage ?? err?.underlyingErrorMessage;
  const parts = [
    [err?.code, err?.message].filter(Boolean).join(' '),
    readable,
    underlying ? `underlying: ${underlying}` : '',
  ].filter(Boolean);
  return parts.join(' | ') || String(e);
}

/** The App Store country the device is buying from. Sandbox error 5 is often
 *  a storefront mismatch, so surfacing this makes that case obvious. */
export async function fetchStorefrontCountry(): Promise<string | null> {
  if (!iapAvailable()) return null;
  try {
    const s = await Purchases.getStorefront();
    return s?.countryCode ?? null;
  } catch {
    return null;
  }
}

/** Sandbox StoreKit sometimes never resolves; a hung promise would wedge the
 *  buy buttons forever, so purchases race a 45s timeout. */
function withTimeout<T>(p: Promise<T>, ms = 45000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for the App Store')), ms),
    ),
  ]);
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    await withTimeout(Purchases.purchasePackage(pkg));
    return { ok: true, cancelled: false };
  } catch (e: unknown) {
    const cancelled = Boolean((e as { userCancelled?: boolean })?.userCancelled);
    return { ok: false, cancelled, error: purchaseError(e) };
  }
}

export async function purchaseProduct(product: PurchasesStoreProduct): Promise<PurchaseResult> {
  try {
    await withTimeout(Purchases.purchaseStoreProduct(product));
    return { ok: true, cancelled: false };
  } catch (e: unknown) {
    const cancelled = Boolean((e as { userCancelled?: boolean })?.userCancelled);
    return { ok: false, cancelled, error: purchaseError(e) };
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!iapAvailable()) return false;
  try {
    await Purchases.restorePurchases();
    return true;
  } catch {
    return false;
  }
}
