import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { USE_MOCKS } from '@/api/config';
import { fetchJobDescription } from '@/api/endpoints/feed';
import { qk } from '@/api/queryKeys';
import CompanyLogo from '@/components/CompanyLogo';
import { cardArt, listingTags, targetMatches } from '@/components/feed/cardArt';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

// Offerloop design-system palette (Figma): primary blue + orange accent.
const BRAND_BLUE = '#4C62A8';
const BRAND_ORANGE = '#DE8040';

/** A short school-colors pennant stripe, shown on cards when the school theme is on. */
function SchoolStripe() {
  const { school } = useTheme();
  if (!school) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
      <View style={{ width: 22, height: 5, borderRadius: 3, backgroundColor: school.primary }} />
      <View style={{ width: 22, height: 5, borderRadius: 3, backgroundColor: school.secondary }} />
      <View style={{ width: 22, height: 5, borderRadius: 3, backgroundColor: school.primary }} />
    </View>
  );
}

/**
 * The swipe card body. Collapsed (quick view): centered, compact, the title
 * as the focal point, enlarged glanceable chips, then a short description
 * that sits low near the action bar (little dead air). Tapping anywhere on
 * the card expands it. Expanded: left-aligned, with a small tab row
 * (Overview, Reached out) modeled on Sorce's company page, where "Reached
 * out" replaces Sorce's Applications and shows who you have contacted at
 * this company. Chips render only when the field exists.
 */

function arrangementIcon(value: string): keyof typeof Ionicons.glyphMap {
  const v = value.toLowerCase();
  if (v.includes('remote')) return 'home-outline';
  if (v.includes('hybrid')) return 'globe-outline';
  return 'business-outline';
}

/** Clean up backend compensation strings for display: "$55 - $55USD" is a
 *  real example (equal bounds + jammed unit). Dedupe equal bounds and space
 *  the unit; never invent a period ("/hr") the data does not state. */
function formatComp(s: string): string {
  const out = s.trim().replace(/(\d)(USD|CAD|EUR|GBP)\b/gi, '$1 $2');
  const m = out.match(/^\$?([\d.,]+)\s*-\s*\$?([\d.,]+)(.*)$/);
  if (m && m[1] === m[2]) return `$${m[1]}${m[3] || ''}`;
  return out;
}

/** Work arrangement and experience level sometimes carry the SAME value
 *  (both "Internship" on scraped jobs). Two identical chips under two labels
 *  reads broken; collapse them into one "Role type" group. */
function dedupeDetails(job: Job): {
  arrangement?: string;
  experience?: string;
  roleType?: string;
} {
  const a = job.workArrangement?.trim();
  const e = job.experienceLevel?.trim();
  if (a && e && a.toLowerCase() === e.toLowerCase()) return { roleType: a };
  return { arrangement: a || undefined, experience: e || undefined };
}

function DetailGroup({
  label,
  children,
  center,
}: {
  label: string;
  children: React.ReactNode;
  center: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 8, alignItems: center ? 'center' : 'flex-start' }}>
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 12,
          letterSpacing: 0.3,
          color: colors.inkTertiary,
        }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: center ? 'center' : 'flex-start',
        }}>
        {children}
      </View>
    </View>
  );
}

