import { apiFetch } from '@/api/client';

/**
 * Follow-ups: who the student owes a move right now.
 *
 * Backend: GET /api/nudges. The tracker daemon scans the outbox every six
 * hours and writes one row per contact who was emailed and has not replied
 * in about a week, each with a written suggestion and often a ready draft.
 * The Gmail webhook dismisses a row the moment that person replies, so a
 * pending row is still true when we read it.
 *
 * This is the same data Scout reads through its get_followups tool. The app
 * reads it directly for the opening line so a fresh Scout sheet can name the
 * person without paying for an LLM turn first.
 */

export type Followup = {
  id: string;
  /** Empty on a pipeline prompt, which is about the whole search, not one person. */
  contactName: string;
  company: string;
  /** The written suggestion, already in Scout's voice. */
  suggestion: string;
  /** True when a follow-up body is already written, so we can offer to send. */
  draftReady: boolean;
};

type RawNudge = {
  id?: string;
  contactName?: string;
  company?: string;
  generatedMessage?: string;
  followUpDraft?: string;
  status?: string;
  type?: string;
};

/**
 * The single most urgent pending follow-up, or null.
 *
 * Only `follow_up` rows: the other kind ("stuck student" pipeline prompts) is
 * a nudge about the search in general, which the opening line has no person
 * to name for. Never throws: the opener is a nicety and must not be able to
 * break the Scout sheet.
 */
export async function fetchTopFollowup(): Promise<Followup | null> {
  try {
    const r = await apiFetch<{ nudges?: RawNudge[] }>(
      '/api/nudges?status=pending&limit=10',
      { timeoutMs: 10_000 },
    );
    const rows = (r.nudges || []).filter(
      (n) => (n.type || 'follow_up') === 'follow_up' && (n.contactName || '').trim(),
    );
    if (!rows.length) return null;
    const n = rows[0];
    return {
      id: String(n.id || ''),
      contactName: String(n.contactName || '').trim(),
      company: String(n.company || '').trim(),
      suggestion: String(n.generatedMessage || '').trim(),
      draftReady: Boolean(n.followUpDraft),
    };
  } catch {
    return null;
  }
}
