# Onboarding tour

Status: PLAN, approved in principle 2026-08-17. Not built. Waiting on the hand
asset from Higgsfield before implementation starts.

Owner: Rylan. Written up from his brief on 2026-08-17.

---

## The problem

Finishing onboarding drops you on the Scout tab, where a first-run overlay
greets you with three example asks and a "Say it out loud" button
(`src/app/(tabs)/index.tsx`, `showIntro` / `INTRO_SEEN_KEY`). It asks you to
pick one of three things before you know what any of them mean, and it explains
nothing about the rest of the app.

Replace it with a short guided tour that shows what the product actually does
for you.

---

## What the code already does (checked, do not re-derive)

- **You already land on Scout.** `completeOnboarding()` sets the flag, the auth
  gate in `src/app/_layout.tsx` routes to `/(tabs)`, and that resolves to
  `(tabs)/index`, which is Scout. No routing change needed to start the tour.
- **The intro overlay is the thing being replaced.** It only fires for accounts
  with no loops and no saved jobs.
- **Notifications are barely asked for.** Onboarding has a notifications step
  (`ONBOARDING_STEPS` in `src/lib/onboardingFlow.ts`), but
  `src/app/(onboarding)/index.tsx` skips it outright when Gmail is not
  connected. After that the ONLY place to enable them is the Profile → Settings
  toggle (`(tabs)/profile.tsx`), which calls `setNotificationsEnabled(true)` in
  `src/store/app.tsx`, which asks the OS and registers the Expo token. There is
  a leftover comment in `(tabs)/_layout.tsx` describing a priming modal that no
  longer exists. So a real slice of users are never asked at all.
- **Surfaces the tour describes**, verified against the screens:
  - Feed: two decks. Jobs, where a right swipe auto-applies for real and a swipe
    up saves. People, where a right swipe spends credits, finds the address and
    drafts an email.
  - Inbox: filters are Your turn / Drafts / Sent / Replied / All.
  - Network: tabs are Contacts, Applications, Meetings. The "owed" queue (an
    application that stopped on a question only the student can answer) sits at
    the top of Applications in red.
  - Profile: tabs are Personal, Resume, Apply kit, Settings. Outreach template
    lives at `/outreach-template`, attachments at `/attachments`.
  - Notifications: the header bell, `/notifications`.

---

## The tour

### Trigger

`completeOnboarding()` sets a `tourPending` flag. Scout mounts, sees it, and:

1. Puts **"How can you help me?"** into the composer, already typed.
2. Floats the hand asset over the send button, motioning a tap.
3. Tapping send starts the tour.

The old three-chip intro overlay is deleted.

### The first reply is scripted, not a model call

Tapping send drops the question into the thread and Scout's answer is our first
tour card, written by us. It does NOT hit the backend. A live call would cost a
request, take seconds, and say something different to every user on the most
important screen of their first session. Every card after this one is the real
UI.

### The seven cards

Each card dims the screen, leaves the tab bar visible, and drives its own
navigation. Skip is on every card.

1. **Scout** (on the Scout tab). What Scout is: ask for anything in plain
   English and it does the work. Find people, write the emails, apply to jobs,
   prep you for a chat. Voice of Scout, since Scout is literally answering.
2. **Feed, Jobs deck** (navigates to Feed). Swipe right and it applies for you,
   for real. Swipe up saves it for later.
3. **Feed, People deck** (flips the deck). Swipe right and it finds their email
   and writes to them.
4. **Inbox.** Every draft and every sent email lands here, plus the replies.
   "Your turn" is the pile that needs you.
5. **Network.** Contacts, Applications, Meetings. Includes the point that some
   applications ask extra questions, we ping you, and you answer once and never
   again. Meeting prep gets one line here rather than its own card.
6. **Profile → Settings.** How your emails sound and what rides along with them
   (template, attachments).
