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
function cleanList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map(decodeEntities);
  return out.length ? out : undefined;
}

/** Build a readable description from the structured fields — the same shape the
 *  web job board renders (What you'll do / What we're looking for / Nice to
 *  have). Mirrors backend services/job_description.compose_from_structured so a
 *  card filled from the feed payload matches the lazy-fetched detail. */
function composeFromStructured(s: RawJob): string {
  const sections: [string, unknown][] = [
    ["What you'll do", s.responsibilities],
    ["What we're looking for", s.requirements],
    ['Nice to have', s.nice_to_have],
  ];
  const parts: string[] = [];
  for (const [header, items] of sections) {
    const bullets = cleanList(items);
    if (!bullets) continue;
    parts.push(header);
    parts.push(...bullets.map((b) => `• ${b}`));
  }
  return parts.join('\n');
}

/** Decode the HTML entities scraped job text carries (&nbsp;, &amp;, &#39; …) so
 *  the card renders clean text instead of raw entity codes. Keeps newlines. */
export function decodeEntities(s: string): string {
  if (!s) return '';
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Some jobs carry a multi-location comp blob ("US employees in NYC, LA … :
 *  $75,900 - $85,400 USD; US employees outside … : $68,300 - $76,900 USD").
 *  Collapse any such prose into a single honest outer range ($68,300 – $85,400)
 *  so the comp chip stays one line on the card instead of ballooning into a
 *  paragraph. A plain, already-clean "$75,900 - $85,400 USD" passes through. */
function condenseComp(text: string): string {
  const amounts: number[] = [];
  const re = /\$\s?([\d,]+(?:\.\d+)?)\s?([kKmM])?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (!isFinite(n)) continue;
    const suffix = (m[2] || '').toLowerCase();
    if (suffix === 'k') n *= 1_000;
    else if (suffix === 'm') n *= 1_000_000;
    amounts.push(n);
  }
  // Only rewrite verbose blobs (prose / multiple ranges) — leave clean ranges be.
  const verbose = text.length > 46 || /;|employees|based|outside|\barea\b/i.test(text);
  if (!verbose || amounts.length < 2) return text;
  const lo = Math.min(...amounts);
  const hi = Math.max(...amounts);
  // Manual grouping — Hermes' Intl doesn't reliably honor toLocaleString.
  const fmt = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
}

function mapJob(raw: RawJob): Job {
  const s = raw.structured || {};
  // Only assert "Remote" — the feed's `remote` flag is boolean; a false value
  // can mean on-site OR unknown, so we don't claim on-site we can't verify.
  const workArrangement = raw.remote ? 'Remote' : employmentLabel(raw.type);
  const requirements = cleanList(s.requirements);
  // The feed strips description_raw but keeps `structured`, so compose the card
  // description from the structured sections immediately (most enriched jobs).
  // When structured is empty too, leave it blank so JobCard lazy-fetches the
  // full description_raw (or the backend's structured summary) on demand.
  const description = composeFromStructured(s);
  // Match the web board's comp source: prefer salary_display, fall back to the
  // structured salary_range_text (what offerloop.ai shows under "At a glance").
  const comp = String(raw.salary_display || s.salary_range_text || '').trim();
  return {
    id: String(raw.job_id || raw.id || raw.apply_url || Math.random()),
    title: raw.title || 'Untitled role',
    company: raw.company || '',
    location: locationString(raw.location),
    logoUrl: raw.employer_logo || undefined,
    compensation: comp ? condenseComp(decodeEntities(comp)) : undefined,
    workArrangement,
    experienceLevel: s.experience_level || undefined,
    education: undefined,
    companySize: undefined,
    description,
    requiredQualifications: requirements,
    // Auto-apply eligibility comes straight off the feed (backend jobs.py tags
    // every job with auto_apply_eligible + ats_platform and sorts eligible first).
    autoApplyEligible: !!raw.auto_apply_eligible,
    atsPlatform: raw.ats_platform || undefined,
  };
}

/**
 * Open roles at ONE company, for the per-company Roles deck. Reuses the existing
 * backend search (GET /api/jobs/search?company=X), which returns jobs through the
 * SAME serializer as the feed (auto_apply_eligible + ats_platform included), so
 * mapJob works unchanged. Companies are stored lowercase-canonical on the backend
 * and the match is case-sensitive, so we lowercase the input to line them up.
 */
export async function fetchRolesByCompany(
  company: string,
  cursor?: string,
): Promise<{ jobs: Job[]; nextCursor: string | null }> {
  if (USE_MOCKS) return { jobs: [], nextCursor: null };
  const c = (company || '').trim().toLowerCase();
  if (!c) return { jobs: [], nextCursor: null };
  // Paginated so a deep company (SpaceX ships ~1,900 roles) isn't capped at one
  // page — the caller pages the cursor to load more as the user swipes through.
  const cur = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const res = await apiFetch<{ results?: RawJob[]; next_cursor?: string | null }>(
    `/api/jobs/search?company=${encodeURIComponent(c)}&limit=100${cur}`,
  );
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of res.results || []) {
    const j = mapJob(r);
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    jobs.push(j);
  }
  return { jobs, nextCursor: res.next_cursor ?? null };
}

/**
 * Jobs for a whole SECTOR from the full pool — not the user's ranked feed. Scout's
 * job search used to only scan the loaded feed, so "fintech jobs" dead-ended even
 * though the pool has 500+ fintech companies. Resolves the sector to its top
 * companies (by real inventory) via /vibe-companies, pulls each one's roles, and
 * round-robin interleaves so no single employer dominates. Empty when the sector
 * is unknown/unclassified — caller falls back to the feed.
 */
