import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_MEETING_PREPS } from '@/mocks/data';
import type { MeetingPrep } from '@/types';

/** Coffee-chat-prep docs (async job). List shape is flat; detail nests contactData. */
type RawPrep = Record<string, any>;

function normStatus(s: unknown): MeetingPrep['status'] {
  const v = String(s || '').toLowerCase();
  if (v === 'completed') return 'completed';
  if (v === 'failed') return 'failed';
  return 'processing';
}

/** From GET /all (flat list fields). Rich content (summary/points) loads on detail. */
function mapListPrep(p: RawPrep): MeetingPrep {
  return {
    id: String(p.id),
    name: p.contactName || 'Contact',
    title: p.jobTitle || '',
    company: p.company || '',
    linkedinUrl: p.linkedinUrl || undefined,
    summary: '',
    talkingPoints: [],
    createdLabel: 'Prepped',
    status: normStatus(p.status),
    pdfUrl: p.pdfUrl || undefined,
  };
}

/** From GET /{id} (full doc): conversationStrategy -> summary, questions -> talking points. */
function mapDetailPrep(id: string, p: RawPrep): MeetingPrep {
  const c = p.contactData || {};
  const name =
    `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.fullName || p.contactName || 'Contact';
  const questions: string[] = Array.isArray(p.questions)
    ? p.questions.map((q: any) => (typeof q === 'string' ? q : q?.question || q?.text || '')).filter(Boolean)
    : [];
  return {
    id,
    name,
    title: c.jobTitle || p.jobTitle || '',
    company: c.company || p.company || '',
    linkedinUrl: p.linkedinUrl || undefined,
    summary: p.conversationStrategy || '',
    talkingPoints: questions,
    createdLabel: 'Prepped',
    status: normStatus(p.status),
    pdfUrl: p.pdfUrl || undefined,
  };
}

export async function fetchMeetingPreps(): Promise<MeetingPrep[]> {
  if (USE_MOCKS) return MOCK_MEETING_PREPS;
  const res = await apiFetch<{ preps?: RawPrep[] }>('/api/coffee-chat-prep/all');
  return (res.preps || []).map(mapListPrep);
}

export async function fetchMeetingPrep(id: string): Promise<MeetingPrep> {
  if (USE_MOCKS) {
    return MOCK_MEETING_PREPS.find((p) => p.id === id) ?? MOCK_MEETING_PREPS[0];
  }
  const p = await apiFetch<RawPrep>(`/api/coffee-chat-prep/${encodeURIComponent(id)}`);
  return mapDetailPrep(id, p);
}

/** A free, read-only "who is this" lookup, so the user can confirm the right
 *  person before spending 15 credits. Reuses the same enrichment the prep runs. */
export type MeetingPrepPreview = {
  found: boolean;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  school?: string;
};

export async function previewMeetingPrep(linkedinUrl: string): Promise<MeetingPrepPreview> {
  if (USE_MOCKS) {
    return { found: true, name: 'Jordan Avery', title: 'VP, Investment Banking', company: 'Evercore', location: 'New York, NY', school: 'USC' };
  }
  const r = await apiFetch<any>('/api/mobile/meeting-prep/preview', {
    method: 'POST',
    body: { linkedinUrl },
  });
  if (!r?.found) return { found: false };
  return {
    found: true,
    name: r.name || undefined,
    title: r.title || undefined,
    company: r.company || undefined,
    location: r.location || undefined,
    school: r.school || undefined,
  };
}

/** Kick off a prep (15 credits, async). Returns the prep id to poll. */
export async function createMeetingPrep(linkedinUrl: string): Promise<string> {
  if (USE_MOCKS) return MOCK_MEETING_PREPS[0]?.id ?? 'prep-mock';
  const res = await apiFetch<RawPrep>('/api/coffee-chat-prep', {
    method: 'POST',
    body: { linkedinUrl },
  });
  return String(res.id || res.prepId);
}
