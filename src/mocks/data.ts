import type { Job, NotificationItem, OutreachItem, TrackerRow } from '@/types';

/**
 * Phase 1 mock fixtures. Everything here is OBVIOUSLY fake by design
 * (Acme Test Co, Taylor Test). Real data arrives in Phase 3 wiring.
 */

export const MOCK_JOBS: Job[] = [
  {
    id: 'job-1',
    title: 'Investment Banking Summer Analyst',
    company: 'Sample Bank & Trust',
    location: 'New York, NY',
    workArrangement: 'In office',
    experienceLevel: 'Internship',
    education: "Bachelor's",
    description:
      'Fixture description for a banking analyst role at a clearly fake bank. Support live deal teams across coverage groups, build models, and prepare client materials. This text exists to test card layout, truncation, and the expanded detail view.',
  },
  {
    id: 'job-2',
    title: 'Strategy Consultant, Entry Level',
    company: 'Acme Test Co',
    location: 'Chicago, IL',
    workArrangement: 'Hybrid',
    experienceLevel: 'Entry Level',
    education: "Bachelor's",
    description:
      'Fixture description for a consulting role at a clearly fake firm. Work with case teams on market sizing, diligence, and growth strategy questions. Placeholder copy to exercise line height and spacing on the swipe card.',
  },
  {
    id: 'job-3',
    title: 'Product Management Intern',
    company: 'Mock Metrics Inc',
    location: 'San Francisco, CA',
    workArrangement: 'Remote',
    experienceLevel: 'Internship',
    description:
      'Fixture description for a PM internship at a clearly fake startup. Partner with engineering and design to ship experiments. Note this card intentionally has no education field, to prove chips only render when data exists.',
  },
  {
    id: 'job-4',
    title: 'Equity Research Associate',
    company: 'Fixture Financial Group',
    location: 'Boston, MA',
    workArrangement: 'In office',
    experienceLevel: 'Entry Level',
    education: "Bachelor's",
    description:
      'Fixture description for an equity research seat at a clearly fake shop. Cover a sector, maintain models, and publish notes. Placeholder copy for layout testing only.',
  },
  {
    id: 'job-5',
    title: 'Software Engineering Intern',
    company: 'Demo Dynamics LLC',
    location: 'Seattle, WA',
    workArrangement: 'Hybrid',
    experienceLevel: 'Internship',
    education: "Bachelor's",
    description:
      'Fixture description for a SWE internship at a clearly fake company. Build features across the stack with a mentor. Placeholder copy to test the deck with a fifth card.',
  },
  {
    id: 'job-6',
    title: 'Corporate Development Analyst',
    company: 'Placeholder Partners',
    location: 'Los Angeles, CA',
    workArrangement: 'In office',
    experienceLevel: 'Entry Level',
    description:
      'Fixture description for a corp dev role at a clearly fake fund. Evaluate acquisition targets and support integrations. Placeholder copy, sixth card in the mock deck.',
  },
];

export const MOCK_OUTREACH_SEED: OutreachItem[] = [
  {
    id: 'out-1',
    jobTitle: 'Consulting Summer Associate',
    company: 'Acme Test Co',
    status: 'replied',
    contact: {
      name: 'Taylor Test',
      title: 'Engagement Manager',
      company: 'Acme Test Co',
      linkedinUrl: 'https://linkedin.com/in/example',
    },
    subject: 'USC student interested in Acme Test Co',
    snippet: 'Happy to chat. Does Thursday afternoon work?',
    timeLabel: '2h ago',
    body: 'Hi Taylor,\n\nFixture email body. This placeholder exists to test the draft editor layout.\n\nBest,\nSample Student',
    thread: [
      {
        from: 'me',
        text: 'Hi Taylor, fixture outreach message asking for a quick coffee chat about consulting at a clearly fake firm.',
        timeLabel: 'Mon',
      },
      {
        from: 'them',
        text: 'Happy to chat. Does Thursday afternoon work?',
        timeLabel: '2h ago',
      },
    ],
  },
  {
    id: 'out-2',
    jobTitle: 'Investment Banking Analyst',
    company: 'Fixture Financial Group',
    status: 'sent',
    contact: {
      name: 'Sam Sample',
      title: 'Vice President',
      company: 'Fixture Financial Group',
    },
    subject: 'Quick question about your team',
    snippet: 'Sent from your connected Gmail (mock)',
    timeLabel: '1d ago',
    body: 'Hi Sam,\n\nFixture email body for a sent item.\n\nBest,\nSample Student',
  },
  {
    id: 'out-3',
    jobTitle: 'Product Management Intern',
    company: 'Mock Metrics Inc',
    status: 'ready',
    contact: {
      name: 'Pat Placeholder',
      title: 'Senior Product Manager',
      company: 'Mock Metrics Inc',
    },
    subject: 'PM intern role, quick intro',
    snippet: 'Draft is ready for your review (mock)',
    timeLabel: '3h ago',
    body: 'Hi Pat,\n\nFixture draft body, ready for review. Edit me to test the editor.\n\nBest,\nSample Student',
  },
];

export const MOCK_NOTIFICATIONS_SEED: NotificationItem[] = [
  {
    id: 'n-1',
    kind: 'reply',
    text: 'Taylor Test at Acme Test Co replied to your outreach',
    timeLabel: '2h ago',
    read: false,
    outreachId: 'out-1',
  },
  {
    id: 'n-2',
    kind: 'draft_ready',
    text: 'Your outreach to Pat Placeholder at Mock Metrics Inc is ready to review',
    timeLabel: '3h ago',
    read: false,
    outreachId: 'out-3',
  },
  {
    id: 'n-3',
    kind: 'loop',
    text: 'Mock Loop update: 2 drafts queued this week (fixture)',
    timeLabel: '1d ago',
    read: true,
  },
];

export const MOCK_TRACKER_ROWS: TrackerRow[] = [
  {
    id: 't-1',
    contactName: 'Taylor Test',
    company: 'Acme Test Co',
    lastActivity: 'Replied 2h ago',
    bucket: 'attention',
    statusLabel: 'Replied',
    statusTone: 'positive',
  },
  {
    id: 't-2',
    contactName: 'Sam Sample',
    company: 'Fixture Financial Group',
    lastActivity: 'Sent 1d ago',
    bucket: 'active',
    statusLabel: 'Waiting',
    statusTone: 'waiting',
  },
  {
    id: 't-3',
    contactName: 'Jordan Fixture',
    company: 'Demo Dynamics LLC',
    lastActivity: 'Coffee chat done last week',
    bucket: 'done',
    statusLabel: 'Done',
    statusTone: 'accent',
  },
];

export const MOCK_PROFILE = {
  name: 'Sample Student',
  school: 'Sample University',
  tier: 'Pro (mock)',
  credits: 480,
  maxCredits: 3000,
  resetLabel: 'Resets July 1 (mock)',
  dailyDraftsUsed: 2,
  dailyDraftCap: 10,
  creditsPerSwipe: 10,
  gmailConnected: true,
  gmailAddress: 'sample.student@gmail.com',
  resume: { name: 'Sample_Resume.pdf', updatedLabel: 'Updated May 2026 (mock)' },
  targetRole: 'Investment Banking Analyst',
  industries: 'Banking, Consulting',
  gradYear: '2027',
  loops: [
    {
      id: 'loop-1',
      brief: 'Find 5 consultants at Acme Test Co a week (mock)',
      status: 'Active' as const,
      contactsFound: 12,
      draftsCreated: 8,
    },
  ],
};
