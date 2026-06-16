import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompanyLogo from '@/components/CompanyLogo';
import FindAnotherDialog from '@/components/FindAnotherDialog';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { MOCK_COMPANY_INFO } from '@/mocks/data';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Company page, modeled on Sorce's: tap a company logo or name from a job
 * and land here. Overview (about, quick facts, news), Jobs (other roles at
 * this company), and Reached out (who you have contacted here, our take on
 * Sorce's Applications tab). Company data is fixture until Phase 3.
 */
export default function CompanyScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const company = decodeURIComponent(name ?? '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { allJobs, outreach, profile, draftAnotherContact } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);

  const info = MOCK_COMPANY_INFO[company];
  const roles = allJobs.filter((j) => j.company === company);
  const reached = outreach.filter((o) => o.company === company && o.status !== 'drafting');

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'jobs', label: `Jobs${roles.length ? ` (${roles.length})` : ''}` },
    { key: 'reached', label: `Reached out${reached.length ? ` (${reached.length})` : ''}` },
  ] as const;
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('overview');

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <CompanyLogo name={company} size={36} radius={9} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 19, color: colors.heading }}>
          {company}
        </Text>
      </View>

      {info ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 14 }}>
          <Chip label={info.industry} tone="brand" icon="briefcase-outline" size="lg" />
          <Chip label={info.size} tone="accent" icon="people-outline" size="lg" />
          <Chip label={info.hq} tone="positive" icon="location-outline" size="lg" />
        </View>
      ) : null}

      {/* Always-visible: reach a person here, the core company action. */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        <Pressable onPress={() => setDialogOpen(true)} accessibilityRole="button">
          <LinearGradient
            colors={['#3B82F6', '#2563EB', '#4A60A8'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 10,
              paddingVertical: 13,
            }}>
            <Ionicons name="person-add" size={17} color={colors.paper} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.paper }}>
              Find a contact here
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 22 }}>
          {TABS.map((t) => {
            const selected = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 2,
                  borderBottomColor: selected ? colors.navy : 'transparent',
                }}>
                <Text
                  style={{
                    fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                    fontSize: 13.5,
                    color: selected ? colors.navy : colors.inkTertiary,
                  }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}>
        {tab === 'overview' ? (
          <>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name="information-circle-outline" size={17} color={colors.accent} />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                  About
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, lineHeight: 22 }}>
                {info?.about ??
                  'No company profile yet. Real company details arrive with backend wiring in Phase 3.'}
              </Text>
            </View>
            {info?.news.length ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Ionicons name="newspaper-outline" size={16} color={colors.marketing} />
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                    News
                  </Text>
                </View>
                {info.news.map((n, i) => (
                  <Card key={i} style={{ gap: 4, borderColor: colors.marketing + '33' }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.marketing }}>
                      {n.source} · {n.timeLabel}
                    </Text>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink, lineHeight: 20 }}>
                      {n.headline}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : null}
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary, textAlign: 'center' }}>
              For deeper firm research, use offerloop.ai
            </Text>
          </>
        ) : null}

        {tab === 'jobs' ? (
          roles.length === 0 ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary }}>
              No other roles from this company in your feed right now.
            </Text>
          ) : (
            roles.map((job) => (
              <Card key={job.id} style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.heading }}>
                  {job.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={11} color={colors.inkTertiary} />
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                    {job.location}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {job.workArrangement ? <Chip label={job.workArrangement} tone="brand" /> : null}
                  {job.experienceLevel ? <Chip label={job.experienceLevel} tone="accent" /> : null}
                  {job.compensation ? <Chip label={job.compensation} tone="positive" /> : null}
                </View>
              </Card>
            ))
          )
        ) : null}

        {tab === 'reached' ? (
          <>
            {reached.length === 0 ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21 }}>
                You have not reached out to anyone at {company} yet. Swipe right on one of
                their roles, or find a contact above.
              </Text>
            ) : (
              reached.map((o) => (
              <Pressable key={o.id} onPress={() => router.push(`/outreach/${o.id}`)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: colors.paper2,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.navy }}>
                      {(o.contact?.name ?? company)
                        .split(' ')
                        .map((p) => p.charAt(0))
                        .slice(0, 2)
                        .join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      {o.contact?.name ?? 'Contact'}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      {o.contact?.title ?? o.jobTitle}
                    </Text>
                  </View>
                  <Chip
                    label={o.status === 'replied' ? 'Replied' : o.status === 'sent' ? 'Sent' : 'Ready'}
                    tone={o.status === 'replied' ? 'positive' : 'neutral'}
                  />
                </Card>
              </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <FindAnotherDialog
        visible={dialogOpen}
        company={company}
        creditCost={profile.creditsPerSwipe}
        onConfirm={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          draftAnotherContact({ company });
        }}
        onClose={() => setDialogOpen(false)}
      />
    </View>
  );
}
