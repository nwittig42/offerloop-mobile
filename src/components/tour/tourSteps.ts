import type { Ionicons } from '@expo/vector-icons';

/**
 * The first-run tour, in seven cards.
 *
 * Copy rules, from Rylan's brief:
 *  - Card 1 is Scout answering the question the user just sent, so it is in
 *    Scout's voice ("I can..."). Everything after is the app's voice.
 *  - Say what the product DOES for them, in the words they would use. No
 *    feature names nobody has heard yet.
 *  - Every claim here has to be true of the shipped screens. If a swipe or a
 *    tab changes meaning, this file changes with it.
 */
export type TourStep = {
  key: string;
  /** Pushed before the card appears. Undefined means stay put. */
  route?: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  /** Overrides the default "Next" label. */
  cta?: string;
};

/**
 * Scout's answer to the question the tour opened with, dropped into the thread
 * when the tour ends. Without it the conversation is left showing a question
 * nobody answered, which is a strange first artifact to leave behind.
 */
export const TOUR_CLOSER =
  "That's the tour. Whenever you want something done, tell me here and I'll take it from there.";

export const TOUR_STEPS: TourStep[] = [
  {
    key: 'scout',
    icon: 'sparkles-outline',
    title: 'Ask me for anything',
    body:
      "Tell me what you need in plain English and I do the work: find the right people at a company, write the emails, apply to jobs for you, and get you ready before a coffee chat. Everything in the app can start from this box.",
  },
  {
    key: 'feed-jobs',
    route: '/(tabs)/feed',
    icon: 'albums-outline',
    title: 'Your job feed',
    body:
      'Swipe right and Offerloop fills out the application and submits it for you. Swipe up to save one for later, swipe left to pass.',
  },
  {
    key: 'feed-people',
    route: '/(tabs)/feed?deck=people',
    icon: 'people-outline',
    title: 'Your people feed',
    body:
      "Flip to People and a right swipe finds that person's email and writes to them in your voice, with your resume attached. It lands in your Inbox for you to read before it goes.",
  },
  {
    key: 'inbox',
    route: '/(tabs)/inbox',
    icon: 'mail-outline',
    title: 'Everything you send lives here',
    body:
      'Drafts waiting on you, emails already sent, and replies as they come back. Your turn is the pile that needs you.',
  },
  {
    key: 'network',
    route: '/(tabs)/network',
    icon: 'git-network-outline',
    title: 'Your people and your applications',
    body:
      'Contacts is everyone you have found. Applications tracks every job we applied to, and when one stops to ask a question only you can answer, we ping you: answer it once and we reuse it from then on. Meetings holds your coffee chat prep.',
  },
  {
    key: 'settings',
    route: '/settings',
    icon: 'settings-outline',
    title: 'Make it sound like you',
    body:
      'Settings is where you set how your emails are written and signed, and what travels with them, like your resume.',
  },
  {
    key: 'notifications',
    route: '/(tabs)',
    icon: 'notifications-outline',
    title: "We'll tell you when it matters",
    body:
      'A reply lands, an application needs an answer, a draft is ready. Turn notifications on and you will know the moment something needs you.',
    cta: 'Turn on notifications',
  },
];