export async function fetchSectorJobs(sector: string, limit = 8): Promise<Job[]> {
  if (USE_MOCKS || !sector) return [];
  let companies: string[] = [];
  try {
    const r = await apiFetch<{ companies?: string[] }>(
      `/api/mobile/vibe-companies?sector=${encodeURIComponent(sector)}&limit=5`,
      { timeoutMs: 8_000 },
    );
    companies = (r.companies || []).slice(0, 4);
  } catch {
    return [];
  }
  if (!companies.length) return [];
  const perCompany = await Promise.all(
    companies.map((c) => fetchRolesByCompany(c).then((r) => r.jobs).catch(() => [] as Job[])),
  );
  const out: Job[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit; i++) {
    let progressed = false;
    for (const jobs of perCompany) {
      const j = jobs[i];
      if (j && !seen.has(j.id)) {
        seen.add(j.id);
        out.push(j);
        progressed = true;
        if (out.length >= limit) break;
      }
    }
    if (!progressed) break;
  }
  return out;
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
  return res.description ? decodeEntities(res.description) : '';
}

/**
 * The swipe deck. Combines fresh matches + the ranked list from
 * GET /api/jobs/feed, de-duped by id, mapped to the mobile Job shape. Missing
 * fields come back undefined so the card chips simply do not render.
 */
/**
 * Lean the deck toward the user's preferred locations without boxing them in.
 * Jobs whose location (or remote flag) matches a preference are front-loaded,
 * but every 4th card is a wildcard from elsewhere so the deck keeps volume and
 * the occasional out-of-area role still shows. No prefs → untouched order.
 * Matches on the city token (before the comma) so "New York, NY" hits a job
 * listed as just "New York", and "Remote" matches remote roles.
 */
export function rankJobsByLocation(jobs: Job[], prefs: string[]): Job[] {
  const tokens = (prefs || [])
    .map((p) => p.split(',')[0].trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return jobs;

  const matches: Job[] = [];
  const rest: Job[] = [];
  for (const j of jobs) {
    const hay = `${j.location || ''} ${j.workArrangement || ''}`.toLowerCase();
    (hay && tokens.some((t) => hay.includes(t)) ? matches : rest).push(j);
  }
  // Nothing to reorder if everything (or nothing) matched.
  if (!matches.length || !rest.length) return jobs;

  const out: Job[] = [];
  let mi = 0;
  let ri = 0;
  while (mi < matches.length || ri < rest.length) {
    for (let k = 0; k < 3 && mi < matches.length; k++) out.push(matches[mi++]);
    if (ri < rest.length) out.push(rest[ri++]); // one wildcard per 3 matches
  }
  return out;
}

/**
 * Tell the server the user rejected (or liked) a job.
 *
 * A left-swipe used to be purely local: it filtered the card out of the in-memory
 * deck and nothing else. The server never heard, so it kept re-serving jobs the
 * user had already rejected, the client kept filtering them back out, and the
 * deck only ever SHRANK — you could swipe left on everything and hit a wall with
 * ~7,400 unseen jobs still in the catalog. Recording the pass lets the next
 * rerank drop it and pull genuinely unseen jobs up into its place, which is what
 * lets someone work through the whole catalog instead of a fixed slice.
 *
 * Best-effort and fire-and-forget: a failed signal must never block a swipe.
 */
export async function sendJobFeedback(jobId: string, signal: 'positive' | 'negative'): Promise<void> {
  if (USE_MOCKS) return;
  try {
    await apiFetch('/api/jobs/feedback', {
      method: 'POST',
      body: { job_id: jobId, signal },
      timeoutMs: 10_000,
    });
  } catch {
    /* swiping must not depend on the network */
  }
}

/**
 * @param opts.refresh When true, hits `?refresh=true` — the backend advances
 *   `jobFeedOffset` by 100 and hydrates a deeper slice of the 1000-ID ranked
 *   list, so the deck fills with genuinely new (and progressively more
 *   adjacent / less strictly on-field) roles. Wraps to the top at the end, so
 *   it always returns cards. Used by the "Show me new roles" reroll.
 */
/** One page of the deck, plus the cursor for the next one (null = end). */
export type FeedPage = { jobs: Job[]; nextCursor: number | null };

/** How many ranked cards a page holds. The feed used to ship ~420 at once — the
 *  whole deck — for a session in which the user swipes a couple of dozen, which
 *  is most of what made opening the app slow. */
export const FEED_PAGE_SIZE = 60;

export async function fetchFeedPage(opts?: {
  refresh?: boolean;
  cursor?: number;
  limit?: number;
}): Promise<FeedPage> {
  if (USE_MOCKS) return { jobs: MOCK_JOBS, nextCursor: null };

  const q = new URLSearchParams();
  if (opts?.refresh) q.set('refresh', 'true');
  q.set('limit', String(opts?.limit ?? FEED_PAGE_SIZE));
  if (opts?.cursor) q.set('cursor', String(opts.cursor));

  const res = await apiFetch<FeedResponse>(`/api/jobs/feed?${q.toString()}`);
  // new_matches only comes back on page 0; later pages carry top_jobs alone.
  const raw = [...(res.new_matches || []), ...(res.top_jobs || [])];

  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of raw) {
    const job = mapJob(r);
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    jobs.push(job);
  }
  const next = (res as unknown as { next_cursor?: number | null }).next_cursor;
  return { jobs, nextCursor: next ?? null };
}

/** First page — what the deck is seeded with. */
export async function fetchFeed(opts?: { refresh?: boolean }): Promise<Job[]> {
  const page = await fetchFeedPage({ refresh: opts?.refresh });
  return page.jobs;
}
