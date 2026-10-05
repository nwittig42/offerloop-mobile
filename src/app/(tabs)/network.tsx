import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  AUTO_APPLY_TERMINAL,
  appliedRelativeTime,
  appliedStatusMeta,
  listAppliedJobs,
  needsUserCount,
  type AppliedJob,
} from '@/api/endpoints/autoApply';
import { fetchContacts, type Contact, type ContactState } from '@/api/endpoints/contacts';
import CompanyLogo from '@/components/CompanyLogo';
import Header from '@/components/Header';
import NightSky from '@/components/NightSky';
import Card from '@/components/ui/Card';
import { sameCompany } from '@/lib/company';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { BRAND_CTA_BG, BRAND_CTA_FG, fonts } from '@/theme/tokens';

/**
 * Network: your progress up top, then people, applications and meetings.
 *
 * The dashboard is deliberately the loudest thing on the screen. It is the one
 * surface in the app that tells a student the grind is adding up, and a row of
 * grey numbers does not do that — the blue is the point, not decoration.
 *
 * Under it, three tabs, because these are three different questions: who do I
 * know, what did I apply to, and who am I meeting. The work that is actually
 * OWED lives at the top of Applications in red, and the same count rides the
 * tab bar badge, so it cannot be missed and cannot be misread as decoration.
 */

const TABS = ['Contacts', 'Applications', 'Meetings'] as const;
type TabKey = (typeof TABS)[number];

/** The dashboard gradient is fixed in both themes, so text on it is fixed too. */
const GRADIENT = ['#2563EB', '#4F46E5', '#7C3AED'] as const;
const ON_GRADIENT = '#FFFFFF';
const ON_GRADIENT_SOFT = '#DDE3FB';

const STATE_MARK: Record<ContactState, { icon: keyof typeof Ionicons.glyphMap | null; label: string }> = {
  replied: { icon: 'arrow-undo', label: 'Replied' },
  waiting: { icon: 'time-outline', label: 'Waiting on a reply' },
  drafted: { icon: 'create-outline', label: 'Draft ready' },
  new: { icon: null, label: 'Not contacted yet' },
};

const IN_FLIGHT = (j: AppliedJob) => !AUTO_APPLY_TERMINAL.includes(j.status);
// Red is for homework: questions only the student can answer. An emailed
// verification code is a different, calmer ask (and often resolves on its
// own), so it gets its own amber card below rather than swelling the red one.
const NEEDS_YOU = (j: AppliedJob) => j.status === 'needs_attention';
const NEEDS_CODE = (j: AppliedJob) => j.status === 'needs_verification';

// Newest leads and is the default (Rylan 2026-08-18): "I just did that" is a
// small win every visit, and an A-Z list reads identical day after day until
// the network is big enough to need looking things up.
const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'az', label: 'A-Z' },
  { key: 'company', label: 'Company' },
  { key: 'oldest', label: 'Oldest' },
] as const;
type SortMode = (typeof SORTS)[number]['key'];

/** One company in the grid: the logo, and what the student has going there. */
type CompanyTile = {
  company: string;
  people: number;
  applied: number;
  needsAttention: boolean;
  recency: string;
};

/**
 * One person, the way they look everywhere in this tab.
 *
 * `showCompany` is the only difference between the two views: the flat list
 * reads "Sara Wittig · Abbott" because there is no header to tell you where
 * she works, while the grouped list already said ABBOTT one row up and
 * repeating it is noise.
 */
function ContactRow({
  contact,
  showCompany,
  onPress,
  colors,
}: {
  contact: Contact;
  showCompany: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const mark = STATE_MARK[contact.state];
  const markColor =
    contact.state === 'replied'
      ? colors.positive
      : contact.state === 'drafted'
        ? colors.accent
        : colors.inkTertiary;
  // Name then company on the SAME line ("Sara Wittig · Abbott"), title under
  // it. In the grouped view the header already said the company one row up, so
  // repeating it there is noise.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${contact.title || 'no title'}, ${contact.company || 'no company'}, ${mark.label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.hairline,
        backgroundColor: colors.paper,
      }}>
      <CompanyLogo name={contact.company} size={38} radius={10} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
          {contact.name}
          {showCompany && contact.company ? (
            <Text style={{ fontFamily: fonts.sans, color: colors.inkSecondary }}>
              {'  ·  '}
              {contact.company}
            </Text>
          ) : null}
        </Text>
        {contact.title ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
            {contact.title}
          </Text>
        ) : null}
      </View>
      {mark.icon ? (
        <Ionicons name={mark.icon} size={15} color={markColor} />
      ) : (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.inkTertiary,
            opacity: 0.5,
          }}
        />
      )}
      <Ionicons name="chevron-forward" size={15} color={colors.inkTertiary} />
    </Pressable>
  );
}

