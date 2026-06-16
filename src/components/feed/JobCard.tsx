import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import CompanyLogo from '@/components/CompanyLogo';
import Chip from '@/components/ui/Chip';
import { FIXTURE_QUALS, MOCK_COMPANY_INFO } from '@/mocks/data';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/** A short school-colors pennant stripe, shown on cards when the school theme is on. */
function SchoolStripe() {
  const { school } = useTheme();
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
    <View style={{ gap: 7, alignItems: center ? 'center' : 'flex-start' }}>
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 11,
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

function DetailGroups({ job, center }: { job: Job; center: boolean }) {
  const colors = useColors();
  return (
    <View style={{ gap: 14, alignItems: center ? 'center' : 'stretch' }}>
      {job.compensation ? (
        <DetailGroup label="Compensation" center={center}>
          <Chip label={job.compensation} tone="positive" icon="cash-outline" size="lg" />
        </DetailGroup>
      ) : null}
      {job.workArrangement || job.experienceLevel ? (
        <DetailGroup label="Role" center={center}>
          {job.workArrangement ? (
            <Chip
              label={job.workArrangement}
              tone="brand"
              icon={arrangementIcon(job.workArrangement)}
              size="lg"
            />
          ) : null}
          {job.experienceLevel ? (
            <Chip label={job.experienceLevel} tone="accent" icon="school-outline" size="lg" />
          ) : null}
          {job.education ? <Chip label={job.education} icon="book-outline" size="lg" /> : null}
        </DetailGroup>
      ) : null}
    </View>
  );
}

function CollapsedCard({ job }: { job: Job }) {
  const colors = useColors();
  const { accentTheme } = useTheme();
  // Reserve room at the bottom so the short description clears the floating
  // glass action bar that rides low over the card.
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingBottom: 72 }}>
      {accentTheme === 'school' ? <SchoolStripe /> : null}
      <CompanyLogo name={job.company} logoUrl={job.logoUrl} size={54} radius={14} />
      <View style={{ height: 12 }} />
      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonts.sansBold,
          fontSize: 26,
          color: colors.heading,
          lineHeight: 32,
          letterSpacing: -0.4,
          textAlign: 'center',
        }}>
        {job.title}
      </Text>
      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
          {job.company}
        </Text>
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.inkTertiary }} />
        <Ionicons name="location-outline" size={12} color={colors.inkTertiary} />
        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>
          {job.location}
        </Text>
      </View>

      <View style={{ height: 18 }} />
      <DetailGroups job={job} center />

      {/* Description sits right below the role, no big gap. */}
      <View style={{ width: '100%', gap: 6, paddingTop: 16, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
          Job description
        </Text>
        <Text
          numberOfLines={4}
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            color: colors.inkSecondary,
            lineHeight: 20,
            textAlign: 'center',
          }}>
          {job.description}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 }}>
          <Ionicons name="expand-outline" size={12} color={colors.accent} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.accent }}>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: tone + '33',
        borderRadius: 10,
        backgroundColor: tone + '0F',
        paddingHorizontal: 12,
        paddingVertical: 12,
      }}>
      <Ionicons name={icon} size={16} color={tone} />
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>
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
function ExpandedCard({ job, onCollapse }: { job: Job; onCollapse?: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const info = MOCK_COMPANY_INFO[job.company];
  const quals = job.requiredQualifications ?? FIXTURE_QUALS;
  const openCompany = () => router.push(`/company/${encodeURIComponent(job.company)}`);

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: string }[] = [];
  if (job.compensation)
    tiles.push({ icon: 'cash-outline', label: job.compensation, tone: colors.positive });
  if (job.workArrangement)
    tiles.push({ icon: arrangementIcon(job.workArrangement), label: job.workArrangement, tone: colors.marketing });
  if (job.experienceLevel)
    tiles.push({ icon: 'school-outline', label: job.experienceLevel, tone: colors.accent });
  if (job.education)
    tiles.push({ icon: 'book-outline', label: job.education, tone: colors.waiting });
  if (info?.size)
    tiles.push({ icon: 'business-outline', label: info.size, tone: colors.navy });

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
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
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
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent }}>
            Find a contact at {job.company}
          </Text>
        </Pressable>

        {tiles.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
              Job details
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {tiles.map((t) => (
                <DetailTile key={t.label} icon={t.icon} label={t.label} tone={t.tone} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            Job description
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, color: colors.inkSecondary, lineHeight: 23 }}>
            {job.description}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            Required qualifications
          </Text>
          {quals.map((q, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: colors.inkTertiary, fontSize: 14 }}>•</Text>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, lineHeight: 22 }}>
                {q}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function JobCard({
  job,
  expanded = false,
  onCollapse,
}: {
  job: Job;
  expanded?: boolean;
  onCollapse?: () => void;
}) {
  return expanded ? <ExpandedCard job={job} onCollapse={onCollapse} /> : <CollapsedCard job={job} />;
}

export default JobCard;
