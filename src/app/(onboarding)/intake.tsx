import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { pickResume, uploadResume, type PickedResume, type ResumeParsed } from '@/api/endpoints/resume';
import { RESUME_BUILDER_LIVE } from '@/api/endpoints/resumeBuilder';
import PrimaryCta from '@/components/ui/PrimaryCta';
import LinkedInUrlHelp from '@/components/onboarding/LinkedInUrlHelp';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
// Aliased: `track` is also the name of the goal-selection state below, and the
// local would shadow the import inside the component.
import { hasAIConsent, promptAIConsent, useAIConsent } from '@/lib/aiConsent';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track as trackEvent } from '@/lib/analytics';
import { saveTargetTrack } from '@/api/endpoints/preferences';
import { enrichLinkedin } from '@/api/endpoints/profile';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { BRAND_CTA_BG, BRAND_CTA_FG, fonts } from '@/theme/tokens';

/**
 * The first two onboarding steps: add your resume, then see the feed it builds.
 *
 * These briefly lived in (auth), ahead of the account, so value landed before
 * the ask. That version needed the resume builder opened to signed-out callers,
 * a holding pen for everything collected, and a flush once the account existed.
 * Nick moved the account first (2026-08-13): with Apple and Google the wall is
 * two taps, and all of that machinery came out.
 *
 * Running behind the account means every call here just works and saves as it
 * goes. Nothing is held; nothing needs reconciling later.
 */

// Local step count for this screen's own state; the PROGRESS numbers come from
// the shared flow so the bar does not reset when we hand off to ./index.tsx.
const TOTAL = 1;

type Track = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  industries: string[];
  roles: string[];
  /** Companies shown in the preview deck. Real firms that recruit this track,
   *  names only: no invented titles, salaries, or counts (repo rule). */
  preview: string[];
};

const TRACKS: Track[] = [
  {
    key: 'ib',
    label: 'Investment Banking',
    icon: 'trending-up-outline',
    industries: ['Investment Banking'],
    roles: ['Investment Banking Analyst'],
    preview: ['Goldman Sachs', 'Morgan Stanley', 'Evercore', 'Jefferies', 'Lazard'],
  },
  {
    key: 'consulting',
    label: 'Consulting',
    icon: 'briefcase-outline',
    industries: ['Consulting'],
    roles: ['Consultant'],
    preview: ['McKinsey & Company', 'Bain & Company', 'BCG', 'Deloitte', 'Accenture'],
  },
  {
    key: 'tech',
    label: 'Tech',
    icon: 'hardware-chip-outline',
    industries: ['Technology'],
    roles: ['Software Engineer'],
    preview: ['Google', 'Microsoft', 'Stripe', 'Databricks', 'Airbnb'],
  },
  {
    key: 'other',
    label: 'Something else',
    icon: 'compass-outline',
    industries: [],
    roles: [],
    preview: [],
  },
];

/** Accept anything a student might paste or type: a full URL (with tracking
 *  junk), "linkedin.com/in/handle", "in/handle", "@handle", or a bare handle.
 *  Returns the normalized https URL, or null if it can't be a profile.
 *  (Same rules as the old onboarding step, kept verbatim so behavior matches.) */
function normalizeLinkedin(raw: string): string | null {
  const s = raw.trim().replace(/^@/, '');
  if (!s) return null;
  const fromUrl = s.match(/linkedin\.com\/in\/([A-Za-z0-9\-_%.]+)/i);
  if (fromUrl) return `https://www.linkedin.com/in/${fromUrl[1]}`;
  const fromPrefix = s.match(/^in\/([A-Za-z0-9\-_%.]+)\/?$/i);
  if (fromPrefix) return `https://www.linkedin.com/in/${fromPrefix[1]}`;
  if (/^[A-Za-z0-9\-_%.]+$/.test(s)) return `https://www.linkedin.com/in/${s}`;
  return null;
}

/** Guess a track from what the resume said, so the goal step opens with an
 *  answer instead of a blank form. Deliberately conservative: a wrong guess is
 *  worse than no guess, so anything ambiguous returns null and they pick. */
