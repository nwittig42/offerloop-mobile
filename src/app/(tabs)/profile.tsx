import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import CommaField from '@/components/ui/CommaField';
import {
  INDUSTRY_SUGGESTIONS,
  MOCK_LINKEDIN_HIGHLIGHTS,
  TARGET_ROLE_SUGGESTIONS,
} from '@/mocks/data';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';
import type { ProfileFile } from '@/types';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** A soft, borderless personalization row with a hairline under it. */
function SoftRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairlineLight,
      }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkTertiary, marginBottom: 3 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * Profile, Sorce-style: credits banner, identity, then a horizontal tab
 * strip. Tab order: Personal, Resume, Files, Settings. Personal is the
 * personalization that steers email writing (LinkedIn to parse, target
 * roles with suggestions, an About box). Resume shows what we parsed out of
 * the uploaded resume, collapsed by default so it does not crowd the view,
 * with Scout chilling in the space. No purchase flow (App Store 3.1.1).
 */

const TABS = [
  { key: 'personal', label: 'Personal', icon: 'person-outline' },
  { key: 'resume', label: 'Resume', icon: 'document-text-outline' },
  { key: 'files', label: 'Files', icon: 'folder-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const FILE_ICON: Record<ProfileFile['kind'], keyof typeof Ionicons.glyphMap> = {
  resume: 'document-text-outline',
  transcript: 'school-outline',
  other: 'document-outline',
};

export default function ProfileScreen() {
  const router = useRouter();
  const {
    profile,
    resumeExperiences,
    files,
    unreadCount,
    swipesAvailable,
    swipeBatchSize,
    cooldownSecondsLeft,
    notificationsEnabled,
    setNotificationsEnabled,
    updateProfile,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<TabKey>('personal');
  const [parseOpen, setParseOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);

  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl);
  const [rolesText, setRolesText] = useState(profile.targetRoles.join(', '));
  const [industriesText, setIndustriesText] = useState(profile.industries.join(', '));
  const [gradYear, setGradYear] = useState(profile.gradYear);
  const [about, setAbout] = useState(profile.about);

  const swipesLabel =
    swipesAvailable > 0
      ? `${swipesAvailable} of ${swipeBatchSize} swipes ready`
      : `Recharging · ${Math.floor(cooldownSecondsLeft / 60)}:${String(cooldownSecondsLeft % 60).padStart(2, '0')}`;

  const dirty =
    linkedinUrl !== profile.linkedinUrl ||
    splitList(industriesText).join('|') !== profile.industries.join('|') ||
    gradYear !== profile.gradYear ||
    about !== profile.about ||
    splitList(rolesText).join('|') !== profile.targetRoles.join('|');

  const saveProfile = () => {
    updateProfile({
      linkedinUrl,
      targetRoles: splitList(rolesText),
      industries: splitList(industriesText),
      gradYear,
      about,
    });
    showToast('Personalization saved (mock)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Profile"
        mark
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 12 }}>
          <Pressable onPress={() => router.push('/credits')}>
            <LinearGradient
              colors={['#1B2A44', '#2563EB', '#5B9BF4'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="flash" size={17} color={colors.paper} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.paper }}>
                    {profile.credits} credits
                  </Text>
                  {profile.plan !== 'Free' ? (
                    <View
                      style={{
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        backgroundColor: 'rgba(255,255,255,0.22)',
                      }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.paper }}>
                        {profile.plan.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: '#DCE6FB' }}>
                  {swipesLabel} · Get more credits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#DCE6FB" />
            </LinearGradient>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink }}>
                  {profile.name}
                </Text>
                {profile.plan !== 'Free' ? (
                  <View
                    style={{
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      backgroundColor: colors.marketing,
                    }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 10, color: colors.paper }}>
                      {profile.plan.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary }}>
                {profile.school}
              </Text>
            </View>
            <Chip label="Mock data" tone="waiting" dot />
          </View>

          <Pressable onPress={() => router.push('/share')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.accent + '40' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.accent + '14',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="share-social-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                  Share your progress
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                  A clean card of your week, for the group chat
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Card>
          </Pressable>
        </View>

        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 22 }}>
            {TABS.map((t) => {
              const selected = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderBottomWidth: 2,
                    borderBottomColor: selected ? colors.navy : 'transparent',
                  }}>
                  <Ionicons name={t.icon} size={15} color={selected ? colors.navy : colors.inkTertiary} />
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
          </ScrollView>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          {tab === 'personal' ? (
            <>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
                This is what Offerloop uses to write like you. Keep it loose and human.
              </Text>

              {/* One soft card, rows separated by hairlines, no boxy inputs. */}
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                <SoftRow label="LinkedIn">
                  <TextInput
                    value={linkedinUrl}
                    onChangeText={setLinkedinUrl}
                    placeholder="linkedin.com/in/you"
                    placeholderTextColor={colors.inkTertiary}
                    autoCapitalize="none"
                    style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                  />
                </SoftRow>
                <SoftRow label="Target roles">
                  <CommaField
                    value={rolesText}
                    onChangeText={setRolesText}
                    suggestions={TARGET_ROLE_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Industries">
                  <CommaField
                    value={industriesText}
                    onChangeText={setIndustriesText}
                    suggestions={INDUSTRY_SUGGESTIONS}
                    placeholder="Add a few, separated by commas"
                  />
                </SoftRow>
                <SoftRow label="Grad year">
                  <TextInput
                    value={gradYear}
                    onChangeText={setGradYear}
                    placeholderTextColor={colors.inkTertiary}
                    style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 2 }}
                  />
                </SoftRow>
                <SoftRow label="About you" last>
                  <TextInput
                    value={about}
                    onChangeText={setAbout}
                    multiline
                    placeholder="Interests, goals, the color a resume misses."
                    placeholderTextColor={colors.inkTertiary}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 15,
                      color: colors.ink,
                      paddingVertical: 2,
                      lineHeight: 22,
                      minHeight: 70,
                      textAlignVertical: 'top',
                    }}
                  />
                </SoftRow>
              </Card>

              <Button
                label={dirty ? 'Save changes' : 'Saved'}
                variant="brand"
                fullWidth
                disabled={!dirty}
                onPress={saveProfile}
              />
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Deeper personalization, templates, and tone live on offerloop.ai
              </Text>
            </>
          ) : null}

          {tab === 'resume' ? (
            <>
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
                <Chip label="Attached" tone="positive" dot />
              </Card>

              {/* LinkedIn, the second source we gather from, above the parse */}
              <Pressable onPress={() => setLinkedinOpen((v) => !v)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="logo-linkedin" size={17} color={colors.accent} />
                  <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    {linkedinUrl.trim()
                      ? 'What we gathered from your LinkedIn'
                      : 'Add your LinkedIn in Personal'}
                  </Text>
                  {linkedinUrl.trim() ? (
                    <Ionicons
                      name={linkedinOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.inkTertiary}
                    />
                  ) : null}
                </Card>
              </Pressable>

              {linkedinUrl.trim() && linkedinOpen ? (
                <Card style={{ gap: 6 }}>
                  {MOCK_LINKEDIN_HIGHLIGHTS.map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                      <Text
                        style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                        {h}
                      </Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Pressable onPress={() => setParseOpen((v) => !v)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="scan-outline" size={17} color={colors.navy} />
                  <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    Here is what we gathered from your resume
                  </Text>
                  <Ionicons
                    name={parseOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.inkTertiary}
                  />
                </Card>
              </Pressable>

              {parseOpen ? (
                resumeExperiences.map((exp) => (
                  <Card key={exp.id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink, flex: 1 }}>
                        {exp.role}
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                        {exp.dates}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
                      {exp.org}
                      {exp.location ? `  ·  ${exp.location}` : ''}
                    </Text>
                    <View style={{ gap: 6, marginTop: 2 }}>
                      {exp.bullets.map((b, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                          <Text style={{ color: colors.inkTertiary, fontSize: 13 }}>•</Text>
                          <Text
                            style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 19 }}>
                            {b}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
                  <Image
                    source={require('../../../assets/images/scout-prep.png')}
                    style={{ width: 130, height: 104 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12.5,
                      color: colors.inkTertiary,
                      textAlign: 'center',
                      maxWidth: 250,
                      lineHeight: 18,
                    }}>
                    Scout read your resume so every draft sounds like you. Tap above to see
                    what we picked up.
                  </Text>
                </View>
              )}

              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                Rebuild your resume or update your LinkedIn on offerloop.ai and the parse
                updates here.
              </Text>
            </>
          ) : null}

          {tab === 'files' ? (
            <>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 19 }}>
                Transcripts, writing samples, and other documents to have on hand. Your
                resume and its parse live in the Resume tab.
              </Text>
              {files.map((file) => (
                <Card key={file.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: colors.paper2,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name={FILE_ICON[file.kind]} size={18} color={colors.inkSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      {file.name}
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      {file.updatedLabel}
                    </Text>
                  </View>
                  {file.kind === 'resume' ? <Chip label="Resume" tone="accent" /> : null}
                </Card>
              ))}
              <Button
                label="Add file"
                variant="outline"
                icon="add"
                onPress={() => showToast('The file picker arrives with real wiring')}
              />
            </>
          ) : null}

          {tab === 'settings' ? (
            <>
              <Pressable onPress={() => router.push('/swipe-settings')}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.accent + '14',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="options-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      Swipe settings
                    </Text>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                      Draft or send, how many contacts, auto-apply
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                </Card>
              </Pressable>

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
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
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
              <Button label="Design gallery" variant="outline" onPress={() => router.push('/design')} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
