import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CompanyLogo from '@/components/CompanyLogo';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Jobs you passed on, reachable from the Network summary. Like Sorce's
 * "jobs you passed on" list. You can put one back into the feed if you
 * changed your mind.
 */
export default function PassedJobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { passedJobs, restorePassedJob, showToast } = useApp();

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
          Jobs you passed on
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: insets.bottom + 40 }}>
        {passedJobs.length === 0 ? (
          <Text
            style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21, paddingTop: 8 }}>
            You have not passed on any jobs yet. Swipe left in the feed and they collect
            here, in case you change your mind.
          </Text>
        ) : (
          passedJobs
            .slice()
            .reverse()
            .map((job) => (
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
                <Button
                  label="Put back in feed"
                  variant="outline"
                  size="sm"
                  icon="arrow-undo-outline"
                  onPress={() => {
                    restorePassedJob(job.id);
                    showToast('Back in your feed');
                  }}
                />
              </Card>
            ))
        )}
      </ScrollView>
    </View>
  );
}
