import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_JOBS } from '@/mocks/data';
import type { Job } from '@/types';

/** Backend job docs are loosely shaped; pull each field from its likely names. */
type RawJob = Record<string, any>;

type FeedResponse = {
  new_matches?: RawJob[];
  top_jobs?: RawJob[];
};

function locationString(loc: unknown): string {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object') {
    return Object.values(loc as Record<string, unknown>)
      .filter(Boolean)
      .map(String)
      .join(', ');
  }
  return '';
}

/** "INTERNSHIP" -> "Internship", "FULLTIME" -> "Full-time". */
function employmentLabel(type: unknown): string | undefined {
  switch (String(type || '').toUpperCase()) {
    case 'INTERNSHIP':
      return 'Internship';
    case 'FULLTIME':
      return 'Full-time';
    case 'PARTTIME':
      return 'Part-time';
    default:
      return undefined;
  }
}

/**
 * Map a backend FeedJob (see api.ts `FeedJob`/`JobStructured`) onto the mobile
 * Job shape. The feed is intentionally lean — `description` (description_raw) is
 * stripped server-side and fetched lazily per card via fetchJobDescription.
 * Only fields the feed actually carries are mapped; the rest stay undefined so
 * the card chips simply do not render (no mock fallbacks).
 */
function mapJob(raw: RawJob): Job {
  const s = raw.structured || {};
  // Only assert "Remote" — the feed's `remote` flag is boolean; a false value
  // can mean on-site OR unknown, so we don't claim on-site we can't verify.
  const workArrangement = raw.remote ? 'Remote' : employmentLabel(raw.type);
  const requirements = Array.isArray(s.requirements) ? s.requirements.filter(Boolean) : undefined;
  return {
    id: String(raw.job_id || raw.id || raw.apply_url || Math.random()),
    title: raw.title || 'Untitled role',
    company: raw.company || '',
    location: locationString(raw.location),
    logoUrl: raw.employer_logo || undefined,
    compensation: raw.salary_display || undefined,
    workArrangement,
    experienceLevel: s.experience_level || undefined,
    education: undefined,
    companySize: undefined,
    // Empty here by design — JobCard lazy-fetches the prose from
    // /api/jobs/{id}/description when first shown.
    description: '',
    requiredQualifications: requirements && requirements.length ? requirements : undefined,
  };
}

/**
 * Lazy per-job description. The feed strips description_raw to stay lean, so the
 * card pulls the prose on demand. Returns '' when the job has no stored text so
 * the card can show an honest empty state rather than placeholder filler.
 */
export async function fetchJobDescription(jobId: string): Promise<string> {
  if (USE_MOCKS) return '';
  const res = await apiFetch<{ description: string | null }>(
    `/api/jobs/${encodeURIComponent(jobId)}/description`,
  );
  return res.description || '';
}

/**
 * The swipe deck. Combines fresh matches + the ranked list from
 * GET /api/jobs/feed, de-duped by id, mapped to the mobile Job shape. Missing
 * fields come back undefined so the card chips simply do not render.
 */
export async function fetchFeed(): Promise<Job[]> {
  if (USE_MOCKS) return MOCK_JOBS;

  const res = await apiFetch<FeedResponse>('/api/jobs/feed');
  const raw = [...(res.new_matches || []), ...(res.top_jobs || [])];

  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of raw) {
    const job = mapJob(r);
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    jobs.push(job);
  }
  return jobs;
}
