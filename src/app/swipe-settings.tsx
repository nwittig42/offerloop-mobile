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
 * up the team" move). Auto-apply is off by default and clearly secondary.
 */

const ACTIONS: { key: SwipeSettings['action']; label: string; sub: string }[] = [
  { key: 'draft', label: 'Draft outreach', sub: 'You review and send each one. Safest.' },
  { key: 'send', label: 'Draft and auto-send', sub: 'Sends from your Gmail without review.' },
];

export default function SwipeSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { swipeSettings, updateSwipeSettings, profile } = useApp();
  const { action, contacts, autoApply } = swipeSettings;

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
          A right swipe always reaches real people at the company. Set what it does once,
          and every swipe stays a single tap.
        </Text>

        {/* What the swipe does */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            When you swipe right
          </Text>
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
                Auto-send fires real emails with no review. Your daily cap protects you,
                but the draft has to be good every time. Swipes after 10pm or before 8am
                are saved as drafts instead, so nothing lands overnight.
              </Text>
            </View>
          ) : null}
        </View>

        {/* How many people */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Reach out to
          </Text>
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
              {contacts === 1
                ? 'We find the hiring manager for the role.'
                : `We start with the hiring manager, then ${contacts - 1} ${contacts - 1 === 1 ? 'person' : 'people'} on the team.`}
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
              1 swipe · {totalCredits} credits ({contacts} {contacts === 1 ? 'person' : 'people'} ×{' '}
              {profile.creditsPerSwipe})
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, lineHeight: 16 }}>
              A swipe always costs one swipe from your daily batch. Reaching more people
              just spends more credits, so going wide is generous on swipes.
            </Text>
          </Card>
        </View>

        {/* Auto-apply accent */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Add-on
          </Text>
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
              Applying is the accent, not the point. Offerloop is about networking your way
              in, the application just gives your outreach a reason to exist. We only apply to
              jobs marked “Auto-apply ready,” and you review each one before it submits.
            </Text>
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
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Attached to every email
          </Text>
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
                  {profile.resume.name}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  {profile.resume.updatedLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Card>
          </Pressable>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
            Your resume goes out with every drafted email. Tap to manage attachments.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
