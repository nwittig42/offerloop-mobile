/**
 * Typed API error + helpers that read the backend's actual signals so screens
 * can branch reliably. The backend currently returns HTTP 400 with an
 * "Insufficient credits" message for the low-credit case (not 402), so the
 * helper matches either, to stay correct across the cutover to a cleaner 402.
 */
export class ApiError extends Error {
  status: number;
  body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function bodyText(err: unknown): string {
  if (!(err instanceof ApiError)) return '';
  const b = err.body;
  const msg = (b && (b.error || b.message)) || err.message || '';
  return String(msg).toLowerCase();
}

export function isInsufficientCredits(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 402 || bodyText(err).includes('insufficient credits');
}

export function isCooldown(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429;
}

export function isGmailDisconnected(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const t = bodyText(err);
  return t.includes('gmail') && (t.includes('connect') || t.includes('unavailable'));
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** Credits the action needed, when the backend reports it on an insufficient-credits error. */
export function creditsNeeded(err: unknown): number | undefined {
  if (!(err instanceof ApiError)) return undefined;
  return err.body?.credits_needed ?? err.body?.creditsNeeded;
}
