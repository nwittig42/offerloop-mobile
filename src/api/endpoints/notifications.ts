import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_NOTIFICATIONS_SEED } from '@/mocks/data';
import type { NotificationItem } from '@/types';

/**
 * Header-bell notifications. GET /api/mobile/notifications reads the same
 * users/{uid}/notifications/outbox doc the reply webhook + loop cycles append
 * to (and that push notifications fire from), so a push that just landed shows
 * up here. The backend already maps to the NotificationItem shape.
 */
type NotificationsResponse = { items?: NotificationItem[]; unreadCount?: number };

export async function fetchNotifications(): Promise<NotificationItem[]> {
  if (USE_MOCKS) return MOCK_NOTIFICATIONS_SEED;
  const res = await apiFetch<NotificationsResponse>('/api/mobile/notifications');
  return res.items || [];
}

/** Mark every bell item read + zero the server unread counters. */
export async function markNotificationsRead(): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/mobile/notifications/read', { method: 'POST' });
}
