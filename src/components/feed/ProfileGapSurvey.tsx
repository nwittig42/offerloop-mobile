import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { saveRankerSignals } from '@/api/endpoints/preferences';
import Input from '@/components/ui/Input';
import TokenPicker from '@/components/feed/TokenPicker';
import { useGmailConnect } from '@/hooks/useGmailConnect';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, shadows } from '@/theme/tokens';

/**
 * The gap survey: what we ask when the People deck has nothing to rank on.
 *
 * person_ranker needs a school or a set of dream companies. Neither was ever
 * writable from the app, so an app-only student got an empty deck forever and
 * the empty state told them to "check back later" — advice that would never
 * come true. This is the three-tap fix, shown in the exact spot where the
 * missing data is costing them something.
 *
 * Design rules, in priority order:
 *
 *  1. Only ask for what is missing. A student who already has a school on
 *     file sees one screen, not two.
 *  2. Taps beat typing. The companies step is a grid of real firms filtered
 *     to the industries they already told us, so the common path is three
 *     taps and no keyboard.
 *  3. Say what they get. The header frames it as unlocking the feature,
 *     because that is literally what it does, and every question shows the
 *     payoff rather than justifying itself.
 *  4. Never trap them. Skip is always available and never scolds.
 */

/** Firms by industry, so a finance student never scrolls past Google.
 *  Trimmed to the names students actually name — the full 76-firm list is a
 *  wall, and a wall is the thing this screen exists to avoid. */
type Step = 'gmail' | 'school' | 'roles' | 'companies' | 'offices';

const FIRMS_BY_INDUSTRY: Record<string, string[]> = {
  finance: [
    'Goldman Sachs',
    'JPMorgan',
    'Morgan Stanley',
    'Evercore',
    'Blackstone',
    'Citi',
    'Jefferies',
    'Lazard',
    'Centerview',
    'Moelis',
  ],
  consulting: [
    'McKinsey',
    'Bain',
    'BCG',
    'Deloitte',
    'EY-Parthenon',
    'Accenture',
    'Kearney',
    'Oliver Wyman',
  ],
  tech: [
    'Google',
    'Meta',
    'Amazon',
    'Apple',
    'Microsoft',
    'Nvidia',
    'Stripe',
    'Databricks',
    'Anduril',
    'Palantir',
  ],
};

/**
 * Roles, by the same industry split as the firms.
 *
 * These are TITLES, not tracks: "Investment Banking Analyst" is what a person
 * on the other end actually has in their LinkedIn headline, and the ranker
 * token-matches the student's titles against the candidate's. "Finance" would
 * match nobody.
 */
const ROLES_BY_INDUSTRY: Record<string, string[]> = {
  finance: [
    'Investment Banking Analyst',
    'Private Equity Analyst',
    'Equity Research Analyst',
    'Sales & Trading Analyst',
    'Financial Analyst',
    'Accountant',
    'Auditor',
    'Wealth Management Analyst',
    'Risk Analyst',
  ],
  consulting: [
    'Management Consultant',
    'Strategy Consultant',
    'Business Analyst',
    'Associate Consultant',
    'Technology Consultant',
    'Operations Consultant',
  ],
  tech: [
    'Software Engineer',
    'Product Manager',
    'Data Scientist',
    'Data Analyst',
    'Machine Learning Engineer',
    'Product Designer',
    'Solutions Engineer',
    'Technical Program Manager',
  ],
};

/** Offices, not cities-in-general: these are where the target firms actually
 *  put analysts. "Right office" is half of whether an intro is worth sending —
 *  a New York banker is a different conversation from a Dallas one. */
const OFFICES = [
  'New York',
  'San Francisco',
  'Chicago',
  'Los Angeles',
  'Boston',
  'Charlotte',
  'Dallas',
  'Houston',
  'Atlanta',
  'Washington DC',
  'Seattle',
  'Miami',
];

const ROLES_MIXED = [
  'Investment Banking Analyst',
  'Management Consultant',
  'Software Engineer',
  'Financial Analyst',
  'Product Manager',
  'Accountant',
  'Data Analyst',
  'Business Analyst',
];

/** No industry on file: a spread across all three, so the grid is still
 *  useful rather than empty. */
const FIRMS_MIXED = [
  'Goldman Sachs',
  'JPMorgan',
  'McKinsey',
  'Bain',
  'BCG',
  'Google',
  'Amazon',
  'Microsoft',
  'Blackstone',
  'Stripe',
];

function industryKeys(industries: string[]): string[] {
  return industries
    .map((i) => i.toLowerCase())
    .map((i) =>
      /financ|bank|invest|private equity|ib\b/.test(i)
        ? 'finance'
        : /consult|strategy/.test(i)
          ? 'consulting'
          : /tech|software|engineer|product|data/.test(i)
            ? 'tech'
            : '',
    )
    .filter(Boolean);
}

/** Industry-matched options first, then everything else, so the list is
 *  relevant at the top and still complete if you scroll. Never truncated:
 *  a student who wants an unlisted firm can type it. */
