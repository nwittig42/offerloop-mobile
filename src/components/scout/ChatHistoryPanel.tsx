import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getScoutChat, listScoutChats, type ScoutChatMeta } from '@/api/endpoints/scout';
import { scoutThread, type ScoutThreadEntry } from '@/lib/scoutThread';
import type { ScoutRoom } from '@/theme/scoutRoom';
import { fonts } from '@/theme/tokens';

/**
 * The saved-chat drawer, slid over the Scout tab from the header. Chats are
 * server-persisted (users/{uid}/scoutChats); free accounts see one, which is
 * the upgrade affordance the web app uses too. Loading one swaps the shared
 * scoutThread wholesale, so the tab AND the header sheet land on the same
 * conversation.
 */
export default function ChatHistoryPanel({
  room,
  onClose,
  onNewChat,
  onLoaded,
  onError,
  onExplain,
}: {
  room: ScoutRoom;
  onClose: () => void;
  onNewChat: () => void;
  /** A saved chat is now the live thread: re-render the transcript. */
  onLoaded: (entries: ScoutThreadEntry[]) => void;
  onError: (message: string) => void;
  /** Open the "what does Scout do" explainer. Here as well as on the empty
   *  state, because mid-conversation is exactly when someone wonders whether
   *  Scout can do the thing they were about to go do by hand. */
  onExplain: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ScoutChatMeta[] | 'loading' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    listScoutChats()
      .then((c) => alive && setChats(c))
      .catch(() => alive && setChats('error'));
    return () => {
      alive = false;
    };
  }, []);

  const load = async (meta: ScoutChatMeta) => {
    onClose();
    try {
      const { turns } = await getScoutChat(meta.chat_id);
      const entries: ScoutThreadEntry[] = turns.map((t) => ({
        from: t.role === 'user' ? ('user' as const) : ('scout' as const),
        text: t.content,
      }));
      scoutThread.replaceAll(entries, meta.chat_id);
      onLoaded(entries);
    } catch {
      onError("I couldn't load that chat, give it another try.");
    }
  };

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
      <View
        style={{
          width: 274,
          backgroundColor: room.panel,
          borderRightWidth: 1,
          borderRightColor: room.lineSoft,
          paddingTop: insets.top + 14,
          paddingHorizontal: 14,
          gap: 8,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: room.ink }}>Chats</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close chats" style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={room.ink2} />
          </Pressable>
        </View>

        <Pressable
          onPress={onNewChat}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: room.cardSoft,
            borderWidth: 1,
            borderColor: room.lineSoft,
          }}>
          <Ionicons name="create-outline" size={16} color={room.ink} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: room.ink }}>New chat</Text>
        </Pressable>

        <ScrollView style={{ flex: 1, marginTop: 6 }} contentContainerStyle={{ gap: 6, paddingBottom: 24 }}>
          {chats === 'loading' ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: room.ink3, paddingHorizontal: 4 }}>
              Loading your chats…
            </Text>
          ) : chats === 'error' ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: room.ink3, paddingHorizontal: 4 }}>
              Could not load saved chats. Check your connection and reopen this panel.
            </Text>
          ) : chats.length === 0 ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: room.ink3, paddingHorizontal: 4 }}>
              No saved chats yet. Ask Scout something and the thread lands here.
            </Text>
          ) : (
            chats.map((c) => {
              const active = c.chat_id === scoutThread.chatId();
              return (
                <Pressable
                  key={c.chat_id}
                  onPress={() => void load(c)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: active ? room.tint : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? room.tintLine : 'transparent',
                    gap: 2,
                  }}>
                  <Text
                    style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: room.ink }}
                    numberOfLines={1}>
                    {c.title || 'Untitled chat'}
                  </Text>
                  {c.message_count ? (
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: room.ink3 }}>
                      {c.message_count} message{c.message_count === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <Pressable
          onPress={onExplain}
          accessibilityRole="button"
          style={{
            borderTopWidth: 1,
            borderTopColor: room.lineSoft,
            paddingVertical: 14,
            paddingHorizontal: 4,
            marginBottom: insets.bottom + 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <Ionicons name="help-circle-outline" size={17} color={room.accent} />
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: room.accent }}>
            What does Scout do?
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: room.scrim }} />
    </View>
  );
}
