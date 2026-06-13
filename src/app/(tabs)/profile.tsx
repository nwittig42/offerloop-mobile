import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';

import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Profile: credits, Loops, resume on file, personalization, settings.
 * Deliberately NO purchase or upgrade links anywhere (App Store rule 3.1.1):
 * the balance is shown, nothing is sold.
 */

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.sansSemibold,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.inkTertiary,
      }}>
      {children}
    </Text>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, unreadCount } = useApp();
  const [pushEnabled, setPushEnabled] = useState(true);

  const creditsUsed = profile.maxCredits - profile.credits;
  const usedRatio = Math.min(1, Math.max(0, creditsUsed / profile.maxCredits));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Profile"
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: colors.navy,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.paper }}>
              {profile.name
                .split(' ')
                .map((p) => p.charAt(0))
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink }}>
              {profile.name}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary }}>
              {profile.school}
            </Text>
          </View>
          <Chip label="Mock data" tone="waiting" dot />
        </Card>

        <View style={{ gap: 10 }}>
          <SectionLabel>Credits</SectionLabel>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 48, color: colors.heading }}>
                {profile.credits}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, paddingBottom: 8 }}>
                of {profile.maxCredits} · {profile.tier}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.hairlineLight }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${Math.round(usedRatio * 100)}%`,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
              {profile.resetLabel} · {profile.dailyDraftsUsed} of {profile.dailyDraftCap} drafts
              used today
            </Text>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Loops</SectionLabel>
          <Card style={{ gap: 14 }}>
            {profile.loops.map((loop) => (
              <View key={loop.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink, flex: 1 }}>
                    {loop.brief}
                  </Text>
                  <Chip label={loop.status} tone="positive" dot />
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                  {loop.contactsFound} contacts found · {loop.draftsCreated} drafts created
                </Text>
              </View>
            ))}
            <Button
              label="New Loop"
              variant="accent"
              onPress={() =>
                Alert.alert(
                  'Phase 2',
                  'The one-field, dictation-friendly Loop setup sheet lands in Phase 2.',
                )
              }
            />
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Resume and personalization</SectionLabel>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={20} color={colors.inkSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                  {profile.resume.name}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                  {profile.resume.updatedLabel} · update it on offerloop.ai
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
            {[
              ['Target role', profile.targetRole],
              ['Industries', profile.industries],
              ['Grad year', profile.gradYear],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary }}>
                  {label}
                </Text>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                  {value}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Settings</SectionLabel>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="mail-outline" size={18} color={colors.inkSecondary} />
                <View>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    Gmail
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                    {profile.gmailConnected ? profile.gmailAddress : 'Not connected'}
                  </Text>
                </View>
              </View>
              <Chip
                label={profile.gmailConnected ? 'Connected' : 'Connect'}
                tone={profile.gmailConnected ? 'positive' : 'accent'}
                dot={profile.gmailConnected}
              />
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="notifications-outline" size={18} color={colors.inkSecondary} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                  Push notifications
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ true: colors.accent, false: colors.hairline }}
              />
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairlineLight }} />
            <Button
              label="Sign out"
              variant="ghost"
              onPress={() => Alert.alert('Phase 3', 'Auth arrives with real wiring.')}
            />
          </Card>
        </View>

        <Button
          label="Design gallery"
          variant="outline"
          onPress={() => router.push('/design')}
        />
      </ScrollView>
    </View>
  );
}
