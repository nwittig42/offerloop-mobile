# Privacy policy addendum: AI processing (for Nick, paste-ready)

Apple rejected build 15 under guidelines 5.1.1(i) and 5.1.2(i): the privacy
policy at offerloop.ai/privacy must state what data the app collects, how, all
uses, and name the AI processing specifically. The app now shows an in-app
disclosure and consent screen naming the same providers, so the policy and the
app must match. Please add the section below to the privacy policy (web repo,
deploys from main). Wording is deliberate: AI providers are named (Apple wants
that and it costs nothing competitively), data-enrichment vendors are
described as a category only (deliberate, do not name them).

## Section to add: How Offerloop uses AI

Offerloop's core features are powered by artificial intelligence. When you use
these features, some of your information is processed by our AI service
providers on our behalf:

- What is shared: the text of your resume, your profile details (school,
  graduation year, target roles, locations, and your About section), the jobs
  and contacts you choose to act on, and the messages you type or speak to
  Scout, our assistant.
- Who processes it: OpenAI, Anthropic, and Perplexity, acting as data
  processors for Offerloop. Your data reaches them only through Offerloop's
  servers when you use an AI feature. We do not send them your account
  credentials, and we do not permit them to use your data to train their
  models under our agreements with them.
- What it powers: drafting your outreach emails, parsing your resume into
  your profile, answering your questions through Scout, preparing meeting
  briefs, and completing applications you ask us to auto-apply to.
- Your choice: the iOS app asks for your permission before any of this data
  is shared, and you can change your choice at any time in Profile, then
  Settings, then AI and your data. If you decline, AI features are disabled
  and no personal data is sent to AI providers.

To find professional contact information for your outreach, we also use
licensed professional data providers. These providers supply publicly
available and licensed business contact data; they receive the search you run
(for example a company name and role) but do not receive your resume or
profile.

We never sell your personal information. All service providers listed or
described above are bound by agreements requiring protections equivalent to
this policy.

## Checklist for Nick

1. Paste the section into offerloop.ai/privacy (deploys from web repo main).
2. Bump the policy's "last updated" date.
3. Sanity-check the model-training claim above against our actual API terms
   (OpenAI and Anthropic API data is not used for training by default;
   Perplexity's API terms should be confirmed). Soften that sentence if any
   provider differs.
4. Reply here when live; the App Store resubmission references this page.
