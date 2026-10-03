import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AUTO_APPLY_TERMINAL,
  appliedRelativeTime,
  appliedStatusMeta,
  listAppliedJobs,
} from '@/api/endpoints/autoApply';
import { fetchCompany } from '@/api/endpoints/company';
import type { CompanyInfo, Job } from '@/types';
import { fetchRolesByCompany } from '@/api/endpoints/feed';
import { qk } from '@/api/queryKeys';
import CompanyLogo from '@/components/CompanyLogo';
import { ExpandedCard } from '@/components/feed/JobCard';
import SwipeDeck from '@/components/feed/SwipeDeck';
import FindAnotherDialog from '@/components/FindAnotherDialog';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { sameCompany } from '@/lib/company';
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
  const {
    allJobs,
    outreach,
    profile,
    draftAnotherContact,
    swipedCardForCompany,
    autoApplyJob,
  } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<'overview' | 'reached' | 'applied' | 'roles'>('overview');

  // ~40s of 2.5s polls before we stop waiting on background research. Bounded
  // so an uncached company whose research never lands can't spin "Gathering
  // company details…" forever — it falls back to the honest empty state.
  const COMPANY_POLL_CAP = 16;
  const companyQuery = useQuery({
    queryKey: qk.company(company),
    queryFn: () => fetchCompany(company),
    enabled: !!company,
    staleTime: 30 * 60 * 1000,
    // First visit to an uncached company: the server answers instantly with
    // "pending" and researches in the background — poll until the profile
    // lands (or the server reports an honest empty), then give up.
    refetchInterval: (q) =>
      q.state.data === 'pending' && q.state.dataUpdateCount < COMPANY_POLL_CAP ? 2500 : false,
  });
  const infoData = companyQuery.data;
  // Downstream code keeps the old contract: `info` is data-or-null, and the
  // background research window counts as loading — until the poll budget runs
  // out (~40s), after which we render the fallback instead of a perpetual
  // spinner. Track when 'pending' started; each poll bumps dataUpdatedAt.
  const pendingSinceRef = useRef<number | null>(null);
  if (infoData === 'pending') {
    if (pendingSinceRef.current == null) pendingSinceRef.current = companyQuery.dataUpdatedAt || Date.now();
  } else {
    pendingSinceRef.current = null;
  }
  const pollExhausted =
    infoData === 'pending' &&
    pendingSinceRef.current != null &&
    (companyQuery.dataUpdatedAt || Date.now()) - pendingSinceRef.current > COMPANY_POLL_CAP * 2500;
  const info: CompanyInfo | null = infoData && infoData !== 'pending' ? infoData : null;
  const companyLoading = (companyQuery.isLoading || infoData === 'pending') && !pollExhausted;
  // Open roles at this company. Fetched from the backend (search-by-company) so
  // the Roles deck + Overview have content for ANY company, not just ones that
  // happen to be in the feed. Lazy: only fetched on the Overview/Roles tabs. Feed
  // matches at this company are the fallback while it loads or if search misses.
  const rolesQuery = useInfiniteQuery({
    queryKey: ['companyRoles', company],
    queryFn: ({ pageParam }) => fetchRolesByCompany(company, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!company && (tab === 'roles' || tab === 'overview' || tab === 'applied'),
    staleTime: 5 * 60 * 1000,
  });
  // Flatten every loaded page into one deduped list.
  const rolesData = useMemo(() => {
    const seen = new Set<string>();
    const out: Job[] = [];
    for (const pg of rolesQuery.data?.pages ?? []) {
      for (const j of pg.jobs) {
        if (!seen.has(j.id)) {
          seen.add(j.id);
          out.push(j);
        }
      }
    }
    return out;
  }, [rolesQuery.data]);
  // sameCompany, not ===: land on /company/Palantir and you still want the
  // roles posted under "Palantir Technologies".
  const feedRoles = useMemo(
    () => allJobs.filter((j) => sameCompany(j.company, company)),
    [allJobs, company],
  );
  const roles = useMemo(
    () => (rolesData.length ? rolesData : feedRoles),
    [rolesData, feedRoles],
  );
  // sameCompany, not ===: PDL rows carry legal names ("Moelis & Company")
  // while this screen's param says "Moelis" — strict equality hid contacts
  // from Reached out (field-tested 2026-07-09).
  const reached = outreach.filter(
    (o) => sameCompany(o.company, company) && o.status !== 'drafting' && o.status !== 'queued',
  );

  // Per-company Roles deck: a mini-feed of this company's open roles you can
  // swipe through (right = reach out, same as the main feed; left = pass). Seeded
  // from `roles`, re-seeded if the feed loads late, but never after you've begun
  // swiping (so passed/drafted cards don't resurrect).
  const [roleDeck, setRoleDeck] = useState<typeof roles>([]);
  const [rolesExpanded, setRolesExpanded] = useState(false);
  const swipedAnyRef = useRef(false);
  // APPEND newly-loaded roles (initial + each paged batch + late feed fallback)
  // to the deck rather than re-seeding, so paging deeper doesn't resurrect roles
  // the user already applied to / passed. everSeen guards against re-adding.
  const everSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = roles.filter((j) => !everSeen.current.has(j.id));
    if (!fresh.length) return;
    fresh.forEach((j) => everSeen.current.add(j.id));
    setRoleDeck((d) => [...d, ...fresh]);
  }, [roles]);
  // Deepen automatically: when the deck runs low and the company has more roles
  // than the current page (SpaceX's ~1,900), pull the next page. This is the
  // "load more" — the user can swipe as deep into a company as they want.
  useEffect(() => {
    if (tab !== 'roles') return;
    if (roleDeck.length < 8 && rolesQuery.hasNextPage && !rolesQuery.isFetchingNextPage) {
      rolesQuery.fetchNextPage();
    }
  }, [tab, roleDeck.length, rolesQuery.hasNextPage, rolesQuery.isFetchingNextPage]);
  // Auto-apply a single role (shared by the Roles swipe deck and the Applied-tab
  // tap-to-apply list). Deduped in the store, so no double applications.
  const applyToRole = (job: (typeof roles)[number]) => autoApplyJob(job);
  const onRoleSwiped = (direction: 'left' | 'right' | 'up', job: (typeof roles)[number]) => {
    swipedAnyRef.current = true;
    if (direction !== 'right') {
      // Perpetual: recycle a passed role to the back so the deck never empties
      // from passes — you keep swiping the company's roles until you apply (or
      // leave the tab). A single role just springs back.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRoleDeck((d) => (d.length <= 1 ? d : [...d.slice(1), d[0]]));
      return;
    }
    // Right = auto-apply this role (the Roles tab is the "apply here" surface;
    // networking lives in Reached out / Find a contact). Remove it from the
    // deck immediately (same optimistic contract as autoApplyJob itself); a
    // failed apply surfaces as a toast, not a resurrected card.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRoleDeck((d) => d.filter((j) => j.id !== job.id));
    applyToRole(job);
  };
  // The exact card the user swiped here (falls back to a current feed role at
  // this company), shown at the top of Overview as the "why you're here" anchor.
  const swipedCard = swipedCardForCompany(company) ?? roles[0];

  // Auto-apply submissions for this company (from the shared applied-jobs cache).
  const { data: appliedData } = useQuery({ queryKey: ['appliedJobs'], queryFn: listAppliedJobs });
  const applied = (appliedData ?? []).filter((j) => sameCompany(j.company || '', company));
  // Open roles at this company you have NOT auto-applied to yet — the tap-to-apply
  // list surfaced under both the Applied and Reached out tabs.
  const openRoles = rolesData.filter((r) => !applied.some((a) => a.job_id === r.id));

  // Shared "open roles you can one-tap apply to" list, reused across tabs.
  const renderOpenRoles = (header: string) => {
    if (rolesQuery.isLoading && openRoles.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, marginTop: 10 }}>
            Finding open roles at {company}…
          </Text>
        </View>
      );
    }
    if (openRoles.length === 0) return null;
    return (
      <>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink, paddingTop: 8 }}>
          {header}
        </Text>
        {openRoles.map((job) => (
          <Card key={job.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.heading }}>
                {job.title}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                {job.location}
                {job.compensation ? ` · ${job.compensation}` : ''}
              </Text>
            </View>
            {job.autoApplyEligible ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  applyToRole(job);
                }}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: colors.accent,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}>
                <Ionicons name="flash" size={13} color={colors.paper} />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.paper }}>
                  Apply
                </Text>
              </Pressable>
            ) : (
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary }}>
                Manual only
              </Text>
            )}
          </Card>
        ))}
      </>
    );
  };

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'reached', label: `Reached out${reached.length ? ` (${reached.length})` : ''}` },
    { key: 'applied', label: `Applied${applied.length ? ` (${applied.length})` : ''}` },
    { key: 'roles', label: `Roles${roles.length ? ` (${roles.length})` : ''}` },
  ] as const;

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

      {info && (info.industry || info.size || info.hq) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 14 }}>
          {info.industry ? (
            <Chip label={info.industry} tone="brand" icon="briefcase-outline" size="lg" />
          ) : null}
          {info.size ? <Chip label={info.size} tone="accent" icon="people-outline" size="lg" /> : null}
          {info.hq ? <Chip label={info.hq} tone="positive" icon="location-outline" size="lg" /> : null}
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
              Find my next contact
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 999,
                paddingVertical: 2,
                paddingHorizontal: 8,
                marginLeft: 2,
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11.5, color: colors.paper }}>
                −{profile.creditsPerSwipe} cr
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            marginTop: 6,
          }}>
          Always someone new — anyone you've already reached is skipped
        </Text>
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

      {tab === 'roles' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: insets.bottom + 12 }}>
          {roleDeck.length === 0 && rolesQuery.isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <ActivityIndicator color={colors.accent} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  marginTop: 10,
                }}>
                Finding open roles at {company}…
              </Text>
            </View>
          ) : roleDeck.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <Ionicons name="checkmark-done-outline" size={30} color={colors.inkTertiary} />
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  marginTop: 10,
                  lineHeight: 21,
                }}>
                {roles.length === 0
                  ? `No open roles at ${company} right now.`
                  : `That's every open role at ${company}. Nice work.`}
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: colors.inkTertiary,
                  textAlign: 'center',
                  paddingBottom: 4,
                }}>
                Swipe right to auto-apply, left to keep browsing
              </Text>
              <SwipeDeck
                jobs={roleDeck}
                expanded={rolesExpanded}
                onToggleExpand={setRolesExpanded}
                onSwiped={onRoleSwiped}
              />
            </>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 40 }}>
        {tab === 'overview' ? (
          <>
            {swipedCard ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Ionicons name="albums-outline" size={16} color={colors.marketing} />
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                    The role you swiped
                  </Text>
                </View>
                <View
                  style={{
                    height: 460,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.paper,
                    padding: 16,
                  }}>
                  <ExpandedCard job={swipedCard} descLoading={false} />
                </View>
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name="information-circle-outline" size={17} color={colors.accent} />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                  About
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, lineHeight: 22 }}>
                {companyLoading
                  ? 'Gathering company details…'
                  : info?.about || 'No public profile found for this company yet.'}
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

        {tab === 'applied' ? (
          <>
            {applied.map((j) => {
              const meta = appliedStatusMeta(j.status, j.stage, { canOpenSite: !!j.apply_url });
              const when = appliedRelativeTime(j);
              const toneColor =
                meta.tone === 'positive'
                  ? colors.positive
                  : meta.tone === 'apply'
                    ? colors.applyLink
                    : meta.tone === 'waiting'
                      ? colors.waiting
                      : meta.tone === 'negative'
                        ? colors.negative
                        : colors.inkTertiary;
              return (
                <Pressable
                  key={j.auto_apply_id}
                  onPress={() => {
                    if (j.status === 'needs_attention') {
                      router.push(`/apply-questions/${j.auto_apply_id}`);
                    } else if (j.apply_url) {
                      Linking.openURL(j.apply_url);
                    }
                  }}>
                  <Card style={{ gap: 8 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.heading }}>
                      {j.job_title || 'Role'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: toneColor + '1A',
                        }}>
                        {!AUTO_APPLY_TERMINAL.includes(j.status) ? (
                          <ActivityIndicator size="small" color={toneColor} />
                        ) : null}
                        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11.5, color: toneColor }}>
                          {meta.label}
                        </Text>
                      </View>
                      {when ? (
                        <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                          {when}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            {/* Tap-to-apply: open roles at this company you haven't applied to. */}
            {renderOpenRoles(applied.length ? 'More open roles' : `Apply to open roles at ${company}`)}
            {!rolesQuery.isLoading && openRoles.length === 0 && applied.length === 0 ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21 }}>
                No open roles at {company} to apply to right now. Reach out with Find a contact, or
                check the Roles tab.
              </Text>
            ) : null}
          </>
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
            {reached.length > 0 ? (
              // The add-another tile lives at the end of the list — the action
              // sits exactly where the eye is when reviewing who you've reached.
              <Pressable onPress={() => setDialogOpen(true)} accessibilityRole="button">
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderStyle: 'dashed',
                    borderColor: colors.accent,
                    backgroundColor: 'transparent',
                  }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: colors.accent + '14',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="person-add" size={17} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.accent }}>
                      Find another contact
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      Someone new at {company} · {profile.creditsPerSwipe} credits
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>
            ) : null}
            {/* You already know someone here — apply to their open roles in a tap. */}
            {renderOpenRoles('Apply to open roles here')}
          </>
        ) : null}
        </ScrollView>
      )}

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
