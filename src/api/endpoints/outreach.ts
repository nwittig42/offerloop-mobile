import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import type { ThreadMessage } from '@/types';

/**
 * Send a reply / follow-up on an existing thread via the outbox service
 * (POST /api/outbox/threads/{id}/send-reply). This is the retention-critical
 * "respond fast from your phone" moment. Returns the appended message so the
 * caller can optimistically grow the thread.
 */
/**
 * Send a cold-open draft in-app (POST /api/mobile/outreach/{id}/send). The
 * backend sends the existing Gmail draft, so the user never leaves the app.
 */
export async function sendDraft(contactId: string): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch(`/api/mobile/outreach/${encodeURIComponent(contactId)}/send`, { method: 'POST' });
}

export async function sendReply(contactId: string, body: string): Promise<ThreadMessage> {
  if (USE_MOCKS) {
    return { from: 'me', text: body, timeLabel: 'Just now' };
  }
  await apiFetch(`/api/outbox/threads/${encodeURIComponent(contactId)}/send-reply`, {
    method: 'POST',
    body: { body },
  });
  return { from: 'me', text: body, timeLabel: 'Just now' };
}
