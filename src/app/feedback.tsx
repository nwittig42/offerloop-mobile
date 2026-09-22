import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

import { fetchFeedback, sendFeedback, type FeedbackMessage } from '@/api/endpoints/feedback';
import { FOUNDER_PHONE, FOUNDER_PHONE_DISPLAY, FOUNDER_PHONE_SET } from '@/lib/links';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Feedback — a direct line to the founders, laid out like Sorce's: a call button
 * in the header, the conversation as chat bubbles, and a message bar pinned to
 * the bottom. No AI-generated replies — a human writes every response (via a
 * Linear comment, see linear_client.REPLY_INSTRUCTIONS on the backend) — this
 * screen just makes that reply land somewhere personal instead of a push
 * notification. This is the deep-link target for the weekly nudge AND what the
 * Profile > Feedback tab opens.
 */
type ThreadItem = {
  id: string;
  message: string;
  response: string | null;
  responseIsPlaceholder: boolean;
  /** True only in the brief window between POST resolving and the canned ack
   *  being revealed — drives the typing-dots bubble. */
  pending: boolean;
};

const FOUNDER_PROMPT =
  'What do you love or hate about Offerloop? This goes straight to the founders — we read every message.';

/** How long the typing indicator shows before the ack reveals. Purely a feel
 *  thing — the real POST usually resolves faster than this, and revealing
 *  the ack instantly reads as a canned auto-response, not someone noticing. */
const TYPING_DELAY_MS = 900;

function TypingDots({ color }: { color: string }) {
  const values = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [values]);

  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 3 }}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
          }}
        />
      ))}
    </View>
  );
}

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { showToast } = useApp();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [local, setLocal] = useState<ThreadItem[]>([]);
  const [callOpen, setCallOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  // Keeps polling only while some reply is still the canned ack (a human
  // hasn't answered yet) — once every message has a real reply, this goes
  // quiet instead of hitting the backend forever for a screen nobody's on.
  const sentQuery = useQuery({
    queryKey: ['feedback'],
    queryFn: fetchFeedback,
    refetchInterval: (query) => {
      const data = query.state.data as FeedbackMessage[] | undefined;
      return data?.some((m) => m.responseIsPlaceholder) ? 10_000 : false;
    },
  });

  const history: ThreadItem[] = (sentQuery.data ?? []).map((m) => ({
    id: m.id,
    message: m.message,
    response: m.response,
    responseIsPlaceholder: m.responseIsPlaceholder,
    pending: false,
  }));
  // Once the server has the message (near-instant — the doc write isn't
  // deferred), drop the optimistic copy so the real one (which will later
  // pick up an actual founder reply) takes over the same spot seamlessly.
  const historyIds = new Set(history.map((h) => h.id));
  const items: ThreadItem[] = [...history, ...local.filter((l) => !historyIds.has(l.id))];

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const localId = `local-${Date.now()}`;
    setLocal((prev) => [...prev, { id: localId, message: text, response: null, responseIsPlaceholder: true, pending: true }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const sent = await sendFeedback(text);
      await new Promise((resolve) => setTimeout(resolve, TYPING_DELAY_MS));
      setLocal((prev) =>
        prev.map((item) =>
          item.id === localId
            ? { ...item, id: sent.id, response: sent.response, pending: false }
            : item,
        ),
      );
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    } catch {
      setLocal((prev) => prev.filter((item) => item.id !== localId));
      showToast("Couldn't send that — check your connection and try again");
    } finally {
      setSending(false);
    }
  }, [draft, sending, showToast, queryClient]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header: back · title · call button (Sorce puts the call button here). */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 8,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6 }} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fonts.display,
            fontSize: 20,
            color: colors.heading,
          }}>
          Feedback
        </Text>
        {FOUNDER_PHONE_SET ? (
          <Pressable
            onPress={() => setCallOpen(true)}
            accessibilityRole="button"
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
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '86%',
              backgroundColor: colors.paper2,
              borderRadius: 16,
              borderTopLeftRadius: 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20, color: colors.ink }}>
              {FOUNDER_PROMPT}
            </Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={{ gap: 10 }}>
              <View
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '86%',
                  backgroundColor: colors.accent,
                  borderRadius: 16,
                  borderTopRightRadius: 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20, color: colors.paper }}>
                  {item.message}
                </Text>
              </View>
              {item.pending ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: colors.paper2,
                    borderRadius: 16,
                    borderTopLeftRadius: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}>
                  <TypingDots color={colors.inkTertiary} />
                </View>
              ) : item.response ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '86%',
                    backgroundColor: colors.paper2,
                    borderRadius: 16,
                    borderTopLeftRadius: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20, color: colors.ink }}>
                    {item.response}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
          {sentQuery.isLoading ? (
            <ActivityIndicator size="small" color={colors.inkTertiary} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </ScrollView>

        {/* Message bar, pinned to the bottom. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 8,
            backgroundColor: colors.paper,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the founders…"
            placeholderTextColor={colors.inkTertiary}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              backgroundColor: colors.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.hairline,
              paddingHorizontal: 16,
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