function guessTrack(parsed: ResumeParsed | null): string | null {
  if (!parsed) return null;
  const hay = [
    parsed.major,
    parsed.currentTitle,
    parsed.jobTitle,
    ...(Array.isArray(parsed.skills) ? parsed.skills : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!hay) return null;
  if (/investment bank|\bib\b|equity research|capital markets|m&a/.test(hay)) return 'ib';
  if (/consult|strategy/.test(hay)) return 'consulting';
  if (/software|engineer|computer science|developer|data scien/.test(hay)) return 'tech';
  return null;
}

/** The one or two facts worth reading back after a parse. Renders nothing when
 *  the resume was thin, which is the case that would otherwise look broken. */
function parsedSummary(parsed: ResumeParsed | null): string | null {
  if (!parsed) return null;
  const school = (parsed.school || parsed.university || '').toString().trim();
  const major = (parsed.major || '').toString().trim();
  const grad = parsed.graduationYear ? String(parsed.graduationYear).trim() : '';
  const bits = [major, school].filter(Boolean);
  if (!bits.length) return null;
  return grad ? `${bits.join(', ')} (${grad})` : bits.join(', ');
}

/** Same mark, size and slot as the resume builder's header, so the two
 *  screens in this flow read as one place. */
function OfferloopMark() {
  return (
    <Image
      source={require('../../../assets/images/offerloop-mark.png')}
      style={{ width: 30, height: 28 }}
      resizeMode="contain"
      accessibilityLabel="Offerloop"
    />
  );
}

export default function Intake() {
  const router = useRouter();
  const colors = useColors();

  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  const [linkedin, setLinkedin] = useState('');
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  // "Where do I even find that?" is the question that stalls this step
  // (Rylan 2026-08-17). The answer lives one tap away instead of nowhere.
  const [linkedinHelp, setLinkedinHelp] = useState(false);
  const [manual, setManual] = useState('');
  const [showManual] = useState(false);

  const [resumeState, setResumeState] = useState<'none' | 'selected' | 'parsing' | 'done' | 'failed'>('none');
  const [picked, setPicked] = useState<PickedResume | null>(null);
  const [working, setWorking] = useState(false);
  // Set when Continue was blocked purely by missing consent. The effect below
  // resumes it the moment consent flips to granted, so the user taps Allow and
  // moves on instead of landing back on the same screen to press Continue again.
  const [pendingContinue, setPendingContinue] = useState(false);
  const [resumeName, setResumeName] = useState('');
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ResumeParsed | null>(null);
  // Build-from-LinkedIn, the door Rylan found missing on 2026-09-01: the
  // builder already exists behind Profile and the Feed, onboarding just never
  // offered it. It needs the URL saved and the profile enriched first, so this
  // waits on both before opening the preview.
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [pendingBuild, setPendingBuild] = useState(false);

  const [track, setTrack] = useState<string | null>(null);
  // The builder finalizes onto the account and invalidates /me, so a resume
  // created there shows up here as profile.resume. No signal to thread back.
  const { profile, updateProfile } = useApp();
  const { consent } = useAIConsent();
  const builtResume = Boolean(profile.resume);


  // Where to open. Two ways in, because routing between the two onboarding
  // screens with a param alone proved unreliable:
  //   1. ?step=1, sent by ./index.tsx's back arrow;
  //   2. failing that, a resume already on the profile means step 1 is done,
  //      so land on the feed preview rather than re-asking for a resume.
  // Whichever fires, the user never gets dropped back a step they finished.
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  useEffect(() => {
    const n = Number(stepParam);
    if (Number.isFinite(n) && n > 0 && n < TOTAL) setStep(n);
    else if (profile.resume) setStep(1);
    setReady(true);
  }, [stepParam, profile.resume]);

  useEffect(() => {
    if (ready) trackEvent('intake_step_viewed', { step: step + 1, total: ONBOARDING_TOTAL });
  }, [step, ready]);


  useEffect(() => {
    if (pendingContinue && consent === 'granted') {
      setPendingContinue(false);
      void submitStep0();
    }
    // submitStep0 is stable enough for this: it only fires on the consent flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingContinue, consent]);

  useEffect(() => {
    if (pendingBuild && consent === 'granted') {
      setPendingBuild(false);
      void buildFromLinkedin();
    }
    // Same shape as the Continue resume above: fires once, on the consent flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBuild, consent]);


  /** Each step returns early, and the account sheet has to outlive all three
   *  (Skip can open it from any of them), so every return goes through here. */
  const withChooser = (node: ReactNode) => (
    <>
      {node}
      {/* Overlays live outside the scaffold so they cover its footer too. */}
      {linkedinHelp ? <LinkedInUrlHelp onClose={() => setLinkedinHelp(false)} /> : null}
    </>
  );

  const addResume = async () => {
    setResumeError(null);
    try {
      const file = await pickResume();
      if (!file) return;
      // HELD, not uploaded. Parsing is what sends the resume to an AI, so it
      // waits until Continue, after the disclosure has been accepted. Picking
      // a file must never be the thing that ships it.
      setPicked(file);
      setResumeName(file.name || 'resume.pdf');
      setResumeState('selected');
      Haptics.selectionAsync();
    } catch (e) {
      setResumeState('failed');
      setResumeError(
        e instanceof Error && e.message ? e.message : 'Could not read that file. Try another.',
      );
    }
  };

  /**
   * Continue. Requires one of the three inputs, then asks for the AI
   * disclosure, and only after that does any reading happen.
   *
   * Order matters and is the whole point: the resume is HELD from the moment
   * it is picked, so the first thing that could send it to an AI provider is
   * this function, and the sheet comes first (guideline 5.1.2(i), the
   * rejection of 2026-08-05). Granting resumes this automatically via the
   * pendingContinue effect below, so allowing costs one tap, not two.
   */
  const submitStep0 = async () => {
    const normalized = normalizeLinkedin(linkedin);
    const hasResume = Boolean(picked) || resumeState === 'done';
    const hasBuilt = builtResume;

    if (!normalized && !hasResume && !hasBuilt) {
      setLinkedinError(
        'Add one of these so your intros sound like you: a resume, your LinkedIn, or let us build one.',
      );
      return;
    }
    setLinkedinError(null);

    if (!hasAIConsent()) {
      setPendingContinue(true);
      promptAIConsent();
      return;
    }

    setWorking(true);
    try {
      if (picked) {
        setResumeState('parsing');
        const res = await uploadResume(picked);
        const data = res?.data ?? null;
        setParsed(data);
        setResumeState('done');
        const guess = guessTrack(data);
        if (guess && !track) setTrack(guess);
        trackEvent('intake_resume_parsed', { got_fields: Boolean(parsedSummary(data)) });
      }
      /**
       * SAVE the URL, then enrich with it. These used to be one call, and that
       * was the bug (Nick 2026-08-16: "I added the linkedin and it didn't
       * save").
       *
       * enrich-linkedin-onboarding only writes linkedinUrl to the user doc as a
       * SIDE EFFECT of a successful scrape: when LinkedIn blocks it, the route
       * returns {enriched: false} and early-returns before the Firestore write,
       * so the URL the student typed is thrown away. The app then swallowed the
       * result, so nothing was shown either. You finished onboarding having
       * entered a LinkedIn, and Profile still said "Add your LinkedIn".
       *
       * The URL is the data; the scrape is a bonus on top of it. So it is
       * persisted here, on its own, and awaited so a failure to save is a real
       * failure rather than a silent one. Enrichment stays fire-and-forget,
       * because it being blocked must not cost the student their URL or hold up
       * the step.
       */
      const inferred = TRACKS.find((x) => x.key === (track ?? guessTrack(parsed)));
      if (normalized || inferred) {
        await saveTargetTrack({
          ...(normalized ? { linkedinUrl: normalized } : {}),
          ...(inferred ? { targetRoles: inferred.roles, industries: inferred.industries } : {}),
        }).catch(() => {
          // Best effort: a student who reached this screen must not be trapped
          // on it by a flaky network. The next Profile save writes it again.
        });
      }
      if (normalized) {
        // Keep the local cache in step so Profile's checklist ticks over
        // immediately, rather than only after the next /me refetch.
        updateProfile({ linkedinUrl: normalized });
        void enrichLinkedin(normalized).catch(() => {});
      }
      trackEvent('intake_completed', {
        source: hasResume ? 'resume' : normalized ? 'linkedin' : 'manual',
        has_linkedin: Boolean(normalized),
        has_resume: hasResume,
      });
      router.replace('/(onboarding)');
    } catch (e) {
      setResumeState('failed');
      setResumeError(
        e instanceof Error && e.message ? e.message : 'Could not read that resume. Try another.',
      );
    } finally {
      setWorking(false);
    }
  };

  /**
   * Build my resume from this LinkedIn. Same consent gate as Continue: the
   * scrape sends their profile to an AI, so the disclosure comes first.
   *
   * The builder's preview route reads the ENRICHED profile from the account,
   * not the URL, so the order here is fixed: save the URL (so it is never
   * lost, see submitStep0), enrich and wait for it, then open the preview.
   * Enrichment is a live scrape and takes a while; the button says so.
   */
  const buildFromLinkedin = async () => {
    const normalized = normalizeLinkedin(linkedin);
    if (!normalized) {
      setLinkedinError('Add your LinkedIn link first.');
      return;
    }
    setLinkedinError(null);
    setBuildError(null);
    if (!hasAIConsent()) {
      setPendingBuild(true);
      promptAIConsent();
      return;
    }
    setBuilding(true);
    try {
      await saveTargetTrack({ linkedinUrl: normalized });
      updateProfile({ linkedinUrl: normalized });
      const r = await enrichLinkedin(normalized);
      if (!r.enriched) {
        setBuildError(
          'We could not read that LinkedIn profile. Your link is saved, so you can continue with it, or upload a resume instead.',
        );
        return;
      }
      trackEvent('intake_build_from_linkedin_opened');
      router.push('/resume-preview');
    } catch {
      setBuildError('Could not reach LinkedIn right now. Try again in a moment, or upload a resume.');
    } finally {
      setBuilding(false);
    }
  };

  const openLinkedIn = async () => {
    try {
      await Linking.openURL('linkedin://');
    } catch {
      try {
        await Linking.openURL('https://www.linkedin.com/');
      } catch {
        /* nothing to open; the hint text still guides them */
      }
    }
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.marketing} />
      </View>
    );
  }

  // ── Step 0: who are you ────────────────────────────────────────────────
  {
    const normalized = normalizeLinkedin(linkedin);
    const summary = parsedSummary(parsed);
    return withChooser(
      <OnboardingScaffold
        step={stepNumber('resume')}
        total={ONBOARDING_TOTAL}
        canBack={false}
        headerRight={<OfferloopMark />}
        title="Add your resume"
        subtitle="We use this to match you to jobs, create personalized emails and fill out job applications. No resume? Use your LinkedIn URL or create one."
        footer={<PrimaryCta label="Continue" busy={working} onPress={submitStep0} />}>
        {/* Resume first: it is the only input we can actually read before an
            account exists, so it is the one that pays off immediately. */}
        <Pressable
          onPress={addResume}
          disabled={resumeState === 'parsing'}
          accessibilityRole="button"
          accessibilityLabel="Upload your resume"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            minHeight: 64,
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: resumeState === 'done' ? 2 : 1,
            borderColor: resumeState === 'done' ? colors.positive : colors.hairline,
            backgroundColor: resumeState === 'done' ? colors.positive + '0F' : colors.paper,
          }}>
          {resumeState === 'parsing' ? (
            <ActivityIndicator size="small" color={colors.marketing} />
          ) : (
            <Ionicons
              name={resumeState === 'done' ? 'checkmark-circle' : 'document-attach-outline'}
              size={22}
              color={resumeState === 'done' ? colors.positive : colors.marketing}
            />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              {resumeState === 'done' ? resumeName || 'Resume added' : 'Upload your resume'}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, marginTop: 2 }}>
              {resumeState === 'parsing'
                ? 'Reading it now'
                : resumeState === 'done'
                  ? summary || 'Read and saved'
                  : 'PDF or Word. We read it right away.'}
            </Text>
          </View>
        </Pressable>
        {resumeError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, marginTop: 8 }}>
            {resumeError}
          </Text>
        ) : null}

        <Text
          style={{
            fontFamily: fonts.sansMedium,
            fontSize: 12.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            marginVertical: 16,
          }}>
          or
        </Text>

        <TextInput
          value={linkedin}
          onChangeText={(t) => {
            setLinkedin(t);
            if (linkedinError) setLinkedinError(null);
          }}
          placeholder="LinkedIn link or handle"
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{
            height: 52,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: linkedinError ? colors.negative : colors.hairline,
            backgroundColor: colors.paper,
            paddingHorizontal: 16,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.ink,
          }}
        />
        {normalized ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.positive, marginTop: 8 }} numberOfLines={1}>
            {normalized.replace('https://www.', '')}
          </Text>
        ) : null}

        {/* The LinkedIn-builds-my-resume door. Shows once a real link is in
            the box and no file was chosen; a file already covers this step. */}
        {RESUME_BUILDER_LIVE && normalized && !picked && resumeState !== 'done' ? (
          builtResume ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: colors.positive,
                backgroundColor: colors.positive + '0F',
              }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.positive} />
              <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                Resume built from your LinkedIn
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={buildFromLinkedin}
              disabled={building || working}
              accessibilityRole="button"
              accessibilityLabel="Build my resume from this LinkedIn"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 48,
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: 12,
                // Fixed black, not colors.ink (Rylan 2026-09-11: the same
                // dark-mode wash-out as "Get started").
                backgroundColor: BRAND_CTA_BG,
                opacity: building ? 0.7 : 1,
              }}>
              {building ? (
                <ActivityIndicator size="small" color={BRAND_CTA_FG} />
              ) : (
                <Ionicons name="sparkles-outline" size={18} color={BRAND_CTA_FG} />
              )}
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: BRAND_CTA_FG }}>
                {building ? 'Reading your LinkedIn, about half a minute' : 'Build my resume from this LinkedIn'}
              </Text>
            </Pressable>
          )
        ) : null}
        {buildError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, marginTop: 8 }}>
            {buildError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => {
            trackEvent('intake_linkedin_help_opened');
            setLinkedinHelp(true);
          }}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            minHeight: 34,
            marginTop: 8,
          }}>
          <Ionicons name="play-circle-outline" size={16} color={colors.marketing} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.marketing }}>
            Watch how to find your LinkedIn link
          </Text>
        </Pressable>

        {normalized ? null : (
          <Pressable
            onPress={openLinkedIn}
            accessibilityRole="button"
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#0A66C2' + '55',
            backgroundColor: '#0A66C2' + '0D',
          }}>
          <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: '#0A66C2' }}>
            Open LinkedIn to grab my link
          </Text>
          </Pressable>
        )}

        {/* The neither case. Plenty of first-years have no resume file on their
            phone and a bare LinkedIn, and dead-ending them here loses them. */}
        {showManual ? (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink, marginBottom: 8 }}>
              In your own words
            </Text>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="School, year, major, and what you have done so far."
              placeholderTextColor={colors.inkTertiary}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 120,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.hairline,
                backgroundColor: colors.paper,
                padding: 14,
                fontFamily: fonts.sans,
                fontSize: 15,
                lineHeight: 21,
                color: colors.ink,
              }}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => {
              trackEvent('intake_build_resume_opened');
              router.push('/resume-from-text');
            }}
            accessibilityRole="button"
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.marketing }}>
              I don&apos;t have either, build me one
            </Text>
          </Pressable>
        )}

        {linkedinError ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.negative, marginTop: 12 }}>
            {linkedinError}
          </Text>
        ) : null}
      </OnboardingScaffold>,
    );
  }
}
