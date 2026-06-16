import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import Avatar from '@/components/Avatar';
import CompanyLogo from '@/components/CompanyLogo';
import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchBar from '@/components/ui/SearchBar';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { TrackerRow } from '@/types';

/**
 * Network: who you have reached out to, plus your coffee library. Two tabs
 * (Contacts, Meeting prep) like Profile and Loops. Each contact row carries
 * two quick actions: a coffee button (prep a meeting with them) and a plus
 * button (find another contact at the same company, the widen-your-reach
 * move surfaced right on the row). Deep pipeline work stays on the web.
 */

const TABS = ['Contacts', 'Meeting prep'] as const;
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

/**
 * A contact row in the iMessage style: gradient avatar, bold name with a
 * timestamp, a gray preview line, an unread dot when they're waiting on you,
 * and swipe-left actions (prep a meeting, reach another contact).
 */
function ContactRow({
  row,
  onOpen,
  onCoffee,
  onTogglePin,
}: {
  row: TrackerRow;
  onOpen: () => void;
  onCoffee: () => void;
  onTogglePin: () => void;
}) {
  const colors = useColors();
  return (
    <ReanimatedSwipeable
      friction={1.6}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          onPress={onCoffee}
          style={{
            width: 88,
            backgroundColor: colors.coffee,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }}>
          <Ionicons name="cafe" size={20} color={colors.paper} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.paper }}>Prep</Text>
        </Pressable>
      )}>
      <Pressable
        onPress={onOpen}
        onLongPress={onTogglePin}
        delayLongPress={280}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 16,
          paddingRight: 16,
          paddingVertical: 9,
          backgroundColor: row.pinned ? colors.paper2 : colors.paper,
        }}>
        <View style={{ width: 8, alignItems: 'center' }}>
          {row.unread ? (
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.marketing }} />
          ) : null}
        </View>
        <Avatar name={row.contactName} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15.5, color: colors.ink }}>
              {row.contactName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {row.pinned ? (
                <Ionicons name="pin" size={12} color={colors.accent} style={{ marginRight: 1 }} />
              ) : null}
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                {row.timeShort}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.inkTertiary} />
            </View>
          </View>
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 18 }}>
            {row.preview}
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function NetworkScreen() {
  const router = useRouter();
  const colors = useColors();
  const { outreach, trackerRows, meetingPreps, unreadCount, passedCount, toggleContactPin, showToast } =
    useApp();
  const [tab, setTab] = useState<TabKey>('Contacts');
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filteredContacts = useMemo(() => {
    const rows =
      q === ''
        ? trackerRows
        : trackerRows.filter((r) =>
            [r.contactName, r.company, r.preview].some((s) => s?.toLowerCase().includes(q)),
          );
    // Pinned float to the top, otherwise keep the existing order.
    return [...rows].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [trackerRows, q]);

  const onTogglePin = (row: TrackerRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleContactPin(row.id);
    showToast(row.pinned ? 'Unpinned' : 'Pinned to top');
  };

  const sentCount = outreach.filter((o) => o.status === 'sent' || o.status === 'replied').length;
  const repliedCount = outreach.filter((o) => o.status === 'replied').length;

  // Companies you've reached out to, most recent first (outreach is newest
  // first), each with how many people and replies.
  const companies = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { company: string; contacts: number; replies: number }>();
    for (const o of outreach) {
      if (o.status === 'drafting') continue;
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
              <BigNumber value={trackerRows.length} label="Contacts" />
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 22 }}>
          {TABS.map((t) => {
            const selected = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
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
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'Contacts' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
            {companies.length ? (
              <>
                <Pressable
                  onPress={() => setCompaniesOpen((v) => !v)}
                  disabled={companies.length <= 1}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 2,
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
                    Companies you've reached out to
                  </Text>
                  {companies.length > 1 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
                        {companiesOpen ? 'Show less' : `All ${companies.length}`}
                      </Text>
                      <Ionicons
                        name={companiesOpen ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={colors.inkTertiary}
                      />
                    </View>
                  ) : null}
                </Pressable>
                {(companiesOpen ? companies : companies.slice(0, 1)).map((c) => (
                  <Pressable
                    key={c.company}
                    onPress={() => router.push(`/company/${encodeURIComponent(c.company)}`)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <CompanyLogo name={c.company} size={38} radius={10} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                          {c.company}
                        </Text>
                        <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                          {c.contacts} {c.contacts === 1 ? 'contact' : 'contacts'}
                          {c.replies > 0 ? ` · ${c.replies} replied` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                    </Card>
                  </Pressable>
                ))}
              </>
            ) : null}

            <Pressable onPress={() => router.push('/passed-jobs')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="arrow-undo-outline" size={17} color={colors.inkSecondary} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                  Jobs you passed on
                </Text>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.inkSecondary }}>
                  {passedCount}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
              </Card>
            </Pressable>
          </View>

          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 13,
              color: colors.ink,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 8,
            }}>
            Your contacts
          </Text>

          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search contacts or companies" />
          </View>

          <View style={{ backgroundColor: colors.paper }}>
            {filteredContacts.length === 0 ? (
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                  paddingVertical: 24,
                  paddingHorizontal: 20,
                }}>
                No contacts match "{query.trim()}".
              </Text>
            ) : (
              filteredContacts.map((row, i) => (
                <View key={row.id}>
                  <ContactRow
                    row={row}
                    onOpen={() => router.push(`/outreach/${row.outreachId}`)}
                    onCoffee={() => router.push('/meeting-prep/new')}
                    onTogglePin={() => onTogglePin(row)}
                  />
                  {i < filteredContacts.length - 1 ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.hairline,
                        marginLeft: 84,
                      }}
                    />
                  ) : null}
                </View>
              ))
            )}
          </View>

          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.inkTertiary,
              textAlign: 'center',
              paddingHorizontal: 20,
              paddingTop: 16,
              lineHeight: 18,
            }}>
            Tap a contact to open the conversation, swipe to prep a meeting, long-press to
            pin. The full pipeline lives on offerloop.ai
          </Text>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              Coffee library
            </Text>
            <Button
              label="New prep"
              size="sm"
              icon="cafe-outline"
              onPress={() => router.push('/meeting-prep/new')}
            />
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
                      backgroundColor: colors.navy + '12',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="cafe" size={18} color={colors.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                      {prep.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                      {prep.title} at {prep.company}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                      {prep.createdLabel}
                    </Text>
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
            Coffee chat prep costs 15 credits and runs the same research as the web
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
