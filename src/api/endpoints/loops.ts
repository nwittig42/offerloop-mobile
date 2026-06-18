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

/** Found / Emailed / Replied funnel from real contact records. */
export type LoopStats = { found: number; emailed: number; replied: number; foundThisWeek: number };

export type LoopDetail = Loop & { stats: LoopStats };

/** One thing a Loop surfaced — a person, job, hiring manager, or company. */
export type LoopActivityItem = {
  id: string;
  type: 'contact' | 'job' | 'hm' | 'company' | 'draft';
  title: string;
  subtitle: string;
  createdAt: string;
};

export async function fetchLoop(id: string): Promise<LoopDetail> {
  const raw = await apiFetch<RawLoop>(`/api/agent/loops/${encodeURIComponent(id)}`);
  const s = raw.liveStats || {};
  return {
    ...mapLoop(raw),
    stats: {
      found: s.found ?? 0,
      emailed: s.emailed ?? 0,
      replied: s.replied ?? 0,
      foundThisWeek: s.foundThisWeek ?? 0,
    },
  };
}

export async function fetchLoopActivity(id: string): Promise<LoopActivityItem[]> {
  const res = await apiFetch<{ items?: any[] }>(
    `/api/agent/loops/${encodeURIComponent(id)}/activity`,
    { query: { limit: 50 } },
  );
  return (res.items || []).map((i) => ({
    id: String(i.id ?? Math.random()),
    type: (i.type as LoopActivityItem['type']) || 'contact',
    title: i.title || 'Untitled',
    subtitle: i.subtitle || '',
    createdAt: i.createdAt || '',
  }));
}

/** Trigger an immediate cycle (POST .../run-now). */
export async function runLoopNow(id: string): Promise<void> {
  await apiFetch(`/api/agent/loops/${encodeURIComponent(id)}/run-now`, { method: 'POST' });
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
