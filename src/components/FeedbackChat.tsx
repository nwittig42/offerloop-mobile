import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchFeedback, sendFeedback } from '@/api/endpoints/feedback';
import { FOUNDER_PHONE, FOUNDER_PHONE_DISPLAY, FOUNDER_PHONE_SET } from '@/lib/links';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Feedback chat body — a direct line to the founders. Self-contained (no
 * ScrollView of its own, so it drops into the Profile tab or a full screen),
 * with a standing prompt, the user's own thread, an inline composer, and a
 * "Talk to a Founder" call sheet. No AI, no auto-reply — a human reads it.
 */
type Bubble = { from: 'founder' | 'me'; text: string };

const FOUNDER_PROMPT =
  'What do you love or hate about Offerloop? This goes straight to the founders — we read every message.';

export default function FeedbackChat() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [local, setLocal] = useState<Bubble[]>([]);
  const [callOpen, setCallOpen] = useState(false);

  const sentQuery = useQuery({ queryKey: ['feedback'], queryFn: fetchFeedback });
  const history: Bubble[] = (sentQuery.data ?? []).map((m) => ({ from: 'me', text: m.message }));
  const bubbles: Bubble[] = [{ from: 'founder', text: FOUNDER_PROMPT }, ...history, ...local];

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    setLocal((prev) => [...prev, { from: 'me', text }]);
    try {
      await sendFeedback(text);
    } catch {
      showToast("Couldn't send that — check your connection and try again");
    } finally {
      setSending(false);
    }
  }, [draft, sending, showToast]);

  return (
    <View style={{ gap: 12 }}>
      {/* Call-a-Founder CTA, inline (the panel has no header of its own). */}
      {FOUNDER_PHONE_SET ? (
        <Pressable
          onPress={() => setCallOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.positive + '12',
            borderWidth: 1,
            borderColor: colors.positive + '30',
          }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.positive + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="call" size={17} color={colors.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
              Talk to a Founder
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
              Rather say it out loud? Call us anytime.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
        </Pressable>
      ) : null}

      {/* Thread. */}
      <View style={{ gap: 10 }}>
        {bubbles.map((b, i) => {
          const mine = b.from === 'me';
          return (
            <View
              key={i}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                backgroundColor: mine ? colors.accent : colors.paper2,
                borderRadius: 16,
                borderTopRightRadius: mine ? 4 : 16,
                borderTopLeftRadius: mine ? 16 : 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14.5,
                  lineHeight: 20,
                  color: mine ? colors.paper : colors.ink,
                }}>
                {b.text}
              </Text>
            </View>
          );
        })}
        {sentQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.inkTertiary} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </View>

      {/* Composer (inline — parent handles scrolling; iOS scrolls the focused input into view). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Tell us anything…"
          placeholderTextColor={colors.inkTertiary}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 44,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 12,
            fontFamily: fonts.sans,
            fontSize: 14.5,
            color: colors.ink,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: draft.trim() ? colors.accent : colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.paper} />
          )}
        </Pressable>
      </View>

      {/* Talk to a Founder sheet. */}
      <Modal visible={callOpen} transparent animationType="slide" onRequestClose={() => setCallOpen(false)}>
        <Pressable
          onPress={() => setCallOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(17,19,24,0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.paper,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 24,
              paddingBottom: insets.bottom + 24,
              alignItems: 'center',
              gap: 8,
            }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.ink }}>
              Talk to a Founder
            </Text>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: colors.inkSecondary,
                textAlign: 'center',
                lineHeight: 20,
              }}>
              Have feedback you'd rather share directly? Call us anytime.
            </Text>
            <Pressable
              onPress={() => {
                setCallOpen(false);
                Linking.openURL(`tel:${FOUNDER_PHONE}`).catch(() => {});
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                paddingVertical: 12,
                paddingHorizontal: 22,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.positive,
              }}>
              <Ionicons name="call" size={17} color={colors.positive} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.positive }}>
                {FOUNDER_PHONE_DISPLAY}
              </Text>
            </Pressable>
            <Pressable onPress={() => setCallOpen(false)} style={{ marginTop: 6, paddingVertical: 6 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.negative }}>Dismiss</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
