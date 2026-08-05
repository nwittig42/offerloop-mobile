import { router, useLocalSearchParams } from 'expo-router';

import PaywallSheet from '@/components/paywall/PaywallSheet';
import { type PaywallContext } from '@/components/paywall/paywallBus';

/**
 * The purchase sheet as a real route (native formSheet). Summoned via
 * presentPaywall() from anywhere, including from inside other native modals
 * (Credits, Scout, outreach detail); see paywallBus for why this must be a
 * route and not a JS modal.
 */
export default function PaywallScreen() {
  const params = useLocalSearchParams<{ context?: string; packsFirst?: string }>();
  return (
    <PaywallSheet
      context={params.context as PaywallContext | undefined}
      packsFirst={params.packsFirst === '1'}
      onClose={() => {
        if (router.canGoBack()) router.back();
      }}
    />
  );
}
