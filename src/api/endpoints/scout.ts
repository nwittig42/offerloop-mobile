import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Scout assistant — the real backend (POST /api/scout-assistant/chat). No credit
 * cost; it answers with the user's resume, pipeline, and live data via the same
 * one-tool-per-turn orchestrator the web app uses (SCOUT_BACKEND_HANDOFF.md).
 *
 * Per the handoff: chips arrive in `cta` / `ctas` on the LIVE success path —
 * `action_buttons` / `navigate_to` exist only in stale docstrings and the error
 * fallback (kept here as a legacy fallback only). Chips carry WEB routes,
 * translated to mobile routes below; a `chat_message` chip means "send this as
 * the next chat message" rather than navigate. Always echo `chat_id` back or
 * every turn starts a fresh server conversation and clarifies never resolve
 * (handoff checklist #8).
 */

export type ScoutTurn = { role: 'user' | 'assistant'; content: string };

export type ScoutUserInfo = {
  name?: string;
  tier?: string;
  credits?: number;
  max_credits?: number;
};

/** A Scout action already translated to a real mobile destination — either a
 *  screen to open (href) or a message to send back into the chat. */
export type ScoutAction = { label: string; href?: string; chatMessage?: string };

export type ScoutReply = {
  message: string;
  chatId?: string;
  actions: ScoutAction[];
};

/** Translate a web route Scout returns into a mobile route, or null if it has no
 *  mobile home (those buttons are dropped rather than shown broken). Exported:
 *  the ask-envelope translator on the Scout tab maps `navigate` actions
 *  through the same table. */
export function mapScoutRoute(route?: string): string | null {
  if (!route || typeof route !== 'string') return null;
  const r = route.toLowerCase().split('?')[0].replace(/\/+$/, '');
  // Find / job board / company + hiring-manager tabs all live in the feed.
  if (
    ['', '/find', '/contact-search', '/home', '/dashboard', '/job-board', '/firm-search',
     '/company-tracker', '/recruiter-spreadsheet', '/hiring-manager-tracker'].includes(r)
  )
    return '/(tabs)/feed';
  if (['/tracker', '/outbox', '/my-network', '/my-network/people', '/contact-directory'].includes(r))
    return '/(tabs)/network';
  if (['/agent', '/agent/setup', '/loops'].includes(r)) return '/loops';
  if (['/coffee-chat-prep', '/coffee-chat-library', '/meeting-prep'].includes(r)) return '/meeting-prep/new';
  if (['/pricing', '/credits', '/account-settings'].includes(r)) return '/credits';
  return null;
}

export async function sendScoutMessage(args: {
  message: string;
  history: ScoutTurn[];
  currentPage?: string;
  userInfo?: ScoutUserInfo;
  chatId?: string | null;
}): Promise<ScoutReply> {
  if (USE_MOCKS) {
    return {
      message:
        "Here's how I'd play it: lead with the alum angle, keep it to three sentences, and ask for 15 minutes, not a referral. Want me to draft it?",
      actions: [{ label: 'Open your feed', href: '/(tabs)/feed' }],
    };
  }

  const r = await apiFetch<any>('/api/scout-assistant/chat', {
    method: 'POST',
    // Without a deadline this call can hang forever and pin the Scout tab on
    // "Thinking…" (field walk 2026-07-08: backgrounded mid-ask, spinner never
    // recovered). LLM chat is slow, but not this slow.
    timeoutMs: 45_000,
    body: {
      message: args.message,
      conversation_history: args.history,
      current_page: args.currentPage || '/home',
      user_info: args.userInfo || {},
      chat_id: args.chatId || undefined,
    },
  });

  // Translate chips into mobile actions, de-duped, dropping anything with no
  // mobile home. Live path: `ctas` (draft turns carry two) then `cta`; a chip
  // with chat_message runs in chat instead of navigating. `action_buttons` /
  // `navigate_to` only ever appear on the legacy/error path — checked last.
  const actions: ScoutAction[] = [];
  const seen = new Set<string>();
  const addChip = (b: any) => {
    const label = typeof b?.label === 'string' ? b.label.trim() : '';
    if (!label) return;
    const chatMessage = typeof b?.chat_message === 'string' ? b.chat_message.trim() : '';
    if (chatMessage) {
      if (!seen.has(`m:${chatMessage}`)) {
        seen.add(`m:${chatMessage}`);
        actions.push({ label, chatMessage });
      }
      return;
    }
    const href = mapScoutRoute(b?.route);
    if (href && !seen.has(href)) {
      seen.add(href);
      actions.push({ label, href });
    }
  };
  for (const b of Array.isArray(r?.ctas) ? r.ctas : []) addChip(b);
  if (r?.cta) addChip(r.cta);
  for (const b of Array.isArray(r?.action_buttons) ? r.action_buttons : []) addChip(b);
  if (!actions.length && r?.navigate_to) {
    const href = mapScoutRoute(r.navigate_to);
    if (href) actions.push({ label: 'Take me there', href });
  }
  // navigate turns: the destination is a plan the user approves by tapping.
  if (r?.tool === 'navigate' && r?.navigate?.route) {
    const href = mapScoutRoute(r.navigate.route);
    if (href && !seen.has(href)) actions.push({ label: 'Take me there', href });
  }

  return {
    message: (r?.message as string) || "I didn't catch that — try asking again?",
    chatId: (r?.chat_id as string) || undefined,
    actions,
  };
}
