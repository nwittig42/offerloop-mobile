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

import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';
import { MOCK_SCOUT_CHATS } from '@/mocks/data';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Scout, the AI assistant, as a summonable sheet. A small history sidebar
 * (like Claude's) holds previous chats and a New chat button, tucked behind
 * a button so it never crowds the conversation. Phase 1 is a clearly
 * labeled mock so the interaction can be felt; real Scout wires up in
 * Phase 3 against the existing backend service.
 */

type Message = { from: 'user' | 'scout'; text: string };

const SUGGESTIONS = [
  'What should I say in a coffee chat?',
  'Which of these jobs fits my resume?',
  'Set up a Loop for consulting roles',
];

export default function ScoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const { jobs } = useApp();
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);

  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;

  const greeting = job
    ? `You are looking at ${job.title} at ${job.company}. I am a mock preview for now, but ask me anything and you will see how this conversation will flow.`
    : 'Hey, I am Scout. I am a mock preview for now, but ask me anything and you will see how this conversation will flow.';

  const [messages, setMessages] = useState<Message[]>([{ from: 'scout', text: greeting }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const newChat = () => {
    setMessages([{ from: 'scout', text: greeting }]);
    setHistoryOpen(false);
  };

  const openChat = (title: string) => {
    setMessages([
      { from: 'scout', text: `Picking up "${title}". This is a mock of an archived chat.` },
    ]);
    setHistoryOpen(false);
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setDraft('');
    setThinking(true);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          from: 'scout',
          text: 'Fixture reply: the real Scout answers with your resume, your pipeline, and live data once Phase 3 wires the backend. This preview is here so the feel of the chat can be tuned now.',
        },
      ]);
      setThinking(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 1100);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
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
          onPress={() => setHistoryOpen(true)}
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
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start' }}>
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
                  maxWidth: '78%',
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
            <ScrollView contentContainerStyle={{ gap: 2, paddingTop: 4 }}>
              {MOCK_SCOUT_CHATS.map((chat) => (
                <Pressable
                  key={chat.id}
                  onPress={() => openChat(chat.title)}
                  style={{ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                    {chat.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>
                    {chat.timeLabel}
                  </Text>
                </Pressable>
              ))}
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
