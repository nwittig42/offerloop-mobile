import type {
  CompanyInfo,
  Job,
  LoopActivity,
  MeetingPrep,
  NotificationItem,
  OutreachItem,
  ProfileFile,
  ResumeExperience,
  ScoutChat,
  TrackerRow,
} from '@/types';

export const FIXTURE_QUALS = [
  'Currently pursuing a Bachelor’s degree (fixture requirement).',
  'Strong written and verbal communication.',
  'Comfortable with Excel and building simple models.',
  'Self-directed, organized, and detail-oriented.',
];

/**
 * Fixture company profiles, keyed by company name, powering the company
 * page (Overview tab). Clearly fake, like the rest of the mock data. Real
 * company enrichment wires in Phase 3.
 */
export const MOCK_COMPANY_INFO: Record<string, CompanyInfo> = {
  'Sample Bank & Trust': {
    about:
      'Fixture profile. Sample Bank & Trust is a clearly fake bulge-bracket bank used to exercise the company page. It runs coverage and markets groups and recruits heavily from target schools.',
    industry: 'Investment Banking',
    size: 'Large Company',
    hq: 'New York, NY',
    news: [
      { source: 'fixturewire', timeLabel: '3d ago', headline: 'Sample Bank & Trust advises on a fixture merger' },
      { source: 'mockstreet', timeLabel: '2w ago', headline: 'Sample Bank & Trust expands its summer analyst class' },
    ],
  },
  'Acme Test Co': {
    about:
      'Fixture profile. Acme Test Co is a clearly fake strategy consulting firm. Case teams work on growth, diligence, and market sizing for fixture clients.',
    industry: 'Management Consulting',
    size: 'Mid-size',
    hq: 'Chicago, IL',
    news: [
      { source: 'consultfixture', timeLabel: '5d ago', headline: 'Acme Test Co opens a fixture office in Austin' },
    ],
  },
  'Mock Metrics Inc': {
    about:
      'Fixture profile. Mock Metrics Inc is a clearly fake analytics startup building fixture data products. Small, fast, product-led.',
    industry: 'Technology',
    size: 'Startup',
    hq: 'San Francisco, CA',
    news: [
      { source: 'technews', timeLabel: '1w ago', headline: 'Mock Metrics Inc raises a fixture Series B' },
    ],
  },
  'Fixture Financial Group': {
    about:
      'Fixture profile. Fixture Financial Group is a clearly fake equity research and asset management shop covering fixture sectors.',
    industry: 'Asset Management',
    size: 'Mid-size',
    hq: 'Boston, MA',
    news: [],
  },
  'Demo Dynamics LLC': {
    about:
      'Fixture profile. Demo Dynamics LLC is a clearly fake software company. Engineers ship across the stack with fixture mentorship.',
    industry: 'Technology',
    size: 'Large Company',
    hq: 'Seattle, WA',
    news: [
      { source: 'devfixture', timeLabel: '4d ago', headline: 'Demo Dynamics LLC launches a fixture platform update' },
    ],
  },
  'Placeholder Partners': {
    about:
      'Fixture profile. Placeholder Partners is a clearly fake investment fund running fixture corporate development and acquisitions.',
    industry: 'Private Equity',
    size: 'Boutique',
    hq: 'Los Angeles, CA',
    news: [],
  },
};

/** Suggested target roles, shown in Personal and filtered by what they type. */
export const TARGET_ROLE_SUGGESTIONS = [
  'Investment Banking Analyst',
  'Management Consultant',
  'Private Equity Analyst',
  'Equity Research Associate',
  'Product Manager',
  'Software Engineer',
  'Sales & Trading Analyst',
  'Corporate Development Analyst',
  'Venture Capital Analyst',
  'Data Analyst',
];

export const INDUSTRY_SUGGESTIONS = [
  'Investment Banking',
  'Management Consulting',
  'Private Equity',
  'Venture Capital',
  'Technology',
  'Asset Management',
  'Hedge Funds',
  'Real Estate',
  'Healthcare',
  'Consumer & Retail',
];

