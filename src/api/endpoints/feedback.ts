import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

export type FeedbackMessage = { id: string; message: string; createdAt?: string };

/** The user's own feedback thread (what they've sent), oldest first. */
export async function fetchFeedback(): Promise<FeedbackMessage[]> {
  if (USE_MOCKS) return [];
  const r = await apiFetch<{ items?: FeedbackMessage[] }>('/api/mobile/feedback', {
    timeoutMs: 15_000,
  });
  return r.items ?? [];
}

/** Send one feedback message straight to the founders. */
export async function sendFeedback(message: string): Promise<FeedbackMessage> {
  const r = await apiFetch<{ id: string; createdAt?: string }>('/api/mobile/feedback', {
    method: 'POST',
    body: { message },
    timeoutMs: 15_000,
  });
  return { id: r.id, message, createdAt: r.createdAt };
}