7. **Notifications.** The bell, and what we ping you about: a reply landed, an
   application needs an answer, a draft is ready. Then the real OS permission
   prompt via `setNotificationsEnabled(true)`, but only when permission is not
   already granted. Ends back on Scout with Done.

Cards 2 to 7 are in the app's voice ("Swipe right and Offerloop applies for
you"), not Scout's.

### Mechanics

- Card plus dimmed background plus a visible tab bar. No spotlight cutout on
  individual buttons: 90% of the clarity for 20% of the work.
- Navigation between cards is `router.push` on the tab routes.
- Done or Skip writes `offerloop.tour.v1` to AsyncStorage. Never fires again.
- A "Replay the tour" row in Profile → Settings. Cheap, and makes it testable
  without burning an account.
- One analytics event per card reached, plus a skip event, so we can see where
  people bail.

### Explicitly not in scope

- Rewriting the mid-onboarding notifications step.
- Spotlight cutouts around individual controls.

---

## The hand asset

Needed before implementation. Match `assets/images/swipe-hand.png`:
272 x 372, alpha, pale matte 3D right hand, index finger extended, no arm,
cut at the wrist.

The existing one was a frame lifted from a Higgsfield render whose light-grey
plate had to be unmultiplied out. The plate was around 246 grey and the hand
only about 80 levels darker, so a plain white key would have dissolved the hand.
The prompt below asks for a black background specifically to avoid repeating
that.

### Higgsfield prompt

> A single photorealistic 3D-rendered human right hand, floating, cut off
> cleanly at the wrist with no arm and no sleeve. The hand is a smooth matte
> material in a very pale off-white, almost porcelain, with soft neutral grey
> shading in the creases and no visible skin texture, freckles, hair or nails
> detail. Soft diffuse studio lighting from the upper left, gentle falloff, no
> hard specular highlights.
>
> The index finger is fully extended and pointing up and slightly to the left,
> as if about to press a button just above the fingertip. The other three
> fingers are loosely curled into the palm and the thumb rests relaxed against
> the middle finger. The palm faces away from the camera, the back of the hand
> toward the viewer, wrist entering from the bottom right of the frame at a
> gentle diagonal.
>
> Motion: the hand pushes the fingertip forward and slightly up in a single
> deliberate tap, holds for a beat, then draws back to the start. Slow, calm,
> loopable. The wrist and forearm stay still. Nothing else in the frame moves.
>
> Background: pure solid black, completely flat and empty, no gradient, no
> vignette, no floor, no cast shadow, no reflection, no props, no text. The hand
> never touches or overlaps the edge of the frame except at the wrist.
>
> Camera: locked off, static, no pan, no zoom, no parallax, no depth of field
> change.

Avoid list to paste into the negative prompt if the tool takes one:

> arm, sleeve, clothing, jewelry, watch, fingernails polish, skin pores, veins,
> two hands, other body parts, phone, screen, button, UI, text, watermark,
> logo, cast shadow, ground plane, gradient background, white background, grey
> background, motion blur, camera movement, depth of field, lens flare, bokeh

Settings:

- Portrait, 3:4 or 9:16. The frame will be cropped to about 272 x 372.
- 2 to 4 seconds is plenty. Static camera. Loop if the tool offers it.
- Deliver the mp4. A frame gets pulled and keyed the same way the existing
  asset was, or, if the tool can export with alpha, a PNG sequence or a webm
  with transparency is better still.

Why black and not the light plate: the hand is nearly white, so a black
background gives the maximum luminance separation for keying. The last render
put a pale hand on a pale plate and the key nearly ate the hand.

Save the result as `assets/images/tap-hand.png` (still, alpha, trimmed to the
hand with a few pixels of margin). The tap itself gets animated in code, the
same way `SwipeDemoHint.tsx` animates the swipe hand, so a single clean still
is all that is needed.

---

## Open decisions

1. Scripted first reply. Recommended yes, see above. Not yet confirmed.
2. Copy tone split (Scout's voice for card 1, app's voice for 2 to 7).
   Recommended, not yet confirmed.
