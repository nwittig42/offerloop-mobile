import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';

/**
 * Outreach detail. Three states:
 * - drafting: the async placeholder, contact still being found
 * - ready/sent: contact card plus the editable email (Send is mock until
 *   Phase 3 wires the real Gmail integration)
 * - replied: the thread view
 */
export default function OutreachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { outreach, updateOutreach, markOutreachSent, showToast } = useApp();

  const item = outreach.find((o) => o.id === id);
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [body, setBody] = useState(item?.body ?? '');

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary }}>
          This outreach no longer exists.
        </Text>
      </View>
    );
  }

  const send = () => {
    updateOutreach(item.id, { subject, body });
    markOutreachSent(item.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Sent (mock), real Gmail send arrives in Phase 3');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          {item.status === 'replied' ? 'Conversation' : 'Your draft'}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>
        {item.status === 'drafting' ? (
          <Card style={{ gap: 10, alignItems: 'flex-start' }}>
            <Chip label="Drafting" tone="waiting" dot />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              Finding a contact at {item.company}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
              The mock service is writing your outreach for the {item.jobTitle} role. This
              fills in automatically, usually within a few seconds.
            </Text>
          </Card>
        ) : (
          <>
            {item.contact ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.paper2,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.navy }}>
                    {item.contact.name
                      .split(' ')
                      .map((p) => p.charAt(0))
                      .slice(0, 2)
                      .join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                    {item.contact.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                    {item.contact.title} at {item.contact.company}
                  </Text>
                </View>
                {item.contact.linkedinUrl ? (
                  <Ionicons name="logo-linkedin" size={18} color={colors.accent} />
                ) : null}
              </Card>
            ) : null}

            {item.status === 'replied' && item.thread ? (
              <View style={{ gap: 10 }}>
                {item.thread.map((msg, i) => (
                  <View
                    key={i}
                    style={{
                      alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      backgroundColor: msg.from === 'me' ? colors.ink : colors.paper,
                      borderWidth: msg.from === 'me' ? 0 : 1,
                      borderColor: colors.hairline,
                      borderRadius: 10,
                      padding: 12,
                      gap: 4,
                    }}>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 13.5,
                        lineHeight: 20,
                        color: msg.from === 'me' ? colors.paper : colors.ink,
                      }}>
                      {msg.text}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 10.5,
                        color: msg.from === 'me' ? colors.inkTertiary : colors.inkTertiary,
                        alignSelf: 'flex-end',
                      }}>
                      {msg.timeLabel}
                    </Text>
                  </View>
                ))}
                <Button
                  label="Reply in Gmail"
                  variant="outline"
                  fullWidth
                  onPress={() =>
                    Alert.alert('Phase 3', 'Replying hands off to Gmail once real wiring lands.')
                  }
                />
              </View>
            ) : (
              <Card style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    Subject
                  </Text>
                  <Input value={subject} onChangeText={setSubject} editable={item.status === 'ready'} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    Email
                  </Text>
                  <Input
                    value={body}
                    onChangeText={setBody}
                    multiline
                    editable={item.status === 'ready'}
                    style={{ minHeight: 200 }}
                  />
                </View>
                {item.status === 'ready' ? (
                  <View style={{ gap: 8 }}>
                    <Button label="Send" fullWidth size="lg" onPress={send} />
                    <Button
                      label="Open in Gmail"
                      variant="ghost"
                      fullWidth
                      onPress={() =>
                        Alert.alert('Phase 3', 'The Gmail handoff arrives with real wiring.')
                      }
                    />
                  </View>
                ) : (
                  <Chip label="Sent" />
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
