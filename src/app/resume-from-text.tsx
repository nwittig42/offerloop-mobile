import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  downloadResumePdfBase64,
  finalizeResume,
  generateResumeFromPrompt,
  refineResume,
  type CanonicalResume,
} from '@/api/endpoints/resumeBuilder';
import { qk } from '@/api/queryKeys';
import { AIConsentRequiredError } from '@/lib/aiConsent';
import { track } from '@/lib/analytics';
import PdfView from '@/components/resume/PdfView';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Build a resume from scratch: the door for someone with no resume file and no
 * usable LinkedIn.
 *
 * Structure note (2026-08-13): this was ONE free-text box, which is not what
 * the website does and produced worse drafts. It now mirrors the web builder's
 * guided form (connect-grow-hire/src/components/resume/ResumeEditorTab.tsx):
 * the same five labeled sections, composed into the same prompt shape
 * ("EDUCATION:\n...\n\nWORK EXPERIENCE:\n..."), so both surfaces feed the
 * generator identically. Labeled inputs beat one empty box: people freeze in
 * front of a blank page and forget half their experience.
 *
 * Same rule as every generated resume: previewed and approved before anything
 * uses it. Nothing is saved until Use this resume.
 */

const SECTIONS = [
  {
    key: 'education',
    label: 'Education',
    placeholder: 'USC, Business Administration, Class of 2027. Add your GPA if you want it shown.',
  },
  {
    key: 'experience',
    label: 'Work experience',
    placeholder: "Sales associate at Men's Wearhouse, summer 2024. List each job, even part time.",
  },
  {
    key: 'projects',
    label: 'Projects',
    placeholder: 'Case competitions, class projects, a personal site.',
  },
  {
    key: 'leadership',
    label: 'Leadership and activities',
    placeholder: 'Clubs, teams, volunteering.',
  },
  {
    key: 'skills',
    label: 'Skills and interests',
    placeholder: 'Excel, SQL, Spanish, Figma. Interests are welcome too.',
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * How complete the draft is, measured off what is actually in it. Not a
 * quality judgement and not invented: every point comes from a section that
 * either has content or does not, so the number and the "what is missing" line
 * always agree with the document on screen.
 *
 * (The backend has a real quality score too, POST /api/resume/score, an LLM
 * pass against the Harvard rubric. That one needs an account and costs a call,
 * so it belongs in the app after signup, not here.)
 */
const COMPLETENESS = [
  { points: 10, label: 'your name', has: (r: CanonicalResume) => !!(r.contact as any)?.name },
  { points: 10, label: 'an email', has: (r: CanonicalResume) => !!(r.contact as any)?.email },
  { points: 20, label: 'education', has: (r: CanonicalResume) => !!r.education?.length },
  { points: 25, label: 'work experience', has: (r: CanonicalResume) => !!r.experience?.length },
  {
    points: 10,
    label: 'more detail under your experience',
    has: (r: CanonicalResume) =>
      (r.experience ?? []).reduce((n, e) => n + (e.bullets?.length ?? 0), 0) >= 3,
  },
  {
    points: 15,
    label: 'projects or leadership',
    has: (r: CanonicalResume) => !!(r.projects?.length || r.leadership?.length),
  },
  { points: 10, label: 'skills', has: (r: CanonicalResume) => !!r.skills?.length },
];

function completeness(resume: CanonicalResume): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];
  for (const c of COMPLETENESS) {
    if (c.has(resume)) score += c.points;
    else missing.push(c.label);
  }
  return { score, missing };
}

const EMPTY: Record<SectionKey, string> = {
  education: '',
  experience: '',
  projects: '',
  leadership: '',
  skills: '',
};

