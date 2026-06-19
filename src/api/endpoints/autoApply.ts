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
  acknowledgedAt?: string | null;
};

export async function getApplicationProfile(): Promise<ApplicationProfile> {
  return apiFetch<ApplicationProfile>('/api/users/application-profile');
}

/** POST merges into the stored profile and stamps acknowledgedAt server-side,
 *  so saving = acknowledging. Returns the saved profile. */
export async function saveApplicationProfile(
  patch: ApplicationProfile,
): Promise<ApplicationProfile> {
  return apiFetch<ApplicationProfile>('/api/users/application-profile', {
    method: 'POST',
    body: patch,
  });
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

/** Terminal + paused states the status doc reports. */
export type AutoApplyStatus =
  | 'queued'
  | 'running'
  | 'submitted'
  | 'failed'
  | 'submit_failed'
  | 'needs_attention'   // a required field the resolver couldn't answer
  | 'needs_verification'; // ATS emailed a code; resolve via the verification flow

export type AutoApplyStatusDoc = {
  status: AutoApplyStatus;
  stage?: string;
  error?: string;
  screenshot?: string;
  [k: string]: unknown;
};

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
  dry_run?: boolean;
  created_at?: string;
};

/** Every auto-apply this user has run, newest first. Dry-runs are filtered out
 *  here — they're previews, not real applications, so they don't belong in a
 *  "jobs I applied to" view. */
export async function listAppliedJobs(): Promise<AppliedJob[]> {
  const r = await apiFetch<{ items?: AppliedJob[] }>('/api/job-board/auto-apply/list');
  return (r.items || []).filter((j) => !j.dry_run);
}

/** Human-facing label + tone for an application status. */
export function appliedStatusMeta(s: AutoApplyStatus): {
  label: string;
  tone: 'positive' | 'waiting' | 'negative' | 'neutral';
} {
  switch (s) {
    case 'submitted':
      return { label: 'Applied', tone: 'positive' };
    case 'needs_verification':
      return { label: 'Needs verification', tone: 'waiting' };
    case 'needs_attention':
      return { label: 'Needs your input', tone: 'waiting' };
    case 'failed':
    case 'submit_failed':
      return { label: 'Failed', tone: 'negative' };
    default:
      // queued / running — the slow part (Browserbase fills + submits the form)
      return { label: 'Auto-applying…', tone: 'neutral' };
  }
}
