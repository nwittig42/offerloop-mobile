import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import {
  AUTO_APPLY_TERMINAL,
  appliedRelativeTime,
  appliedStatusMeta,
  listAppliedJobs,
  type AppliedJob,
} from '@/api/endpoints/autoApply';

import CompanyLogo from '@/components/CompanyLogo';
import Header from '@/components/Header';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Network: applications and meeting prep. The Inbox owns the people and
 * conversations (it shows the same contacts), so Network is the outbound /
 * prep surface: a slim stats header, the companies you've reached into, the
 * jobs you applied to, and your coffee library. Deep pipeline work stays on web.
 */

const TABS = ['Companies', 'Applications', 'Meeting prep'] as const;
type TabKey = (typeof TABS)[number];

function BigNumber({ value, label }: { value: number; label: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.paper }}>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: '#E2E0FB' }}>
        {label}
      </Text>
    </View>
  );
}

export default function NetworkScreen() {
  const router = useRouter();
  const colors = useColors();
  const { outreach, trackerRows, meetingPreps, unreadCount, passedCount, savedCount } = useApp();
  const [tab, setTab] = useState<TabKey>('Companies');
  const [companyQuery, setCompanyQuery] = useState('');
  const [appQuery, setAppQuery] = useState('');
  const [gridCols, setGridCols] = useState(3); // density toggle: 2 / 3 / 4 up
  const [sortMode, setSortMode] = useState<'recent' | 'active'>('recent');
  const { width: windowWidth } = useWindowDimensions();

  // Applications submitted via auto-apply. Fetched on Applications (the list) and
  // Companies (the grid uses per-company applied counts); polls every 15s while
  // any application is still in flight (queued / running) so a submit lands
  // without a manual refresh. FOCUS-GATED: tab screens stay mounted in the
  // background, and this response is heavy (~5MB) — un-gated it kept hammering
  // the server every 8s from behind other tabs, which helped OOM the staging
  // box mid-draft (field-tested 2026-07-07). No polling unless you're looking.
  const isFocused = useIsFocused();
  const appliedQuery = useQuery({
    queryKey: ['appliedJobs'],
    queryFn: listAppliedJobs,
    enabled: isFocused && (tab === 'Applications' || tab === 'Companies'),
    refetchInterval: (q) => {
      if (!isFocused) return false;
      const items = q.state.data as AppliedJob[] | undefined;
      return items?.some((j) => !AUTO_APPLY_TERMINAL.includes(j.status)) ? 15_000 : false;
    },
  });
  const appliedJobs = appliedQuery.data ?? [];
  // Filter the applications list by company / role when the user searches.
  const filteredApplied = useMemo(() => {
    const q = appQuery.trim().toLowerCase();
    if (!q) return appliedJobs;
    return appliedJobs.filter(
      (j) =>
        (j.job_title || '').toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q),
    );
  }, [appliedJobs, appQuery]);

  const sentCount = outreach.filter((o) => o.status === 'sent' || o.status === 'replied').length;
  const repliedCount = outreach.filter((o) => o.status === 'replied').length;

  // Companies you've reached out to, most recent first (outreach is newest
  // first), each with how many people and replies.
  const companies = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { company: string; contacts: number; replies: number }>();
    for (const o of outreach) {
      if (o.status === 'drafting' || o.status === 'queued') continue;
      let e = map.get(o.company);
      if (!e) {
        e = { company: o.company, contacts: 0, replies: 0 };
        map.set(o.company, e);
        order.push(o.company);
      }
      e.contacts += 1;
      if (o.status === 'replied') e.replies += 1;
    }
    return order.map((c) => map.get(c)!);
  }, [outreach]);

  // One tile per company you've engaged with — applications submitted AND people
  // reached, merged so the Applications tab centers on companies (not scattered
  // lists). Tapping a tile opens that company's roles-applied + people-reached.
  const companyTiles = useMemo(() => {
    const keyOf = (c: string) => (c || '').trim().toLowerCase();
    // `recency` = position in the newest-first source lists (outreach + applied);
    // lower means more recently engaged, so the one you just did floats to top.
    const map = new Map<
      string,
      {
        company: string;
        applied: number;
        reached: number;
        replies: number;
        needsAttention: boolean;
        recency: number;
      }
    >();
    companies.forEach((c, i) => {
      const k = keyOf(c.company);
      if (!k) return;
      map.set(k, {
        company: c.company,
        applied: 0,
        reached: c.contacts,
        replies: c.replies,
        needsAttention: false,
        recency: i,
      });
    });
    appliedJobs.forEach((j, i) => {
      const k = keyOf(j.company);
      if (!k) return;
      let e = map.get(k);
      if (!e) {
        e = { company: j.company, applied: 0, reached: 0, replies: 0, needsAttention: false, recency: i };
        map.set(k, e);
      } else {
        e.recency = Math.min(e.recency, i);
      }
      e.applied += 1;
      if (j.status === 'needs_attention' || j.status === 'needs_verification') e.needsAttention = true;
    });
    return Array.from(map.values());
  }, [companies, appliedJobs]);

  const visibleTiles = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    const base = q ? companyTiles.filter((t) => t.company.toLowerCase().includes(q)) : companyTiles;
    const sorted = [...base];
    if (sortMode === 'recent') {
      sorted.sort((a, b) => a.recency - b.recency || b.applied - a.applied);
    } else {
      sorted.sort(
        (a, b) => b.applied - a.applied || b.reached - a.reached || a.company.localeCompare(b.company),
      );
    }
    return sorted;
  }, [companyTiles, companyQuery, sortMode]);

  // Density-adjustable grid; compute the exact tile width for the column count so
  // logos aren't stretched, and scale the logo down as the grid gets denser.
  const GRID_GAP = 12;
  const tileW = (windowWidth - 40 - GRID_GAP * (gridCols - 1)) / gridCols;
  const logoSize = gridCols <= 2 ? 66 : gridCols === 3 ? 52 : 40;

  const renderCompanyTile = (t: {
    company: string;
    applied: number;
    reached: number;
    replies: number;
    needsAttention: boolean;
  }) => (
    <Pressable
      key={t.company}
      onPress={() => router.push(`/company/${encodeURIComponent(t.company)}`)}
      style={{ width: tileW, alignItems: 'center', gap: 6, paddingVertical: 8 }}>
      <View>
        <CompanyLogo name={t.company} size={logoSize} radius={Math.round(logoSize * 0.25)} />
        {t.needsAttention ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: colors.negative,
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 12,
          color: colors.ink,
          textAlign: 'center',
          maxWidth: tileW,
        }}>
        {t.company}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {t.applied > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="briefcase" size={11} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
              {t.applied}
            </Text>
          </View>
        ) : null}
        {t.reached > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="person" size={11} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
              {t.reached}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Network"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        <Pressable onPress={() => router.push('/milestones')} accessibilityRole="button">
          <LinearGradient
            colors={['#2563EB', '#4F46E5', '#7C3AED'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1, color: '#E2E0FB' }}>
                YOUR GRIND
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="trophy" size={12} color="#FFFFFF" />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: '#FFFFFF' }}>
                  Milestones
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <BigNumber value={sentCount} label="Outreach sent" />
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <BigNumber value={repliedCount} label="Replies" />
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <BigNumber value={trackerRows.length} label="Reached" />
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 12 }}>
        <View
          style={{ flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between' }}>
          {TABS.map((t) => {
            const selected = t === tab;
            const icon =
              t === 'Applications'
                ? selected
                  ? 'briefcase'
                  : 'briefcase-outline'
                : t === 'Companies'
                  ? selected
                    ? 'business'
                    : 'business-outline'
                  : selected
                    ? 'cafe'
                    : 'cafe-outline';
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderBottomWidth: 2.5,
                  borderBottomColor: selected ? colors.navy : 'transparent',
                }}>
                <Ionicons name={icon} size={16} color={selected ? colors.navy : colors.inkTertiary} />
                <Text
                  style={{
                    fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                    fontSize: 13.5,
                    color: selected ? colors.navy : colors.inkTertiary,
                  }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'Applications' ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 13,
              color: colors.ink,
            }}>
            Your applications
          </Text>

          {appliedJobs.length > 5 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.surface,
                borderRadius: 10,
                paddingHorizontal: 12,
                height: 40,
              }}>
              <Ionicons name="search" size={16} color={colors.inkTertiary} />
              <TextInput
                value={appQuery}
                onChangeText={setAppQuery}
                placeholder="Search applications"
                placeholderTextColor={colors.inkTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
              />
              {appQuery ? (
                <Pressable onPress={() => setAppQuery('')} accessibilityRole="button">
                  <Ionicons name="close-circle" size={16} color={colors.inkTertiary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {appliedQuery.isLoading ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingVertical: 24,
              }}>
              Loading your applications…
            </Text>
          ) : appliedQuery.isError ? (
            <Card>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                Couldn't load your applications right now.
              </Text>
              <Pressable
                onPress={() => appliedQuery.refetch()}
                accessibilityRole="button"
                style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, fontWeight: '600', color: colors.accent }}>
                  Tap to retry
                </Text>
              </Pressable>
            </Card>
          ) : appliedJobs.length === 0 ? (
            <Card>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                No applications yet. Turn on Auto-apply in swipe settings, then swipe right on a
                job to submit. Every application you send shows up here with its status.
              </Text>
            </Card>
          ) : filteredApplied.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingVertical: 16,
              }}>
              No applications match that search.
            </Text>
          ) : (
            filteredApplied.map((j) => {
              const meta = appliedStatusMeta(j.status, j.stage, { canOpenSite: !!j.apply_url });
              const when = appliedRelativeTime(j);
              const toneColor =
                meta.tone === 'positive'
                  ? colors.positive
                  : meta.tone === 'waiting'
                    ? colors.waiting
                    : meta.tone === 'negative'
                      ? colors.negative
                      : colors.inkTertiary;
              return (
                <Pressable
                  key={j.auto_apply_id}
                  onPress={() => {
                    // Needs-input applications open the in-app answer screen;
                    // everything else opens the listing on the company site.
                    if (j.status === 'needs_attention') {
                      router.push(`/apply-questions/${j.auto_apply_id}`);
                    } else if (j.apply_url) {
                      Linking.openURL(j.apply_url);
                    }
                  }}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <CompanyLogo name={j.company} size={38} radius={10} />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                        {j.job_title || 'Role'}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                        {j.company}
                        {j.ats_platform ? ` · ${j.ats_platform}` : ''}
                        {when ? ` · ${when}` : ''}
                      </Text>
                      {/* The backend explains exactly why an application didn't go
                          through ("this employer's Location field wouldn't accept an
                          automated answer — open the listing and finish it there").
                          Showing only "Apply on the site" with no reason is half an
                          answer; the user is left guessing whether we broke or the
                          form did. */}
                      {j.failure_reason && (j.status === 'failed' || j.status === 'submit_failed') ? (
                        <Text
                          numberOfLines={2}
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 11.5,
                            color: colors.inkTertiary,
                            lineHeight: 16,
                            marginTop: 2,
                          }}>
                          {j.failure_reason}
                        </Text>
                      ) : null}
                    </View>
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
                    {j.status === 'needs_attention' || j.apply_url ? (
                      <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                    ) : null}
                  </Card>
                </Pressable>
              );
            })
          )}

          {appliedJobs.length > 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.inkTertiary,
                textAlign: 'center',
                paddingTop: 6,
                lineHeight: 18,
              }}>
              “Needs verification” means the employer emailed a code we’re completing for you. Tap
              an application to open it on the company site.
            </Text>
          ) : null}
        </ScrollView>
      ) : tab === 'Companies' ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
                Companies
              </Text>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
                {companyTiles.length}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setGridCols((c) => (c >= 4 ? 2 : c + 1))}
                accessibilityRole="button"
                accessibilityLabel="Change grid density"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.paper,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                <Ionicons name="grid-outline" size={13} color={colors.inkSecondary} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                  {gridCols}×
                </Text>
              </Pressable>
              {savedCount > 0 ? (
                <Pressable
                  onPress={() => router.push('/saved-jobs')}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: colors.paper,
                    borderRadius: 999,
                    paddingLeft: 10,
                    paddingRight: 12,
                    paddingVertical: 6,
                  }}>
                  <Ionicons name="bookmark" size={12} color={colors.accent} />
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    {savedCount} saved
                  </Text>
                </Pressable>
              ) : null}
              {passedCount > 0 ? (
                <Pressable
                  onPress={() => router.push('/passed-jobs')}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: colors.paper,
                    borderRadius: 999,
                    paddingLeft: 10,
                    paddingRight: 12,
                    paddingVertical: 6,
                  }}>
                  <Ionicons name="trash-outline" size={13} color={colors.inkSecondary} />
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    {passedCount} passed
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {companyTiles.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['recent', 'active'] as const).map((m) => {
                const on = sortMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setSortMode(m)}
                    accessibilityRole="button"
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: on ? colors.navy : colors.paper,
                    }}>
                    <Text
                      style={{
                        fontFamily: on ? fonts.sansSemibold : fonts.sansMedium,
                        fontSize: 12,
                        color: on ? colors.paper : colors.inkSecondary,
                      }}>
                      {m === 'recent' ? 'Recent' : 'Most active'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {companyTiles.length === 0 ? (
            <Card>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                No companies yet. Swipe right on a job to apply or reach out, and every company you
                engage lands here.
              </Text>
            </Card>
          ) : (
            <>
              {companyTiles.length > 9 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: colors.paper,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    height: 40,
                  }}>
                  <Ionicons name="search" size={16} color={colors.inkTertiary} />
                  <TextInput
                    value={companyQuery}
                    onChangeText={setCompanyQuery}
                    placeholder="Search companies"
                    placeholderTextColor={colors.inkTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
                  />
                  {companyQuery ? (
                    <Pressable onPress={() => setCompanyQuery('')} accessibilityRole="button">
                      <Ionicons name="close-circle" size={16} color={colors.inkTertiary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                {visibleTiles.map(renderCompanyTile)}
              </View>
              {visibleTiles.length === 0 ? (
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: colors.inkSecondary,
                    textAlign: 'center',
                    paddingVertical: 16,
                  }}>
                  No companies match that search.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              Coffee library
            </Text>
            <Pressable
              onPress={() => router.push('/meeting-prep/new')}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: '#FACC15',
                borderRadius: 8,
                paddingHorizontal: 13,
                height: 34,
              }}>
              <Ionicons name="cafe" size={15} color={colors.coffee} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.coffee }}>
                New prep
              </Text>
            </Pressable>
          </View>

          {meetingPreps.length === 0 ? (
            <Card>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                No preps yet. Before a coffee chat or career fair, prep someone from their
                LinkedIn and it lands here.
              </Text>
            </Card>
          ) : (
            meetingPreps.map((prep) => (
              <Pressable key={prep.id} onPress={() => router.push(`/meeting-prep/${prep.id}`)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.coffee + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="cafe" size={18} color={colors.coffee} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                      {prep.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                      {prep.title} at {prep.company}
                    </Text>
                    {/* A prep is a ~2min async job, but this card showed no status
                        at all — and createdLabel is hardcoded "Prepped", so one
                        that was still building already claimed to be done, and a
                        failed one looked finished too. Say what it actually is. */}
                    {prep.status === 'processing' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <ActivityIndicator size="small" color={colors.coffee} />
                        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.coffee }}>
                          Prepping… we’ll notify you
                        </Text>
                      </View>
                    ) : prep.status === 'failed' ? (
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.negative }}>
                        Didn’t finish — tap to retry
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                        {prep.createdLabel}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>
            ))
          )}

          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.inkTertiary,
              textAlign: 'center',
              paddingTop: 6,
            }}>
            Coffee chat prep is free and runs the same research as the web
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
