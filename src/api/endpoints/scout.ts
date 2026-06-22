import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Scout assistant — the real backend (POST /api/scout-assistant/chat). No credit
 * cost; it answers with the user's resume, pipeline, and live data via the same
 * service the web app uses. We send the running conversation + light user context
 * (tier/credits) and render the reply. The backend also returns `navigate_to` /
 * `action_buttons`, but those are WEB routes that don't map to the mobile tabs,
 * so we deliberately ignore them here rather than send users somewhere broken.
 */

export type ScoutTurn = { role: 'user' | 'assistant'; content: string };

export type ScoutUserInfo = {
  name?: string;
  tier?: string;
  credits?: number;
  max_credits?: number;
};

export type ScoutReply = {
  message: string;
  chatId?: string;
};

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

  return {
    message: (r?.message as string) || "I didn't catch that — try asking again?",
    chatId: (r?.chat_id as string) || undefined,
  };
}
