import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import type { ScoutRoom } from '@/theme/scoutRoom';
import { fonts } from '@/theme/tokens';

/**
 * "What does Scout do?" — the explainer behind the link on the empty state and
 * in the chats drawer (Rylan 2026-08-17). The first-run intro shows once and
 * is gone; this is the version someone can go back to on day nine when they
 * wonder whether Scout can do the thing they are about to do by hand.
 *
 * Every credit number here is the real one (5 per drafted contact, 5 per
 * auto-apply, previews free). If those change, change them here too, or this
 * card becomes a lie the app tells on its own front page.
 */
type Capability = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  example: string;
  cost: string;
  /** Each capability wears its own hue (Rylan 2026-08-18: the sheet needed
   *  color); the row scans by icon color before anyone reads a word. */
  color: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: 'people-outline',
    color: '#3B82F6',
    title: 'Find people',
    body: 'Who works at a company, and what they actually do there.',
    example: 'show me analysts at Evercore',
    cost: 'free to look',
  },
  {
    icon: 'mail-outline',
    color: '#7C3AED',
    title: 'Draft outreach',
    body: 'Writes the email in your voice, with your resume attached.',
    example: 'draft 3 analysts at Goldman Sachs',
    cost: '5 credits a person, lands in your drafts',
  },
  {
    icon: 'briefcase-outline',
    color: '#16A34A',
    title: 'Apply to jobs',
    body: 'Fills out the application and submits it for real.',
    example: 'apply to my saved jobs',
    cost: '5 credits each',
  },
  {
    icon: 'cafe-outline',
    color: '#CA8A04',
    title: 'Meeting prep',
    body: 'A brief and talking points before a coffee chat.',
    example: 'prep me for my next coffee chat',
    cost: 'free',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    color: '#0EA5E9',
    title: 'Ask anything',
    body: 'Firms, timelines, and what to actually say.',
    example: 'what should I say in a coffee chat',
    cost: 'free',
  },
];

export default function WhatScoutDoes({
  room,
  onClose,
  onExample,
}: {
  room: ScoutRoom;
  onClose: () => void;
  /** Tapping an example closes this and runs the ask for real. */
  onExample: (ask: string) => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: room.scrim,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}>
      {/* Tap-anywhere-out to dismiss, behind the card. */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Animated.View
        entering={FadeInDown.duration(220)}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '82%',
          backgroundColor: room.panel,
          borderColor: room.line,
          borderWidth: 1,
          borderRadius: 20,
          overflow: 'hidden',
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 20,
            paddingRight: 12,
            paddingTop: 18,
            paddingBottom: 6,
          }}>
          <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: room.ink }}>
            What Scout does
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ padding: 6 }}>
            <Ionicons name="close" size={22} color={room.ink2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 16 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20, color: room.ink2 }}>
            Say it or type it. Nothing that spends credits happens without your OK.
          </Text>

          {CAPABILITIES.map((c) => (
            <View key={c.title} style={{ flexDirection: 'row', gap: 12 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: c.color + '1C',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={c.icon} size={17} color={c.color} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: room.ink }}>
                  {c.title}
                </Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: room.ink2 }}>
                  {c.body}
                </Text>
                <Pressable
                  onPress={() => onExample(c.example)}
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: room.tintLine,
                    backgroundColor: room.tint,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                  }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: room.ink }}>
                    {c.example}
                  </Text>
                </Pressable>
                <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: room.ink3 }}>
                  {c.cost}
                </Text>
              </View>
            </View>
          ))}

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: room.lineSoft,
              paddingTop: 14,
            }}>
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 19, color: room.ink2 }}>
              Scout drafts, you send. No email leaves without you reading it.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
