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

function mapJob(raw: RawJob): Job {
  const s = raw.structured || {};
  return {
    id: String(raw.job_id || raw.id || raw.url || Math.random()),
    title: raw.title || s.title || 'Untitled role',
    company: raw.company || s.company || '',
    location: locationString(raw.location ?? s.location),
    logoUrl: raw.logo_url || raw.company_logo_url || s.logo_url || undefined,
    compensation: raw.compensation || raw.salary || s.compensation || undefined,
    workArrangement: raw.work_arrangement || raw.workArrangement || s.work_arrangement || undefined,
    experienceLevel: raw.experience_level || raw.seniority || s.experience_level || undefined,
    education: raw.education || s.education || undefined,
    companySize: raw.company_size || raw.companySize || s.company_size || undefined,
    description: raw.description || raw.description_text || raw.summary || s.description || '',
    requiredQualifications:
      raw.required_qualifications || raw.qualifications || s.required_qualifications || undefined,
  };
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
