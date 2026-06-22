import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { OnboardingScaffold } from '@/components/onboarding/Scaffold';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Step 4 — the aha. The user does the core action once on a REAL job: a swipe
 * drafts a real, personalized intro to someone at that company (via the live
 * draftJob path), which lands in their Inbox. Everything before exists to make
 * this land. Falls back gracefully if the feed hasn't loaded yet.
 */
export default function OnboardingDemo() {
  const router = useRouter();
  const colors = useColors();
  const { jobs, draftJob } = useApp();
  const [done, setDone] = useState(false);

  const job = jobs[0];

  const draft = () => {
    if (job) draftJob(job.id);
    setDone(true);
  };

  if (done) {
    return (
      <OnboardingScaffold
        step={4}
        total={6}
        canBack={false}
        title="That's the magic"
        subtitle="We're drafting a personalized intro right now — it'll be waiting in your Inbox. That's all a swipe does."
        footer={
          <Button
            label="Continue"
            variant="brand"
            size="lg"
            fullWidth
            icon="arrow-forward"
            onPress={() => router.push('/(onboarding)/notify')}
          />
        }>
        <View style={{ alignItems: 'center', paddingTop: 12, gap: 16 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.positive + '18',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="checkmark-circle" size={38} color={colors.positive} />
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
            Review it, tweak a line if you want, and send. Do that a few times a week and the
            replies start coming.
          </Text>
        </View>
      </OnboardingScaffold>
    );
  }

  return (
    <OnboardingScaffold
      step={4}
      total={6}
      title="Try one swipe"
      subtitle="Swipe right on a job and Offerloop drafts a tailored intro to someone who works there. Here's a real one from your feed."
      footer={
        job ? (
          <Button label="Swipe right → draft my intro" variant="brand" size="lg" fullWidth icon="arrow-forward" onPress={draft} />
        ) : (
          <Button
            label="Continue"
            variant="brand"
            size="lg"
            fullWidth
            icon="arrow-forward"
            onPress={() => router.push('/(onboarding)/notify')}
          />
        )
      }>
      {job ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 6,
                backgroundColor: colors.accent + '14',
              }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.accent, letterSpacing: 0.4 }}>
                FROM YOUR FEED
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.heading, lineHeight: 23 }}>
            {job.title}
          </Text>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
            {job.company}
            {job.location ? <Text style={{ color: colors.inkTertiary }}>{`  ·  ${job.location}`}</Text> : null}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
            <Ionicons name="person-add-outline" size={15} color={colors.inkSecondary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
              We'll find someone here worth reaching and write the intro.
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            Your feed is loading
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
            We're pulling jobs that fit your targets. Finish setup and your first swipe is waiting on
            the Feed.
          </Text>
        </Card>
      )}
    </OnboardingScaffold>
  );
}
