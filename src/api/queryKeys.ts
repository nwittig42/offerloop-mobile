/**
 * Centralized React Query key factory, so queries and invalidations stay
 * consistent across the store and endpoint layers.
 */
export const qk = {
  me: ['me'] as const,
  feed: ['feed'] as const,
  jobDescription: (id: string) => ['jobDescription', id] as const,
  company: (name: string) => ['company', name] as const,
  inbox: ['inbox'] as const,
  outreach: (id: string) => ['outreach', id] as const,
  loops: ['loops'] as const,
  loop: (id: string) => ['loop', id] as const,
  loopActivity: ['loopActivity'] as const,
  loopActivityFor: (id: string) => ['loopActivity', id] as const,
  meetingPreps: ['meetingPreps'] as const,
  meetingPrep: (id: string) => ['meetingPrep', id] as const,
  contacts: ['contacts'] as const,
  notifications: ['notifications'] as const,
  emailTemplate: ['emailTemplate'] as const,
  savedEmailTemplates: ['savedEmailTemplates'] as const,
  flags: ['flags'] as const,
};
