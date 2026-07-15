import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getScoutChat,
  listScoutChats,
  sendScoutMessage,
  type ScoutAction,
  type ScoutChatMeta,
  type ScoutTurn,
} from '@/api/endpoints/scout';
import Input from '@/components/ui/Input';
import { scoutThread } from '@/lib/scoutThread';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Scout, the AI assistant, as a summonable sheet. The conversation is the
 * SAME thread as the Scout tab (shared via scoutThread) — opening the sheet
 * mid-session shows what you and Scout already said, and the server chat_id
 * rides along so clarifies resolve across surfaces. The history sidebar
 * lists the server-persisted chats (free tier sees one — its upgrade
 * affordance); tapping one loads it into both surfaces.
 */

type Message = { from: 'user' | 'scout'; text: string; actions?: ScoutAction[] };

const SUGGESTIONS = [
  'What should I say in a coffee chat?',
  'Which of these jobs fits my resume?',
  'Find alumni at a company I’m targeting',
];

export default function ScoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { jobs, profile } = useApp();
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);

  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;

  const greeting = job
    ? `You're looking at ${job.title} at ${job.company}. Ask me how to position yourself, who to reach, or what to say — I've got your resume and pipeline.`
    : "Hey, I'm Scout. Ask me anything about your search — who to reach at a company, what to say in a coffee chat, or which jobs fit your resume.";

  // Seed from the shared thread: the sheet continues whatever conversation
  // the Scout tab already has going (and vice versa).
  const [messages, setMessages] = useState<Message[]>(() => [
    { from: 'scout', text: greeting },
    ...scoutThread.entries().map((e) => ({ from: e.from, text: e.text })),
  ]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedChats, setSavedChats] = useState<ScoutChatMeta[] | 'loading' | 'error'>('loading');

  const userInfo = {
    name: profile.name,
    tier: (profile.plan || 'Free').toLowerCase(),
    credits: profile.credits,
    max_credits: profile.maxCredits,
  };

  const newChat = () => {
    scoutThread.reset();
    setMessages([{ from: 'scout', text: greeting }]);
    setHistoryOpen(false);
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setSavedChats('loading');
    listScoutChats()
      .then(setSavedChats)
      .catch(() => setSavedChats('error'));
  };

  const loadChat = async (meta: ScoutChatMeta) => {
    setHistoryOpen(false);
    setThinking(true);
    try {
      const { turns } = await getScoutChat(meta.chat_id);
      const entries = turns.map((t) => ({
        from: t.role === 'user' ? ('user' as const) : ('scout' as const),
        text: t.content,
      }));
      // Both surfaces swap to the loaded thread together.
      scoutThread.replaceAll(entries, meta.chat_id);
      setMessages([{ from: 'scout', text: greeting }, ...entries]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: 'scout', text: "I couldn't load that chat — give it another try." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    // Shared rolling window (server reloads the full thread from chat_id
    // anyway; resending everything just bloats the request).
    const history: ScoutTurn[] = scoutThread.history(16);

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    scoutThread.append({ from: 'user', text: trimmed });
    setDraft('');
    setThinking(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await sendScoutMessage({
        message: trimmed,
        history,
        currentPage: job ? '/job-board' : '/home',
        userInfo,
        chatId: scoutThread.chatId(),
      });
      if (res.chatId) scoutThread.setChatId(res.chatId);
      scoutThread.append({ from: 'scout', text: res.message });
      setMessages((prev) => [...prev, { from: 'scout', text: res.message, actions: res.actions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: 'scout', text: "I hit a snag reaching the server — give it another try in a moment." },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <Pressable
          onPress={openHistory}
          accessibilityRole="button"
          accessibilityLabel="Chat history"
          style={{ padding: 4 }}>
          <Ionicons name="time-outline" size={22} color={colors.ink} />
        </Pressable>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.paper2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <Image
            source={require('../../assets/images/scout-yeti-head.png')}
            style={{ width: 29, height: 29, marginTop: 4 }}
            resizeMode="contain"
            accessibilityLabel="Scout"
          />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
          Scout
        </Text>
        <Pressable
          onPress={newChat}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          style={{ padding: 4 }}>
          <Ionicons name="create-outline" size={21} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 4 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 10 }}>
        {messages.map((msg, i) =>
          msg.from === 'user' ? (
            <View
              key={i}
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                backgroundColor: colors.ink,
                borderRadius: 10,
                padding: 12,
              }}>
              <Text
                style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.paper }}>
                {msg.text}
              </Text>
            </View>
          ) : (
            <View key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    backgroundColor: colors.paper2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  <Image
                    source={require('../../assets/images/scout-yeti-head.png')}
                    style={{ width: 22, height: 22, marginTop: 3 }}
                    resizeMode="contain"
                  />
                </View>
                <View
                  style={{
                    flexShrink: 1,
                    backgroundColor: colors.paper2,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    borderRadius: 10,
                    padding: 12,
                  }}>
                  <Text
                    style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: colors.ink }}>
                    {msg.text}
                  </Text>
                </View>
              </View>
              {msg.actions?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 34 }}>
                  {msg.actions.map((a) => (
                    <Pressable
                      key={a.href ?? `m:${a.chatMessage ?? a.label}`}
                      onPress={() => {
                        // chat_message chips run in the conversation (e.g.
                        // "Find people at X"); route chips close the sheet
                        // and navigate. a.href is optional — never push
                        // undefined (pre-fix these chips were dead buttons).
                        if (a.chatMessage) {
                          void send(a.chatMessage);
                          return;
                        }
                        if (!a.href) return;
                        router.back();
                        router.push(a.href as never);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.accent + '55',
                        backgroundColor: colors.accent + '0F',
                      }}>
                      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.accent }}>
                        {a.label}
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color={colors.accent} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ),
        )}
        {thinking ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.paper2,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkTertiary }}>
              Scout is thinking...
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 14, gap: 10 }}>
        {messages.length <= 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.accent + '40',
                  backgroundColor: colors.accent + '0D',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accent }}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask Scout anything"
              onSubmitEditing={() => send(draft)}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={() => send(draft)}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="arrow-up" size={17} color={colors.paper} />
          </Pressable>
        </View>
      </View>

      {historyOpen ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
          <View
            style={{
              width: 270,
              backgroundColor: colors.paper,
              borderRightWidth: 1,
              borderRightColor: colors.hairline,
              paddingTop: insets.top + 16,
              paddingHorizontal: 16,
              gap: 8,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                Chats
              </Text>
              <Pressable onPress={() => setHistoryOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={colors.inkSecondary} />
              </Pressable>
            </View>
            <Pressable
              onPress={newChat}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: colors.paper2,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}>
              <Ionicons name="create-outline" size={16} color={colors.ink} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                New chat
              </Text>
            </Pressable>
            <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ gap: 6, paddingBottom: 24 }}>
              {savedChats === 'loading' ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, paddingHorizontal: 4 }}>
                  Loading your chats…
                </Text>
              ) : savedChats === 'error' ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, paddingHorizontal: 4, lineHeight: 18 }}>
                  Couldn't load saved chats — check your connection and reopen this panel.
                </Text>
              ) : savedChats.length === 0 ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary, paddingHorizontal: 4, lineHeight: 18 }}>
                  No saved chats yet — ask Scout something and the thread lands here.
                </Text>
              ) : (
                savedChats.map((c) => {
                  const active = c.chat_id === scoutThread.chatId();
                  return (
                    <Pressable
                      key={c.chat_id}
                      onPress={() => void loadChat(c)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: active ? colors.accent + '14' : 'transparent',
                        borderWidth: active ? 1 : 0,
                        borderColor: active ? colors.accent + '44' : 'transparent',
                        gap: 2,
                      }}>
                      <Text
                        style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}
                        numberOfLines={1}>
                        {c.title || 'Untitled chat'}
                      </Text>
                      {c.message_count ? (
                        <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>
                          {c.message_count} message{c.message_count === 1 ? '' : 's'}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
          <Pressable
            onPress={() => setHistoryOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(17,19,24,0.35)' }}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
