import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompanyLogo from '@/components/CompanyLogo';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * Jobs you swiped up to save, reachable from the Companies tab. Revisit later to
 * apply (one-tap auto-apply on a supported ATS), put back in the feed to reach
 * out, or remove.
 */
export default function SavedJobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { savedJobs, restoreSavedJob, unsaveJob, autoApplyJob, showToast } = useApp();

  const applySaved = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    unsaveJob(job.id);
    autoApplyJob(job); // deduped in the store
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
          Jobs you saved
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: insets.bottom + 40 }}>
        {savedJobs.length === 0 ? (
          <Text
            style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21, paddingTop: 8 }}>
            Nothing saved yet. Swipe up on a job in the feed to save it here for later.
          </Text>
        ) : (
          savedJobs.map((job) => (
            <Card key={job.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <CompanyLogo name={job.company} logoUrl={job.logoUrl} size={38} radius={10} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.heading }}>
                    {job.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                    {job.company} · {job.location}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {job.compensation ? <Chip label={job.compensation} tone="positive" /> : null}
                {job.workArrangement ? <Chip label={job.workArrangement} tone="brand" /> : null}
                {job.experienceLevel ? <Chip label={job.experienceLevel} tone="accent" /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {job.autoApplyEligible ? (
                  <Pressable
                    onPress={() => applySaved(job)}
                    accessibilityRole="button"
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.accent,
                      borderRadius: 8,
                      paddingVertical: 10,
                    }}>
                    <Ionicons name="flash" size={15} color={colors.paper} />
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.paper }}>
                      Apply
                    </Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Button
                    label="Put back in feed"
                    variant="outline"
                    size="sm"
                    icon="arrow-undo-outline"
                    onPress={() => {
                      restoreSavedJob(job.id);
                      showToast('Back in your feed');
                    }}
                  />
                </View>
              </View>
              <Pressable onPress={() => unsaveJob(job.id)} accessibilityRole="button" style={{ alignSelf: 'center' }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkTertiary }}>
                  Remove
                </Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
