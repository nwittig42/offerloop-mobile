import { Text, View } from 'react-native';

import type { ScoutRoom } from '@/theme/scoutRoom';
import { fonts } from '@/theme/tokens';

/**
 * One turn in the Scout conversation, shaped like the chat apps students
 * already live in (Rylan 2026-08-17, ChatGPT as the reference):
 *
 *  - What YOU said is a tinted bubble on the right. Short, so a bubble fits.
 *  - What SCOUT said is plain text on the left, no bubble, full width. Scout's
 *    answers run long (a read on a firm, three names with reasons), and a
 *    600-character speech balloon reads like a wall. Unboxed it reads like a
 *    document, which is what it is.
 *
 * Pending is the live voice transcript: the same bubble, dimmed, before the
 * utterance is finished and sent.
 */
export default function ChatMessage({
  from,
  text,
  room,
  pending,
}: {
  from: 'user' | 'scout';
  text: string;
  room: ScoutRoom;
  pending?: boolean;
}) {
  if (from === 'user') {
    return (
      <View
        style={{
          alignSelf: 'flex-end',
          maxWidth: '84%',
          backgroundColor: room.tint,
          borderRadius: 18,
          paddingVertical: 10,
          paddingHorizontal: 14,
          opacity: pending ? 0.6 : 1,
        }}>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14.5,
            lineHeight: 21,
            color: room.ink,
          }}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignSelf: 'stretch', paddingRight: 8 }}>
      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 14.5,
          lineHeight: 22,
          color: room.ink,
        }}>
        {text}
      </Text>
    </View>
  );
}
