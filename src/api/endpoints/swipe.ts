import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { ApiError } from '@/api/errors';
import type { ContactRelation, OutreachItem } from '@/types';

/**
 * The swipe finds real people at the company, drafts (or sends) tailored
 * outreach, and saves the contact server-side. Two targeting modes:
 *
 *  - 'employee' (DEFAULT): one /api/prompt-search pass on the role at the
 *    company. Teammates/alumni vastly outnumber recruiters in the index, so
 *    this lands far more often and is the cheapest path. Warmth scoring floats
 *    alumni/shared-school people to the top, so it's "best-matched teammate,"
 *    not random. A no-title fallback pass makes an empty swipe rare.
 *
 *  - 'hiring_manager': the intent upgrade. Routes targeting through the
 *    production /api/job-board/find-hiring-manager (recruiter_finder's curated
 *    titles + tier scoring + verification), then fills any remainder from the
 *    team via prompt-search. Always drafts (that endpoint doesn't send) so cold
 *    outreach to decision-makers is reviewed first.
 *
 * Both charge 5 credits per contact. Relation is derived from each contact's
 * real title (no fabricated "Hiring manager" label).
 */
type RawContact = Record<string, any>;

type PromptSearchResponse = {
  contacts?: RawContact[];
  credits_remaining?: number;
  mode?: string;
};

type HiringManagerResponse = {
  hiringManagers?: RawContact[];
  emails?: { to_email?: string; subject?: string; plain_body?: string; body?: string }[];
  creditsRemaining?: number;
};

export type SwipeResult = {
  items: OutreachItem[];
  creditsRemaining?: number;
};

type SwipeArgs = {
  company: string;
  jobTitle: string;
  count: number;
  action: 'draft' | 'send';
  priority: 'employee' | 'mix' | 'hiring_manager';
  jobDescription?: string;
  /** Per-GESTURE idempotency key. The server records the outcome under this id,
   *  so a retry of the same gesture (tap-to-retry, timeout ambiguity) replays
   *  the recorded result instead of re-running the pipeline — no duplicate
   *  Gmail drafts, no double credit charge. Persisted across retries by the
   *  store (failedDraftArgs). */
  swipeId?: string;
};

let mockSeq = 0;

/** Draft calls run a 25–60s server pipeline; the staging gunicorn allows up to
 *  300s. If nothing came back in 150s the request is effectively lost — abort
 *  so the Inbox row can fail-with-retry instead of spinning forever. (Legacy
 *  synchronous path only — the job path polls with short requests instead.) */
const DRAFT_TIMEOUT_MS = 150_000;

// ---------------------------------------------------------------------------
// Server-side draft jobs (PLAN-instant-feel.md Phase 2). POST hands the swipe
// to the server and returns a job id in <1s; the pipeline runs server-side
// (survives app close, bounded concurrency), and we poll the job doc for REAL
// stage progress — including the found person's name — until it completes.
// ---------------------------------------------------------------------------

export type DraftJobProgress = {
  status: string;
  stage: string;
  stageLabel: string;
  progressPct: number;
  foundContacts?: { name: string; title: string; company: string }[];
};

