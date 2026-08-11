import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { SwipeSettings } from '@/types';

/**
 * Swipe Settings: set once, not per card, so the swipe stays a one-thumb
 * reflex. Choose what a right swipe does (draft vs auto-send), how many
 * people it reaches (the hiring manager first, then the team), and, as an
 * accent a few steps down, whether to also apply (Nick's "apply, then warm
 * up the team" move). Auto-apply is ON by default (Rylan, 2026-07-21); the
 * toggle here turns it off, and the choice persists per-user.
 */

const ACTIONS: { key: SwipeSettings['action']; label: string; sub: string }[] = [
  { key: 'draft', label: 'Draft outreach', sub: 'You review and send each one. Safest.' },
  { key: 'send', label: 'Draft and auto-send', sub: 'Sends from your Gmail without review.' },
];

// The teammates -> hiring-managers dial, rendered as a 3-stop slider.
const PRIORITY_STOPS: {
  key: SwipeSettings['priority'];
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'employee', label: 'Teammates', icon: 'people-outline' },
  { key: 'hiring_manager', label: 'Hiring mgrs', icon: 'briefcase-outline' },
  { key: 'mix', label: 'Mix', icon: 'git-merge-outline' },
];

/**
 * Section header with a tinted icon chip. The screen used to be five plain
 * bold labels over gray cards, which read washed-out and technical; a color
 * per section gives each block an identity at a glance.
 */
function SectionHeader({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: color + '14',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
        {label}
      </Text>
    </View>
  );
}

/** The split a swipe will produce, given the dial + how many people it reaches. */
function targetingTally(priority: SwipeSettings['priority'], contacts: number): string {
  const team = (n: number) => `${n} ${n === 1 ? 'teammate' : 'teammates'}`;
  if (priority === 'employee') return team(contacts);
  if (priority === 'mix') {
    return contacts <= 1 ? '1 hiring manager' : `1 hiring manager · ${team(contacts - 1)}`;
  }
  return contacts <= 1 ? '1 hiring manager' : `up to ${contacts} hiring managers`;
}

