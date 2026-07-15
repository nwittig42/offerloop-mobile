import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchFeedback, sendFeedback } from '@/api/endpoints/feedback';
import { FOUNDER_PHONE, FOUNDER_PHONE_DISPLAY, FOUNDER_PHONE_SET } from '@/lib/links';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Feedback — a direct line to the founders (Sorce-style). A chat screen: a
 * standing prompt from us, then whatever the user sends lands in the top-level
 * `feedback` collection for a human to read. No AI, no auto-reply — the value is
 * that it goes straight to us. The header's call button opens a "Talk to a
 * Founder" sheet with a real phone number.
 */
type Bubble = { from: 'founder' | 'me'; text: string };

const FOUNDER_PROMPT = "What do you love or hate about Offerloop? This goes straight to the founders — we read every message.";

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { showToast } = useApp();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [local, setLocal] = useState<Bubble[]>([]);
  const [callOpen, setCallOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // The user's own past messages, so returning to the screen replays the thread.
  const sentQuery = useQuery({ queryKey: ['feedback'], queryFn: fetchFeedback });
  const history: Bubble[] = (sentQuery.data ?? []).map((m) => ({ from: 'me', text: m.message }));
  const bubbles: Bubble[] = [{ from: 'founder', text: FOUNDER_PROMPT }, ...history, ...local];

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [bubbles.length]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    setLocal((prev) => [...prev, { from: 'me', text }]); // optimistic
    try {
      await sendFeedback(text);
    } catch {
      // Keep the message on screen but tell them it didn't send.
      showToast("Couldn't send that — check your connection and try again");
    } finally {
      setSending(false);
    }
  }, [draft, sending, showToast]);

  const callFounder = () => {
    setCallOpen(false);
    Linking.openURL(`tel:${FOUNDER_PHONE}`).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header: title + a Sorce-style call button. */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6 }} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
          Feedback
        </Text>
        {FOUNDER_PHONE_SET ? (
          <Pressable
            onPress={() => setCallOpen(true)}
            accessibilityLabel="Call a founder"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.positive + '18',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="call" size={18} color={colors.positive} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled">
          {bubbles.map((b, i) => {
            const mine = b.from === 'me';
            return (
              <View
                key={i}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
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
            <ActivityIndicator size="small" color={colors.inkTertiary} style={{ marginTop: 8 }} />
          ) : null}
        </ScrollView>

        {/* Composer. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 8,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
            backgroundColor: colors.paper,
          }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Tell us anything…"
            placeholderTextColor={colors.inkTertiary}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 40,
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.hairline,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              fontFamily: fonts.sans,
              fontSize: 14.5,
              color: colors.ink,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
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
      </KeyboardAvoidingView>

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
              onPress={callFounder}
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
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.negative }}>
                Dismiss
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
