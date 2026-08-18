import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { titleCase } from '@/lib/text';

/**
 * Saved contacts: everyone in the student's network, written to or not.
 *
 * Backend: GET /api/contacts (cursor-paginated, 100 max per page). This is the
 * same collection the website's My Network reads, so a person saved from the
 * feed, revealed from the People deck, or found by Scout all land here.
 *
 * The Network tab used to build its people list from the outbox instead, which
 * meant somebody only existed once they had been emailed: a student who saved
 * twenty people and wrote to three saw three, and the seventeen they still owed
 * an email were invisible. Reading the contacts collection is what makes "not
 * contacted yet" a visible state instead of an absence.
 */

/** Where a person stands with the student. Drives the one marker on the row. */
export type ContactState = 'replied' | 'waiting' | 'drafted' | 'new';

export type Contact = {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  linkedinUrl: string;
  state: ContactState;
  /** ISO string of the last thing that happened, for sorting. Empty if never. */
  lastActivity: string;
};

type RawContact = Record<string, any>;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Firestore timestamps arrive as ISO strings, {_seconds}, or {seconds}
 * depending on which writer produced them. Anything unparseable sorts last
 * rather than throwing off the whole list.
 */
function isoOf(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') {
    const secs = (v as any)._seconds ?? (v as any).seconds;
    if (typeof secs === 'number') return new Date(secs * 1000).toISOString();
  }
  return '';
}

/**
 * The pipeline stage the rest of the product writes, collapsed to the four
 * states a row can show. Unknown stages fall to 'new' rather than inventing a
 * status: claiming someone was emailed when we are not sure is the one wrong
 * answer here.
 */
function stateOf(raw: RawContact): ContactState {
  const stage = str(raw.pipelineStage || raw.stage).toLowerCase();
  if (stage === 'replied' || stage === 'responded' || raw.hasReplied === true) return 'replied';
  if (stage === 'email_sent' || stage === 'waiting_on_reply' || stage === 'sent') return 'waiting';
  if (stage === 'draft_created' || stage === 'drafted') return 'drafted';
  if (isoOf(raw.emailSentAt)) return 'waiting';
  return 'new';
}

function normalize(raw: RawContact): Contact | null {
  const first = str(raw.firstName || raw.FirstName);
  const last = str(raw.lastName || raw.LastName);
  const name = str(raw.name) || [first, last].filter(Boolean).join(' ');
  const id = str(raw.id);
  // A row with no id cannot be opened and a row with no name cannot be read.
  if (!id || !name) return null;
  // PDL stores these lowercase and the contact docs keep it that way, so the
  // list was reading "sara wittig, abbott". Cased once here on the way in.
  return {
    id,
    name: titleCase(name) ?? name,
    title: titleCase(str(raw.jobTitle || raw.title || raw.Title)) ?? '',
    company: titleCase(str(raw.company || raw.Company)) ?? '',
    email: str(raw.email || raw.draftToEmail || raw.workEmail),
    linkedinUrl: str(raw.linkedinUrl || raw.linkedin || raw.LinkedIn),
    state: stateOf(raw),
    lastActivity: isoOf(raw.lastActivityAt) || isoOf(raw.emailSentAt) || isoOf(raw.createdAt),
  };
}

/** Pages to walk before giving up. 100 per page, so 10 pages is 1,000 people,
 *  far past any real student. The cap exists so a pagination bug cannot spin
 *  the request loop forever. */
const MAX_PAGES = 10;
const PER_PAGE = 100;

/**
 * Every saved contact, newest activity first.
 *
 * Walks the cursor to the end because the list groups by company: showing the
 * first 100 would silently drop companies off the bottom, and a network tab
 * that hides people is worse than one that takes an extra second. A page that
 * fails mid-walk returns what was collected so far rather than nothing.
 */
export async function fetchContacts(signal?: AbortSignal): Promise<Contact[]> {
  if (USE_MOCKS) return [];
  const out: Contact[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const q = new URLSearchParams({ per_page: String(PER_PAGE) });
    if (cursor) q.set('cursor', cursor);
    let res: { contacts?: RawContact[]; pagination?: { next_cursor?: string | null } };
    try {
      res = await apiFetch(`/api/contacts?${q.toString()}`, { signal, timeoutMs: 20_000 });
    } catch (err) {
      // Partial data beats an error screen: the student still sees the people
      // we did get. A first-page failure returns [] and the caller shows its
      // own empty state.
      if (out.length === 0) throw err;
      break;
    }
    for (const raw of res.contacts || []) {
      const c = normalize(raw);
      if (c) out.push(c);
    }
    const next = res.pagination?.next_cursor;
    if (!next) break;
    cursor = next;
  }

  out.sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
  return out;
}
