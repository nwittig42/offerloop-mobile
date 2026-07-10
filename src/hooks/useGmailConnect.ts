import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';

import { startGmailOAuth } from '@/api/endpoints/profile';
import { qk } from '@/api/queryKeys';

/**
 * In-app Gmail connect. Offerloop runs ON Gmail — real sends from the user's
 * own account, drafts in their drafts folder, replies tracked back — so this
 * is the single most load-bearing setup step, not an optional integration.
 *
 * Flow: backend mints the Google auth URL (surface=mobile) -> we open it in an
 * iOS auth session -> Google redirects to our callback -> the callback bounces
 * to offerloop://gmail-connected, which closes the session -> we refetch /me
 * so `profile.gmailConnected` flips without a restart.
 */
export type GmailConnectResult = 'connected' | 'cancelled' | 'failed';

const RETURN_URL = 'offerloop://gmail-connected';

export function useGmailConnect() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async (): Promise<GmailConnectResult> => {
    if (connecting) return 'cancelled';
    setConnecting(true);
    try {
      const authUrl = await startGmailOAuth();
      const res = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);
      if (res.type !== 'success') return 'cancelled';
      // The callback appends ?gmail_error=... when Google or our exchange failed.
      if (res.url.includes('gmail_error=')) return 'failed';
      // /me is the source of truth for gmailConnected; force a fresh read.
      await queryClient.invalidateQueries({ queryKey: qk.me });
      return 'connected';
    } catch {
      return 'failed';
    } finally {
      setConnecting(false);
    }
  }, [connecting, queryClient]);

  return { connect, connecting };
}
