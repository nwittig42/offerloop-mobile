import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import GradientButton from '@/components/ui/GradientButton';
import Input from '@/components/ui/Input';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, type Palette } from '@/theme/tokens';
import type { LoopActivity } from '@/types';

/**
 * Loops: the autopilot. A Loop is the same engine as a right swipe, run on
 * a schedule from a natural-language brief. Two tabs, like Profile: the
 * Loops list (create, pause, counters) and an Activity feed (what the
 * Loops have been doing, the 8am-regimen log). Deep config stays on web.
 */

const TABS = ['Loops', 'Activity'] as const;
type TabKey = (typeof TABS)[number];

// Vibrant blue -> indigo -> purple, matching the Network dashboard + credits
// surfaces. Active Loops wear it; paused Loops go muted so the state reads.
const LOOP_GRADIENT = ['#2563EB', '#4F46E5', '#7C3AED'] as const;

const ACTIVITY_ICON: Record<LoopActivity['kind'], keyof typeof Ionicons.glyphMap> = {
  run: 'sync-outline',
  draft: 'document-text-outline',
  sent: 'paper-plane-outline',
  reply: 'chatbubble-ellipses-outline',
};

const activityColor = (c: Palette): Record<LoopActivity['kind'], string> => ({
  run: c.navy,
  draft: c.accent,
  sent: c.marketing,
  reply: c.positive,
});

/** A labeled −/+ counter row for the per-cycle people targets. */
function PeopleStepper({
  icon,
  title,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const colors = useColors();
  const btn = (disabled: boolean) => ({
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: disabled ? colors.paper2 : colors.paper,
    opacity: disabled ? 0.5 : 1,
  });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 11,
        backgroundColor: colors.paper2,
      }}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>{hint}</Text>
      </View>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} style={btn(value <= min)}>
        <Ionicons name="remove" size={16} color={value <= min ? colors.inkTertiary : colors.ink} />
      </Pressable>
      <Text style={{ minWidth: 16, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink }}>
        {value}
      </Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} style={btn(value >= max)}>
        <Ionicons name="add" size={16} color={value >= max ? colors.inkTertiary : colors.ink} />
      </Pressable>
    </View>
  );
}

