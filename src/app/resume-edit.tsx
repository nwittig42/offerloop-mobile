import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  currentResume,
  finalizeResume,
  RESUME_BUILDER_LIVE,
  sectionsFromCanonical,
  type CanonicalResume,
} from '@/api/endpoints/resumeBuilder';
import { qk } from '@/api/queryKeys';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { ResumeRefine } from '@/components/resume/ResumeRefine';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Edit the SAVED resume (Rylan 2026-08-11): load the stored resume in
 * editable form, refine it with typed instructions, preview every change,
 * and only overwrite the saved file when the user taps save. Backing out
 * keeps the stored resume untouched.
 */
export default function ResumeEditScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useApp();

  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; resume: CanonicalResume; dirty: boolean }
    | { phase: 'none' }
  >({ phase: 'loading' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!RESUME_BUILDER_LIVE) {
      router.back();
      return;
    }
    let alive = true;
    currentResume().then((resume) => {
      if (!alive) return;
      setState(resume ? { phase: 'ready', resume, dirty: false } : { phase: 'none' });
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const save = async () => {
    if (state.phase !== 'ready' || saving) return;
    setSaving(true);
    const ok = await finalizeResume(state.resume);
    setSaving(false);
    if (ok) {
      showToast('Resume updated');
      await queryClient.invalidateQueries({ queryKey: qk.me });
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.back();
    } else {
      showToast('Could not save the changes. Try again.');
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
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
          Edit your resume
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={{ flex: 1, padding: 20, paddingBottom: insets.bottom + 16 }}>
        {state.phase === 'loading' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.navy} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
              Loading your resume…
            </Text>
          </View>
        ) : state.phase === 'ready' ? (
          <View style={{ flex: 1, gap: 12 }}>
            <ResumePreview
              fileName="Offerloop_Resume.pdf"
              sections={sectionsFromCanonical(state.resume)}
              onUse={save}
              busy={saving}
              useLabel={state.dirty ? 'Save changes' : 'Looks right, keep it'}
              onSecondary={() => router.back()}
              secondaryLabel="Cancel"
            />
            <ResumeRefine
              resume={state.resume}
              onRefined={(next) => setState({ phase: 'ready', resume: next, dirty: true })}
              onLimit={() => showToast('Daily edit limit reached. It resets tomorrow.')}
              onError={(m) => showToast(m)}
            />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 }}>
            <Ionicons name="document-outline" size={34} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
              We could not load your resume in editable form. If you uploaded a file,
              editing works best on resumes built in the app.
            </Text>
            <Button label="Close" variant="outline" onPress={() => router.back()} />
          </View>
        )}
      </View>
    </View>
  );
}
