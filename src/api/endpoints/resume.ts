import * as DocumentPicker from 'expo-document-picker';

import { apiFetch } from '@/api/client';
import { hasAIConsent, promptAIConsent } from '@/lib/aiConsent';

/**
 * Resume upload.
 *
 * The backend endpoint (/api/parse-resume) already did all the work — it takes a
 * multipart field named `resume`, stores the file in Firebase Storage under
 * resumes/{uid}/, extracts the text, and persists resumeUrl + the parsed profile
 * on the user doc. The app simply never called it: the resume card was read-only
 * and told people to go do it on the website.
 *
 * Auth subtlety worth knowing: that endpoint is deliberately UNauthenticated,
 * because web onboarding parses a resume before the user has an account. It only
 * associates the file with a user when a Bearer token is present — apiFetch
 * attaches ours, so our uploads persist. (It also has a per-IP rate limit as an
 * abuse backstop, since parsing costs an LLM call.)
 */

export type ResumeUploadResult = {
  savedToFirebase?: boolean;
  resumeUrl?: string;
  resumeFileName?: string;
  /** The parsed resume fields. Present even when the call is unauthenticated,
   *  which is what lets pre-account intake show someone what we read off their
   *  resume before they have signed up. Shape is the backend's parsed_info. */
  data?: ResumeParsed | null;
};

/** The subset of the backend's parsed_info the app actually reads. Everything
 *  is optional: a thin resume parses to a mostly empty object, and the intake
 *  screens are built to handle that rather than assume a full profile. */
export type ResumeParsed = {
  name?: string;
  email?: string;
  school?: string;
  university?: string;
  major?: string;
  graduationYear?: string | number;
  currentTitle?: string;
  jobTitle?: string;
  skills?: string[];
  [key: string]: unknown;
};

export type PickedResume = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

// Mirrors what storage.rules actually permits — PDF/DOC/DOCX, 10MB hard cap.
// Checking here means an oversized file fails instantly with a clear message
// instead of burning an upload and getting rejected by the storage rule.
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 10 * 1024 * 1024;

/** Open the system picker (Files / iCloud / Drive). null when the user cancels. */
export async function pickResume(): Promise<PickedResume | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_TYPES,
    copyToCacheDirectory: true, // gives us a readable file:// uri to upload
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size };
}

/** Upload + parse. Resolves once the file is stored and the profile is updated. */
export async function uploadResume(file: PickedResume): Promise<ResumeUploadResult> {
  // AI consent gate (5.1.2(i)): parsing runs the resume through an AI
  // provider. Every upload surface funnels through here, so this one check
  // covers them all; the disclosure opens and the caller's catch shows its
  // normal failure state.
  if (!hasAIConsent()) {
    promptAIConsent();
    throw new Error('Resume parsing uses AI. Allow AI features to continue.');
  }
  if (file.size && file.size > MAX_BYTES) {
    throw new Error('That file is over 10MB — try a smaller PDF.');
  }

  const form = new FormData();
  // RN's FormData wants {uri, name, type} for a file part.
  form.append('resume', {
    uri: file.uri,
    name: file.name || 'resume.pdf',
    type: file.mimeType || 'application/pdf',
  } as unknown as Blob);

  // Server-side parsing runs text extraction + an LLM pass, so give it room —
  // but bounded, because fetch has no default timeout on iOS release builds.
  return apiFetch<ResumeUploadResult>('/api/parse-resume', {
    method: 'POST',
    body: form as unknown as Record<string, unknown>,
    timeoutMs: 60_000,
  });
}

/** Remove the resume on file (deletes the stored file + the parsed data). */
export async function deleteResume(): Promise<void> {
  await apiFetch('/api/resume', { method: 'DELETE', timeoutMs: 20_000 });
}
