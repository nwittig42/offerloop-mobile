import { apiFetch } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { ResumePreviewSection } from '@/components/resume/ResumePreview';

/**
 * The website's resume-builder engine, contract agreed with Nick 2026-08-10
 * (NICK-SPEC-resume-endpoint.md plus his corrections). Routes live at
 * /api/resume-builder/*, same Firebase bearer auth as everything else.
 *
 * The mobile flow is LinkedIn-first and preview-first:
 *   1. onboarding already ran POST /api/enrich-linkedin-onboarding, which
 *      populates users/{uid}.linkedinResumeParsed;
 *   2. previewResumeFromLinkedin() renders WITHOUT saving (Nick's new
 *      preview variant, deterministic, no LLM, no cap burn);
 *   3. the user approves, finalizeResume() adopts it (the ONLY save).
 */

/** Flip to true the moment Nick's preview variant is live on staging.
 *  Everything downstream ships dark behind this. */
export const RESUME_BUILDER_LIVE = false;

type Entryish = {
  org?: string;
  school?: string;
  name?: string;
  role?: string;
  degree?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
};

/** Nick's CanonicalResume, typed loosely on purpose: the preview maps
 *  whatever arrives, and finalize passes the object back untouched. */
export type CanonicalResume = {
  contact?: Record<string, unknown>;
  education?: Entryish[];
  experience?: Entryish[];
  projects?: Entryish[];
  leadership?: Entryish[];
  skills?: string[];
  interests?: string[];
};

export type ResumeBuildResult =
  | { status: 'ok'; resume: CanonicalResume; html: string }
  | { status: 'thin'; missing: string[] }
  | { status: 'limit' }
  | { status: 'error'; message: string };

export async function previewResumeFromLinkedin(): Promise<ResumeBuildResult> {
  try {
    const r = await apiFetch<{ success: boolean; resume: CanonicalResume; html: string }>(
      '/api/resume-builder/from-linkedin/preview',
      { method: 'POST', timeoutMs: 45000 },
    );
    if (!r.success || !r.resume) return { status: 'error', message: 'Generation failed.' };
    return { status: 'ok', resume: r.resume, html: r.html };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: string; missing?: string[] } | undefined;
      if (e.status === 422 && body?.error === 'profile_too_thin') {
        return { status: 'thin', missing: body.missing ?? [] };
      }
      if (e.status === 429) return { status: 'limit' };
    }
    return { status: 'error', message: 'Could not build the resume right now.' };
  }
}

/** Adopt: the explicit, user-approved save. Flips hasResume via resumeUrl. */
export async function finalizeResume(resume: CanonicalResume): Promise<boolean> {
  try {
    const r = await apiFetch<{ success: boolean; resumeUrl?: string }>(
      '/api/resume-builder/finalize',
      { method: 'POST', body: { resume }, timeoutMs: 45000 },
    );
    return !!r.success && !!r.resumeUrl;
  } catch {
    return false;
  }
}

/** Shape CanonicalResume into the preview component's titled sections. */
export function sectionsFromCanonical(resume: CanonicalResume): ResumePreviewSection[] {
  const sections: ResumePreviewSection[] = [];
  const entryLines = (items?: Entryish[]) =>
    (items ?? [])
      .map((it) => {
        const head = [it.role ?? it.degree ?? it.title ?? it.name, it.org ?? it.school]
          .filter(Boolean)
          .join(', ');
        const dated = [head, it.dates].filter(Boolean).join(' · ');
        return [dated, ...(it.bullets ?? []).map((b) => `• ${b}`)].filter(Boolean).join('\n');
      })
      .filter(Boolean);

  const push = (title: string, lines: string[]) => {
    if (lines.length) sections.push({ title, lines });
  };
  push('Experience', entryLines(resume.experience));
  push('Education', entryLines(resume.education));
  push('Projects', entryLines(resume.projects));
  push('Leadership', entryLines(resume.leadership));
  push('Skills', resume.skills?.length ? [resume.skills.join(' · ')] : []);
  push('Interests', resume.interests?.length ? [resume.interests.join(' · ')] : []);
  return sections;
}
