import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  finalizeResume,
  previewResumeFromLinkedin,
  RESUME_BUILDER_LIVE,
  sectionsFromCanonical,
  type CanonicalResume,
} from '@/api/endpoints/resumeBuilder';
import { qk } from '@/api/queryKeys';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Build-from-LinkedIn: preview then approve (the quality bar: a generated
 * resume is NEVER adopted without the user seeing it and saying yes).
 * finalize is the only save; backing out saves nothing.
 */
export default function ResumePreviewScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useApp();

  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; resume: CanonicalResume }
    | { phase: 'thin'; missing: string[] }
    | { phase: 'limit' }
    | { phase: 'error'; message: string }
  >({ phase: 'loading' });
  const [adopting, setAdopting] = useState(false);

  useEffect(() => {
    if (!RESUME_BUILDER_LIVE) {
      // Shipped dark: nothing routes here until the flag flips, but a stale
      // deep link should exit gracefully rather than spin.
      router.back();
      return;
    }
    let alive = true;
    previewResumeFromLinkedin().then((r) => {
      if (!alive) return;
      if (r.status === 'ok') setState({ phase: 'ready', resume: r.resume });
      else if (r.status === 'thin') setState({ phase: 'thin', missing: r.missing });
      else if (r.status === 'limit') setState({ phase: 'limit' });
      else setState({ phase: 'error', message: r.message });
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const adopt = async () => {
    if (state.phase !== 'ready' || adopting) return;
    setAdopting(true);
    const ok = await finalizeResume(state.resume);
    setAdopting(false);
    if (ok) {
      showToast('Resume saved. Auto-apply can use it now.');
      await queryClient.invalidateQueries({ queryKey: qk.me });
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.back();
    } else {
      showToast('Could not save the resume. Try again.');
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
          Your resume
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
              Building your resume from LinkedIn…
            </Text>
          </View>
        ) : state.phase === 'ready' ? (
          <ResumePreview
            fileName="Offerloop_Resume.pdf"
            sections={sectionsFromCanonical(state.resume)}
            onUse={adopt}
            busy={adopting}
            onSecondary={() => router.back()}
            secondaryLabel="Not yet"
          />
        ) : state.phase === 'thin' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 }}>
            <Ionicons name="document-outline" size={34} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink, textAlign: 'center' }}>
              Not enough on your LinkedIn yet
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
              We only build from real information, and your profile needs a bit more
              ({state.missing.join(', ') || 'experience or education'}) before a resume
              would do you justice. Add details in Profile, or upload a resume file instead.
            </Text>
            <Button label="Open Profile" variant="brand" onPress={() => { router.back(); router.push('/(tabs)/profile'); }} />
          </View>
        ) : state.phase === 'limit' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Ionicons name="hourglass-outline" size={34} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
              You have reached the resume generation limit for now.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Ionicons name="cloud-offline-outline" size={34} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center' }}>
              {state.message}
            </Text>
            <Button label="Close" variant="outline" onPress={() => router.back()} />
          </View>
        )}
      </View>
    </View>
  );
}
