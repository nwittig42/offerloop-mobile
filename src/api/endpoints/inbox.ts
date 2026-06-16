import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_OUTREACH_SEED } from '@/mocks/data';
import type { OutreachItem, OutreachStatus } from '@/types';

/** Outbox thread shape from GET /api/outbox/threads (see outbox_service._contact_to_dict). */
type Thread = Record<string, any>;

type ThreadsResponse = { threads?: Thread[] };

const DRAFT_STAGES = new Set(['new', 'not_contacted', 'draft', 'draft_created', 'draft_deleted']);

function statusFor(t: Thread): { status: OutreachStatus; attended?: boolean } {
  const stage = String(t.pipelineStage || '');
  if (t.hasUnreadReply) return { status: 'replied', attended: false };
  if (stage === 'replied') return { status: 'replied', attended: true };
  if (DRAFT_STAGES.has(stage)) return { status: 'ready' };
  return { status: 'sent' };
}

/** Short relative label ("now", "3h", "2d") from an ISO timestamp. */
function relTime(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d` : `${Math.round(days / 7)}w`;
}

function mapThread(t: Thread): OutreachItem {
  const { status, attended } = statusFor(t);
  return {
    id: String(t.id),
    jobTitle: t.title || t.jobTitle || '',
    company: t.company || '',
    status,
    attended,
    contact: {
      name: t.name || t.contactName || 'Contact',
      title: t.title || '',
      company: t.company || '',
      linkedinUrl: t.linkedinUrl || undefined,
    },
    subject: t.emailSubject || undefined,
    snippet: t.lastMessageSnippet || undefined,
    timeLabel: relTime(t.lastActivityAt || t.updatedAt) || 'recently',
    // gmailDraftUrl is carried through so the detail screen can open the draft
    // in Gmail for the cold-open send (no in-app send-draft endpoint).
    gmailDraftUrl: t.gmailDraftUrl || undefined,
  };
}

/** The Inbox: real threads (drafts + sent + replies) from the outbox service. */
export async function fetchInbox(): Promise<OutreachItem[]> {
  if (USE_MOCKS) return MOCK_OUTREACH_SEED;
  const res = await apiFetch<ThreadsResponse>('/api/outbox/threads');
  return (res.threads || []).map(mapThread);
}