function CollapsedCard({ job, descLoading }: { job: Job; descLoading: boolean }) {
  const colors = useColors();
  const { accentTheme } = useTheme();
  const { profile } = useApp();
  const art = cardArt(job.id);
  const details = dedupeDetails(job);

  // Sparse-card fill (Rylan 2026-08-11): when the structured fields leave a
  // void, fill it with TRUE glanceables: the user's own targets that appear
  // in this listing, then buzzword phrases pulled from the listing text.
  const detailCount =
    (job.compensation ? 1 : 0) +
    (details.roleType ? 1 : 0) +
    (details.arrangement ? 1 : 0) +
    (details.experience ? 1 : 0);
  const jobText = `${job.title} ${job.description || ''}`;
  const matches =
    detailCount < 3
      ? targetMatches(jobText, [...profile.targetRoles, ...profile.industries], 2)
      : [];
  const tags = detailCount < 3 ? listingTags(job.description, 4 - detailCount) : [];
  return (
    <View style={{ flex: 1 }}>
      {/* Full-bleed palette wash + hand-drawn loop watermark, breaking out of
          the Card's 20px padding and clipped to its corners. Steady brand
          blue: the rotating per-card tints read as a rendering glitch, not
          variety (Rylan 2026-08-11), so they lasted one release. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -20,
          left: -20,
          right: -20,
          bottom: -20,
          borderRadius: 22,
          overflow: 'hidden',
        }}>
        <LinearGradient
          colors={[BRAND_BLUE + '12', '#FAFBFF00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.6 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 190 }}
        />
        <Image
          source={art.watermark}
          resizeMode="contain"
          style={{ position: 'absolute', bottom: 14, right: -18, width: 170, height: 190, opacity: 0.05 }}
        />
      </View>

      {accentTheme === 'school' ? <SchoolStripe /> : null}

      {/* Title, left-aligned, the focal point (Sorce-style). A gradient
          "flair ribbon" sat above this for one release; Rylan cut it
          (read as gimmicky next to the clean chips below). */}
      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonts.sansBold,
          fontSize: 23,
          color: colors.heading,
          lineHeight: 28,
          letterSpacing: -0.3,
        }}>
        {job.title}
      </Text>
      {/* Hand-drawn squiggle underline from the design system, accent-tinted. */}
      <Image
        source={art.squiggle}
        resizeMode="contain"
        style={{ width: 120, height: 12, marginTop: 4, tintColor: BRAND_ORANGE, opacity: 0.9 }}
      />

      {/* Company + location with the logo beside it, flex-contained and
          single-line so a long name/location can never clip off the edge.
          Sized up for at-a-glance readability (Sorce-style). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 16 }}>
        <CompanyLogo name={job.company} logoUrl={job.logoUrl} size={54} radius={14} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.sansBold, fontSize: 17.5, color: colors.ink, lineHeight: 22 }}>
            {job.company || 'Company'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={14} color={colors.inkTertiary} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
              {job.location || 'Location not listed'}
            </Text>
          </View>
        </View>
      </View>

      {/* Labeled detail sections, each renders only when the data exists.
          These ARE the card body now (Rylan 2026-08-10): a student swipes on
          comp + arrangement + level, not on a wall of description text. */}
      <View style={{ gap: 15, marginTop: 20 }}>
        {job.compensation ? (
          <DetailGroup label="Compensation" center={false}>
            <Chip
              label={formatComp(job.compensation)}
              tone="positive"
              icon="cash-outline"
              size="lg"
              numberOfLines={2}
            />
          </DetailGroup>
        ) : null}
        {details.roleType ? (
          <DetailGroup label="Role type" center={false}>
            <Chip label={details.roleType} tone="brand" icon="briefcase-outline" size="lg" />
          </DetailGroup>
        ) : null}
        {details.arrangement ? (
          <DetailGroup label="Work arrangement" center={false}>
            <Chip
              label={details.arrangement}
              tone="brand"
              icon={arrangementIcon(details.arrangement)}
              size="lg"
            />
          </DetailGroup>
        ) : null}
        {details.experience ? (
          <DetailGroup label="Experience level" center={false}>
            <Chip label={details.experience} tone="accent" icon="school-outline" size="lg" />
          </DetailGroup>
        ) : null}

        {/* Personal fit, only when TRUE: the user's own stated targets that
            literally appear in this listing. */}
        {matches.length ? (
          <DetailGroup label="Matches your targets" center={false}>
            {matches.map((m) => (
              <Chip key={m} label={m} tone="accent" icon="checkmark-circle-outline" size="lg" />
            ))}
          </DetailGroup>
        ) : null}

        {/* Real phrases from the listing itself, so a sparse card still gives
            a feel for the company at a glance. Full-size chips, same visual
            weight as compensation/arrangement (Rylan 2026-08-11): tiny tags
            just re-created the white space they were meant to fill. */}
        {tags.length ? (
          <DetailGroup label="From the listing" center={false}>
            {tags.map((t) => (
              <Chip key={t} label={t} tone="brand" icon="pricetag-outline" size="lg" />
            ))}
          </DetailGroup>
        ) : null}
      </View>

      {/* Description is a PEEK, not the card body: a few lines pinned above
          the enlarge cue. The full text (and everything else) lives one tap
          away in the expanded view. Spacer pushes it to the bottom so the
          glanceable chips own the middle of the card. */}
      <View style={{ flex: 1 }} />
      <View style={{ marginTop: 14, gap: 6 }}>
        <Text
          style={{ fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 0.3, color: colors.inkTertiary }}>
          Job description
        </Text>
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fonts.sans,
            fontSize: 14.5,
            color: colors.inkSecondary,
            lineHeight: 21,
          }}>
          {job.description || (descLoading ? 'Loading description…' : 'Full description on the company’s listing, tap to apply and read the details there.')}
        </Text>
        {/* Lifted clear of the floating action bar that overlaps the card's
            lower edge, so the cue is never hidden behind the buttons. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginBottom: 36 }}>
          <Ionicons name="expand-outline" size={13} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
            Tap anywhere to enlarge
          </Text>
        </View>
      </View>
    </View>
  );
}

function DetailTile({
  icon,
  label,
  tone,
  full,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: string;
  /** Span the full row and wrap freely (used for a long comp range). */
  full?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: full ? '100%' : '46%',
        flexDirection: 'row',
        alignItems: full ? 'flex-start' : 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: tone + '33',
        borderRadius: 10,
        backgroundColor: tone + '0F',
        paddingHorizontal: 12,
        paddingVertical: 12,
      }}>
      <Ionicons name={icon} size={16} color={tone} style={full ? { marginTop: 1 } : undefined} />
      <Text
        numberOfLines={full ? undefined : 1}
        style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink, lineHeight: full ? 20 : undefined }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Expanded job view, modeled on Sorce's scrolling job detail: title,
 * company row (logo and name tap into the company page), a Job details
 * grid, the full description, and required qualifications. Scrolls under
 * the floating action bar, so swipe and draft stay available while reading.
 */