function BigNumber({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 46, color: ON_GRADIENT }}>{value}</Text>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: ON_GRADIENT_SOFT }}>
        {label}
      </Text>
    </View>
  );
}

export default function NetworkScreen() {
  const router = useRouter();
  const colors = useColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const isFocused = useIsFocused();
  const { unreadCount, meetingPreps, passedPeople, passedJobs } = useApp();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Scout's receipt chips deep-link here ("Open Applications"), so the tab is
  // addressable. Anything unrecognised falls back to Contacts rather than
  // rendering a blank tab.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: TabKey =
    TABS.find((t) => t.toLowerCase() === String(tabParam || '').toLowerCase()) || 'Contacts';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState('');
  // A-Z by default: a student looking for a name scans alphabetically without
  // being taught anything. The other three answer different questions, so they
  // are one tap away rather than the only view. "Company" is not a sort at all
  // — it swaps the list for the company grid.
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const contactsQuery = useQuery({ queryKey: ['contacts'], queryFn: () => fetchContacts() });
  // A reveal on the Feed writes a contact the moment the draft lands, but
  // this tab used to load once and sit on it (Rylan 2026-09-03: three drafts
  // in Inbox, an empty Network). Every visit to the tab re-reads the list.
  useEffect(() => {
    if (isFocused) void contactsQuery.refetch();
    // refetch is stable; re-running on focus is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
  const contacts = useMemo(() => {
    // Dedupe at the source (Rylan 2026-08-18: the same person showed 2-3x;
    // several server write paths can each mint a doc for one human). Keyed
    // by linkedin, else name+company; keeps the row with the latest
    // activity. The server-side guard shipped the same day, this covers the
    // docs that already exist.
    const raw = contactsQuery.data ?? [];
    const byKey = new Map<string, (typeof raw)[number]>();
    for (const c of raw) {
      const key =
        c.linkedinUrl?.trim().toLowerCase() || `${c.name}::${c.company}`.toLowerCase();
      const prev = byKey.get(key);
      if (!prev || (c.lastActivity || '') > (prev.lastActivity || '')) byKey.set(key, c);
    }
    return [...byKey.values()];
  }, [contactsQuery.data]);

  const appliedQuery = useQuery({
    queryKey: ['applied-jobs'],
    queryFn: () => listAppliedJobs(),
    enabled: isFocused,
    refetchInterval: (q) => {
      const items = q.state.data as AppliedJob[] | undefined;
      return items?.some(IN_FLIGHT) ? 8000 : false;
    },
  });
  const appliedJobs = useMemo(() => appliedQuery.data ?? [], [appliedQuery.data]);
  const needsYou = needsUserCount(appliedJobs);
  const repliedCount = contacts.filter((c) => c.state === 'replied').length;

  // One search box, re-pointed at whatever tab is showing. Cleared on switch so
  // a query typed for people never silently hides half the applications.
  const q = query.trim().toLowerCase();

  const filteredContacts = useMemo(() => {
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q),
    );
  }, [contacts, q]);

  const sortedContacts = useMemo(() => {
    const out = [...filteredContacts];
    if (sortMode === 'newest') {
      out.sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
    } else if (sortMode === 'oldest') {
      // People with no activity at all sort to the END of oldest-first: they
      // were never contacted, so "longest since I did something" does not apply
      // to them, and burying the real stale ones under them would be wrong.
      out.sort((a, b) => {
        if (!a.lastActivity && !b.lastActivity) return a.name.localeCompare(b.name);
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return a.lastActivity.localeCompare(b.lastActivity);
      });
    } else {
      out.sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [filteredContacts, sortMode]);

  /** Company tiles: everyone grouped, plus what has been applied to there. */
  const companyTiles = useMemo(() => {
    const tiles: CompanyTile[] = [];
    const find = (c: string) => tiles.find((t) => sameCompany(t.company, c));
    for (const c of filteredContacts) {
      const name = (c.company || '').trim();
      if (!name) continue;
      const e = find(name);
      if (e) {
        e.people += 1;
        if (c.lastActivity > e.recency) e.recency = c.lastActivity;
      } else {
        tiles.push({
          company: name,
          people: 1,
          applied: 0,
          needsAttention: false,
          recency: c.lastActivity,
        });
      }
    }
    // Applications fold onto the same tile, so "Palantir" (people) and
    // "Palantir Technologies" (applied) are one company, not two.
    for (const j of appliedJobs) {
      const name = (j.company || '').trim();
      if (!name) continue;
      let e = find(name);
      if (!e) {
        // Only surface an applied-only company when nothing is being searched;
        // otherwise a search for a person's name would sprout unrelated tiles.
        if (q) continue;
        e = { company: name, people: 0, applied: 0, needsAttention: false, recency: '' };
        tiles.push(e);
      }
      e.applied += 1;
      if (NEEDS_YOU(j)) e.needsAttention = true;
    }
    tiles.sort((a, b) => a.company.localeCompare(b.company));
    return tiles;
  }, [filteredContacts, appliedJobs, q]);

  const filteredApplied = useMemo(() => {
    if (!q) return appliedJobs;
    return appliedJobs.filter(
      (j) =>
        (j.job_title || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q),
    );
  }, [appliedJobs, q]);

  const needsList = filteredApplied.filter(NEEDS_YOU);
  const codeList = filteredApplied.filter(NEEDS_CODE);
  const doneList = filteredApplied.filter((j) => !NEEDS_YOU(j) && !NEEDS_CODE(j));

  const switchTab = (t: TabKey) => {
    setTab(t);
    setQuery('');
  };

  // Three up, matching the reference. Width is computed rather than flexed so
  // the logos are never stretched to fill an odd remainder.
  const GRID_GAP = 12;
  const tileW = (windowWidth - 40 - GRID_GAP * 2) / 3;
  const LOGO_SIZE = 62;

  const searchPlaceholder =
    tab === 'Contacts'
      ? 'Search people and companies'
      : tab === 'Applications'
        ? 'Search applications'
        : 'Search meetings';

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* The mountains stay. Low opacity so a dense list still reads cleanly
          over them, and static rather than parallaxed — a drifting backdrop
          under a list of names fights the thing you are trying to read. */}
      <NightSky />
      {!isDark ? (
        <>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: windowHeight, opacity: 0.55 }}>
            <Image
              source={require('../../../assets/images/foggy-trees.jpeg')}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.surface + '66', colors.surface + '99', colors.surface + 'CC']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}

      <Header
        title="Network"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* ── The dashboard ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 18, padding: 18, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  color: ON_GRADIENT_SOFT,
                }}>
                YOUR PROGRESS
              </Text>
              {/* Gold, deliberately (Rylan 2026-08-18): the one warm note on a
                  cool gradient, so the trophy reads as a prize and not chrome. */}
              <Pressable
                onPress={() => router.push('/milestones')}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: 'rgba(251,191,36,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(251,191,36,0.45)',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}>
                <Ionicons name="trophy" size={13} color="#FBBF24" />
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: '#FDE68A' }}>
                  Milestones
                </Text>
                <Ionicons name="chevron-forward" size={13} color="#FDE68A" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <BigNumber value={appliedJobs.length} label="Applied" />
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <BigNumber value={contacts.length} label="Contacts" />
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              <BigNumber value={repliedCount} label="Replies" />
            </View>

            {/* The one live piece of the dashboard: work that is owed. Sits
                inside the card so it inherits the weight, and goes straight to
                the pinned group rather than the tab in general. */}
            {/* The page's real call to action, so it dresses like one: solid
                white on the gradient with a red count, not a translucent row
                that washes into the card (Rylan 2026-08-18). */}
            {needsYou > 0 ? (
              <Pressable
                onPress={() => switchTab('Applications')}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  shadowColor: '#000000',
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 4,
                }}>
                <View
                  style={{
                    minWidth: 24,
                    height: 24,
                    borderRadius: 12,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#DC2626',
                  }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: '#FFFFFF' }}>
                    {needsYou}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13.5, color: '#1B2A44' }}>
                  application{needsYou === 1 ? '' : 's'} need{needsYou === 1 ? 's' : ''} your
                  answers
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#1B2A44" />
              </Pressable>
            ) : null}
          </LinearGradient>
        </View>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between' }}>
            {TABS.map((t) => {
              const selected = t === tab;
              const icon: keyof typeof Ionicons.glyphMap =
                t === 'Contacts'
                  ? selected
                    ? 'people'
                    : 'people-outline'
                  : t === 'Applications'
                    ? selected
                      ? 'briefcase'
                      : 'briefcase-outline'
                    : selected
                      ? 'cafe'
                      : 'cafe-outline';
              return (
                <Pressable
                  key={t}
                  onPress={() => switchTab(t)}
                  accessibilityRole="button"
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
                  {t === 'Applications' && needsYou > 0 ? (
                    <View
                      style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        paddingHorizontal: 5,
                        backgroundColor: colors.negative,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10.5, color: '#FFFFFF' }}>
                        {needsYou}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Search ──────────────────────────────────────────────────── */}
        {(tab === 'Contacts' && contacts.length > 8) ||
        (tab === 'Applications' && appliedJobs.length > 5) ||
        (tab === 'Meetings' && meetingPreps.length > 5) ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 20,
              paddingTop: 12,
            }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.paper,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: 12,
                height: 40,
              }}>
              <Ionicons name="search" size={16} color={colors.inkTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.inkTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.ink }}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityRole="button">
                  <Ionicons name="close-circle" size={16} color={colors.inkTertiary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Filter by. Four short chips beat a hidden menu: the student sees
            every way to look at the list, and switching is one tap rather than
            open-read-choose. "Company" is the odd one out — it swaps the list
            for the grid — so it reads as a destination, not a sort. */}
        {/* The two bins. Passed jobs had a screen and no way to reach it;
            passed people had neither (Rylan 2026-09-03). */}
        {tab === 'Contacts' && (passedPeople.length > 0 || passedJobs.length > 0) ? (
          <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingTop: 10 }}>
            {passedPeople.length > 0 ? (
              <Pressable
                onPress={() => router.push('/passed-people' as never)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 }}>
                <Ionicons name="arrow-undo-outline" size={14} color={colors.marketing} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.marketing }}>
                  People you passed on ({passedPeople.length})
                </Text>
              </Pressable>
            ) : null}
            {passedJobs.length > 0 ? (
              <Pressable
                onPress={() => router.push('/passed-jobs')}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 }}>
                <Ionicons name="arrow-undo-outline" size={14} color={colors.marketing} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.marketing }}>
                  Jobs you passed on ({passedJobs.length})
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {tab === 'Contacts' && contacts.length > 1 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 20,
              paddingTop: 10,
            }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
              Filter by
            </Text>
            {SORTS.map((m) => {
              const on = sortMode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setSortMode(m.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? colors.navy : colors.hairline,
                    backgroundColor: on ? colors.navy : colors.paper,
                  }}>
                  <Text
                    style={{
                      fontFamily: on ? fonts.sansSemibold : fonts.sansMedium,
                      fontSize: 12,
                      color: on ? '#FFFFFF' : colors.inkSecondary,
                    }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* ── Contacts ────────────────────────────────────────────────── */}
        {tab === 'Contacts' ? (
          contactsQuery.isLoading ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingVertical: 32,
              }}>
              Loading your network…
            </Text>
          ) : contactsQuery.isError ? (
            <View style={{ padding: 20, alignItems: 'center', gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                Couldn&apos;t load your contacts right now.
              </Text>
              <Pressable onPress={() => contactsQuery.refetch()} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.accent }}>
                  Tap to retry
                </Text>
              </Pressable>
            </View>
          ) : contacts.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                lineHeight: 20,
                padding: 24,
              }}>
              Nobody here yet. Swipe right on someone in the feed, or ask Scout to find people at a
              company you care about.
            </Text>
          ) : filteredContacts.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: colors.inkSecondary,
                textAlign: 'center',
                paddingVertical: 24,
              }}>
              Nobody matches that search.
            </Text>
          ) : (
            sortMode === 'company' ? (
              companyTiles.length === 0 ? (
                <Text
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: colors.inkSecondary,
                    textAlign: 'center',
                    paddingVertical: 24,
                  }}>
                  No companies match that search.
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: GRID_GAP,
                    paddingHorizontal: 20,
                    paddingTop: 14,
                  }}>
                  {companyTiles.map((t) => (
                    <Pressable
                      key={t.company}
                      onPress={() => router.push(`/company/${encodeURIComponent(t.company)}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.company}, ${t.people} contact${t.people === 1 ? '' : 's'}${t.applied ? `, ${t.applied} applied` : ''}`}
                      style={{ width: tileW, alignItems: 'center', gap: 6, paddingVertical: 8 }}>
                      <View>
                        <CompanyLogo name={t.company} size={LOGO_SIZE} radius={16} />
                        {/* The red dot is the same "needs your answers" state
                            the tab badge counts, so a company with homework is
                            visible without opening it. */}
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
                          fontSize: 12.5,
                          color: colors.ink,
                          textAlign: 'center',
                          maxWidth: tileW,
                        }}>
                        {t.company}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                        {t.people > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="person" size={11} color={colors.inkTertiary} />
                            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
                              {t.people}
                            </Text>
                          </View>
                        ) : null}
                        {t.applied > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="briefcase" size={11} color={colors.inkTertiary} />
                            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
                              {t.applied}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : (

              <View style={{ paddingTop: 12 }}>
                {sortedContacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    showCompany
                    colors={colors}
                    onPress={() => router.push(`/contact/${encodeURIComponent(c.id)}`)}
                  />
                ))}
              </View>
            )
          )
        ) : null}

        {/* ── Applications ────────────────────────────────────────────── */}
        {tab === 'Applications' ? (
          <View style={{ padding: 16, gap: 10 }}>
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
            ) : appliedJobs.length === 0 ? (
              <Card>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                  No applications yet. Swipe right on a job in the feed, or ask Scout to apply to
                  something.
                </Text>
              </Card>
            ) : (
              <>
                {/* Needs you: a red block, not a row in a list. This is the only
                    thing on the screen that is homework, and the whole reason
                    the tab has a badge. */}
                {needsList.length > 0 ? (
                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: colors.negative + '55',
                      backgroundColor: colors.negative + '0F',
                      padding: 12,
                      gap: 10,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="alert-circle" size={18} color={colors.negative} />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: fonts.sansSemibold,
                          fontSize: 14,
                          color: colors.negative,
                        }}>
                        {needsList.length} need{needsList.length === 1 ? 's' : ''} your answers
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12.5,
                        color: colors.inkSecondary,
                        lineHeight: 18,
                      }}>
                      These stopped on a question only you can answer. Tap one, fill it in, and it
                      finishes submitting itself.
                    </Text>
                    {needsList.map((j) => {
                      const qs = j.pending_questions || [];
                      // Say what is actually waiting. "Finish" alone never told
                      // the student that tapping opens a form, or how much work
                      // it is — naming the questions makes the doorway obvious
                      // before they commit to walking through it.
                      const what = qs.length
                        ? `${qs.length} question${qs.length === 1 ? '' : 's'} to answer`
                        : 'A few questions to answer';
                      // Pending questions carry their text under "question";
                      // reading only "label" left this preview permanently
                      // blank (same field-name bug the answer library had).
                      const firstQ: any = qs[0] || {};
                      const preview = firstQ.label || firstQ.question || '';
                      return (
                        <Pressable
                          key={j.auto_apply_id}
                          onPress={() => router.push(`/apply-questions/${j.auto_apply_id}`)}
                          accessibilityRole="button"
                          accessibilityLabel={`${j.job_title} at ${j.company}. ${what}. Opens the answer form.`}
                          style={{
                            backgroundColor: colors.paper,
                            borderRadius: 12,
                            overflow: 'hidden',
                          }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                              padding: 11,
                            }}>
                            <CompanyLogo name={j.company} size={36} radius={9} />
                            <View style={{ flex: 1 }}>
                              <Text
                                numberOfLines={2}
                                style={{
                                  fontFamily: fonts.sansSemibold,
                                  fontSize: 14,
                                  color: colors.ink,
                                  lineHeight: 18,
                                }}>
                                {j.job_title || 'Role'}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                                {j.company}
                              </Text>
                            </View>
                          </View>
                          {preview ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 12,
                                color: colors.inkTertiary,
                                fontStyle: 'italic',
                                paddingHorizontal: 11,
                                paddingBottom: 8,
                              }}>
                              &ldquo;{preview}&rdquo;
                            </Text>
                          ) : null}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingHorizontal: 11,
                              paddingVertical: 9,
                              borderTopWidth: StyleSheet.hairlineWidth,
                              borderTopColor: colors.hairline,
                              backgroundColor: colors.negative + '0D',
                            }}>
                            <Ionicons
                              name="help-circle-outline"
                              size={15}
                              color={colors.negative}
                            />
                            <Text
                              style={{
                                flex: 1,
                                fontFamily: fonts.sansMedium,
                                fontSize: 12.5,
                                color: colors.negative,
                              }}>
                              {what}
                            </Text>
                            <Text
                              style={{
                                fontFamily: fonts.sansSemibold,
                                fontSize: 13,
                                color: colors.negative,
                              }}>
                              Answer them
                            </Text>
                            <Ionicons name="chevron-forward" size={15} color={colors.negative} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {/* Waiting on an emailed code: a calmer ask than the red
                    block. The company's system emailed a confirmation code;
                    tapping opens the entry form, and if the email never came
                    the honest fallback is applying on the site. Amber, not
                    red: this is a hold-up, not homework. */}
                {codeList.length > 0 ? (
                  <View
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.waiting + '66',
                      backgroundColor: colors.waiting + '14',
                      padding: 12,
                      gap: 8,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="mail-unread-outline" size={16} color={colors.waiting} />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: fonts.sansSemibold,
                          fontSize: 13.5,
                          color: colors.ink,
                        }}>
                        Waiting on an email confirmation
                      </Text>
                    </View>
                    {codeList.map((j) => (
                      <Pressable
                        key={j.auto_apply_id}
                        onPress={() => router.push(`/apply-questions/${j.auto_apply_id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${j.job_title} at ${j.company}. Waiting on an emailed code. Opens the code entry.`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          backgroundColor: colors.paper,
                          borderRadius: 12,
                          padding: 11,
                        }}>
                        <CompanyLogo name={j.company} size={32} radius={8} />
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
                            {j.job_title || 'Role'}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                            The company emailed a code. Have it? Tap to enter it.
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={15} color={colors.inkTertiary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {doneList.length > 0 ? (
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 11.5,
                      letterSpacing: 0.8,
                      color: colors.inkTertiary,
                      marginTop: 6,
                    }}>
                    ALL APPLICATIONS
                  </Text>
                ) : null}

                {doneList.length === 0 && needsList.length === 0 ? (
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
                ) : null}

                {doneList.map((j) => {
                  const meta = appliedStatusMeta(j.status, j.stage, {
                    canOpenSite: !!j.apply_url,
                    evidence: j.submit_evidence,
                    company: j.company,
                  });
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
                        if (j.apply_url) Linking.openURL(j.apply_url);
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
                            {when ? ` · ${when}` : ''}
                          </Text>
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
                          {meta.detail ? (
                            <Text
                              numberOfLines={2}
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 11.5,
                                color: colors.inkTertiary,
                                lineHeight: 16,
                                marginTop: 2,
                              }}>
                              {meta.detail}
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
                          {IN_FLIGHT(j) ? <ActivityIndicator size="small" color={toneColor} /> : null}
                          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11.5, color: toneColor }}>
                            {meta.label}
                          </Text>
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {/* ── Meetings ────────────────────────────────────────────────── */}
        {tab === 'Meetings' ? (
          <View style={{ padding: 16, gap: 10 }}>
            <Pressable
              onPress={() => router.push('/meeting-prep/new')}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 46,
                borderRadius: 10,
                // Fixed black, not colors.ink (Rylan 2026-09-11: the same
                // dark-mode wash-out as "Get started").
                backgroundColor: BRAND_CTA_BG,
              }}>
              <Ionicons name="add" size={18} color={BRAND_CTA_FG} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: BRAND_CTA_FG }}>
                Prep for a meeting
              </Text>
            </Pressable>

            {meetingPreps.length === 0 ? (
              <Card>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
                  No preps yet. Paste someone&apos;s LinkedIn and you get a brief on them plus
                  talking points before the chat.
                </Text>
              </Card>
            ) : (
              meetingPreps
                .filter(
                  (p) =>
                    !q ||
                    p.name.toLowerCase().includes(q) ||
                    (p.company || '').toLowerCase().includes(q),
                )
                .map((p) => (
                  <Pressable key={p.id} onPress={() => router.push(`/meeting-prep/${p.id}`)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <CompanyLogo name={p.company} size={38} radius={10} />
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                          {p.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                          {[p.title, p.company].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      {p.status === 'processing' ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                          {p.createdLabel}
                        </Text>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                    </Card>
                  </Pressable>
                ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
