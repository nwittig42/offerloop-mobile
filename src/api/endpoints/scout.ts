import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { requireAIConsent } from '@/lib/aiConsent';

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

/** One concrete edit Scout proposed for the resume (backend's
 *  tailor_resume_to_job / improve_resume_for_target tools). */
export type ScoutEdit = { id: string; section: string; current: string; suggested: string };

/** A Scout action already translated to a real mobile destination — either a
 *  screen to open (href) or a message to send back into the chat. Resume
 *  actions may carry the structured edits Scout proposed, so the edit
 *  screen can offer approve/skip instead of one blanket rewrite. */
export type ScoutAction = {
  label: string;
  href?: string;
  chatMessage?: string;
  edits?: ScoutEdit[];
};

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
  // /applications and /my-network/managers were unmapped, so every "Open
  // Applications" chip Scout offered after an auto-apply, and every "Open
  // Hiring Managers" chip after a manager search, was silently dropped: the
  // student was told to go look somewhere and given nothing to tap.
  // Applications is a tab inside Network, so the chip carries which tab to
  // open. Without this, "Open Applications" dropped the student on Contacts.
  if (r === '/applications') return '/(tabs)/network?tab=Applications';
  if (
    ['/tracker', '/outbox', '/my-network', '/my-network/people', '/contact-directory',
     '/my-network/managers'].includes(r)
  )
    return '/(tabs)/network';
  if (['/agent', '/agent/setup', '/loops'].includes(r)) return '/loops';
  if (['/coffee-chat-prep', '/coffee-chat-library', '/meeting-prep'].includes(r)) return '/meeting-prep/new';
  if (['/pricing', '/credits', '/account-settings'].includes(r)) return '/credits';
  // The website's resume page, in every spelling Scout uses for it. The
  // mobile home is the edit screen; the chat translator below adds the
  // advice as a prefill so "Take me there" actually does the work.
  if (r === '/resume' || r.startsWith('/resume/') || r.startsWith('/resume-')) return '/resume-preview?mode=edit';
  return null;
}

/** Resume chips carry Scout's own advice into the edit screen, which runs it
 *  through "Describe your changes" and shows the result for approval (Rylan
 *  2026-09-08: "it says opening your Resume page and doesn't"). */
export function withResumePrefill(href: string, advice: string): string {
  if (!href.startsWith('/resume-preview')) return href;
  const text = (advice || '').trim().slice(0, 1500);
  if (!text) return href;
  return `${href}&prompt=${encodeURIComponent(text)}`;
}

/** Structured edits ride the deep link as JSON, so the edit screen can offer
 *  approve/skip per line instead of one blanket rewrite. A handful of short
 *  edits stays well inside any practical URL length, but capped anyway. */
export function withResumeEdits(href: string, edits: ScoutEdit[]): string {
  if (!href.startsWith('/resume-preview') || !edits.length) return href;
  const payload = JSON.stringify(edits).slice(0, 4000);
  return `${href}&edits=${encodeURIComponent(payload)}`;
}

export type ScoutChatMeta = {
  chat_id: string;
  title: string;
  last_active_at?: string;
  message_count?: number;
};

/** Saved chats (server-persisted threads, TTL by tier — free sees 1, its
 *  upgrade affordance). Backend: GET /api/scout-assistant/chats. */
export async function listScoutChats(): Promise<ScoutChatMeta[]> {
  const r = await apiFetch<any>('/api/scout-assistant/chats', {
    method: 'GET',
    query: { limit: 20 },
    timeoutMs: 15_000,
  });
  return (Array.isArray(r?.chats) ? r.chats : []).filter(
    (c: any) => typeof c?.chat_id === 'string' && c.chat_id,
  );
}

/** One saved chat's messages, oldest first, mapped to plain turns. A missing
 *  chat comes back empty rather than erroring (the server never 404s here). */
export async function getScoutChat(
  chatId: string,
): Promise<{ chatId: string; turns: ScoutTurn[] }> {
  const r = await apiFetch<any>(
    `/api/scout-assistant/chats/${encodeURIComponent(chatId)}`,
    { method: 'GET', timeoutMs: 15_000 },
  );
  const turns: ScoutTurn[] = (Array.isArray(r?.messages) ? r.messages : [])
    .map((m: any) => ({
      role: m?.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: typeof m?.content === 'string' ? m.content : '',
    }))
    .filter((t: ScoutTurn) => t.content.trim());
  return { chatId, turns };
}

export async function sendScoutMessage(args: {
  message: string;
  history: ScoutTurn[];
  currentPage?: string;
  userInfo?: ScoutUserInfo;
  chatId?: string | null;
}): Promise<ScoutReply> {
  requireAIConsent();
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
      // Structured edits (the resume tools' prefill) ride along here; the
      // resume-chip block below prefers these over the flattened prompt.
      const rawEdits = Array.isArray(b?.prefill?.edits) ? b.prefill.edits : [];
      const edits: ScoutEdit[] = rawEdits
        .filter((e: any) => e && typeof e === 'object')
        .map((e: any, i: number) => ({
          id: typeof e.id === 'string' && e.id ? e.id : `e${i}`,
          section: typeof e.section === 'string' ? e.section : '',
          current: typeof e.current === 'string' ? e.current : '',
          suggested: typeof e.suggested === 'string' ? e.suggested : '',
        }))
        .filter((e: ScoutEdit) => e.suggested);
      actions.push(edits.length ? { label, href, edits } : { label, href });
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

  // Resume chips: structured edits win (the tool already computed exactly
  // what to change, so the edit screen offers approve/skip per line);
  // otherwise fall back to the answer's own prose run through refine as one
  // blanket rewrite, same as before (Rylan 2026-09-08 / 2026-09-09).
  const sayText: string = typeof r?.message === 'string' ? r.message : typeof r?.say === 'string' ? r.say : '';
  for (const a of actions) {
    if (a.href && a.href.startsWith('/resume-preview')) {
      if (a.edits?.length) {
        a.label = "Review Scout's resume edits";
      } else {
        a.href = withResumePrefill(a.href, sayText);
        a.label = 'Apply this to my resume';
      }
    }
  }
  return {
    message: (r?.message as string) || "I didn't catch that — try asking again?",
    chatId: (r?.chat_id as string) || undefined,
    actions,
  };
}
