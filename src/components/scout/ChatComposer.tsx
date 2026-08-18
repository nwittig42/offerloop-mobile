import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import type { ScoutRoom } from '@/theme/scoutRoom';
import { NO_WEB_FOCUS_RING } from '@/theme/webFocus';
import { fonts } from '@/theme/tokens';

/**
 * The Scout composer: one pill at the bottom of the tab, always there,
 * modeled on the chat apps students already use (Rylan 2026-08-17).
 *
 * Plus opens what travels with outreach. The round button on the right is a
 * single control with one job at a time, so there is never a question about
 * what tapping it does:
 *
 *   nothing typed  → mic, start talking
 *   text typed     → send
 *   listening      → stop, end the utterance and run it
 *   Scout working  → stop, cancel and put the ask back in the box
 */
type Props = {
  room: ScoutRoom;
  value: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  onMic: () => void;
  onStop: () => void;
  listening: boolean;
  busy: boolean;
  onPlus: () => void;
  placeholder?: string;
};

const ChatComposer = forwardRef<TextInput, Props>(function ChatComposer(
  { room, value, onChangeText, onSubmit, onMic, onStop, listening, busy, onPlus, placeholder },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const stopping = listening || busy;
  const sending = !stopping && value.trim().length > 0;

  const press = () => {
    if (stopping) return onStop();
    if (sending) return onSubmit();
    onMic();
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: focused ? room.line : room.lineSoft,
        backgroundColor: room.field,
        // Sized off the button (32) plus 5pt of breathing room, so an empty
        // composer is a slim pill and only grows once the text wraps.
        borderRadius: 22,
        paddingLeft: 6,
        paddingRight: 5,
        paddingVertical: 5,
        minHeight: 42,
      }}>
      <Pressable
        onPress={onPlus}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="What travels with your outreach"
        style={{ padding: 6 }}>
        <Ionicons name="add" size={22} color={room.ink2} />
      </Pressable>

      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={listening ? 'Listening…' : placeholder || 'Ask Scout'}
        placeholderTextColor={room.ink3}
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Multiline so a long ask wraps instead of scrolling sideways. That
        // costs the return-key submit, which is fine on a phone (the send
        // button is right there) but wrong in the browser preview, where
        // everyone types Enter. Handle it explicitly on web.
        onKeyPress={(e) => {
          const ev = e.nativeEvent as unknown as { key?: string; shiftKey?: boolean };
          if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
            (e as unknown as { preventDefault?: () => void }).preventDefault?.();
            onSubmit();
          }
        }}
        editable={!listening}
        multiline
        // react-native-web renders multiline as a <textarea>, which defaults to
        // two rows and left the empty composer a good 20pt taller than it
        // needed to be. One row here, and it still grows on wrap.
        numberOfLines={1}
        style={[
          {
            flex: 1,
            color: room.ink,
            fontFamily: fonts.sans,
            fontSize: 15,
            lineHeight: 20,
            minHeight: 32,
            maxHeight: 112,
            paddingVertical: 6,
            paddingHorizontal: 2,
          },
          NO_WEB_FOCUS_RING,
        ]}
      />

      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={stopping ? 'Stop' : sending ? 'Send' : 'Talk to Scout'}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: room.action,
        }}>
        <Ionicons
          name={stopping ? 'stop' : sending ? 'arrow-up' : 'mic'}
          size={stopping ? 14 : 17}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
});

export default ChatComposer;
