import { API_BASE_URL } from '@/api/config';
import { getIdToken, handleUnauthorized } from '@/api/authToken';
import { ApiError } from '@/api/errors';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type FetchOptions = {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** Attach the Firebase bearer token (default true). */
  auth?: boolean;
  /** Query params appended to the path. */
  query?: Record<string, string | number | boolean | undefined>;
};

const MAX_503_RETRIES = 2;

function buildUrl(path: string, query?: FetchOptions['query']): string {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return params ? `${url}?${params}` : url;
}

async function parse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The single fetch wrapper. Prepends the base URL, attaches the Firebase ID
 * token, sends/parses JSON, and throws a typed `ApiError` on non-2xx. Handles:
 *  - 401: force a token refresh and retry once; if still 401, sign out.
 *  - 503 with { retry: true }: exponential backoff (the backend signals this
 *    for transient auth-service blips).
 */
export async function apiFetch<T = any>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, auth = true, query } = opts;
  const url = buildUrl(path, query);

  const doFetch = async (forceTokenRefresh: boolean): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = await getIdToken(forceTokenRefresh);
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  };

  let res = await doFetch(false);

  // 401: refresh the token once and retry; otherwise sign out.
  if (res.status === 401 && auth) {
    res = await doFetch(true);
    if (res.status === 401) {
      handleUnauthorized();
      throw new ApiError(401, 'Session expired', await parse(res));
    }
  }

  // 503 transient: back off and retry a couple times.
  let attempt = 0;
  while (res.status === 503 && attempt < MAX_503_RETRIES) {
    const data = await parse(res);
    if (!data || data.retry !== true) {
      throw new ApiError(503, (data && (data.error || data.message)) || 'Service unavailable', data);
    }
    await sleep(400 * Math.pow(2, attempt));
    attempt += 1;
    res = await doFetch(false);
  }

  const data = await parse(res);
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}
