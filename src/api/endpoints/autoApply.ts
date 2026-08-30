import { apiFetch } from '@/api/client';
import { ApiError } from '@/api/errors';

/**
 * Auto-apply client — mirrors the web `/api/job-board/auto-apply/*` contract
 * (cofounder's commit e95b683). The backend drives a real headless browser
 * (Browserbase) to fill + submit Greenhouse / Lever / Ashby applications, so
 * every endpoint here is Pro/Elite-gated and a submit is irreversible. The app
 * uses a review-first flow (prepare → show the filled answers → submit), the
 * higher-quality model Simplify/Jobright use, not a silent spray.
 */

// ── Application profile (one-time prerequisite) ───────────────────────────

export type WorkAuthorization = {
  authorizedToWorkUS: boolean | null;
  requiresSponsorship: boolean | null;
  visaStatus?: string | null;
};

export type ApplicationProfile = {
  contactInfo?: { phone?: string | null; linkedinUrl?: string | null };
  workAuthorization?: WorkAuthorization;
  preferences?: {
    openToRelocation?: boolean | null;
    openToRemote?: boolean | null;
    earliestStartDate?: string | null;
    expectedSalaryUsd?: number | null;
  };
  demographics?: { gender?: string | null; race?: string | null };
  veteranStatus?: string | null;
  disabilityStatus?: string | null;
  acknowledgedAt?: string | null;
};

export async function getApplicationProfile(): Promise<ApplicationProfile> {
  // Backend wraps it: { profile, acknowledged, work_auth_complete }.
  const r = await apiFetch<any>('/api/users/application-profile');
  return (r?.profile ?? r ?? {}) as ApplicationProfile;
}

/** POST merges into the stored profile and stamps acknowledgedAt server-side,
 *  so saving = acknowledging. The backend expects the profile NESTED under a
 *  `profile` key (and returns it the same way), so wrap/unwrap here. */
export async function saveApplicationProfile(
  patch: ApplicationProfile,
): Promise<ApplicationProfile> {
  const r = await apiFetch<any>('/api/users/application-profile', {
    method: 'POST',
    body: { profile: patch },
  });
  return (r?.profile ?? r ?? {}) as ApplicationProfile;
}

export function isProfileReady(p: ApplicationProfile | null | undefined): boolean {
  return !!(p?.acknowledgedAt && p?.workAuthorization?.authorizedToWorkUS != null);
}

// ── Prepare (eligibility + filled-answer preview) ─────────────────────────

export type AutoApplyPreview = {
  fields: Record<string, string>;
  structured_answers: Record<string, unknown>;
  open_ended_answers: Record<string, string>;
  resume: { has_resume: boolean; filename: string };
  unmapped_fields: string[];
};

export type PrepareOk = {
  status: 'ok';
  jobId: string;
  atsPlatform: string;
  preview: AutoApplyPreview;
  previewComplete: boolean;
  job: { title?: string; company?: string; apply_url?: string };
};

/** Why a prepare couldn't proceed — the caller branches on this:
 *  - profile_required / work_auth_required → route to the Application Profile
 *  - ineligible → this job isn't a Greenhouse/Lever/Ashby form (skip the apply)
 *  - not_configured → Browserbase/Browserless env not set on the backend
 *  - error → anything else (show the message) */
export type PrepareBlocked = {
  status: 'profile_required' | 'work_auth_required' | 'ineligible' | 'not_configured' | 'error';
  message: string;
};

export type PrepareResult = PrepareOk | PrepareBlocked;

