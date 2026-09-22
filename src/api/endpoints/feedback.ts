import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

export type FeedbackMessage = {
  id: string;
  message: string;
  createdAt?: string;
  /** Null only if something failed server-side; every message gets at least
   *  the canned acknowledgement immediately, then a real reply overwrites it
   *  in place once a founder responds via Linear. */
  response: string | null;
  /** True = the canned "we got it" ack, not read yet by a human. False = a
   *  real, human-written reply. Drives which style the bubble renders as. */
  responseIsPlaceholder: boolean;
};

/** The user's own feedback thread (what they've sent), oldest first. */
export async function fetchFeedback(): Promise<FeedbackMessage[]> {
  if (USE_MOCKS) return [];
  const r = await apiFetch<{ items?: FeedbackMessage[] }>('/api/mobile/feedback', {
    timeoutMs: 15_000,
  });
  return r.items ?? [];
}

/** Send one feedback message straight to the founders. Returns the canned
 *  acknowledgement immediately; the caller decides how to reveal it. */
export async function sendFeedback(message: string): Promise<FeedbackMessage> {
  const r = await apiFetch<{ id: string; createdAt?: string; response?: string }>(
    '/api/mobile/feedback',
    { method: 'POST', body: { message }, timeoutMs: 15_000 },
  );
  return {
    id: r.id,
    message,
    createdAt: r.createdAt,
    response: r.response ?? null,
    responseIsPlaceholder: true,
  };
}
