import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_COMPANY_INFO } from '@/mocks/data';
import type { CompanyInfo } from '@/types';

/** 'pending' = the server answered instantly and is researching the company in
 *  the background (first visit to an uncached company) — poll until it lands. */
export type CompanyFetchResult = CompanyInfo | null | 'pending';

/**
 * Single-company overview for the company page. Hits GET /api/mobile/company/{name}
 * (firm-intel pipeline, server-cached 30d). Returns null when there's no real
 * profile so the page can show an honest empty state instead of fabricated facts.
 */
export async function fetchCompany(name: string): Promise<CompanyFetchResult> {
  if (USE_MOCKS) return MOCK_COMPANY_INFO[name] ?? null;

  const res = await apiFetch<Partial<CompanyInfo> & { pending?: boolean }>(
    `/api/mobile/company/${encodeURIComponent(name)}`,
  );
  if (res?.pending) return 'pending';
  if (!res || (!res.about && !res.industry && !res.hq && !res.size)) return null;
  return {
    about: res.about || '',
    industry: res.industry || '',
    size: res.size || '',
    hq: res.hq || '',
    news: res.news || [],
  };
}
