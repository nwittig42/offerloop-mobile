import type { ScoutTurn } from '@/api/endpoints/scout';

/**
 * The ONE Scout conversation, shared by both surfaces — the voice-first tab
 * and the header chat sheet. Before this module each kept its own chat_id and
 * history, so asking Scout from the header versus the tab were two server
 * conversations that never saw each other (parity audit). Module-scoped
 * session state, deliberately not reactive: each surface re-reads on its own
 * renders/mount, and the two are never on screen at the same time.
 *
 * The server owns the durable copy (users/{uid}/scoutChats via chat_id);
 * this is just the in-session mirror both surfaces trust.
 */

export type ScoutThreadEntry = { from: 'user' | 'scout'; text: string };

const MAX_ENTRIES = 80;

let chatId: string | null = null;
let entries: ScoutThreadEntry[] = [];

export const scoutThread = {
  chatId: (): string | null => chatId,
  setChatId(id: string | null) {
    chatId = id;
  },
  entries: (): ScoutThreadEntry[] => [...entries],
  size: (): number => entries.length,
  append(e: ScoutThreadEntry) {
    if (!e.text) return;
    entries.push(e);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  },
  /** Load a saved chat wholesale (sheet sidebar): thread + id swap together. */
  replaceAll(next: ScoutThreadEntry[], id: string | null) {
    entries = next.slice(-MAX_ENTRIES);
    chatId = id;
  },
  reset() {
    chatId = null;
    entries = [];
  },
  /** The rolling window both chat clients send (server reloads the full
   *  thread from chat_id anyway; this is the offline-shaped fallback). */
  history(maxMessages = 16): ScoutTurn[] {
    return entries.slice(-maxMessages).map((m) => ({
      role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }));
  },
};
