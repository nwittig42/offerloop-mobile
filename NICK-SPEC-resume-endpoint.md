# Resume-builder endpoint for mobile (for Nick, with Sid cc'd)

Context: auto-apply needs a resume, and most mobile users do not have a
file on their phone. The app now routes users by what they have: upload
(has a file), BUILD FROM LINKEDIN (has a profile, the big unlock), or a
guided flow later. The website already has a resume-creation engine;
mobile needs it behind one authenticated endpoint. Rylan says you have
the most recent version of that endpoint, so this doc is two things:
what mobile needs, and questions where you should correct us.

## What mobile needs (proposed contract)

POST /api/mobile/resume/generate
- Auth: Firebase bearer token, same as every /api/mobile route.
- Input: none required. The engine reads the caller's profile
  (LinkedIn-enriched fields, experiences, school, about). Optional body
  { "tone": "default" } reserved for later.
- Behavior: renders the user's profile into a resume using the website
  engine. Asynchronous is fine if generation is slow: return
  { "jobId": "..." } and add GET /api/mobile/resume/generate/<jobId>.
- Output (done): {
    "resumeUrl": "<pdf url>",        // storage URL, same bucket as uploads
    "previewUrl": "<png/jpg url>",   // first-page image for the approve UI
    "sections": [ { "title": "...", "bullets": ["..."] } ]  // for display
  }
- IMPORTANT: generation must NOT overwrite the user's stored resume.
  The app shows a preview and the user explicitly approves; only then do
  we persist it as their resume. Proposed: POST /api/mobile/resume/adopt
  { "resumeUrl": ... } marks it as the active resume (same effect as an
  upload through /api/parse-resume, including hasResume flipping true).
- Errors: 422 with { "error": "profile_too_thin", "missing": ["experiences"] }
  when the profile lacks enough for a non-empty resume; the app routes the
  user to fill the gaps. 402/429 if you need to gate cost.

## Questions for you

1. Does the website engine already have this shape, and what is the real
   route? If it differs, send the actual contract and mobile adapts.
2. Is generation profile-driven or does the web version take form input?
   If form-driven, can it fall back to profile fields?
3. Any cost per generation we should surface honestly in the UI?
4. Does it produce a preview image today, or only a PDF? (Mobile can
   render page 1 client-side if not, just tell us.)
5. Deploy target: staging/mobile-field branch first, same as everything
   else; both Render services pick it up.

## Quality bar (product decision, firm)

A generated resume is never used silently. The user sees the preview and
taps "Use this resume" before auto-apply or anything else touches it.
Nothing invented: the engine must only use real profile data, and thin
profiles get the honest 422 rather than padded fiction.

Reply with corrections or "contract is fine" and Session A wires the app
side the same day.
