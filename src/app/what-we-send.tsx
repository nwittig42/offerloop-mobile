import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApplicationProfile, type ApplicationProfile } from '@/api/endpoints/autoApply';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * What we send: a receipt, not a form.
 *
 * The student reads the exact payload that leaves on every submission, field
 * by field, and fixes the blanks. Blanks are the usual reason an application
 * bounces back asking for answers, so an unanswered row is never left empty:
 * it says "Not set" in amber on a tinted row with a left edge, and taps
 * through to that one question.
 */

type Row = { label: string; value: string | null };

export default function WhatWeSendScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const appProfileQuery = useQuery({
    queryKey: ['application-profile'],
    queryFn: getApplicationProfile,
  });
  const app: ApplicationProfile | undefined = appProfileQuery.data;
  const wa = app?.workAuthorization;
  const prefs = app?.preferences;
  const yesNo = (v: boolean | null | undefined) => (v == null ? null : v ? 'Yes' : 'No');

  // Submission order, so the list reads the way a form fills.
  const rows: Row[] = [
    { label: 'Resume', value: profile.hasResume ? profile.resume.name || 'Attached' : null },
    { label: 'Name', value: profile.name || null },
    { label: 'Email', value: profile.gmailAddress || null },
    { label: 'LinkedIn', value: profile.linkedinUrl || null },
    { label: 'Authorized to work in the US', value: yesNo(wa?.authorizedToWorkUS) },
    { label: 'Needs visa sponsorship', value: yesNo(wa?.requiresSponsorship) },
    { label: 'Open to relocation', value: yesNo(prefs?.openToRelocation) },
    { label: 'Open to remote', value: yesNo(prefs?.openToRemote) },
    { label: 'Earliest start date', value: prefs?.earliestStartDate || null },
  ];
  const answered = rows.filter((r) => r.value).length;
  const missing = rows.length - answered;

  const locations = profile.preferredLocations ?? [];

  const openAnswers = () => router.push('/application-profile');

  const resumeRoutes: { label: string; href: string }[] = [
    { label: 'Build one from LinkedIn', href: '/resume-preview' },
    { label: 'Describe your experience', href: '/resume-from-text' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Centered title with the back arrow standing alone (Rylan 2026-08-18):
          separating "go back to Profile" from "what this page is" reads
          cleaner than stacking them. The label names the feature it explains
          instead of the old ambiguous "What we send". */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          hitSlop={10}
          style={{ width: 40, alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fonts.display,
            fontSize: 26,
            color: colors.heading,
          }}>
          What&rsquo;s in auto apply
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          This is what goes out on every application, exactly as written here.
        </Text>

        <Card padded={false} style={{ overflow: 'hidden' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.accent + '14',
              borderBottomWidth: 1,
              borderBottomColor: colors.accent + '2E',
              paddingVertical: 10,
              paddingHorizontal: 16,
            }}>
            <Text
              style={{
                flex: 1,
                fontFamily: fonts.sansSemibold,
                fontSize: 11,
                letterSpacing: 0.9,
                color: colors.accent,
              }}>
              SUBMITTED FIELDS
            </Text>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent }}>
              {answered} of {rows.length} answered
            </Text>
          </View>

          {rows.map((r, i) => {
            const blank = !r.value;
            return (
              <Pressable
                key={r.label}
                onPress={blank ? openAnswers : undefined}
                disabled={!blank}
                accessibilityRole={blank ? 'button' : undefined}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.hairlineLight,
                  backgroundColor: blank ? colors.waiting + '12' : 'transparent',
                  borderLeftWidth: blank ? 3 : 0,
                  borderLeftColor: colors.waiting,
                }}>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.sans,
                    fontSize: 12.5,
                    color: colors.inkTertiary,
                    lineHeight: 18,
                  }}>
                  {r.label}
                </Text>
                <Text
                  style={{
                    flex: 1.4,
                    textAlign: 'right',
                    fontFamily: blank ? fonts.sansSemibold : fonts.sansMedium,
                    fontSize: 14,
                    lineHeight: 19,
                    color: blank ? colors.waiting : colors.ink,
                  }}>
                  {r.value ?? 'Not set ›'}
                </Text>
              </Pressable>
            );
          })}
        </Card>

        <View style={{ gap: 6 }}>
          <Pressable
            onPress={openAnswers}
            accessibilityRole="button"
            style={{
              borderRadius: 8,
              shadowColor: '#3B82F6',
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
            <LinearGradient
              colors={['#4B8AF9', '#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 46,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#FFFFFF' }}>
                {missing > 0
                  ? `Fill in ${missing} missing ${missing === 1 ? 'answer' : 'answers'}`
                  : 'Edit these answers'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: colors.inkTertiary,
              textAlign: 'center',
            }}>
            A blank answer is the usual reason an application comes back.
          </Text>
        </View>

        <Pressable onPress={() => router.push('/location-preferences')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: colors.accent + '14',
                borderWidth: 1,
                borderColor: colors.accent + '2E',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="location-outline" size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                Location preferences
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                {locations.length
                  ? locations.slice(0, 3).join(', ') + (locations.length > 3 ? ' and more' : '')
                  : 'Not set yet'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
          </Card>
        </Pressable>

        <Text
          style={{
            fontFamily: fonts.sansSemibold,
            fontSize: 11,
            letterSpacing: 0.9,
            color: colors.accent,
            marginTop: 4,
          }}>
          NEED A DIFFERENT RESUME
        </Text>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {resumeRoutes.map((r, i) => (
            <Pressable
              key={r.href}
              onPress={() => router.push(r.href as never)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.hairlineLight,
              }}>
              <Text style={{ flex: 1, fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
                {r.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
            </Pressable>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