export default function LoopsScreen() {
  const router = useRouter();
  const colors = useColors();
  const ACTIVITY_COLOR = activityColor(colors);
  const { loops, loopActivity, profile, unreadCount, addLoop, toggleLoop, showToast } = useApp();
  const [tab, setTab] = useState<TabKey>('Loops');
  const [brief, setBrief] = useState('');
  const [composing, setComposing] = useState(false);
  // Per-cycle people mix the loop aims for (caps). Defaults mirror the backend.
  const [hmPerCycle, setHmPerCycle] = useState(1);
  const [employeesPerCycle, setEmployeesPerCycle] = useState(3);
  // Off by default — the Loop drafts for review. On flips it to send-for-me
  // (still subject to the backend send gate: Gmail, verified email, quiet hours).
  const [autoSend, setAutoSend] = useState(false);

  // Loop briefs suggested from the user's own profile, so they can tap
  // instead of writing one from scratch.
  const suggestions = useMemo(() => {
    const roles = profile.targetRoles;
    const inds = profile.industries;
    const out: string[] = [];
    if (roles[0]) out.push(`Find 5 ${roles[0]} contacts a week`);
    if (roles[1]) out.push(`Reach out to 3 ${roles[1]} this week`);
    if (inds[0]) out.push(`Connect with ${inds[0]} alumni from ${profile.school}`);
    if (inds[1]) out.push(`Find ${inds[1]} contacts at top firms`);
    if (out.length === 0) out.push('Find 5 product managers at fintech startups a week');
    return out;
  }, [profile.targetRoles, profile.industries, profile.school]);

  const filteredSuggestions = useMemo(() => {
    const q = brief.trim().toLowerCase();
    return suggestions.filter((s) => q === '' || s.toLowerCase().includes(q));
  }, [suggestions, brief]);

  const create = () => {
    const trimmed = brief.trim();
    if (!trimmed) return;
    addLoop(trimmed, { hmPerCycle, employeesPerCycle }, autoSend);
    setBrief('');
    setHmPerCycle(1);
    setEmployeesPerCycle(3);
    setAutoSend(false);
    setComposing(false);
    showToast(
      autoSend
        ? 'Loop created — it sends for you once contacts are verified'
        : 'Loop created — it drafts outreach for your review',
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Loops"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
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

      {tab === 'Loops' ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 48 }}>
          <Text
            style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
            A Loop is your swipe on autopilot. Describe who you want to meet and Offerloop
            finds contacts and drafts outreach on a schedule, into the same Inbox.
          </Text>

          {composing ? (
            <Card style={{ gap: 12 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                Describe your Loop
              </Text>
              <Input
                multiline
                value={brief}
                onChangeText={setBrief}
                placeholder="Find 5 product managers at fintech startups a week"
                autoFocus
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="mic-outline" size={13} color={colors.inkTertiary} />
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  Tip: tap the mic on your keyboard and just say it
                </Text>
              </View>

              {filteredSuggestions.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
                    Suggested from your profile
                  </Text>
                  {filteredSuggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setBrief(s)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        borderColor: colors.hairline,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                        backgroundColor: colors.paper2,
                      }}>
                      <Ionicons name="add-circle-outline" size={15} color={colors.accent} />
                      <Text
                        style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink }}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {/* Per-cycle people mix — the loop aims for up to this many of
                  each each run (caps, same split as the job board). */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>
                  People per cycle
                </Text>
                <PeopleStepper
                  icon="rocket-outline"
                  title="Hiring managers"
                  hint="10 credits each"
                  value={hmPerCycle}
                  min={0}
                  max={3}
                  onChange={setHmPerCycle}
                />
                <PeopleStepper
                  icon="people-outline"
                  title="Employees"
                  hint="4 credits each · peers worth a coffee chat"
                  value={employeesPerCycle}
                  min={0}
                  max={5}
                  onChange={setEmployeesPerCycle}
                />
              </View>

              {/* Send mode — off by default (drafts for review). On flips the
                  Loop to send-for-me; the backend gate still guards every send
                  (Gmail connected, email verified, 8a–10p, daily cap). */}
              <Pressable
                onPress={() => setAutoSend((v) => !v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderWidth: 1,
                  borderColor: autoSend ? colors.accent : colors.hairline,
                  borderRadius: 10,
                  paddingVertical: 9,
                  paddingHorizontal: 11,
                  backgroundColor: autoSend ? colors.accent + '12' : colors.paper2,
                }}>
                <Ionicons
                  name={autoSend ? 'paper-plane' : 'create-outline'}
                  size={18}
                  color={colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
                    {autoSend ? 'Send for me automatically' : 'Draft for my review'}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>
                    {autoSend
                      ? 'Sends once a contact’s email is verified'
                      : 'Creates Gmail drafts you send yourself'}
                  </Text>
                </View>
                {/* Pill toggle */}
                <View
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    padding: 3,
                    backgroundColor: autoSend ? colors.accent : colors.hairline,
                    alignItems: autoSend ? 'flex-end' : 'flex-start',
                  }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.paper,
                    }}
                  />
                </View>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Create Loop" onPress={create} disabled={!brief.trim()} />
                <Button label="Cancel" variant="ghost" onPress={() => setComposing(false)} />
              </View>
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="New Loop"
                  variant="accent"
                  fullWidth
                  onPress={() => setComposing(true)}
                />
              </View>
              <Button
                label="Open on web"
                variant="outline"
                icon="open-outline"
                onPress={() => Linking.openURL('https://offerloop.ai')}
              />
            </View>
          )}

          {loops.map((loop) => {
            const active = loop.status === 'Active';
            // Cumulative Found toward the goal — mirrors the Loop detail funnel,
            // so the list shows the same progress the detail does (was a
            // this-week count that read 0 even with contacts found last week).
            const pct = Math.max(
              loop.contactsFound > 0 ? 6 : 0,
              Math.min(100, Math.round((loop.contactsFound / Math.max(1, loop.weeklyTarget)) * 100)),
            );
            return (
            <Card
              key={loop.id}
              style={{ gap: 10, borderColor: active ? '#4F46E5' + '33' : colors.hairline }}>
              <Pressable onPress={() => router.push(`/loops/${loop.id}`)} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {active ? (
                  <LinearGradient
                    colors={LOOP_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="infinite" size={18} color="#FFFFFF" />
                  </LinearGradient>
                ) : (
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.inkTertiary + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="infinite" size={18} color={colors.inkTertiary} />
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink, flex: 1, lineHeight: 20 }}>
                  {loop.brief}
                </Text>
                <Chip
                  label={loop.status}
                  tone={active ? 'positive' : 'waiting'}
                  dot
                />
                <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
              </View>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                    Toward your goal
                  </Text>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink }}>
                    {loop.contactsFound} of {loop.weeklyTarget}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.hairlineLight, overflow: 'hidden' }}>
                  {active ? (
                    <LinearGradient
                      colors={LOOP_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: 6, borderRadius: 3, width: `${pct}%` }}
                    />
                  ) : (
                    <View
                      style={{ height: 6, borderRadius: 3, width: `${pct}%`, backgroundColor: colors.inkTertiary }}
                    />
                  )}
                </View>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                {loop.draftsCreated} drafts created all time
              </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label={loop.status === 'Active' ? 'Pause' : 'Resume'}
                  variant="outline"
                  size="sm"
                  onPress={() => toggleLoop(loop.id)}
                />
              </View>
            </Card>
            );
          })}

          <Card style={{ gap: 12, borderColor: colors.accent + '40', borderWidth: 1.5, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="rocket-outline" size={19} color={colors.accent} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                Run Loops at full power on the web
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
              Mobile keeps Loops simple. On offerloop.ai you get custom schedules, bigger
              weekly targets, send rules and budgets, multi-step sequences, and full
              control over who each Loop targets.
            </Text>
            <GradientButton
              label="Open offerloop.ai"
              icon="open-outline"
              fullWidth
              onPress={() => Linking.openURL('https://offerloop.ai')}
            />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 48 }}>
          <Text
            style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            What your Loops have been doing. Drafts run on a morning regimen and show up
            here and in your Inbox.
          </Text>
          {loopActivity.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <Ionicons name="time-outline" size={32} color={colors.inkTertiary} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 270 }}>
                No activity yet. When your Loops run, the people they find and the drafts they write show up here.
              </Text>
            </View>
          ) : null}
          {loopActivity.map((a) => (
            <View
              key={a.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: ACTIVITY_COLOR[a.kind] + '0F',
                borderWidth: 1,
                borderColor: ACTIVITY_COLOR[a.kind] + '26',
              }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: ACTIVITY_COLOR[a.kind],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={ACTIVITY_ICON[a.kind]} size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>
                  {a.text}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                  {a.timeLabel}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
