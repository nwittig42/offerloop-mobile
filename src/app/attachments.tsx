import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * What travels with your outreach (the doc button in the Feed action row,
 * mirroring Sorce's attachment control). Shows the resume on file and the
 * add-attachment entry point; the real picker arrives with Phase 3 wiring.
 */
export default function AttachmentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, showToast } = useApp();
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
          This is what Offerloop uses to personalize every drafted email.
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
            <Ionicons name="document-text-outline" size={19} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.ink }}>
              {profile.resume.name}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
              {profile.resume.updatedLabel}
            </Text>
          </View>
          <Chip label="Resume" tone="accent" />
        </Card>


        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.inkTertiary,
            textAlign: 'center',
            lineHeight: 18,
          }}>
          Rebuild or replace your resume on offerloop.ai and it syncs here
        </Text>
      </ScrollView>
    </View>
  );
}
