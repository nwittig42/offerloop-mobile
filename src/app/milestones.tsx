import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import CircleProgress from '@/components/ui/CircleProgress';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Milestones: a tasteful, on-brand take on gamifying the grind (NOT an Angry
 * Birds level map). Reached from the Network dashboard. Laid out as a vertical
 * PATH (a connected timeline rail) so it reads as linear progression, on a soft
 * blue wash. Every milestone tracks REAL store activity (no-fake-numbers): each
 * unlocked one is a tappable SHAREABLE BADGE. A couple tease cosmetic THEME
 * rewards (the parked funk/school-colors palettes), so progression unlocks
 * status + skins, never gating core function.
 */

const RAIL = '#3B82F6';

type Milestone = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
  current: number;
  goal: number;
  reward?: string;
};

export default function MilestonesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  const { outreach, meetingPreps, trackerRows, showToast } = useApp();
  const [selected, setSelected] = useState<Milestone | null>(null);

  const sent = outreach.filter((o) => o.status === 'sent' || o.status === 'replied').length;
  const replies = outreach.filter((o) => o.status === 'replied').length;
  const preps = meetingPreps.length;
  const contacts = trackerRows.length;

  const milestones: Milestone[] = [
    { id: 'first-send', icon: 'paper-plane', color: '#2563EB', title: 'First outreach', desc: 'Send your first draft', current: sent, goal: 1 },
    { id: 'ten-send', icon: 'flame', color: '#F59E0B', title: 'Getting going', desc: '10 outreach sent', current: sent, goal: 10 },
    { id: 'twentyfive-send', icon: 'rocket', color: '#7C3AED', title: 'On a tear', desc: '25 outreach sent', current: sent, goal: 25, reward: 'School-colors theme' },
    { id: 'first-reply', icon: 'chatbubble-ellipses', color: '#16A34A', title: 'They wrote back', desc: 'Land your first reply', current: replies, goal: 1 },
    { id: 'five-reply', icon: 'mail-open', color: '#0EA5E9', title: 'In the conversation', desc: '5 replies back', current: replies, goal: 5 },
    { id: 'first-prep', icon: 'cafe', color: '#8B5A2B', title: 'Coffee ready', desc: 'Prep your first coffee chat', current: preps, goal: 1 },
    { id: 'ten-contacts', icon: 'people', color: '#EC4899', title: 'Building a network', desc: '10 contacts in your network', current: contacts, goal: 10 },
    { id: 'fifty-send', icon: 'trophy', color: '#4F46E5', title: 'Networking machine', desc: '50 outreach sent', current: sent, goal: 50 },
  ];

  const unlocked = milestones.filter((m) => m.current >= m.goal).length;
  const total = milestones.length;

  const onTap = (m: Milestone, done: boolean) => {
    if (!done) {
      showToast(`${m.goal - m.current} to go to unlock "${m.title}"`);
      return;
    }
    setSelected(m);
  };

  const shareSelected = () => {
    if (!selected) return;
    Share.share({
      message: `Milestone unlocked on Offerloop: "${selected.title}" - ${selected.desc}. The grind continues. offerloop.ai`,
    }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Soft blue wash behind the whole path. */}
      <LinearGradient
        colors={
          dark
            ? (['#13233F', '#101A30', colors.surface] as const)
            : (['#E4EDFF', '#EEF3FF', colors.surface] as const)
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <Ionicons name="chevron-back" size={24} color={colors.ink} onPress={() => router.back()} />
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.heading, flex: 1 }}>
          Milestones
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {/* Overall progress, same ring as the profile gauge. */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <CircleProgress size={64} strokeWidth={6} progress={unlocked / total} color={RAIL} label={`${unlocked}/${total}`} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              {unlocked === total ? 'Every milestone unlocked' : 'Your grind, unlocked'}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 18 }}>
              Tap an unlocked badge to share it. Each one tracks real progress, no busywork.
            </Text>
          </View>
        </Card>

        {/* The path: connected timeline rail down the left, badge cards on the right. */}
        {milestones.map((m, i) => {
          const done = m.current >= m.goal;
          const prevDone = i > 0 && milestones[i - 1].current >= milestones[i - 1].goal;
          const pct = Math.min(100, Math.round((m.current / m.goal) * 100));
          const isLast = i === milestones.length - 1;

          return (
            <Pressable key={m.id} onPress={() => onTap(m, done)} style={{ flexDirection: 'row', gap: 12 }}>
              {/* Rail: top segment, node, bottom segment. */}
              <View style={{ width: 40, alignItems: 'center' }}>
                <View
                  style={{
                    flex: 1,
                    width: 2.5,
                    backgroundColor: i === 0 ? 'transparent' : prevDone ? RAIL : colors.hairline,
                  }}
                />
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: done ? m.color : colors.paper2,
                    borderWidth: done ? 0 : 1.5,
                    borderColor: colors.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={m.icon} size={19} color={done ? '#FFFFFF' : colors.inkTertiary} />
                </View>
                <View
                  style={{
                    flex: 1,
                    width: 2.5,
                    backgroundColor: isLast ? 'transparent' : done ? RAIL : colors.hairline,
                  }}
                />
              </View>

              {/* Badge card. */}
              <Card
                style={{
                  flex: 1,
                  gap: 8,
                  marginBottom: 12,
                  borderColor: done ? m.color + '40' : colors.hairline,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                      {m.title}
                    </Text>
                    {done ? <Ionicons name="checkmark-circle" size={16} color={m.color} /> : null}
                  </View>
                  {done ? (
                    <Chip label="Unlocked" tone="positive" dot />
                  ) : (
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkTertiary }}>
                      {m.current}/{m.goal}
                    </Text>
                  )}
                </View>

                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                  {m.desc}
                </Text>

                {!done ? (
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.hairlineLight, overflow: 'hidden' }}>
                    <View style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: m.color }} />
                  </View>
                ) : null}

                {m.reward ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="color-palette-outline" size={14} color={colors.accent} />
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
                      Unlocks the {m.reward}
                    </Text>
                  </View>
                ) : null}

                {done ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 1 }}>
                    <Ionicons name="share-social-outline" size={13} color={colors.inkTertiary} />
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary }}>
                      Tap to share this badge
                    </Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 11.5,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 17,
            paddingTop: 4,
          }}>
          Preview. Theme rewards arrive with the customization update; milestones reward
          status and skins, never gating what you can do.
        </Text>
      </ScrollView>

      {/* Badge card, the shareable artifact (styled like the progress card). */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <Pressable
          onPress={() => setSelected(null)}
          style={{ flex: 1, backgroundColor: 'rgba(17,19,24,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, gap: 14 }}>
            {selected ? (
              <LinearGradient
                colors={[selected.color, '#1E2D4D'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 26, alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                  }}>
                  <Image
                    source={require('../../assets/images/offerloop-logo.png')}
                    style={{ width: 78, height: 19 }}
                    resizeMode="contain"
                    accessibilityLabel="Offerloop"
                  />
                </View>

                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 6,
                  }}>
                  <Ionicons name={selected.icon} size={40} color="#FFFFFF" />
                </View>

                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, letterSpacing: 1.4, color: 'rgba(255,255,255,0.85)' }}>
                  MILESTONE UNLOCKED
                </Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 28, color: '#FFFFFF', textAlign: 'center', lineHeight: 32 }}>
                  {selected.title}
                </Text>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
                  {selected.desc}
                </Text>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  earned on offerloop.ai
                </Text>
              </LinearGradient>
            ) : null}

            <Pressable
              onPress={shareSelected}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                paddingVertical: 13,
              }}>
              <Ionicons name="share-social" size={16} color="#111318" />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#111318' }}>
                Share badge
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelected(null)} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