export function ExpandedCard({
  job,
  descLoading,
  onCollapse,
}: {
  job: Job;
  descLoading: boolean;
  onCollapse?: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { autoApplyJob } = useApp();
  const quals = job.requiredQualifications ?? [];
  const openCompany = () => router.push(`/company/${encodeURIComponent(job.company)}`);
  // One-tap auto-apply to THIS job, straight from the (expanded) card. Applying
  // is separate from swiping: swipe = network, this = apply. Only shown when the
  // role is on a supported ATS. Deduped via the store (no double applications).
  const onApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    autoApplyJob(job);
  };

  const details = dedupeDetails(job);
  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string; full?: boolean }[] = [];
  if (job.compensation) {
    // Comp can be a long multi-location range; give it the full row to wrap.
    const comp = formatComp(job.compensation);
    tiles.push({ icon: 'cash-outline', label: comp, tone: colors.positive, full: comp.length > 28 });
  }
  if (details.roleType)
    tiles.push({ icon: 'briefcase-outline', label: details.roleType, tone: colors.marketing });
  if (details.arrangement)
    tiles.push({ icon: arrangementIcon(details.arrangement), label: details.arrangement, tone: colors.marketing });
  if (details.experience)
    tiles.push({ icon: 'school-outline', label: details.experience, tone: colors.accent });

  return (
    <View style={{ flex: 1 }}>
      {onCollapse ? (
        <Pressable
          onPress={onCollapse}
          accessibilityRole="button"
          accessibilityLabel="Collapse"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="chevron-down" size={17} color={colors.ink} />
        </Pressable>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, gap: 18 }}>
        <View style={{ gap: 12, paddingRight: 36 }}>
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 26, color: colors.heading, lineHeight: 32, letterSpacing: -0.4 }}>
            {job.title}
          </Text>
          <Pressable onPress={openCompany} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CompanyLogo name={job.company} logoUrl={job.logoUrl} size={40} radius={10} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
                  {job.company}
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.inkTertiary} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="location-outline" size={11} color={colors.inkTertiary} />
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                  {job.location}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={openCompany}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: colors.accent,
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}>
          <Ionicons name="person-add-outline" size={16} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.accent }}>
            Find a contact at {job.company}
          </Text>
        </Pressable>

        {job.autoApplyEligible ? (
          <Pressable
            onPress={onApply}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingVertical: 12,
            }}>
            <Ionicons name="flash" size={16} color={colors.paper} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.paper }}>
              Auto-apply to this role
            </Text>
          </Pressable>
        ) : null}

        {tiles.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              Job details
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {tiles.map((t) => (
                <DetailTile key={t.label} icon={t.icon} label={t.label} tone={t.tone} full={t.full} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
            Job description
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 15.5, color: colors.inkSecondary, lineHeight: 24 }}>
            {job.description || (descLoading ? 'Loading description…' : 'Full description on the company’s listing, tap to apply and read the details there.')}
          </Text>
        </View>

        {quals.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              Required qualifications
            </Text>
            {quals.map((q, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: colors.inkTertiary, fontSize: 15 }}>•</Text>
                <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.inkSecondary, lineHeight: 23 }}>
                  {q}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function JobCardImpl({
  job,
  expanded = false,
  onCollapse,
}: {
  job: Job;
  expanded?: boolean;
  onCollapse?: () => void;
}) {
  // The feed omits description (stripped server-side); fetch it lazily the
  // first time a card is shown, cached so re-renders/expand don't refetch.
  const needsDesc = !job.description;
  const { data: lazyDesc, isLoading } = useQuery({
    queryKey: qk.jobDescription(job.id),
    queryFn: () => fetchJobDescription(job.id),
    enabled: needsDesc && !USE_MOCKS,
    staleTime: 5 * 60 * 1000,
  });
  const effJob = needsDesc ? { ...job, description: lazyDesc ?? '' } : job;
  const descLoading = needsDesc && isLoading;

  return expanded ? (
    <ExpandedCard job={effJob} descLoading={descLoading} onCollapse={onCollapse} />
  ) : (
    <CollapsedCard job={effJob} descLoading={descLoading} />
  );
}

// The deck re-renders on every store change/poll, but a card only needs to
// re-render when its job (or expand state) changes. Memo cuts the heavy card
// render out of the hot swipe path.
export const JobCard = memo(JobCardImpl);

export default JobCard;
