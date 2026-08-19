# Stash: onboarding Gmail step after Google sign-in ships (post build 19)

Rylan, 2026-08-11 (night of the build-19 submission). Do NOT implement until
build 19 is released and the OTA runtime locks are updated.

## The question

Once users can sign in with Google: do we still ask them to connect Gmail in
onboarding? And is that the moment to steer .edu users onto their school email?

## The answer (agreed direction)

KEEP the connect step, always. Signing in with Google grants identity only;
the Gmail connect grants the mail scopes the product runs on (drafts, send,
reply tracking). Removing it would kill the core loop. But the step should
adapt to how they signed in:

1. Signed in with Google, address is a school account (ends .edu or the
   domain is a school workspace): the step becomes one tap. "Connect the
   inbox you just signed in with." Preselect that account.

2. Signed in with Google, PERSONAL gmail.com out of habit: this is the .edu
   opportunity. Offer both paths, school first:
   - Primary: connect your school email instead
   - Secondary: connect the Gmail you signed in with

3. Signed in with email/password or magic link: current step unchanged.

The connected Gmail is stored separately from the sign-in email
(profile.gmailAddress vs account email), so "sign in personal, send from
school" already works with zero backend changes.

## Stashed wording (no invented numbers, per the no-fake-data rule)

Step title when personal gmail detected:
  "Send from your school email"

Body:
  "You signed in with your personal Gmail, which works fine. But recruiters
  take a message from a school address more seriously, it says current
  student before they read a word. If your school email runs on Gmail
  (most do), connect that one instead. It takes the same one tap."

Buttons:
  [Connect my school email]   (primary)
  [Use this Gmail instead]    (quiet secondary, connects the sign-in account)

Toast after school connect:
  "Nice. Your outreach now comes from your school address."

## Notes

- Never claim a reply-rate number we have not measured. The pitch stays
  qualitative until we have real data from our own sends.
- If the school runs Outlook (connect fails or they say so), fall back to
  the sign-in Gmail gracefully, no dead end.
- Detection: sign-in email domain != .edu and == gmail.com triggers the
  nudge. A .edu sign-in skips the pitch and preselects itself (case 1).