export async function prepareAutoApply(jobId: string): Promise<PrepareResult> {
  try {
    const r = await apiFetch<any>('/api/job-board/auto-apply/prepare', {
      method: 'POST',
      body: { job_id: jobId },
    });
    return {
      status: 'ok',
      jobId: String(r.job_id),
      atsPlatform: r.ats_platform,
      preview: r.preview,
      previewComplete: !!r.preview_complete,
      job: r.job || {},
    };
  } catch (e) {
    if (e instanceof ApiError) {
      const code = (e.body?.code as string) || '';
      if (code === 'PROFILE_REQUIRED') return { status: 'profile_required', message: e.message };
      if (code === 'WORK_AUTH_REQUIRED') return { status: 'work_auth_required', message: e.message };
      if (code === 'INELIGIBLE') return { status: 'ineligible', message: e.message };
      if (code === 'BROWSERLESS_NOT_CONFIGURED') return { status: 'not_configured', message: e.message };
      return { status: 'error', message: e.message };
    }
    return { status: 'error', message: 'Could not prepare the application.' };
  }
}

// ── Submit + poll ─────────────────────────────────────────────────────────

export type SubmitResult = { autoApplyId: string; status: string };

/** Real submit (dry_run=false) is irreversible. dry_run=true fills + screenshots
 *  but does NOT click Submit — used to verify the form before the real run. */
export async function submitAutoApply(
  jobId: string,
  opts: { dryRun?: boolean; editedAnswers?: { why_role?: string; why_company?: string } } = {},
): Promise<SubmitResult> {
  const r = await apiFetch<any>(`/api/job-board/auto-apply/${encodeURIComponent(jobId)}/submit`, {
    method: 'POST',
    body: { dry_run: opts.dryRun ?? false, edited_answers: opts.editedAnswers || {} },
  });
  return { autoApplyId: String(r.auto_apply_id), status: r.status || 'queued' };
}

/** Fire-and-forget submit for the swipe flow — no blocking review. Returns a
 *  discriminated result so the caller can react (profile gate, no credits, etc.)
 *  without try/catch. The backend checks eligibility + profile BEFORE charging,
 *  so a gate failure here never costs credits. */
export async function startAutoApply(
  jobId: string,
): Promise<{ ok: true; autoApplyId: string } | { ok: false; code: string; message: string }> {
  try {
    const r = await submitAutoApply(jobId, { dryRun: false });
    return { ok: true, autoApplyId: r.autoApplyId };
  } catch (e) {
    if (e instanceof ApiError) {
      return { ok: false, code: (e.body?.code as string) || 'ERROR', message: e.message };
    }
    return { ok: false, code: 'ERROR', message: 'Could not start the application.' };
  }
}

/** Terminal + paused states the status doc reports. */
export type AutoApplyStatus =
  | 'queued'
  | 'running'
  | 'submitted'
  | 'failed'
  | 'submit_failed'
  | 'needs_attention'   // a required field the resolver couldn't answer
  | 'needs_verification'; // ATS emailed a code; resolve via the verification flow

/** A required field the filler couldn't answer — surfaced in the app so the
 *  user can fill it, after which the backend resumes the submission. */
export type PendingQuestion = {
  field_id?: string;
  question_id?: string;
  label: string;
  /** The employer's own help text for this question. A label like "Additional
   *  Information" is unanswerable alone — all the meaning lives in the paragraph
   *  the form renders under it, which we used to throw away before asking. */
  description?: string;
  field_type?: string; // 'text' | 'textarea' | 'select'
  options?: Array<string | { label?: string; value?: string }>;
  required?: boolean;
};

/** Stable id for a pending question across the field_id / question_id shapes. */
export function questionId(q: PendingQuestion): string {
  return String(q.field_id ?? q.question_id ?? '');
}

/** Normalize an option to a display string. */
export function optionLabel(o: string | { label?: string; value?: string }): string {
  return typeof o === 'string' ? o : o.label ?? o.value ?? '';
}

export type AutoApplyStatusDoc = {
  status: AutoApplyStatus;
  stage?: string;
  error?: string;
  screenshot?: string;
  job_title?: string;
  company?: string;
  /** The listing URL — lets the Needs-input screen route a question we couldn't
   *  fully capture (a custom multi-select) to the real form to finish. */
  apply_url?: string;
  pending_questions?: PendingQuestion[];
  [k: string]: unknown;
};

