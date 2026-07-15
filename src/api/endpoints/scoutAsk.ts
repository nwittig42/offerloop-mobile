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
  /** Present only on brain-executed (charged) searches — the paid reveal. */
  email?: string;
  contactId?: string;
};

export type ScoutAskAction = {
  type: string;
  params: Record<string, unknown>;
  needsConfirm: boolean | Record<string, unknown>;
  jobRef: { kind: string; id: string } | null;
  results: { kind: string; items: ContactPreview[] } | null;
};

export type ScoutAskEnvelope = {
  say: string;
  actions: ScoutAskAction[];
  askId: string;
  /** Brain path only: the persisted server chat thread. Send it back on the
   *  next ask for multi-turn memory (same threads web Scout uses). */
  conversationId?: string | null;
  error?: { code: string; detail: string };
};

export type AskClassification = {
  intent: 'draft_outreach' | 'find_people' | 'find_jobs' | 'apply_saved' | 'meeting_prep' | 'question';
  cleaned_ask: string;
  role: string;
  company: string;
  location: string;
  count: number;
  hiring_manager: boolean;
  wants_send: boolean;
  job_query: string;
  /** Server repaired a likely speech-recognition error (e.g. "Molly's" →
   *  Moelis). Client must confirm-card repaired companies, never run silent. */
  repaired: boolean;
  error?: string;
};

/** The any-ask intelligence layer: LLM classification for whatever the
 *  client regex ladder can't parse. Cached server-side (14d), never throws
 *  business errors — worst case returns intent 'question'. */
export async function classifyAsk(ask: string, askId: string): Promise<AskClassification> {
  const r = await apiFetch<{ classification: AskClassification }>('/api/mobile/scout/ask', {
    method: 'POST',
    body: { ask, askId, source: 'voice', action: 'classify', params: {} },
    timeoutMs: 15_000,
  });
  return r.classification;
}

/** How many open roles we have per company — grounds Scout's company suggestions
 *  in real inventory (drop firms with 0 jobs, rank by count). Best-effort: on any
 *  failure the caller shows the unfiltered suggestions. */
export async function fetchCompanyJobCounts(companies: string[]): Promise<Record<string, number>> {
  const list = companies.map((c) => (c || '').trim()).filter(Boolean).slice(0, 8);
  if (!list.length) return {};
  const r = await apiFetch<{ counts?: Record<string, number> }>(
    `/api/mobile/company-counts?companies=${encodeURIComponent(list.join(','))}`,
    { timeoutMs: 8_000 },
  );
  return r.counts || {};
}

/** Voice overhaul P2: one round trip that turns the RAW ask audio into an
 *  understanding. Server transcribes with a firm-vocabulary-primed model
 *  (falls back internally to the Apple transcript on any ASR failure —
 *  transcript_source says which won), then classifies with the same cached
 *  brain as classifyAsk. */
export async function transcribeAsk(args: {
  audioUri: string;
  appleTranscript: string;
  askId: string;
  hintCompanies: string[];
}): Promise<{ transcript: string; transcript_source: 'audio' | 'apple'; classification: AskClassification }> {
  const form = new FormData();
  form.append('audio', { uri: args.audioUri, name: 'ask.wav', type: 'audio/wav' } as unknown as Blob);
  form.append('askId', args.askId);
  form.append('apple_transcript', args.appleTranscript.slice(0, 500));
  form.append('hint_companies', JSON.stringify(args.hintCompanies.slice(0, 25)));
  return apiFetch('/api/mobile/scout/transcribe-ask', {
    method: 'POST',
    body: form,
    timeoutMs: 15_000,
  });
}

/** Phase 2 (2026-07-09): the REAL brain — action='ask' runs the full Scout
 *  tool loop server-side (find/draft/prep/apply/company intel/workflow
 *  reads) and returns the contract envelope with typed receipt actions.
 *  This is what the v0 dialect above was always a placeholder for; the
 *  legacy calls stay for the fast client paths until they're retired. */
export async function askScoutBrain(args: {
  ask: string;
  askId: string;
  conversationId?: string | null;
  source?: 'voice' | 'typed' | 'chip';
}): Promise<ScoutAskEnvelope> {
  return apiFetch<ScoutAskEnvelope>('/api/mobile/scout/ask', {
    method: 'POST',
    body: {
      ask: args.ask,
      askId: args.askId,
      source: args.source || 'typed',
      action: 'ask',
      conversationId: args.conversationId || undefined,
      params: {},
    },
    timeoutMs: 45_000,
  });
}

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
