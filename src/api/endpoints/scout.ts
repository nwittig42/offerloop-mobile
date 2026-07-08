import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Scout assistant — the real backend (POST /api/scout-assistant/chat). No credit
 * cost; it answers with the user's resume, pipeline, and live data via the same
 * service the web app uses. The backend also returns `navigate_to` /
 * `action_buttons` as WEB routes, which we translate to mobile routes here and
 * surface as tappable actions (web-only destinations are dropped, never shown as
 * dead buttons).
 */

export type ScoutTurn = { role: 'user' | 'assistant'; content: string };

export type ScoutUserInfo = {
  name?: string;
  tier?: string;
  credits?: number;
  max_credits?: number;
};

/** A Scout action already translated to a real mobile destination. */
export type ScoutAction = { label: string; href: string };

export type ScoutReply = {
  message: string;
  chatId?: string;
  actions: ScoutAction[];
};

/** Translate a web route Scout returns into a mobile route, or null if it has no
 *  mobile home (those buttons are dropped rather than shown broken). */
function mapScoutRoute(route?: string): string | null {
  if (!route || typeof route !== 'string') return null;
  const r = route.toLowerCase().split('?')[0].replace(/\/+$/, '');
  // Find / job board / company + hiring-manager tabs all live in the feed.
  if (
    ['', '/find', '/contact-search', '/home', '/dashboard', '/job-board', '/firm-search',
     '/company-tracker', '/recruiter-spreadsheet', '/hiring-manager-tracker'].includes(r)
  )
    return '/(tabs)';
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
      actions: [{ label: 'Open your feed', href: '/(tabs)' }],
    };
  }

  const r = await apiFetch<any>('/api/scout-assistant/chat', {
    method: 'POST',
    body: {
      message: args.message,
      conversation_history: args.history,
      current_page: args.currentPage || '/home',
      user_info: args.userInfo || {},
      chat_id: args.chatId || undefined,
    },
  });

  // Translate the backend's web action_buttons + navigate_to into mobile actions,
  // de-duped by destination, dropping anything with no mobile home.
  const actions: ScoutAction[] = [];
  const seen = new Set<string>();
  const buttons = Array.isArray(r?.action_buttons) ? r.action_buttons : [];
  for (const b of buttons) {
    const href = mapScoutRoute(b?.route);
    const label = typeof b?.label === 'string' ? b.label.trim() : '';
    if (href && label && !seen.has(href)) {
      seen.add(href);
      actions.push({ label, href });
    }
  }
  if (!actions.length && r?.navigate_to) {
    const href = mapScoutRoute(r.navigate_to);
    if (href) actions.push({ label: 'Take me there', href });
  }

  return {
    message: (r?.message as string) || "I didn't catch that — try asking again?",
    chatId: (r?.chat_id as string) || undefined,
    actions,
  };
}
