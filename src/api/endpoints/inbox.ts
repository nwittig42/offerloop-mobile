import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { relationFor } from '@/lib/relation';
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
  const title = t.title || '';
  return {
    id: String(t.id),
    jobTitle: title || t.jobTitle || '',
    company: t.company || '',
    status,
    attended,
    contact: {
      name: t.name || t.contactName || 'Contact',
      title,
      // Inferred from the title so the Inbox can badge hiring managers and
      // recruiters. Same helper the People deck uses, so the two agree.
      relation: relationFor(title),
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

/** Sort key: most recent activity first. The backend /threads (no-limit path)
 *  streams in Firestore doc-id order, NOT by recency, so a fresh draft lands
 *  wherever its id falls and gets buried. Sort here so newest is always on top. */
function recencyOf(t: Thread): number {
  const v = Date.parse(t.lastActivityAt || t.updatedAt || t.draftCreatedAt || t.createdAt || '');
  return Number.isNaN(v) ? 0 : v;
}

/** The Inbox: real threads (drafts + sent + replies) from the outbox service. */
export async function fetchInbox(): Promise<OutreachItem[]> {
  if (USE_MOCKS) return MOCK_OUTREACH_SEED;
  // fields=list → the server returns only what mapThread reads (~1/3 the
  // bytes at a few hundred contacts). Older servers ignore the param.
  const res = await apiFetch<ThreadsResponse>('/api/outbox/threads', {
    query: { fields: 'list' },
  });
  return (res.threads || [])
    .slice()
    .sort((a, b) => recencyOf(b) - recencyOf(a))
    .map(mapThread);
}
