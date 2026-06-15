import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  const { outreach, meetingPreps, updateOutreach, markOutreachSent, showToast } = useApp();

  const item = outreach.find((o) => o.id === id);
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [followupOpen, setFollowupOpen] = useState(false);
  const firstName = item?.contact?.name.split(' ')[0] ?? 'there';
  const [followup, setFollowup] = useState(
    `Hi ${firstName},\n\nThanks so much for getting back to me. Thursday afternoon works great on my end. Anytime after 1pm, whatever is easiest for you.\n\nLooking forward to it,\nSample Student`,
  );

  // Opening a reply clears it from "needs attention" (the red badge).
  useEffect(() => {
    if (item && item.status === 'replied' && !item.attended) {
      updateOutreach(item.id, { attended: true });
    }
  }, [item, updateOutreach]);

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

  const sendFollowup = () => {
    const nextThread = [
      ...(item.thread ?? []),
      { from: 'me' as const, text: followup, timeLabel: 'Just now' },
    ];
    updateOutreach(item.id, { thread: nextThread, snippet: 'You sent a follow-up (mock)' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFollowupOpen(false);
    showToast('Follow-up sent (mock), real Gmail send arrives in Phase 3');
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
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
                    {item.contact.name}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                    {item.contact.title} at {item.contact.company}
                  </Text>
                  {item.contact.relation ? (
                    <Chip
                      label={item.contact.relation}
                      tone={item.contact.relation === 'Hiring manager' ? 'accent' : 'neutral'}
                    />
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {item.contact.linkedinUrl ? (
                    <Ionicons name="logo-linkedin" size={18} color={colors.accent} />
                  ) : null}
                  {(() => {
                    const prep = meetingPreps.find((p) => p.name === item.contact?.name);
                    return (
                      <Pressable
                        onPress={() =>
                          prep
                            ? router.push(`/meeting-prep/${prep.id}`)
                            : router.push('/meeting-prep/new')
                        }
                        accessibilityLabel={prep ? 'View meeting prep' : 'Prep a meeting'}
                        hitSlop={8}>
                        <Ionicons
                          name="cafe"
                          size={18}
                          color={colors.coffee}
                          style={{ opacity: prep ? 1 : 0.35 }}
                        />
                      </Pressable>
                    );
                  })()}
                </View>
              </Card>
            ) : null}

            {item.status === 'replied' && item.thread ? (
              <View style={{ gap: 10 }}>
                {item.subject ? (
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 11.5,
                      color: colors.inkTertiary,
                      textAlign: 'center',
                      paddingBottom: 2,
                    }}>
                    Email · {item.subject}
                  </Text>
                ) : null}
                {item.thread.map((msg, i) => (
                  <View
                    key={i}
                    style={{
                      alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      backgroundColor: msg.from === 'me' ? colors.marketing : colors.surface,
                      borderRadius: 20,
                      borderBottomRightRadius: msg.from === 'me' ? 6 : 20,
                      borderBottomLeftRadius: msg.from === 'me' ? 20 : 6,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      gap: 3,
                    }}>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 14,
                        lineHeight: 20,
                        color: msg.from === 'me' ? colors.paper : colors.ink,
                      }}>
                      {msg.text}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 10,
                        color: msg.from === 'me' ? 'rgba(255,255,255,0.7)' : colors.inkTertiary,
                        alignSelf: 'flex-end',
                      }}>
                      {msg.timeLabel}
                    </Text>
                  </View>
                ))}
                {followupOpen ? (
                  <Card style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="arrow-undo-outline" size={16} color={colors.accent} />
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                        Your follow-up
                      </Text>
                    </View>
                    <Input value={followup} onChangeText={setFollowup} multiline style={{ minHeight: 150 }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button label="Send follow-up" onPress={sendFollowup} />
                      <Button label="Cancel" variant="ghost" onPress={() => setFollowupOpen(false)} />
                    </View>
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                      Drafted for you. Edit it, then send without leaving the app.
                    </Text>
                  </Card>
                ) : (
                  <Button
                    label="Draft a follow-up"
                    icon="arrow-undo-outline"
                    fullWidth
                    onPress={() => setFollowupOpen(true)}
                  />
                )}
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
