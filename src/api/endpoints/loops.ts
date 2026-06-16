import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_PROFILE } from '@/mocks/data';
import type { Loop } from '@/types';

/** Raw loop from GET /api/agent/loops (loop_service + attached found counts). */
type RawLoop = Record<string, any>;

function mapLoop(l: RawLoop): Loop {
  const status = String(l.status || '').toLowerCase();
  return {
    id: String(l.id),
    brief: l.briefText || l.name || 'Loop',
    // Backend statuses: idle | active | running | paused | completed | archived.
    // Only "paused" reads as paused; everything else is live to the user.
    status: status === 'paused' ? 'Paused' : 'Active',
    contactsFound: l.liveContactsFound ?? l.totalContactsFound ?? 0,
    draftsCreated: l.liveDraftsWaiting ?? 0,
    weeklyTarget: l.weeklyTarget ?? 5,
    weeklyDone: l.weekContactsFound ?? 0,
  };
}

export async function fetchLoops(): Promise<Loop[]> {
  if (USE_MOCKS) return MOCK_PROFILE.loops;
  const res = await apiFetch<{ loops?: RawLoop[] }>('/api/agent/loops');
  return (res.loops || []).map(mapLoop);
}

/** Create + auto-start a Loop from a natural-language brief. */
export async function createLoop(brief: string): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/agent/loops', { method: 'POST', body: { briefText: brief } });
}

/** Pause or resume a Loop (POST .../pause | .../start). */
export async function setLoopPaused(id: string, paused: boolean): Promise<void> {
  if (USE_MOCKS) return;
  const action = paused ? 'pause' : 'start';
  await apiFetch(`/api/agent/loops/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
}
