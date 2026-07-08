import { apiFetch } from '@/api/client';

/**
 * Client for POST /api/mobile/scout/ask — the SCOUT-ACTION-CONTRACT.md
 * translator (v0 built by the app team; Nick's brain slots in behind the
 * same envelope). v0 serves find_contacts (search-only, web-Find parity,
 * uncharged preview with no emails) and draft_outreach (jobRef in the same
 * response). The client mapper keeps owning intent classification until
 * the real brain lands.
 */

export type ContactPreview = {
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
};

export type ScoutAskEnvelope = {
  say: string;
  actions: {
    type: string;
    params: Record<string, unknown>;
    needsConfirm: boolean | Record<string, unknown>;
    jobRef: { kind: string; id: string } | null;
    results: { kind: string; items: ContactPreview[] } | null;
  }[];
  askId: string;
  error?: { code: string; detail: string };
};

export async function askScoutFindContacts(args: {
  ask: string;
  askId: string;
  role?: string;
  company?: string;
  location?: string | null;
}): Promise<ScoutAskEnvelope> {
  return apiFetch<ScoutAskEnvelope>('/api/mobile/scout/ask', {
    method: 'POST',
    body: {
      ask: args.ask,
      askId: args.askId,
      source: 'voice',
      action: 'find_contacts',
      params: { role: args.role || '', company: args.company || '', location: args.location || '' },
    },
    timeoutMs: 45_000,
  });
}
