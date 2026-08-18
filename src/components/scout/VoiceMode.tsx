import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, type SharedValue } from 'react-native-reanimated';

import ScoutOrb, { type OrbState } from '@/components/scout/ScoutOrb';
import type { ScoutRoom } from '@/theme/scoutRoom';
import { fonts } from '@/theme/tokens';

/**
 * Talking to Scout, full screen (Rylan 2026-08-17, Gemini as the reference).
 *
 * Deliberately almost empty: the circle, what was heard, and one control. The
 * chat is still there underneath and every turn lands in it, so closing this
 * is not losing anything, it is just switching how you are talking.
 *
 * It never re-opens the mic on its own. Scout finishing a sentence is not
 * permission to start recording again, so asking twice takes two taps.
 */
export default function VoiceMode({
  room,
  orbState,
  volume,
  listening,
  thinking,
  transcript,
  say,
  thinkWord,
  onTalk,
  onStop,
  onClose,
}: {
  room: ScoutRoom;
  orbState: OrbState;
  volume: SharedValue<number>;
  listening: boolean;
  thinking: boolean;
  /** What the mic has heard so far this utterance. */
  transcript: string;
  /** Scout's latest answer, once there is one. */
  say: string | null;
  thinkWord: string;
  onTalk: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  const caption = listening
    ? transcript || 'Listening…'
    : thinking
      ? `${thinkWord}…`
      : say || 'Tap to talk';

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: room.bg,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 20,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18 }}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close voice"
          style={{ padding: 6 }}>
          <Ionicons name="close" size={26} color={room.ink2} />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34 }}>
        <ScoutOrb state={orbState} volume={volume} size={262} onPress={listening ? onStop : onTalk} />

        {/* One caption slot: what you are saying, what Scout is doing, or what
            it said. Scrolls, because a long answer read aloud is still a long
            answer on screen. */}
        <ScrollView
          style={{ maxHeight: 210, alignSelf: 'stretch' }}
          contentContainerStyle={{ paddingHorizontal: 28 }}
          showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontFamily: listening ? fonts.sans : fonts.sansMedium,
              fontSize: listening ? 20 : 16,
              lineHeight: listening ? 29 : 24,
              color: listening || say ? room.ink : room.ink3,
              textAlign: 'center',
            }}>
            {caption}
          </Text>
        </ScrollView>
      </View>

      <View style={{ alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={listening ? onStop : onTalk}
          disabled={thinking}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop' : 'Talk to Scout'}
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: thinking ? room.card : room.action,
            borderWidth: 1,
            borderColor: thinking ? room.line : 'transparent',
            opacity: thinking ? 0.6 : 1,
          }}>
          <Ionicons
            name={listening ? 'stop' : 'mic'}
            size={listening ? 24 : 27}
            color={thinking ? room.ink3 : '#FFFFFF'}
          />
        </Pressable>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: room.ink3 }}>
          {listening ? 'Tap when you are done' : thinking ? 'Working on it' : 'Tap to talk'}
        </Text>
      </View>
    </Animated.View>
  );
}
