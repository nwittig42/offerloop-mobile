import { getIdToken } from '@/api/authToken';
import { apiFetch } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { ResumePreviewEntry, ResumePreviewSection } from '@/components/resume/ResumePreview';
import { requireAIConsent } from '@/lib/aiConsent';

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

/** LIVE since 2026-08-10: PR #181 on the web repo shipped the preview
 *  variant, thin guard, and cap fix; smoke-tested against the deployed
 *  service (200, real sections, verified no save side effect). */
export const RESUME_BUILDER_LIVE = true;

/** The resume-builder lives on the WEB backend (deploys from main), not the
 *  mobile services. Same Firebase project, so the bearer token just works.
 *
 *  Overridable so the website backend can be run on this machine and pointed at
 *  from the app: set EXPO_PUBLIC_WEB_BASE_URL in .env.local (gitignored) to
 *  something like http://192.168.1.x:5055. Without it, the deployed service.
 *  This is the ONE address in the app that does not follow the normal API base,
 *  which is why local testing of the builder needs its own switch. */
const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://final-offerloop.onrender.com';

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
  requireAIConsent();
  try {
    // polish: run the mapped draft through the website's Harvard-rubric LLM
    // pass so the mobile build matches web quality. Slower (an LLM round
    // trip), hence the long timeout; the backend falls back to the unpolished
    // mapping if the user is capped or the LLM hiccups.
    const r = await apiFetch<{ success: boolean; resume: CanonicalResume; html: string }>(
      `${WEB_BASE}/api/resume-builder/from-linkedin/preview`,
      { method: 'POST', body: { polish: true }, timeoutMs: 90000 },
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

/** The no-LinkedIn, no-file door: the user describes (or pastes) their
 *  experience in their own words and the website's builder turns it into a
 *  Harvard-format draft. Same generator the web resume builder uses,
 *  including its role-research pass, hence the long timeout. Counts against
 *  the lifetime generation cap (it is an LLM build). */
export async function generateResumeFromPrompt(prompt: string): Promise<ResumeBuildResult> {
  requireAIConsent();
  try {
    const r = await apiFetch<{ success: boolean; resume: CanonicalResume; html: string }>(
      `${WEB_BASE}/api/resume-builder/generate`,
      { method: 'POST', body: { prompt }, timeoutMs: 120000 },
    );
    if (!r.success || !r.resume) return { status: 'error', message: 'Generation failed.' };
    return { status: 'ok', resume: r.resume, html: r.html };
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return { status: 'limit' };
    return { status: 'error', message: 'Could not build the resume right now.' };
  }
}

/** Refine a draft: the backend applies the user's typed instructions to the
 *  previous resume, changing only what the instructions require (the system
 *  prompt's rule 16). context 'editor' uses the free daily edit cap, not the
 *  lifetime generation cap. */
export async function refineResume(
  prompt: string,
  previous: CanonicalResume,
): Promise<ResumeBuildResult> {
  requireAIConsent();
  try {
    const r = await apiFetch<{ success: boolean; resume: CanonicalResume; html: string }>(
      `${WEB_BASE}/api/resume-builder/generate`,
      { method: 'POST', body: { prompt, previous, context: 'editor' }, timeoutMs: 90000 },
    );
    if (!r.success || !r.resume) return { status: 'error', message: 'Edit failed.' };
    return { status: 'ok', resume: r.resume, html: r.html };
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return { status: 'limit' };
    return { status: 'error', message: 'Could not apply that change right now.' };
  }
}

/** The stored resume in editable (canonical) form, for the edit loop.
 *  null resume = nothing stored (or stored in a shape we cannot convert). */
export async function currentResume(): Promise<CanonicalResume | null> {
  try {
    const r = await apiFetch<{ success: boolean; resume: CanonicalResume | null }>(
      `${WEB_BASE}/api/resume-builder/current`,
      { timeoutMs: 30000 },
    );
    return r.resume ?? null;
  } catch {
    return null;
  }
}

/** Adopt: the explicit, user-approved save. Flips hasResume via resumeUrl. */
export async function finalizeResume(resume: CanonicalResume): Promise<boolean> {
  try {
    const r = await apiFetch<{ success: boolean; resumeUrl?: string }>(
      `${WEB_BASE}/api/resume-builder/finalize`,
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
  const toEntries = (items?: Entryish[]): ResumePreviewEntry[] =>
    (items ?? [])
      .map((it) => ({
        heading: it.role ?? it.degree ?? it.title ?? it.name,
        sub: it.org ?? it.school,
        meta: it.dates,
        bullets: it.bullets ?? [],
      }))
      .filter((e) => e.heading || e.sub || e.bullets.length);

  const push = (title: string, entries: ResumePreviewEntry[]) => {
    if (entries.length) sections.push({ title, entries });
  };
  push('Experience', toEntries(resume.experience));
  push('Education', toEntries(resume.education));
  push('Projects', toEntries(resume.projects));
  push('Leadership', toEntries(resume.leadership));
  push('Skills', resume.skills?.length ? [{ bullets: [resume.skills.join(' · ')] }] : []);
  push('Interests', resume.interests?.length ? [{ bullets: [resume.interests.join(' · ')] }] : []);
  return sections;
}

/**
 * Render the draft to a real PDF and hand it back base64-encoded, so the
 * review screen can show the actual document rather than a re-rendered
 * approximation of it.
 *
 * Not apiFetch: that client assumes JSON both ways, and this response is
 * application/pdf bytes. Auth is attached when we have it and omitted when we
 * do not, because /download is one of the two builder routes open to signed-out
 * callers (the other is /generate). Pure render on the server: no storage
 * write, no cap charge, so this is safe to call on every draft change.
 *
 * Returns null on any failure. The caller falls back to the section preview,
 * which is always available; losing the PDF should never block finishing.
 */
export async function downloadResumePdfBase64(
  resume: CanonicalResume,
): Promise<string | null> {
  try {
    const token = await getIdToken();
    const res = await fetch(`${WEB_BASE}/api/resume-builder/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resume }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    // RN has no Buffer; FileReader gives us a data: URL we can slice.
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const s = String(reader.result || '');
        const comma = s.indexOf(',');
        resolve(comma > -1 ? s.slice(comma + 1) : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
