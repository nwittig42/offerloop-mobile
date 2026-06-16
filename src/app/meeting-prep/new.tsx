import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { isInsufficientCredits } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * New meeting prep: paste a LinkedIn URL and get a real brief on the person
 * plus a tailored opener (the coffee-chat-prep job, 15 credits). A uniquely
 * mobile moment, you can do it standing in front of them.
 */
export default function NewMeetingPrepScreen() {
  const router = useRouter();
  const { addMeetingPrep, showToast } = useApp();
  const colors = useColors();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const canGenerate = url.trim().length > 0 && !busy;

  const generate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    try {
      const id = await addMeetingPrep({ name, linkedinUrl: url });
      router.replace(`/meeting-prep/${id}`);
    } catch (e) {
      setBusy(false);
      showToast(
        isInsufficientCredits(e) ? 'Not enough credits for a prep (15)' : 'Could not start the prep',
      );
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
        <Ionicons name="cafe" size={20} color={colors.navy} />
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
          Meeting prep
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text
          style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          About to grab coffee or chat at a career fair? Paste their LinkedIn and get a
          quick brief plus an opener, so you walk in ready.
        </Text>

        <Card style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
              LinkedIn URL
            </Text>
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder="linkedin.com/in/their-profile"
              autoCapitalize="none"
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
              Their name (optional)
            </Text>
            <Input value={name} onChangeText={setName} placeholder="First Last" />
          </View>

          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={() => {}}>
            <Ionicons name="qr-code-outline" size={16} color={colors.inkTertiary} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              QR scan for career fairs arrives with real wiring
            </Text>
          </Pressable>
        </Card>

        <Button
          label={busy ? 'Starting prep...' : 'Prep this person'}
          size="lg"
          fullWidth
          disabled={!canGenerate}
          onPress={generate}
        />
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
          Reads their LinkedIn and writes a brief. Costs 15 credits and takes a few moments.
        </Text>
      </ScrollView>
    </View>
  );
}