type DraftJobState = DraftJobProgress & {
  jobId: string;
  result?: PromptSearchResponse & { error?: string };
  statusCode?: number;
  error?: string;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const JOB_POLL_MS = 2500;
const JOB_DEADLINE_MS = 6 * 60_000;

/** Poll an EXISTING draft job to a terminal state (Scout action cards +
 *  re-hydration after an app kill). Throws ApiError on failure/timeout. */
export async function pollDraftJob(
  jobId: string,
  onProgress?: (p: DraftJobProgress) => void,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  let state = await apiFetch<DraftJobState>(`/api/mobile/draft-jobs/${jobId}`, {
    timeoutMs: 20_000,
  });
  onProgress?.(state);
  const deadline = Date.now() + JOB_DEADLINE_MS;
  while (state.status === 'queued' || state.status === 'running') {
    if (Date.now() > deadline) throw new ApiError(408, 'Draft timed out', null);
    await sleep(JOB_POLL_MS);
    state = await apiFetch<DraftJobState>(`/api/mobile/draft-jobs/${jobId}`, {
      timeoutMs: 20_000,
    });
    onProgress?.(state);
  }
  if (state.status === 'failed') throw new ApiError(500, state.error || 'Draft failed', state);
  const code = state.statusCode ?? 200;
  const result = state.result ?? {};
  if (code >= 400) {
    throw new ApiError(code, (result as { error?: string }).error || 'Draft failed', result);
  }
  return { contacts: result.contacts || [], creditsRemaining: result.credits_remaining };
}

/** Create (or re-attach to — job id doubles as the idempotency key) a draft
 *  job and poll it to a terminal state. Throws ApiError on failure/timeout. */
async function runJobToCompletion(
  body: Record<string, unknown>,
  onProgress?: (p: DraftJobProgress) => void,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const created = await apiFetch<DraftJobState>('/api/mobile/draft-jobs', {
    method: 'POST',
    body,
    timeoutMs: 20_000,
  });
  let state = created;
  const deadline = Date.now() + JOB_DEADLINE_MS;
  while (state.status === 'queued' || state.status === 'running') {
    if (Date.now() > deadline) throw new ApiError(408, 'Draft timed out', null);
    await sleep(JOB_POLL_MS);
    state = await apiFetch<DraftJobState>(`/api/mobile/draft-jobs/${created.jobId}`, {
      timeoutMs: 20_000,
    });
    onProgress?.(state);
  }
  if (state.status === 'failed') {
    throw new ApiError(500, state.error || 'Draft failed', state);
  }
  const code = state.statusCode ?? 200;
  const result = state.result ?? {};
  if (code >= 400) {
    throw new ApiError(code, (result as { error?: string }).error || 'Draft failed', result);
  }
  return { contacts: result.contacts || [], creditsRemaining: result.credits_remaining };
}

function contactName(c: RawContact): string {
  const full = `${c.FirstName || c.firstName || ''} ${c.LastName || c.lastName || ''}`.trim();
  return full || c.Name || c.name || 'New contact';
}

/** Classify a contact by their ACTUAL title — honest, not by list position.
 *  Recruiters/TA → Recruiter; managers/leads/heads → Hiring manager; else
 *  Employee. */
function relationFor(title: string): ContactRelation {
  const t = (title || '').toLowerCase();
  if (/recruit|talent|sourcer|\bhr\b|human resources|people ops|people operations/.test(t)) {
    return 'Recruiter';
  }
  if (/manager|lead\b|head of|director|\bvp\b|vice president|chief|founder|president|owner/.test(t)) {
    return 'Hiring manager';
  }
  return 'Employee';
}

function dedupeKey(c: RawContact): string {
  return (
    (c.Email || c.email || '').toLowerCase() ||
    String(c.pdlId || c.id || '') ||
    `${contactName(c)}|${(c.Company || c.company || '').toLowerCase()}`
  );
}

async function promptSearch(
  prompt: string,
  batchSize: number,
  mode: string,
  swipeId?: string,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const res = await apiFetch<PromptSearchResponse>('/api/prompt-search', {
    method: 'POST',
    // notify_draft_ready stays OFF for manual swipes: the user is in-app
    // watching the Inbox fill, so a "draft ready" bell item + push per contact
    // is just noise. The bell is reserved for async/away events (Loops, replies).
    body: { prompt, batchSize, mode, notify_draft_ready: false, swipe_id: swipeId },
    timeoutMs: DRAFT_TIMEOUT_MS,
  });
  return { contacts: res.contacts || [], creditsRemaining: res.credits_remaining };
}

function mapContact(
  c: RawContact,
  idx: number,
  args: SwipeArgs,
): OutreachItem {
  const title = c.Title || c.JobTitle || c.title || '';
  const relation: ContactRelation = relationFor(title);
  // Trust what ACTUALLY happened, not the requested action: a swipe-to-send
  // can be downgraded to a draft by the server's quality gate or the daily
  // send cap (contact then carries gmailDraftId, no emailSent). Showing
  // "Sent" for a draft was a real field-test bug.
  const sent = c.emailSent === true;
  const subject = c.emailSubject || c.email_subject || `Reaching out about ${args.jobTitle}`;
  const body = c.emailBody || c.email_body || '';
  return {
    id: String(c.pdlId || c.id || `out-${Date.now()}-${idx}`),
    jobTitle: args.jobTitle,
    company: args.company,
    status: sent ? 'sent' : 'ready',
    contact: {
      name: contactName(c),
      title: c.Title || c.JobTitle || c.title || '',
      company: c.Company || c.company || args.company,
      relation,
      linkedinUrl: c.LinkedIn || c.linkedinUrl || undefined,
    },
    subject,
    body,
    snippet: sent
      ? 'Sent from your connected Gmail'
      : args.action === 'send' && (c._sendBlockedByQuality || c._sendBlockedByDailyCap)
        ? 'Held as a draft — review before sending'
        : 'Draft is ready for your review',
    timeLabel: 'Just now',
  };
}

/** HM mode: reuse the production hiring-manager endpoint (recruiter_finder's
 *  curated targeting + verification + draft + charge + save), then attach the
 *  generated email text onto each manager so mapContact can render it. */
async function findHiringManagers(
  args: SwipeArgs,
  count: number,
): Promise<{ contacts: RawContact[]; creditsRemaining?: number }> {
  const res = await apiFetch<HiringManagerResponse>('/api/job-board/find-hiring-manager', {
    method: 'POST',
    body: {
      company: args.company,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription || '',
      maxResults: count,
      generateEmails: true,
      createDrafts: true,
    },
    timeoutMs: DRAFT_TIMEOUT_MS,
  });
  const byEmail = new Map<string, { subject?: string; plain_body?: string }>();
  for (const e of res.emails || []) {
    const k = (e.to_email || '').toLowerCase();
    if (k) byEmail.set(k, e);
  }
  const contacts = (res.hiringManagers || []).map((m) => {
    const k = (m.Email || m.email || m.WorkEmail || '').toLowerCase();
    const e = byEmail.get(k);
    return { ...m, emailSubject: e?.subject, emailBody: e?.plain_body };
  });
  return { contacts, creditsRemaining: res.creditsRemaining };
}

export async function runSwipe(
  args: SwipeArgs,
  onProgress?: (p: DraftJobProgress) => void,
): Promise<SwipeResult> {
  if (USE_MOCKS) {
    mockSeq += 1;
    const items: OutreachItem[] = Array.from({ length: args.count }, (_, i) =>
      mapContact(
        { FirstName: 'Sample', LastName: `Contact ${mockSeq}.${i}`, Title: 'Recruiter' },
        i,
        args,
      ),
    );
    return { items };
  }

  const mode = args.action === 'send' ? 'send' : 'draft';

  // Any hiring-manager targeting: 'mix' gets ONE verified HM then fills the rest
  // with teammates; 'hiring_manager' targets up to `count` HMs, teammates only to
  // fill. Both always draft (the HM endpoint never sends). Still the legacy
  // synchronous path — the job pipeline only covers /api/prompt-search.
  if (args.priority === 'mix' || args.priority === 'hiring_manager') {
    const hmTarget = args.priority === 'mix' ? 1 : args.count;
    const hm = await findHiringManagers(args, hmTarget);
    const contacts = hm.contacts;
    let creditsRemaining = hm.creditsRemaining;

    if (contacts.length < args.count) {
      const need = args.count - contacts.length;
      const seen = new Set(contacts.map(dedupeKey));
      // HM endpoint always drafts, so fill from the team as drafts too.
      const fallback = await promptSearch(
        `${args.jobTitle} at ${args.company}`,
        need,
        'draft',
        args.swipeId ? `${args.swipeId}-f` : undefined,
      );
      for (const c of fallback.contacts) {
        const key = dedupeKey(c);
        if (key && seen.has(key)) continue;
        seen.add(key);
        contacts.push(c);
      }
      if (typeof fallback.creditsRemaining === 'number') creditsRemaining = fallback.creditsRemaining;
    }

    const items = contacts.slice(0, args.count).map((c, i) => mapContact(c, i, args));
    return { items, creditsRemaining };
  }

  // Employee mode (default): server-side draft JOB. The server answers in
  // <1s and cooks in the background — the draft survives the app closing,
  // bursts queue server-side, and we poll for real stage progress. The
  // primary and fallback passes get DISTINCT job ids (-p / -f): sharing one
  // would make the fallback re-attach to the primary's empty result.
  // notify_draft_ready is ON here (unlike the legacy path): the job can
  // finish while the user is away, and the push both notifies them and
  // triggers the app's instant inbox refresh.
  try {
    const baseBody = { batchSize: args.count, mode, notify_draft_ready: true };
    const primary = await runJobToCompletion(
      {
        ...baseBody,
        prompt: `${args.jobTitle} at ${args.company}`,
        swipe_id: args.swipeId ? `${args.swipeId}-p` : undefined,
      },
      onProgress,
    );
    let contacts = primary.contacts;
    let creditsRemaining = primary.creditsRemaining;

    // Miss-proofing: if the titled search found nobody (title too specific,
    // small co), one no-title pass so a swipe almost never comes back empty.
    if (contacts.length === 0) {
      const fallback = await runJobToCompletion(
        {
          ...baseBody,
          prompt: `people at ${args.company}`,
          swipe_id: args.swipeId ? `${args.swipeId}-f` : undefined,
        },
        onProgress,
      );
      contacts = fallback.contacts;
      if (typeof fallback.creditsRemaining === 'number') creditsRemaining = fallback.creditsRemaining;
    }

    const items = contacts.slice(0, args.count).map((c, i) => mapContact(c, i, args));
    return { items, creditsRemaining };
  } catch (e) {
    // A server without /draft-jobs yet (OTA reached the phone before the
    // backend deploy) → fall back to the legacy synchronous request.
    if ((e as { status?: number })?.status === 404) {
      return runSwipeLegacySync(args, mode);
    }
    throw e;
  }
}

/** The pre-job synchronous employee path. Kept as a version-skew fallback. */
async function runSwipeLegacySync(args: SwipeArgs, mode: string): Promise<SwipeResult> {
  const primary = await promptSearch(
    `${args.jobTitle} at ${args.company}`,
    args.count,
    mode,
    args.swipeId ? `${args.swipeId}-p` : undefined,
  );
  let contacts = primary.contacts;
  let creditsRemaining = primary.creditsRemaining;

  if (contacts.length === 0) {
    const fallback = await promptSearch(
      `people at ${args.company}`,
      args.count,
      mode,
      args.swipeId ? `${args.swipeId}-f` : undefined,
    );
    contacts = fallback.contacts;
    if (typeof fallback.creditsRemaining === 'number') creditsRemaining = fallback.creditsRemaining;
  }

  const items = contacts.slice(0, args.count).map((c, i) => mapContact(c, i, args));
  return { items, creditsRemaining };
}
