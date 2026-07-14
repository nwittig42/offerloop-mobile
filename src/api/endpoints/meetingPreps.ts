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

/** Coerce a research section (list of strings or objects) into clean strings. */
function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x?.text || x?.title || x?.headline || x?.summary || ''))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** From GET /{id} (full doc). Backend fields: similaritySummary, coffeeQuestions,
 *  conversationStrategy, companyCheatSheet, research{company_news/overview/...}. */
function mapDetailPrep(id: string, p: RawPrep): MeetingPrep {
  const c = p.contactData || {};
  const name =
    `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.fullName || p.contactName || 'Contact';
  const questions = strList(p.coffeeQuestions ?? p.questions);
  const r = p.research || {};
  return {
    id,
    name,
    title: c.jobTitle || p.jobTitle || '',
    company: c.company || p.company || '',
    linkedinUrl: p.linkedinUrl || undefined,
    summary: p.similaritySummary || p.conversationStrategy || '',
    talkingPoints: questions,
    commonGround: p.similaritySummary || '',
    conversationStrategy: p.conversationStrategy || '',
    companyCheatSheet: p.companyCheatSheet || '',
    research: {
      companyNews: strList(r.company_news),
      companyOverview: strList(r.company_overview),
      personMentions: strList(r.person_mentions),
      industryTrends: strList(r.industry_trends),
    },
    createdLabel: 'Prepped',
    status: normStatus(p.status),
    // The backend streams each section into the doc as it lands, so a prep in
    // flight already has real content to show. Carry the progress through so the
    // screen can reveal what's ready instead of hiding it behind a spinner.
    progressPct: typeof p.progressPct === 'number' ? p.progressPct : undefined,
    stageLabel: p.stageLabel || undefined,
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