export default function SwipeSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { swipeSettings, updateSwipeSettings, profile } = useApp();
  const { action, contacts, autoApply, priority } = swipeSettings;

  const totalCredits = contacts * profile.creditsPerSwipe;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          Swipe settings
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          Set this once. After that, every right swipe is a single tap.
        </Text>

        {/* "Show me new roles" moved OUT of here to the Feed action bar (the
            shuffle button, Rylan 2026-08-10): a deck refresh is a Feed action,
            not a setting, and its big card crowded this screen. */}

        {/* What the swipe does */}
        <View style={{ gap: 8 }}>
          <SectionHeader icon="flash-outline" label="When you swipe right" color={colors.marketing} />
          {ACTIONS.map((a) => {
            const selected = action === a.key;
            return (
              <Pressable key={a.key} onPress={() => updateSwipeSettings({ action: a.key })}>
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderColor: selected ? colors.accent : colors.hairline,
                    borderWidth: selected ? 1.5 : 1,
                  }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selected ? colors.accent : colors.hairline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {selected ? (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                      {a.label}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                      {a.sub}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          {action === 'send' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <Ionicons name="warning-outline" size={14} color={colors.waiting} />
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 11.5, color: colors.waiting, lineHeight: 16 }}>
                Auto-send emails go out without review. Overnight swipes (10pm to 8am)
                are saved as drafts instead.
              </Text>
            </View>
          ) : null}
          {/* The template decides what those emails actually say, so it lives
              with the swipe action, not buried in Profile settings. */}
          <Pressable
            onPress={() => router.push('/outreach-template')}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6 }}>
            <Ionicons name="mail-open-outline" size={16} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
              Outreach template, what your emails ask for
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.accent} />
          </Pressable>
        </View>

        {/* Who we reach — a teammates -> hiring-managers dial */}
        <View style={{ gap: 10 }}>
          <SectionHeader icon="people-outline" label="Who we reach out to" color={colors.accent} />
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: colors.hairline,
              padding: 4,
              gap: 4,
            }}>
            {PRIORITY_STOPS.map((s) => {
              const selected = priority === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => updateSwipeSettings({ priority: s.key })}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    paddingVertical: 11,
                    borderRadius: 10,
                    backgroundColor: selected ? colors.marketing : 'transparent',
                  }}>
                  <Ionicons name={s.icon} size={19} color={selected ? colors.paper : colors.inkSecondary} />
                  <Text
                    style={{
                      fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium,
                      fontSize: 12,
                      color: selected ? colors.paper : colors.inkSecondary,
                    }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 }}>
            <Ionicons name="checkmark-circle" size={15} color={colors.marketing} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.ink }}>
              Each swipe reaches {targetingTally(priority, contacts)}.
            </Text>
          </View>
          {priority !== 'employee' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <Ionicons name="information-circle-outline" size={14} color={colors.inkSecondary} />
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkSecondary, lineHeight: 16 }}>
                Hiring managers are verified first, so they can take a little longer and
                always arrive as drafts.
              </Text>
            </View>
          ) : null}
        </View>

        {/* How many people */}
        <View style={{ gap: 8 }}>
          <SectionHeader icon="person-add-outline" label="How many people" color={colors.navy} />
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                {contacts} {contacts === 1 ? 'person' : 'people'} per job
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable
                  onPress={() =>
                    updateSwipeSettings({ contacts: Math.max(1, contacts - 1) as SwipeSettings['contacts'] })
                  }
                  disabled={contacts === 1}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: contacts === 1 ? 0.4 : 1,
                  }}>
                  <Ionicons name="remove" size={18} color={colors.ink} />
                </Pressable>
                <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, minWidth: 20, textAlign: 'center' }}>
                  {contacts}
                </Text>
                <Pressable
                  onPress={() =>
                    updateSwipeSettings({ contacts: Math.min(3, contacts + 1) as SwipeSettings['contacts'] })
                  }
                  disabled={contacts === 3}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: contacts === 3 ? 0.4 : 1,
                  }}>
                  <Ionicons name="add" size={18} color={colors.ink} />
                </Pressable>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
              {priority === 'employee'
                ? contacts === 1
                  ? 'We find a strong teammate at the company, alumni first.'
                  : `We find ${contacts} people on the team, alumni first.`
                : contacts === 1
                  ? 'We find the hiring manager for the role.'
                  : 'We start with the hiring manager, then fill the rest with the team.'}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
              1 swipe · {totalCredits} credits ({contacts} {contacts === 1 ? 'person' : 'people'} ×{' '}
              {profile.creditsPerSwipe})
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, lineHeight: 16 }}>
              More people spends more credits, never more of your daily swipes.
            </Text>
          </Card>
        </View>

        {/* Auto-apply */}
        <View style={{ gap: 8 }}>
          <SectionHeader icon="paper-plane-outline" label="Auto-apply" color={colors.applyLink} />
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.navy + '12',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="paper-plane-outline" size={18} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                  Also apply to the job
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                  Submit the application, then warm up the team
                </Text>
              </View>
              <Switch
                value={autoApply}
                onValueChange={(v) => updateSwipeSettings({ autoApply: v })}
                trackColor={{ true: colors.accent, false: colors.hairline }}
              />
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, lineHeight: 17 }}>
              The first few applications may ask you a detail or two. Every answer teaches
              auto-apply to need you less.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.navy + '12',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="mic-outline" size={18} color={colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                  Scout confirms before spending
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                  One Run-it tap before voice asks spend credits
                </Text>
              </View>
              <Switch
                value={swipeSettings.scoutConfirmSpend}
                onValueChange={(v) => updateSwipeSettings({ scoutConfirmSpend: v })}
                trackColor={{ true: colors.accent, false: colors.hairline }}
              />
            </View>

            {autoApply ? (
              <Pressable
                onPress={() => router.push('/application-profile')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: colors.hairlineLight,
                }}>
                <Ionicons name="person-circle-outline" size={18} color={colors.accent} />
                <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
                  Set up your application profile
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.accent} />
              </Pressable>
            ) : null}
          </Card>
          {autoApply ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, paddingHorizontal: 4 }}>
              Auto-apply is a Pro/Elite feature. Work authorization is required before the
              first submission.
            </Text>
          ) : null}
        </View>

        {/* What rides along with every swipe */}
        <View style={{ gap: 8 }}>
          <SectionHeader icon="attach-outline" label="Attached to every email" color={colors.coffee} />
          <Pressable onPress={() => router.push('/attachments')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="document-text-outline" size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                  {profile.resume.name || 'No resume yet'}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  {profile.resume.updatedLabel || 'Tap to add one'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Card>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
