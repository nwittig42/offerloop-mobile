import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { isInsufficientCredits } from '@/api/errors';
import { previewMeetingPrep, type MeetingPrepPreview } from '@/api/endpoints/meetingPreps';
import { useAIConsent } from '@/lib/aiConsent';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const looksLikeLinkedIn = (u: string) => /linkedin\.com\/in\//i.test(u.trim());

/**
 * New meeting prep: paste a LinkedIn URL and get a real brief on the person
 * plus a tailored opener (the coffee-chat-prep job, 15 credits). A uniquely
 * mobile moment, you can do it standing in front of them.
 */
export default function NewMeetingPrepScreen() {
  const router = useRouter();
  const { addMeetingPrep, showToast } = useApp();
  const colors = useColors();

  // AI consent gate (5.1.2(i)): the brief is researched and written by the AI
  // providers from the pasted profile. Redirect unconsented opens.
  const { consent } = useAIConsent();
  useEffect(() => {
    if (consent !== 'granted') {
      router.replace({ pathname: '/ai-consent', params: { mode: 'prompt' } });
    }
  }, [consent, router]);
  // `scanned` comes from the QR scanner; `linkedin` from a contact's Prep
  // button, which already knows the URL. Same seeding either way.
  const { scanned, linkedin } = useLocalSearchParams<{ scanned?: string; linkedin?: string }>();
  const seedUrl = typeof linkedin === 'string' && linkedin ? linkedin : scanned;
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<MeetingPrepPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const lastPreviewed = useRef('');

  // A URL handed back from the QR scanner seeds the field (which kicks off the
  // preview effect below). Guarded so editing the field afterward isn't undone.
  const seededFromScan = useRef('');
  useEffect(() => {
    if (seedUrl && typeof seedUrl === 'string' && seedUrl !== seededFromScan.current) {
      seededFromScan.current = seedUrl;
      setUrl(seedUrl);
    }
  }, [seedUrl]);

  // Free "who is this" lookup once a real LinkedIn URL is entered, so the user
  // confirms the right person before spending 15 credits. Debounced; never
  // blocks — a miss just leaves the manual name field in charge.
  useEffect(() => {
    const u = url.trim().replace(/[?#].*$/, '').replace(/\/$/, '');
    if (!looksLikeLinkedIn(u)) {
      setPreview(null);
      return;
    }
    if (u === lastPreviewed.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const p = await previewMeetingPrep(u);
        if (cancelled) return;
        lastPreviewed.current = u;
        setPreview(p);
        // Pre-fill the name if we found one and the user hasn't typed their own.
        if (p.found && p.name && !name.trim()) setName(p.name);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url, name]);

  const canGenerate = url.trim().length > 0 && !busy;
  const firstName = (preview?.name || name).trim().split(/\s+/)[0] || '';

  const generate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    try {
      const id = await addMeetingPrep({ name, linkedinUrl: url });
      router.replace(`/meeting-prep/${id}`);
    } catch (e) {
      setBusy(false);
      showToast(
        isInsufficientCredits(e) ? 'You have hit this month\'s prep limit — it resets on the 1st' : 'Could not start the prep',
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

          {/* The other half of "paste their LinkedIn": going and GETTING it.
              A real button, right under the field it feeds (Rylan
              2026-08-30: the small link version was missable and users go
              to the LinkedIn app anyway to find profiles). The https URL is
              a universal link: iOS opens the LinkedIn APP when installed,
              the site otherwise, no custom scheme allowlisting needed. */}
          <Pressable
            onPress={() => void Linking.openURL('https://www.linkedin.com/')}
            accessibilityRole="button"
            accessibilityLabel="Open LinkedIn to find their profile"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 46,
              borderRadius: 10,
              backgroundColor: '#0A66C2',
            }}>
            <Ionicons name="logo-linkedin" size={18} color="#FFFFFF" />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: '#FFFFFF' }}>
              Open LinkedIn to find them
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              lineHeight: 18,
              color: colors.inkTertiary,
            }}>
            In LinkedIn: open their profile, tap the three dots, then Share via,
            then Copy link. Come back and paste it above.
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
              Their name (optional)
            </Text>
            <Input value={name} onChangeText={setName} placeholder="First Last" />
          </View>

          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={() => router.push('/scan-linkedin')}
            accessibilityRole="button">
            <Ionicons name="qr-code-outline" size={16} color={colors.accent} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
              Scan a LinkedIn QR at a career fair
            </Text>
          </Pressable>
        </Card>

        {previewing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
            <ActivityIndicator size="small" color={colors.navy} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary }}>
              Looking up this profile…
            </Text>
          </View>
        ) : preview?.found ? (
          <Card style={{ gap: 4, borderColor: colors.positive + '44', borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.positive} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.heading, flex: 1 }}>
                {preview.name}
              </Text>
            </View>
            {preview.title || preview.company ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink }}>
                {[preview.title, preview.company].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {preview.location || preview.school ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                {[preview.school, preview.location].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Card>
        ) : preview && !preview.found ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, paddingHorizontal: 4, lineHeight: 18 }}>
            Couldn’t pull this profile automatically — you can still prep with the name above.
          </Text>
        ) : null}

        <Button
          label={
            busy
              ? 'Starting prep...'
              : preview?.found && firstName
                ? `Prep ${firstName}`
                : 'Prep this person'
          }
          size="lg"
          fullWidth
          disabled={!canGenerate}
          onPress={generate}
        />
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
          Reads their LinkedIn and writes a brief. Free — takes a few moments.
        </Text>
      </ScrollView>
    </View>
  );
}
