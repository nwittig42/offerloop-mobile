import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResumeDoors } from '@/components/resume/ResumeDoors';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { UpgradeNudgeCard } from '@/components/resume/UpgradeNudgeCard';
import { ActionCircle, Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Phase 0 token gallery. Everything on this screen is a SPECIMEN with
 * clearly fake fixture content, never plausible product data.
 * Purpose: eyeball brand fidelity on a real device before feature work.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontFamily: fonts.sansSemibold,
          fontSize: 12,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: colors.inkTertiary,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Swatch({ name, hex, border }: { name: string; hex: string; border?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 4, width: 76 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: hex,
          borderWidth: border ? 1 : 0,
          borderColor: colors.hairline,
        }}
      />
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10, color: colors.inkSecondary }}>
        {name}
      </Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.inkTertiary }}>{hex}</Text>
    </View>
  );
}

export default function DesignGallery() {
  // Dev tool with fixture content — never reachable in a store build, even via
  // deep link (Apple 2.2 placeholder-content guard).
  if (!__DEV__) return <Redirect href="/(tabs)/feed" />;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();

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
          justifyContent: 'space-between',
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.heading }}>
          Design gallery
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 28 }}>
        <Section title="Typography">
          <Card>
            <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.heading }}>
              Offerloop
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.heading, marginTop: 4 }}>
              0123456789
            </Text>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 17, color: colors.ink, marginTop: 14 }}>
              Inter Semibold, card titles
            </Text>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink, marginTop: 6 }}>
              Inter Medium, buttons and labels
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, marginTop: 6, lineHeight: 21 }}>
              Inter Regular, body copy in secondary ink. The quick brown fox jumps over the lazy dog.
            </Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.inkTertiary, marginTop: 8 }}>
              JetBrains Mono 0123456789
            </Text>
          </Card>
        </Section>

        <Section title="Color">
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Swatch name="paper" hex="#FFFFFF" border />
              <Swatch name="paper-2" hex="#FAFBFF" border />
              <Swatch name="surface" hex="#F5F6F8" border />
              <Swatch name="ink" hex="#111318" />
              <Swatch name="ink-2" hex="#4A4F5B" />
              <Swatch name="ink-3" hex="#8A8F9A" />
              <Swatch name="navy" hex="#1B2A44" />
              <Swatch name="heading" hex="#1E2D4D" />
              <Swatch name="accent" hex="#4A60A8" />
              <Swatch name="positive" hex="#16A34A" />
              <Swatch name="negative" hex="#DC2626" />
              <Swatch name="waiting" hex="#CA8A04" />
            </View>
          </Card>
        </Section>

        <Section title="Buttons">
          <Card style={{ gap: 10 }}>
            <Button label="Primary, ink fill" />
            <Button label="Secondary / outline" variant="outline" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Brand navy" variant="brand" />
            <Button label="Accent, fills on press" variant="accent" />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Button label="Small" size="sm" variant="outline" />
              <Button label="Large" size="lg" />
              <Button icon="share-outline" size="icon" variant="outline" />
            </View>
          </Card>
        </Section>

        <Section title="Chips">
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Neutral" />
              <Chip label="Hybrid" tone="brand" />
              <Chip label="Ready to review" tone="accent" dot />
              <Chip label="Replied" tone="positive" dot />
              <Chip label="No contact found" tone="negative" />
              <Chip label="Drafting" tone="waiting" dot />
            </View>
          </Card>
        </Section>

        <Section title="Inputs">
          <Card style={{ gap: 10 }}>
            <Input placeholder="Subject line" />
            <Input placeholder="Tap to test the focus ring" />
            <Input placeholder="Multiline body" multiline />
          </Card>
        </Section>

        <Section title="Resume path (unwired specimens, fake fixture data)">
          <Card style={{ paddingVertical: 24 }}>
            <ResumeDoors
              hasResume={false}
              hasLinkedin
              onUpload={() => {}}
              onBuildFromLinkedin={() => {}}
              onNotNow={() => {}}
            />
          </Card>
          <View style={{ height: 460 }}>
            <ResumePreview
              fileName="sample-resume.pdf"
              sections={[
                {
                  title: 'Experience',
                  entries: [
                    {
                      heading: 'Sample Job Title',
                      sub: 'Acme Test Co',
                      meta: 'Sample Dates',
                      bullets: ['Sample bullet describing fake work.', 'Second sample bullet.'],
                    },
                    { heading: 'Sample Second Role', sub: 'Placeholder Industries', meta: 'Sample Dates' },
                  ],
                },
                { title: 'Education', entries: [{ heading: 'Sample University', sub: 'Sample Degree' }] },
                { title: 'Skills', entries: [{ bullets: ['Sample skill one, sample skill two'] }] },
              ]}
              onUse={() => {}}
              onSecondary={() => {}}
            />
          </View>
          <UpgradeNudgeCard onTry={() => {}} onDismiss={() => {}} />
        </Section>

        <Section title="Swipe card specimen (fake fixture data)">
          <Card elevated="lg" style={{ gap: 14 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 22, color: colors.heading }}>
                Sample Job Title
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: colors.paper2,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.navy }}>
                  A
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
                  Acme Test Co
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={11} color={colors.inkTertiary} />
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                    Sample City, CA
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkSecondary }}>
                Work arrangement
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label="Hybrid" tone="brand" />
                <Chip label="Internship" tone="accent" />
              </View>
            </View>
            <Text
              numberOfLines={3}
              style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
              This is placeholder fixture text standing in for a job description.
              It exists only to judge type color, size, and line height on a card.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                paddingTop: 4,
              }}>
              <ActionCircle icon="arrow-undo-outline" size={40} />
              <ActionCircle icon="close" tone="negative" />
              <ActionCircle icon="paper-plane" tone="ink" />
              <ActionCircle icon="share-outline" size={40} />
            </View>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}
