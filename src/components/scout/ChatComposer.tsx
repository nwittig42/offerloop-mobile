import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useState } from 'react';
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
  /** Example asks that TYPE THEMSELVES into the empty box, one character at a
   *  time, cycling (Rylan 2026-08-18: the examples should feel like someone
   *  typing, "because now it's a chat"). Overrides `placeholder` while the
   *  box is empty; real typing always wins because a placeholder only shows
   *  on an empty input. */
  typingHints?: string[];
};

const ChatComposer = forwardRef<TextInput, Props>(function ChatComposer(
  { room, value, onChangeText, onSubmit, onMic, onStop, listening, busy, onPlus, placeholder, typingHints },
  ref,
) {
  const [focused, setFocused] = useState(false);

  // The typewriter: type a hint, hold it readable, erase fast, next hint.
  const [hint, setHint] = useState('');
  useEffect(() => {
    if (!typingHints?.length) return;
    let hi = 0;
    let ci = 0;
    let phase: 'type' | 'erase' = 'type';
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = typingHints[hi % typingHints.length];
      if (phase === 'type') {
        ci += 1;
        setHint(full.slice(0, ci));
        if (ci >= full.length) {
          phase = 'erase';
          t = setTimeout(step, 2100);
        } else {
          t = setTimeout(step, 42);
        }
      } else {
        ci -= 3;
        if (ci <= 0) {
          ci = 0;
          setHint('');
          phase = 'type';
          hi += 1;
          t = setTimeout(step, 500);
        } else {
          setHint(full.slice(0, ci));
          t = setTimeout(step, 22);
        }
      }
    };
    t = setTimeout(step, 700);
    return () => clearTimeout(t);
  }, [typingHints]);

  const idlePlaceholder = typingHints?.length ? hint || 'Ask Scout' : placeholder || 'Ask Scout';
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
        placeholder={listening ? 'Listening…' : idlePlaceholder}
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
