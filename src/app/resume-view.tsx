import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickResume, uploadResume } from '@/api/endpoints/resume';
import { qk } from '@/api/queryKeys';
import PdfView from '@/components/resume/PdfView';
import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The resume on file, full screen: the actual PDF, readable and pinchable,
 * served by its token-secured link. Edit opens the builder on the current
 * resume (uploaded ones are converted on the way in); Replace opens the same
 * three doors Profile uses. Rylan 2026-09-08: students could attach a resume
 * but never look at it.
 */
export default function ResumeViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { profile, showToast } = useApp();
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = profile.resume?.url;

  const onUpload = async () => {
    setDoorsOpen(false);
    try {
      const file = await pickResume();
      if (!file) return;
      setBusy(true);
      showToast('Uploading your resume…');
      await uploadResume(file);
      await queryClient.invalidateQueries({ queryKey: qk.me });
      showToast('Resume replaced');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not upload that file.');
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
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }} numberOfLines={1}>
          {profile.resume?.name || 'Your resume'}
        </Text>
        <Pressable
          onPress={() => setDoorsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Replace resume"
          style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent }}>Replace</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {url ? (
        <PdfView uri={url} backgroundColor={colors.surface} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Ionicons name="document-outline" size={34} color={colors.inkTertiary} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center' }}>
            No resume on file yet.
          </Text>
          <Button label="Add one" variant="brand" onPress={() => setDoorsOpen(true)} />
        </View>
      )}

      {url ? (
        <View
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}>
          <Button
            label="Edit this resume"
            variant="brand"
            size="lg"
            fullWidth
            icon="create-outline"
            disabled={busy}
            onPress={() => router.push({ pathname: '/resume-preview', params: { mode: 'edit' } } as never)}
          />
        </View>
      ) : null}

      <Modal visible={doorsOpen} transparent animationType="fade" onRequestClose={() => setDoorsOpen(false)}>
        <Pressable
          onPress={() => setDoorsOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 20,
              paddingBottom: insets.bottom + 16,
            }}>
            <ResumeDoors
              hasResume={profile.hasResume}
              hasLinkedin={!!profile.linkedinUrl?.trim()}
              onUpload={() => void onUpload()}
              onBuildFromLinkedin={() => {
                setDoorsOpen(false);
                router.push('/resume-preview');
              }}
              onDescribe={() => {
                setDoorsOpen(false);
                router.push('/resume-from-text');
              }}
              onNotNow={() => setDoorsOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
