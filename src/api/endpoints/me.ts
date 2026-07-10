import { apiFetch } from '@/api/client';
import { USE_MOCKS } from '@/api/config';
import { MOCK_PROFILE } from '@/mocks/data';
import type { ResumeExperience } from '@/types';

/** The app-facing profile shape (what every screen reads via useApp().profile). */
export type Profile = typeof MOCK_PROFILE;

/** Raw shape returned by GET /api/mobile/me. */
type MeResponse = {
  name: string;
  email: string;
  photoUrl?: string;
  school: string;
  plan: 'Free' | 'Pro' | 'Elite';
  tier: string;
  credits: number;
  maxCredits: number;
  resetLabel: string;
  creditsPerSwipe: number;
  gmailConnected: boolean;
  gmailAddress: string;
  resume: { name: string; url?: string } | null;
  linkedinUrl: string;
  phone: string;
  preferredLocations: string[];
  targetRoles: string[];
  industries: string[];
  gradYear: string;
  about: string;
  resumeExperiences: ResumeExperience[];
  linkedinHighlights: string[];
};

/**
 * Fetch the signed-in user and map it onto the app profile shape. Residual
 * mock-only fields (loops, daily counters) are spread from the fixture so the
 * object stays type-complete; the real values for those flow through their own
 * queries. Loops here is left empty — the live loops list is its own query.
 */
export async function fetchMe(): Promise<Profile> {
  if (USE_MOCKS) return MOCK_PROFILE;

  const me = await apiFetch<MeResponse>('/api/mobile/me');

  // Genuinely-new vs established, judged on the RAW response (before the mock
  // fallbacks below). An existing user has at least a school / resume / target
  // — a brand-new account has none. Drives the new-user onboarding gate.
  const hasServerProfile = !!(
    me.school?.trim() ||
    me.resume ||
    me.targetRoles?.length ||
    me.industries?.length ||
    me.gradYear?.trim() ||
    me.linkedinUrl?.trim()
  );

  return {
    ...MOCK_PROFILE,
    hasServerProfile,
    name: me.name,
    photoUrl: me.photoUrl || '',
    school: me.school || MOCK_PROFILE.school,
    tier: me.plan,
    plan: me.plan,
    credits: me.credits,
    maxCredits: me.maxCredits,
    resetLabel: me.resetLabel,
    creditsPerSwipe: me.creditsPerSwipe || 5,
    gmailConnected: me.gmailConnected,
    gmailAddress: me.gmailAddress || '',
    // hasResume is the truth; `resume` keeps a placeholder object so the card
    // can render an empty state. Never derive "has a resume" from resume.name
    // — the placeholder is truthy (fresh accounts showed an "Attached" chip
    // and a completion ring crediting a resume they never uploaded).
    hasResume: !!me.resume,
    resume: me.resume
      ? { name: me.resume.name, updatedLabel: 'On file' }
      : { name: 'No resume yet', updatedLabel: 'Add on offerloop.ai' },
    linkedinUrl: me.linkedinUrl || '',
    phone: me.phone || '',
    preferredLocations: me.preferredLocations || [],
    targetRoles: me.targetRoles || [],
    industries: me.industries || [],
    gradYear: me.gradYear || '',
    about: me.about || '',
    resumeExperiences: me.resumeExperiences || [],
    linkedinHighlights: me.linkedinHighlights || [],
    loops: [],
  };
}
