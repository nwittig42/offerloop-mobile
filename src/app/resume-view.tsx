import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickResume, renameResume, uploadResume } from '@/api/endpoints/resume';
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
  // Tap the title to rename (Rylan 2026-09-08). The name is what recruiters
  // see on the attachment, so it is worth a tap. Extension stays server-side.
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const openRename = () => {
    const current = profile.resume?.name || '';
    setDraftName(current.replace(/\.(pdf|docx?)$/i, ''));
    setRenaming(true);
  };
  const saveRename = async () => {
    const next = draftName.trim();
    if (!next) return;
    setRenaming(false);
    try {
      const finalName = await renameResume(next);
      await queryClient.invalidateQueries({ queryKey: qk.me });
      showToast(`Renamed to ${finalName}`);
    } catch {
      showToast('Could not rename the resume.');
    }
  };

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
        <Pressable
          onPress={url ? openRename : undefined}
          accessibilityRole="button"
          accessibilityLabel="Rename resume"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flexShrink: 1 }} numberOfLines={1}>
            {profile.resume?.name || 'Your resume'}
          </Text>
          {url ? <Ionicons name="pencil-outline" size={16} color={colors.inkTertiary} /> : null}
        </Pressable>
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

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable
          onPress={() => setRenaming(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.paper, borderRadius: 14, padding: 18, gap: 12 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>Rename resume</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
              This is the file name recruiters see on your emails and applications.
            </Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void saveRename()}
              placeholder="Rylan Bohnett Resume"
              placeholderTextColor={colors.inkTertiary}
              style={{
                height: 46,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.hairline,
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                fontFamily: fonts.sans,
                fontSize: 15,
                color: colors.ink,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button label="Cancel" variant="outline" size="sm" onPress={() => setRenaming(false)} />
              <Button label="Save" variant="brand" size="sm" onPress={() => void saveRename()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