/** Answer the pending questions on a needs_attention application. The backend
 *  saves each to the answer library (so the same question auto-fills next time),
 *  and once all REQUIRED ones are answered it resumes the submission in the
 *  background — no navigating back to the form, no starting over. */
export async function resolveAutoApply(
  autoApplyId: string,
  answers: Record<string, string>,
): Promise<{ status: string; pendingQuestions: PendingQuestion[] }> {
  const r = await apiFetch<any>(
    `/api/job-board/auto-apply/${encodeURIComponent(autoApplyId)}/resolve`,
    { method: 'POST', body: { answers } },
  );
  return { status: r.status, pendingQuestions: r.pending_questions || [] };
}

export async function fetchAutoApplyStatus(autoApplyId: string): Promise<AutoApplyStatusDoc> {
  return apiFetch<AutoApplyStatusDoc>(
    `/api/job-board/auto-apply/${encodeURIComponent(autoApplyId)}/status`,
  );
}

export const AUTO_APPLY_TERMINAL: AutoApplyStatus[] = [
  'submitted',
  'failed',
  'submit_failed',
  'needs_attention',
  'needs_verification',
];

// ── Applied-jobs list (the "Applied" tab) ─────────────────────────────────

export type AppliedJob = {
  auto_apply_id: string;
  job_id: string;
  job_title: string;
  company: string;
  ats_platform?: string;
  apply_url?: string;
  status: AutoApplyStatus;
  stage?: string;
  /** Why it didn't go through, in plain language. Returned by the list
   *  endpoint; shown on the tile so "Apply on the site" isn't unexplained. */
  failure_reason?: string;
  dry_run?: boolean;
  created_at?: string;
  updated_at?: string;
  inspect_completed_at?: string;
  completed_at?: string;
  pending_questions?: PendingQuestion[];
};

/** The backend stamps `updated_at` on every state change, so it's the best
 *  signal for "most recent activity" (newer than created_at). Fall back through
 *  the other timestamps. */
export function lastActivityAt(j: AppliedJob): string | undefined {
  return j.updated_at || j.inspect_completed_at || j.completed_at || j.created_at;
}

/** Parse a backend timestamp as UTC. The backend writes naive ISO
 *  (`datetime.utcnow().isoformat()`, no 'Z'); JS would treat a tz-less string as
 *  LOCAL time and be off by the device's offset, so append 'Z' when absent. */
function parseServerTs(iso?: string): number {
  if (!iso) return NaN;
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  return Date.parse(hasTz ? iso : iso + 'Z');
}

/** Short, seconds-precise "just now / 30s ago / 5m ago / 3h ago / 2d ago" for an
 *  application's last activity — fine-grained so a just-submitted app is visibly
 *  fresher than one from a minute ago. */