/** Parsed out of the connected LinkedIn, the "here is what we gathered" view. */
export const MOCK_LINKEDIN_HIGHLIGHTS = [
  'Headline: Finance student, investment club treasurer, recruiting for banking (fixture).',
  '500+ connections, active in fixture finance and consulting groups.',
  'Recent post: reflections on a fixture spring-week experience.',
  'Endorsed for financial modeling, Excel, and valuation (fixture).',
];

export const MOCK_SCOUT_CHATS: ScoutChat[] = [
  { id: 'chat-1', title: 'Coffee chat questions for banking', timeLabel: '2h ago' },
  { id: 'chat-2', title: 'Which jobs fit my resume', timeLabel: 'Yesterday' },
  { id: 'chat-3', title: 'How to follow up after no reply', timeLabel: 'Mon' },
];

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
    compensation: '$110k',
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
    compensation: '$95k',
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
    compensation: '$8k / mo',
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
      'Fixture description for an equity research seat at a clearly fake shop. Cover a sector, maintain models, and publish notes. This card intentionally has no compensation field, to prove the row only renders when data exists.',
  },
  {
    id: 'job-5',
    title: 'Software Engineering Intern',
    company: 'Demo Dynamics LLC',
    location: 'Seattle, WA',
    compensation: '$9k / mo',
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
    compensation: '$100k',
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
      relation: 'Hiring manager',
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
      relation: 'Employee',
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
      relation: 'Hiring manager',
    },
    subject: 'PM intern role, quick intro',
    snippet: 'Draft is ready for your review (mock)',
    timeLabel: '3h ago',
    body: 'Hi Pat,\n\nFixture draft body, ready for review. Edit me to test the editor.\n\nBest,\nSample Student',
  },
  {
    id: 'out-4',
    jobTitle: 'Software Engineering Intern',
    company: 'Demo Dynamics LLC',
    status: 'replied',
    contact: {
      name: 'Jordan Fixture',
      title: 'Engineering Manager',
      company: 'Demo Dynamics LLC',
      relation: 'Hiring manager',
    },
    subject: 'Loved chatting about the team',
    snippet: 'Great chatting, let me know if you have questions',
    timeLabel: '1w ago',
    body: 'Hi Jordan,\n\nFixture outreach body.\n\nBest,\nSample Student',
    thread: [
      {
        from: 'me',
        text: 'Hi Jordan, fixture note asking for a quick coffee chat about the eng team.',
        timeLabel: '2w',
      },
      { from: 'them', text: 'Great chatting, let me know if you have questions.', timeLabel: '1w ago' },
    ],
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
    outreachId: 'out-1',
    preview: 'Happy to chat. Does Thursday afternoon work?',
    timeShort: '2h',
    unread: true,
    bucket: 'attention',
    statusLabel: 'Replied',
    statusTone: 'positive',
  },
  {
    id: 't-2',
    contactName: 'Sam Sample',
    company: 'Fixture Financial Group',
    lastActivity: 'Sent 1d ago',
    outreachId: 'out-2',
    preview: 'You: Wanted to introduce myself before applying',
    timeShort: '1d',
    unread: false,
    bucket: 'active',
    statusLabel: 'Waiting',
    statusTone: 'waiting',
  },
  {
    id: 't-3',
    contactName: 'Jordan Fixture',
    company: 'Demo Dynamics LLC',
    lastActivity: 'Coffee chat done last week',
    outreachId: 'out-4',
    preview: 'Great chatting, let me know if you have questions',
    timeShort: '1w',
    unread: false,
    bucket: 'done',
    statusLabel: 'Done',
    statusTone: 'accent',
  },
];

