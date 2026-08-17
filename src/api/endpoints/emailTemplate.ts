import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';

/**
 * Outreach email template, mirrors the web's Email Template page.
 *
 * The draft pipeline resolves users/{uid}.emailTemplate server-side on every
 * swipe (runs.execute_prompt_search), so saving the default here changes the
 * very next draft with no other app wiring.
 */

/** The default template that shapes every drafted email. */
export type EmailTemplateDefault = {
  /** 'networking' | 'referral' | 'follow_up' | 'custom' | null (backend default) */
  purpose: string | null;
  /**
   * How the email should SOUND, separate from what it asks for. Backend keys:
   * casual | professional | short_direct | warm_enthusiastic | bold_confident,
   * or null for no preference.
   *
   * The app used to POST this as a hardcoded null (2026-08-16), so every save
   * from the phone silently erased a style the user had picked on the website.
   */
  stylePreset: string | null;
  customInstructions: string;
  signoffPhrase: string;
  signatureBlock: string;
  name: string;
  subject: string;
  savedTemplateId: string | null;
};

/** A named reusable template (Elite feature server-side). */
export type SavedTemplate = { id: string; name: string; subject: string; body: string };

export const EMPTY_TEMPLATE: EmailTemplateDefault = {
  purpose: null,
  stylePreset: null,
  customInstructions: '',
  signoffPhrase: 'Best,',
  signatureBlock: '',
  name: '',
  subject: '',
  savedTemplateId: null,
};

export async function fetchEmailTemplate(): Promise<EmailTemplateDefault> {
  if (USE_MOCKS) return EMPTY_TEMPLATE;
  const r = await apiFetch<Partial<EmailTemplateDefault>>('/api/email-template');
  return {
    purpose: r.purpose ?? null,
    stylePreset: r.stylePreset ?? null,
    customInstructions: r.customInstructions || '',
    signoffPhrase: (r.signoffPhrase || '').trim() || 'Best,',
    signatureBlock: r.signatureBlock || '',
    name: r.name || '',
    subject: r.subject || '',
    savedTemplateId: r.savedTemplateId ?? null,
  };
}

/** Save the default template (all tiers). POST /api/email-template. */
export async function saveEmailTemplate(t: EmailTemplateDefault): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch('/api/email-template', {
    method: 'POST',
    body: {
      purpose: t.purpose,
      stylePreset: t.stylePreset,
      customInstructions: t.customInstructions,
      signoffPhrase: t.signoffPhrase,
      signatureBlock: t.signatureBlock,
      name: t.name,
      subject: t.subject,
      savedTemplateId: t.savedTemplateId,
    },
  });
}

/** List saved custom templates. Elite-gated server-side (403 otherwise), so
 *  callers should only fetch when the profile says Elite. */
export async function fetchSavedTemplates(): Promise<SavedTemplate[]> {
  if (USE_MOCKS) return [];
  const r = await apiFetch<{ templates?: Partial<SavedTemplate>[] }>('/api/email-template/saved');
  return (r.templates || []).map((t) => ({
    id: String(t.id),
    name: t.name || '',
    subject: t.subject || '',
    body: t.body || '',
  }));
}

/** Create (no id) or update (with id) a saved custom template. Elite-gated. */
export async function createSavedTemplate(t: {
  id?: string;
  name: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  if (USE_MOCKS) return { id: t.id || 'mock-template' };
  return apiFetch<{ id: string }>('/api/email-template/saved', { method: 'POST', body: t });
}

export async function deleteSavedTemplate(id: string): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch(`/api/email-template/saved/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