export function appliedRelativeTime(j: AppliedJob): string {
  const t = parseServerTs(lastActivityAt(j));
  if (Number.isNaN(t)) return '';
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days}d ago` : `${Math.round(days / 7)}w ago`;
}

/** Every auto-apply this user has run, most-recently-active first. Dry-runs are
 *  filtered out here — they're previews, not real applications, so they don't
 *  belong in a "jobs I applied to" view. */
export async function listAppliedJobs(): Promise<AppliedJob[]> {
  // timeoutMs is required — fetch has no default timeout on iOS release builds,
  // so a slow/hanging endpoint would leave the Applications tab spinning
  // "Loading your applications…" forever instead of settling to an error state.
  const r = await apiFetch<{ items?: AppliedJob[] }>('/api/job-board/auto-apply/list', {
    timeoutMs: 15000,
  });
  const sorted = (r.items || [])
    .filter((j) => !j.dry_run)
    .sort((a, b) => parseServerTs(lastActivityAt(b)) - parseServerTs(lastActivityAt(a)));
  // Collapse duplicate applications to the same job (keep the most recent) — a
  // safety net so accidental double-applies don't show as separate rows.
  const seen = new Set<string>();
  const deduped: AppliedJob[] = [];
  for (const j of sorted) {
    const key = j.job_id || j.auto_apply_id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(j);
  }
  return deduped;
}

/** Has this user already applied to (or is mid-applying to) this job? Reads the
 *  applied-jobs cache; used to block duplicate applications before we fire one.
 *  Failed/submit_failed don't count — those can be retried. */
export function alreadyApplied(applied: AppliedJob[] | undefined, jobId: string): boolean {
  return (applied ?? []).some(
    (a) => a.job_id === jobId && a.status !== 'failed' && a.status !== 'submit_failed',
  );
}

/** Human-facing label + tone for an application status.
 *  `stage` distinguishes the two halves of a still-running job: while the bot
 *  is typing it's "Auto-applying…", but once it clicks Submit the backend hops
 *  the stage to `awaiting_verification` and everything after is just waiting on
 *  Greenhouse / the emailed code. Surface that as its own "waiting" card so a
 *  filled-but-not-yet-confirmed job doesn't look stuck mid-fill. */
export function appliedStatusMeta(
  s: AutoApplyStatus,
  stage?: string,
  opts?: { canOpenSite?: boolean },
): {
  label: string;
  // 'apply' = "Apply on the site" — a distinct light-purple tone so it doesn't
  // read the same as the amber "Needs your input"; they're different asks.
  tone: 'positive' | 'waiting' | 'negative' | 'neutral' | 'apply';
} {
  switch (s) {
    case 'submitted':
      return { label: 'Applied', tone: 'positive' };
    case 'needs_verification':
      return { label: 'Waiting on an email code', tone: 'waiting' };
    case 'needs_attention':
      return { label: 'Needs your input', tone: 'waiting' };
    case 'failed':
    case 'submit_failed':
      // Not every role can be auto-applied end to end — a form field won't
      // commit, the ATS isn't one we drive, the posting moved. That's not a
      // dead end for the user: if we have the listing URL, frame it as the
      // next action ("apply on the company site") rather than a scary
      // "Failed." Only when there's genuinely nowhere to send them do we say
      // it couldn't be done.
      return opts?.canOpenSite
        ? { label: 'Apply on the site', tone: 'apply' }
        : { label: "Couldn't apply", tone: 'negative' };
    default:
      // queued / running. If input's done and we're on the code/submit gate,
      // say so instead of the generic "Auto-applying…".
      if (stage === 'awaiting_verification') {
        return { label: 'Filled — finishing up…', tone: 'waiting' };
      }
      return { label: 'Auto-applying…', tone: 'neutral' };
  }
}

/**
 * Applications stopped on something only the student can answer.
 *
 * The single definition of "needs you": the Applications screen pins this
 * group to the top, and the badge on the Network tab counts it. One function
 * so the badge can never disagree with the list it points at.
 */
export function needsUserCount(jobs: AppliedJob[] | undefined): number {
  if (!jobs?.length) return 0;
  // Only real homework counts: questions the student must answer. A pending
  // email code renders as its own calm amber card, not a red badge, because
  // it often resolves on its own and alarming red taught users to distrust
  // the badge (Rylan 2026-08-30).
  return jobs.filter((j) => j.status === 'needs_attention').length;
}

export type SavedAnswer = {
  question_id: string;
  question_text_original: string;
  answer: string | number | boolean;
  usage_count?: number;
};

/** The custom-question answers auto-apply has learned and reuses. Empty on
 *  error: the transparency section simply doesn't render rather than
 *  breaking the page it rides on. */
export async function listSavedAnswers(): Promise<SavedAnswer[]> {
  try {
    const res = await apiFetch<{ answers?: SavedAnswer[] }>('/api/users/application-answers', {
      timeoutMs: 8000,
    });
    return Array.isArray(res?.answers) ? res.answers : [];
  } catch {
    return [];
  }
}