/** Parsed out of the uploaded resume, the "here is what we gathered" view. */
export const MOCK_RESUME_EXPERIENCES: ResumeExperience[] = [
  {
    id: 'exp-1',
    role: 'Finance Intern',
    org: 'Sample Capital Partners',
    dates: 'Jun 2025 - Aug 2025',
    location: 'New York, NY',
    bullets: [
      'Built three-statement models for two fixture transactions and pressure-tested assumptions with the deal team.',
      'Drafted investment memos and sat in on management presentations.',
    ],
  },
  {
    id: 'exp-2',
    role: 'Treasurer',
    org: 'Sample University Investment Club',
    dates: 'Sep 2024 - Present',
    location: 'Sample City, CA',
    bullets: [
      'Manage a fixture student-run portfolio and present quarterly performance to 40 members.',
      'Ran the recruiting prep series that placed members into banking and consulting roles.',
    ],
  },
  {
    id: 'exp-3',
    role: 'Data Analyst Intern',
    org: 'Demo Dynamics LLC',
    dates: 'Jun 2024 - Aug 2024',
    location: 'Remote',
    bullets: [
      'Cleaned and analyzed a fixture dataset, surfacing trends that shaped a product decision.',
    ],
  },
];

export const MOCK_FILES: ProfileFile[] = [
  { id: 'file-1', name: 'Sample_Resume.pdf', kind: 'resume', updatedLabel: 'Updated May 2026 (mock)' },
  { id: 'file-2', name: 'Transcript_Spring26.pdf', kind: 'transcript', updatedLabel: 'Added May 2026 (mock)' },
];

export const MOCK_LOOP_ACTIVITY: LoopActivity[] = [
  { id: 'la-1', kind: 'draft', text: 'Drafted outreach to Alex Fixture at Acme Test Co', timeLabel: 'Today, 8:02 AM' },
  { id: 'la-2', kind: 'draft', text: 'Drafted outreach to Riley Mockwell at Acme Test Co', timeLabel: 'Today, 8:01 AM' },
  { id: 'la-3', kind: 'run', text: 'Loop ran and found 2 new contacts', timeLabel: 'Today, 8:00 AM' },
  { id: 'la-4', kind: 'reply', text: 'Casey Specimen replied to a Loop draft', timeLabel: 'Yesterday' },
  { id: 'la-5', kind: 'sent', text: 'You sent 3 Loop drafts', timeLabel: 'Mon' },
];

export const MOCK_MEETING_PREPS: MeetingPrep[] = [
  {
    id: 'prep-1',
    name: 'Taylor Test',
    title: 'Engagement Manager',
    company: 'Acme Test Co',
    linkedinUrl: 'https://linkedin.com/in/example',
    summary:
      'Fixture brief: Taylor leads fixture engagements in the consumer practice, came up through a fixture banking program, and mentors fixture analysts. This preview shows the shape of a real prep.',
    talkingPoints: [
      'Ask how the fixture consumer practice has changed since they joined.',
      'They mentor analysts, so ask what separates the ones who get return offers.',
      'Shared USC connection is worth opening on.',
    ],
    createdLabel: 'Prepped 2d ago',
  },
];

export const MOCK_PROFILE = {
  // Whether the SERVER profile (not this fixture) has real onboarding data —
  // used to decide if a signed-in user is genuinely new. Defaults false so the
  // loading/offline state never claims an established profile.
  // This is the loading / server-unreachable fallback (shown behind the honest
  // "Sample data" chip), so identity fields are EMPTY rather than fake names.
  hasServerProfile: false,
  name: '',
  photoUrl: '',
  school: '',
  tier: '',
  plan: 'Free' as 'Free' | 'Pro' | 'Elite',
  credits: 0,
  maxCredits: 500,
  resetLabel: '',
  dailyDraftsUsed: 0,
  dailyDraftCap: 10,
  creditsPerSwipe: 10,
  gmailConnected: false,
  gmailAddress: '',
  hasResume: false,
  resume: { name: '', updatedLabel: '', url: '' as string | undefined },
  linkedinUrl: '',
  phone: '',
  preferredLocations: [] as string[],
  targetRoles: [] as string[],
  industries: [] as string[],
  gradYear: '',
  about: '',
  resumeExperiences: [] as ResumeExperience[],
  linkedinHighlights: [] as string[],
  loops: [] as {
    id: string;
    brief: string;
    status: 'Active' | 'Paused';
    contactsFound: number;
    draftsCreated: number;
    weeklyTarget: number;
    weeklyDone: number;
  }[],
};