function optionsFor(
  industries: string[],
  byIndustry: Record<string, string[]>,
  fallback: string[],
): string[] {
  const keys = industryKeys(industries);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    for (const v of byIndustry[k] ?? []) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  for (const list of [...Object.values(byIndustry), fallback]) {
    for (const v of list) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}


/**
 * The CTA. Not ui/Button: its `primary` variant fills with colors.marketing
 * (a mid blue), and disabled renders that blue at low opacity — which on this
 * screen read as a broken button rather than one waiting for input. Ink fill
 * matches the design system ("primary buttons are ink-black fill"), and the
 * disabled state is a flat surface with tertiary text, which reads as "not
 * yet" instead of "something went wrong".
 */
function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={{
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? colors.surface : colors.ink,
        borderWidth: 1,
        borderColor: disabled ? colors.hairline : colors.ink,
      }}>
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 15,
          color: disabled ? colors.inkTertiary : colors.paper,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileGapSurvey({
  needsSchool,
  needsCompanies,
  onDone,
}: {
  needsSchool: boolean;
  needsCompanies: boolean;
  /** Fired after a successful save so the deck can refetch. */
  onDone: () => void;
}) {
  const colors = useColors();
  const { profile, showToast } = useApp();
  const { connect: connectGmail, connecting: gmailConnecting } = useGmailConnect();

  /**
   * Steps, in the order the ranker values them.
   *
   * Roles earns its place here (Nick 2026-08-16). person_ranker was calling
   * the warmth scorer with no title context at all, so role matching returned
   * "not evaluated" for every candidate — a student who said "Auditor" was
   * ranked identically to one who said nothing. Asking for it and feeding it
   * in are the same fix, and the title also aims the PDL search.
   */
  const steps = useMemo(() => {
    const out: Step[] = [];
    // Gmail first, because it is the only hard gate here. The rest of this
    // survey tunes WHO we find; without a connected account there is nowhere
    // for the email to go, so a student who answers everything else and has
    // no Gmail still cannot use the deck. Asking for it last would be asking
    // three questions that did not matter yet.
    if (!profile.gmailConnected) out.push('gmail');
    if (needsSchool) out.push('school');
    out.push('roles');
    if (needsCompanies) out.push('companies');
    out.push('offices');
    return out;
  }, [needsSchool, needsCompanies, profile.gmailConnected]);

  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const [school, setSchool] = useState('');
  const [roles, setRoles] = useState<string[]>(profile.targetRoles ?? []);
  const [companies, setCompanies] = useState<string[]>([]);
  const [roleQuery, setRoleQuery] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [offices, setOffices] = useState<string[]>(profile.preferredLocations ?? []);
  const [officeQuery, setOfficeQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Memoized: `?? []` builds a new array every render, which would re-run
  // both option lists on every keystroke in the search box.
  const industries = useMemo(() => profile.industries ?? [], [profile.industries]);
  const firmOptions = useMemo(
    () => optionsFor(industries, FIRMS_BY_INDUSTRY, FIRMS_MIXED),
    [industries],
  );
  const roleOptions = useMemo(
    () => optionsFor(industries, ROLES_BY_INDUSTRY, ROLES_MIXED),
    [industries],
  );

  const addTo = (
    value: string,
    list: string[],
    set: (next: string[]) => void,
    clearQuery: () => void,
  ) => {
    const name = value.trim();
    if (!name) return;
    if (!list.includes(name)) set([...list, name]);
    clearQuery();
  };

  const toggleIn = (value: string, list: string[], set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const finish = useCallback(async () => {
    setSaving(true);
    try {
      await saveRankerSignals({
        school: school.trim() || undefined,
        dreamCompanies: companies.length ? companies : undefined,
        targetRoles: roles.length ? roles : undefined,
        preferredLocations: offices.length ? offices : undefined,
      });
      onDone();
    } catch {
      showToast('Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }, [school, companies, roles, onDone, showToast]);

  const next = () => (isLast ? void finish() : setIndex((i) => i + 1));

  /**
   * Every question is optional (Nick 2026-08-16: "optional but encouraged").
   *
   * A disabled button reading "Pick at least one role" is a scold, and it
   * lies: the deck works on a school alone, or on companies alone. Blocking
   * on each step separately turned three encouragements into three walls.
   * Encouragement lives in the copy and in the payoff line; the button just
   * moves you forward.
   */
  const ctaLabel = saving
    ? 'Saving…'
    : isLast
      ? `Find my people${companies.length ? ` (${companies.length})` : ''}`
      : 'Continue';

  const HEADINGS: Record<Step, { title: string; sub: string }> = {
    gmail: {
      title: 'Connect your Gmail',
      sub: 'Your intros are written as drafts in your own account, from your own address. Nothing sends without you.',
    },
    school: {
      title: 'Where do you go to school?',
      sub: 'Alumni answer far more often than strangers. It’s the strongest signal we have.',
    },
    roles: {
      title: 'What job do you want?',
      sub: 'The exact title, not the field. We match it against what people actually do.',
    },
    companies: {
      title: 'Where would you love to work?',
      sub: 'Add as many as you like. Each one pulls a fresh set of people into your deck.',
    },
    offices: {
      title: 'Which offices?',
      sub: 'We’ll put people in these cities at the top. A New York banker is a different conversation from a Dallas one.',
    },
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 }}>
      {/* A card, floating on the feed ground. Loose on the background this
          read as a settings page that had taken over the tab; in a card it
          reads as one task sitting on top of the deck, which is what it is. */}
      <View
        style={[
          {
            backgroundColor: colors.paper,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: 20,
            gap: 20,
          },
          shadows.lg,
        ]}>
        {/* Back and position. A three-step form with no way back is a trap:
            the answer you want to change is always the one behind you. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 22 }}>
          {index > 0 ? (
            <Pressable
              onPress={() => setIndex((i) => i - 1)}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chevron-back" size={17} color={colors.inkSecondary} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.inkSecondary }}>
                Back
              </Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="lock-open-outline" size={13} color={colors.accent} />
              <Text
                style={{
                  fontFamily: fonts.sansBold,
                  fontSize: 11,
                  letterSpacing: 0.7,
                  color: colors.accent,
                }}>
                UNLOCK PEOPLE
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {steps.length > 1 ? (
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
              {index + 1} of {steps.length}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 27, color: colors.heading, lineHeight: 32 }}>
            {HEADINGS[step].title}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13.5,
              color: colors.inkSecondary,
              lineHeight: 20,
            }}>
            {HEADINGS[step].sub}
          </Text>
        </View>

        {step === 'gmail' ? (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={async () => {
                const res = await connectGmail();
                // Advance on success only. A cancelled connect that skipped
                // ahead would leave the student on a later step believing
                // they had finished setup.
                if (res === 'connected') {
                  showToast('Gmail connected.');
                  setIndex((i) => Math.min(i + 1, steps.length - 1));
                } else if (res === 'failed') {
                  showToast('Could not connect Gmail. Try again.');
                }
              }}
              disabled={gmailConnecting}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                height: 50,
                borderRadius: 12,
                backgroundColor: colors.paper,
                borderWidth: 1.5,
                borderColor: colors.hairline,
                opacity: gmailConnecting ? 0.6 : 1,
              }}>
              <Ionicons name="mail" size={18} color="#EA4335" />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                {gmailConnecting ? 'Connecting…' : 'Connect Gmail'}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.inkTertiary} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: colors.inkTertiary,
                  lineHeight: 17,
                }}>
                We only create drafts and track replies. You can disconnect any time in Profile.
              </Text>
            </View>
          </View>
        ) : step === 'school' ? (
          <Input
            value={school}
            onChangeText={setSchool}
            placeholder="e.g. USC"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={next}
          />
        ) : step === 'roles' ? (
          <TokenPicker
            query={roleQuery}
            onQueryChange={setRoleQuery}
            selected={roles}
            onToggle={(v) => toggleIn(v, roles, setRoles)}
            onAddTyped={() => addTo(roleQuery, roles, setRoles, () => setRoleQuery(''))}
            suggestions={roleOptions}
            placeholder="Search any job title"
            emptyHint="e.g. Accountant, Auditor, Investment Banking Analyst"
          />
        ) : step === 'offices' ? (
          <TokenPicker
            query={officeQuery}
            onQueryChange={setOfficeQuery}
            selected={offices}
            onToggle={(v) => toggleIn(v, offices, setOffices)}
            onAddTyped={() => addTo(officeQuery, offices, setOffices, () => setOfficeQuery(''))}
            suggestions={OFFICES}
            placeholder="Search any city"
            emptyHint="Skip if you’re open to anywhere."
          />
        ) : (
          <TokenPicker
            query={companyQuery}
            onQueryChange={setCompanyQuery}
            selected={companies}
            onToggle={(v) => toggleIn(v, companies, setCompanies)}
            onAddTyped={() => addTo(companyQuery, companies, setCompanies, () => setCompanyQuery(''))}
            suggestions={firmOptions}
            placeholder="Search any company"
            emptyHint="Pick a few, or search for any firm."
          />
        )}

      </View>
    </ScrollView>

      {/* Pinned, never scrolled (Nick 2026-08-16: "always above the fold").
          Suggestion lists grow and shrink as you search, so a button that
          lives at the end of the content is sometimes on screen and
          sometimes three flicks away — and the one time it hides is the
          moment right after someone taps a chip, which is exactly when they
          are looking for it. */}
      <View
        style={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 10,
          gap: 2,
          backgroundColor: colors.feedBg,
          borderTopWidth: 1,
          borderTopColor: colors.hairlineLight,
        }}>
        <PrimaryButton label={ctaLabel} disabled={saving} onPress={next} />
        <Pressable onPress={onDone} accessibilityRole="button" style={{ paddingVertical: 10 }}>
          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: 13,
              color: colors.inkTertiary,
              textAlign: 'center',
            }}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
