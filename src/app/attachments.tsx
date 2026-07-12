import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { qk } from '@/api/queryKeys';
import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * What travels with your outreach (the doc button in the Feed action row).
 *
 * This used to be a read-only stub that told people to "rebuild your resume on
 * offerloop.ai" — so the app could never actually take a resume, which meant
 * every auto-apply hit a Greenhouse form with the Resume field unfilled. The
 * picker is wired now: pick a PDF/DOC from Files/iCloud/Drive, and the backend
 * stores it (Firebase Storage, resumes/{uid}/) and parses it into the profile
 * that personalizes drafts and fills applications.
 */
export default function AttachmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, showToast } = useApp();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const hasResume = profile.hasResume;

  const onPick = async () => {
    if (busy) return;
    try {
      const file = await pickResume();
      if (!file) return; // cancelled
      setBusy(true);
      showToast('Uploading your resume…');
      await uploadResume(file);
      // /me is the source of truth for hasResume — refetch so the card flips.
      await queryClient.invalidateQueries({ queryKey: qk.me });
      showToast('Resume saved');
    } catch (e) {
      const msg =
        e instanceof Error && e.message.includes('10MB')
          ? e.message
          : "Couldn't read that file. Try a PDF.";
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

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
          gap: 10,
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.heading, flex: 1 }}>
          Attached
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <Text
          style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          This is what Offerloop uses to personalize every drafted email — and to fill out job
          applications for you.
        </Text>

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
            {busy ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={hasResume ? 'document-text' : 'document-text-outline'}
                size={19}
                color={hasResume ? colors.accent : colors.inkTertiary}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
              {hasResume ? profile.resume.name : 'No resume yet'}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
              {busy
                ? 'Uploading…'
                : hasResume
                  ? profile.resume.updatedLabel
                  : 'Add one to personalize your outreach'}
            </Text>
          </View>
          {hasResume ? <Chip label="Resume" tone="accent" /> : null}
        </Card>

        <Button
          label={hasResume ? 'Replace resume' : 'Upload resume'}
          variant={hasResume ? 'outline' : 'brand'}
          size="lg"
          fullWidth
          icon="cloud-upload-outline"
          disabled={busy}
          onPress={onPick}
        />

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 18,
          }}>
          PDF, DOC or DOCX · up to 10MB. Only you can see it.
        </Text>
      </ScrollView>
    </View>
  );
}