export default function ResumeFromTextScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useApp();

  const [fields, setFields] = useState<Record<SectionKey, string>>(EMPTY);
  const [state, setState] = useState<
    | { phase: 'input' }
    | { phase: 'loading' }
    | { phase: 'ready'; resume: CanonicalResume }
    | { phase: 'limit' }
    | { phase: 'error'; message: string }
  >({ phase: 'input' });
  const [adopting, setAdopting] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [edit, setEdit] = useState('');
  const [refining, setRefining] = useState(false);

  const anyFilled = Object.values(fields).some((v) => v.trim());

  /** Exactly the web builder's composePrompt: only filled sections, upper-cased
   *  label, blank line between. The generator is tuned against this shape. */
  const composePrompt = () =>
    SECTIONS.filter((s) => fields[s.key].trim())
      .map((s) => `${s.label.toUpperCase()}:\n${fields[s.key].trim()}`)
      .join('\n\n');

  const generate = async () => {
    if (!anyFilled) {
      showToast('Fill in at least one section, whichever you have.');
      return;
    }
    setPdf(null);
    setState({ phase: 'loading' });
    let r;
    try {
      r = await generateResumeFromPrompt(composePrompt());
    } catch (e) {
      // Not consented yet: requireAIConsent already opened the disclosure, so
      // drop quietly back to the form rather than spinning forever behind it.
      // Their typed answers are untouched and Build works after they allow.
      if (e instanceof AIConsentRequiredError) {
        setState({ phase: 'input' });
        return;
      }
      setState({ phase: 'error', message: 'Could not build the resume right now.' });
      return;
    }
    if (r.status === 'ok') setState({ phase: 'ready', resume: r.resume });
    else if (r.status === 'limit') setState({ phase: 'limit' });
    else
      setState({
        phase: 'error',
        message: r.status === 'error' ? r.message : 'Something went wrong.',
      });
  };

  /** Keep the on-screen PDF in step with the draft. The document IS the review
   *  surface now, so it re-renders on first build and after every accepted
   *  edit rather than hiding behind a button. Pure render on the server: no
   *  storage write, no cap charge, so calling it on every change is free. */
  const resumeJson = state.phase === 'ready' ? JSON.stringify(state.resume) : null;
  useEffect(() => {
    if (state.phase !== 'ready') return;
    let alive = true;
    setPdfBusy(true);
    void downloadResumePdfBase64(state.resume).then((b64) => {
      if (!alive) return;
      setPdfBusy(false);
      if (b64) setPdf(b64);
      else showToast('Could not render the PDF. Try an edit, or use it as is.');
    });
    return () => {
      alive = false;
    };
    // resumeJson, not state.resume: a new object identity every render would
    // re-fetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeJson]);

  /** Apply a typed instruction to the draft. The PDF follows automatically via
   *  the effect above, so the user watches the document change. */
  const applyEdit = async () => {
    const p = edit.trim();
    if (state.phase !== 'ready' || !p || refining) return;
    setRefining(true);
    let r;
    try {
      r = await refineResume(p, state.resume);
    } catch (e) {
      setRefining(false);
      // Same as above: the disclosure is on screen, so say nothing over it.
      if (!(e instanceof AIConsentRequiredError)) showToast('Could not apply that change.');
      return;
    }
    setRefining(false);
    if (r.status === 'ok') {
      setEdit('');
      setState({ phase: 'ready', resume: r.resume });
    } else if (r.status === 'limit') {
      showToast('Daily edit limit reached. It resets tomorrow.');
    } else {
      showToast(r.status === 'error' ? r.message : 'Could not apply that change.');
    }
  };

  const adopt = async () => {
    if (state.phase !== 'ready' || adopting) return;


    setAdopting(true);
    const ok = await finalizeResume(state.resume);
    setAdopting(false);
    if (ok) {
      track('resume_built', { method: 'described' });
      showToast('Resume saved. Auto-apply can use it now.');
      await queryClient.invalidateQueries({ queryKey: qk.me });
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.back();
    } else {
      showToast('Could not save the resume. Try again.');
    }
  };

  const title =
    state.phase === 'ready' ? 'Review your resume' : 'Build your resume';

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Back arrow, not a close X: this is a page in a flow now, reachable
          from intake and from Profile, and people expect to be able to step
          back to their answers without losing them. */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        {/* Back and mark are the same width so the title lands optically
            centered, not just centered within the leftover space. */}
        <Pressable
          onPress={() => (state.phase === 'ready' ? setState({ phase: 'input' }) : router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={{ width: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={colors.ink} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: fonts.display,
            fontSize: 24,
            color: colors.heading,
            textAlign: 'center',
          }}>
          {title}
        </Text>
        <View style={{ width: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Image
            source={require('../../assets/images/offerloop-mark.png')}
            style={{ width: 30, height: 28 }}
            resizeMode="contain"
            accessibilityLabel="Offerloop"
          />
        </View>
      </View>

      {state.phase === 'input' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <ScrollView
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 20 }}>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                lineHeight: 20,
                color: colors.inkSecondary,
              }}>
              Fill in whatever you have. Rough notes are fine, and you can leave sections
              blank. We&apos;ll turn it into a clean resume built to get past ATS screens and
              land interviews.
            </Text>

            {SECTIONS.map((s) => (
              <View key={s.key} style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                  {s.label}
                </Text>
                <TextInput
                  value={fields[s.key]}
                  onChangeText={(t) => setFields((p) => ({ ...p, [s.key]: t }))}
                  multiline
                  placeholder={s.placeholder}
                  placeholderTextColor={colors.inkTertiary}
                  textAlignVertical="top"
                  style={{
                    minHeight: 96,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    backgroundColor: colors.paper,
                    padding: 14,
                    fontFamily: fonts.sans,
                    fontSize: 14.5,
                    lineHeight: 21,
                    color: colors.ink,
                  }}
                />
              </View>
            ))}

          </ScrollView>

          {/* Pinned footer rather than a button at the end of five tall text
              areas. Nick could not tell the CTA existed without scrolling for
              it; a hint would have been a worse fix than removing the scroll
              hunt entirely, and this matches OnboardingScaffold. The gradient
              above it fades the last section out so the list still reads as
              scrollable. */}
          <View style={{ position: 'relative' }}>
            <LinearGradient
              colors={['transparent', colors.surface]}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: -28, height: 28 }}
            />
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: insets.bottom + 12,
                backgroundColor: colors.surface,
                gap: 8,
              }}>
              <Button
                label="Build my resume"
                variant="brand"
                size="lg"
                fullWidth
                disabled={!anyFilled}
                onPress={() => void generate()}
              />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 11.5,
                  color: colors.inkTertiary,
                  textAlign: 'center',
                  lineHeight: 16,
                }}>
                You review the draft, and nothing is saved until you say so.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1, padding: 20, paddingBottom: insets.bottom + 16 }}>
          {state.phase === 'loading' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.navy} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
                Building your resume
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                This can take up to a minute.
              </Text>
            </View>
          ) : state.phase === 'ready' ? (
            /* The document IS the review. No section re-rendering, no info
               banner, no "view as PDF" detour: you look at the actual PDF,
               type what you want changed, and watch it change. */
            <View style={{ flex: 1, gap: 12 }}>
              {/* Completeness, derived from the document itself. The missing
                  line doubles as the next thing to type into the edit box. */}
              {(() => {
                const { score, missing } = completeness(state.resume);
                const bar =
                  score >= 85 ? colors.positive : score >= 60 ? colors.waiting : colors.negative;
                return (
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text
                        style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
                        {score}% complete
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.hairline,
                          overflow: 'hidden',
                        }}>
                        <View style={{ width: `${score}%`, height: 6, backgroundColor: bar }} />
                      </View>
                    </View>
                    {missing.length ? (
                      <Text
                        numberOfLines={2}
                        style={{
                          fontFamily: fonts.sans,
                          fontSize: 12,
                          lineHeight: 17,
                          color: colors.inkSecondary,
                        }}>
                        Still missing: {missing.join(', ')}.
                      </Text>
                    ) : null}
                  </View>
                );
              })()}

              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  backgroundColor: colors.paper,
                }}>
                {pdf ? (
                  <PdfView base64={pdf} backgroundColor={colors.paper} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <ActivityIndicator color={colors.navy} />
                    <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>
                      Rendering your resume
                    </Text>
                  </View>
                )}
                {/* Re-rendering after an edit: keep the old page visible and
                    dim it, so the screen never goes blank mid-change. */}
                {pdf && (pdfBusy || refining) ? (
                  <View
                    pointerEvents="none"
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.paper + 'CC',
                      gap: 10,
                    }}>
                    <ActivityIndicator color={colors.navy} />
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSecondary }}>
                      {refining ? 'Making that change' : 'Updating'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Prompt box with the send affordance inside it, bottom right. */}
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={edit}
                  onChangeText={setEdit}
                  multiline
                  editable={!refining}
                  placeholder="Describe a change. Cut the third bullet, add my GPA, make it shorter."
                  placeholderTextColor={colors.inkTertiary}
                  textAlignVertical="top"
                  style={{
                    minHeight: 88,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    backgroundColor: colors.paper,
                    paddingTop: 12,
                    paddingBottom: 12,
                    paddingLeft: 14,
                    paddingRight: 56,
                    fontFamily: fonts.sans,
                    fontSize: 14.5,
                    lineHeight: 21,
                    color: colors.ink,
                  }}
                />
                <Pressable
                  onPress={() => void applyEdit()}
                  disabled={!edit.trim() || refining}
                  accessibilityRole="button"
                  accessibilityLabel="Apply this change"
                  accessibilityState={{ disabled: !edit.trim() || refining }}
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: edit.trim() && !refining ? colors.ink : colors.hairline,
                  }}>
                  {refining ? (
                    <ActivityIndicator size="small" color={colors.paper} />
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={20}
                      color={edit.trim() ? colors.paper : colors.inkTertiary}
                    />
                  )}
                </Pressable>
              </View>

              <Button
                label="Use this resume"
                variant="brand"
                size="lg"
                fullWidth
                disabled={adopting || refining}
                onPress={() => void adopt()}
              />
            </View>
          ) : state.phase === 'limit' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="hourglass-outline" size={34} color={colors.inkTertiary} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                You have reached the resume generation limit for now.
              </Text>
              <Button label="Back" variant="outline" onPress={() => router.back()} />
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.inkTertiary} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                }}>
                {state.phase === 'error' ? state.message : 'Something went wrong.'}
              </Text>
              <Button label="Try again" variant="outline" onPress={() => setState({ phase: 'input' })} />
            </View>
          )}
        </View>
      )}

    </View>
  );
}
