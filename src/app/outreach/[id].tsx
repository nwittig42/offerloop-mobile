import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isGmailDisconnected } from '@/api/errors';
import { fetchThreadMessages, sendDraft, sendReply } from '@/api/endpoints/outreach';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input from '@/components/ui/Input';
import { requestReviewIfDue } from '@/lib/appRating';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** "View in Gmail": green button, the Gmail mark in its brand red on a white
 *  chip (so the red logo reads on green). Opens the Gmail app. */
function GmailButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        height: 44,
        borderRadius: 8,
        backgroundColor: colors.positive,
      }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <MaterialCommunityIcons name="gmail" size={16} color="#EA4335" />
      </View>
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.sansMedium, fontSize: 15 }}>View in Gmail</Text>
    </Pressable>
  );
}

/**
 * Outreach detail. Three states:
 * - drafting: the async placeholder, contact still being found
 * - ready/sent: contact card plus the draft. The cold-open send opens the real
 *   Gmail draft to review + send (no in-app send-draft endpoint yet).
 * - replied: the thread view, with a real in-app follow-up via send-reply.
 */
export default function OutreachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { outreach, meetingPreps, profile, updateOutreach, resolveOutreachId, showToast } = useApp();
  const queryClient = useQueryClient();

  const item = outreach.find((o) => o.id === id);
  // A just-swiped draft is shown on an optimistic id; once the inbox poll swaps
  // it for the real server id, follow it here instead of dying with "no longer
  // exists." willRedirect = the id reconciled to a different (real) one.
  const mappedId = id ? resolveOutreachId(id) : id;
  const willRedirect = !item && !!mappedId && mappedId !== id;
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [body, setBody] = useState(item?.body ?? item?.snippet ?? '');
  const [followupOpen, setFollowupOpen] = useState(false);
  const firstName = item?.contact?.name.split(' ')[0] ?? 'there';
  const [followup, setFollowup] = useState(
    `Hi ${firstName},\n\nThanks so much for getting back to me, I really appreciate it. Would you have 15 minutes sometime in the next week or two for a quick chat? Happy to work around whatever is easiest for you.\n\nBest,\n${profile.name || ''}`,
  );

  // The inbox list payload carries only a short snippet, so the real draft/sent
  // body lives in the thread-messages endpoint. Fetch it for any synced item
  // (a fresh swipe still has its body locally on the optimistic item).
  const isRealId = !!id && !id.startsWith('out-new-');
  const messagesQuery = useQuery({
    queryKey: ['threadMessages', id],
    queryFn: () => fetchThreadMessages(id as string),
    enabled: isRealId && !!item && item.status !== 'drafting' && item.status !== 'queued',
  });
  const sentMessage = (messagesQuery.data ?? []).find((m) => m.isFromUser);

  // Backfill the body/subject from the fetched thread when the list payload had none.
  useEffect(() => {
    if (!sentMessage) return;
    setBody((prev) => prev || sentMessage.body || '');
    setSubject((prev) => prev || sentMessage.subject || '');
  }, [sentMessage]);

  // Scroll-down affordance: shown only while there's more content below.
  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const showScrollDown = contentH > viewportH + 12 && !atBottom;

  // Follow the optimistic -> real id swap so the draft doesn't vanish.
  useEffect(() => {
    if (willRedirect && mappedId) router.replace(`/outreach/${mappedId}`);
  }, [willRedirect, mappedId, router]);

  // Opening a reply clears it from "needs attention" (the red badge).
  useEffect(() => {
    if (item && item.status === 'replied' && !item.attended) {
      updateOutreach(item.id, { attended: true });
    }
  }, [item, updateOutreach]);

  // The App Store rating ask (lib/appRating). A reply landing is the one moment
  // in this app that is unambiguously good news, so it is the primary trigger.
  // Delayed a beat so the stars arrive after they have read the thing, not on
  // top of it, and fired at most once per screen. appRating owns every other
  // rule (30 day gap, 3 per year, quiet after an error).
  //
  // Deliberately NOT gated on !attended. The server marks a thread attended
  // whenever hasUnreadReply is false, so anyone who reads their mail in Gmail
  // first would never qualify, which is most students. Opening a reply thread
  // at all is good news, and the 30 day gap is what stops it being a nag.
  const askedForReviewRef = useRef(false);
  useEffect(() => {
    if (askedForReviewRef.current) return;
    if (!item || item.status !== 'replied') return;
    askedForReviewRef.current = true;
    const t = setTimeout(() => {
      void requestReviewIfDue('reply', Date.now());
    }, 2500);
    return () => clearTimeout(t);
  }, [item]);

  // Open the Gmail app (not Safari). Requires googlegmail in the app's
  // LSApplicationQueriesSchemes; falls back to the web draft URL.
  const openGmail = async () => {
    // Open the Gmail app directly. canOpenURL needs the scheme whitelisted (a
    // native rebuild), but openURL does not, so try it straight and fall back to
    // the web draft only if the app isn't installed.
    try {
      await Linking.openURL('googlegmail://');
      showToast('Opening Gmail');
      return;
    } catch {
      // Gmail app not installed — fall back to the web draft.
    }
    if (item?.gmailDraftUrl) {
      Linking.openURL(item.gmailDraftUrl);
      showToast('Opening your draft in Gmail');
    } else {
      showToast('Install the Gmail app to open it here');
    }
  };

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary }}>
          {willRedirect ? 'Opening your draft…' : 'This outreach no longer exists.'}
        </Text>
      </View>
    );
  }

  // Send in-app: the backend sends the Gmail draft directly, so the user never
  // leaves. Falls back to opening the Gmail draft if the item hasn't synced to
  // the server yet (a swipe whose contact id is still the local placeholder).
  const send = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await sendDraft(item.id);
      updateOutreach(item.id, { status: 'sent', snippet: 'Sent from your Gmail', timeLabel: 'Just now' });
      showToast('Sent');
      queryClient.invalidateQueries({ queryKey: qk.inbox });
      router.back();
    } catch (e) {
      if (isGmailDisconnected(e)) {
        showToast('Connect Gmail to send');
      } else if (item.gmailDraftUrl) {
        Linking.openURL(item.gmailDraftUrl);
        showToast('Opening your draft in Gmail');
        router.back();
      } else {
        showToast('Could not send, give it a moment and try from the Inbox');
      }
    }
  };

  const sendFollowup = async () => {
    const text = followup;
    const nextThread = [
      ...(item.thread ?? []),
      { from: 'me' as const, text, timeLabel: 'Just now' },
    ];
    updateOutreach(item.id, { thread: nextThread, snippet: 'You sent a follow-up' });
    setFollowupOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await sendReply(item.id, text);
      showToast('Follow-up sent');
      queryClient.invalidateQueries({ queryKey: qk.inbox });
    } catch (e) {
      showToast(
        isGmailDisconnected(e) ? 'Connect Gmail to send replies' : 'Could not send, try again',
      );
    }
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
        ref={scrollRef}
        scrollEventThrottle={16}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => {
          setContentH(h);
          setAtBottom(h <= viewportH + 12);
        }}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          setAtBottom(layoutMeasurement.height + contentOffset.y >= contentSize.height - 24);
        }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>
        {item.status === 'drafting' || item.status === 'queued' ? (
          <Card style={{ gap: 10, alignItems: 'flex-start' }}>
            <Chip label={item.status === 'queued' ? 'In line' : 'Drafting'} tone="waiting" dot />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 16, color: colors.ink }}>
              {item.status === 'queued'
                ? `Waiting to draft for ${item.company}`
                : `Finding a contact at ${item.company}`}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
              {item.status === 'queued'
                ? 'An earlier swipe is still drafting — this one starts automatically right after it.'
                : `We’re finding the right person for the ${item.jobTitle} role and writing your outreach. This fills in automatically, usually within a few seconds.`}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  {item.contact.linkedinUrl ? (
                    <Pressable
                      onPress={() => Linking.openURL(item.contact!.linkedinUrl!)}
                      accessibilityLabel="Open LinkedIn"
                      hitSlop={8}>
                      <Ionicons name="logo-linkedin" size={26} color={colors.accent} />
                    </Pressable>
                  ) : null}
                  {(() => {
                    const prep = meetingPreps.find((p) => p.name === item.contact?.name);
                    return (
                      <Pressable
                        onPress={() =>
                          prep
                            ? router.push(`/meeting-prep/${prep.id}`)
                            : router.push({
                                pathname: '/meeting-prep/new',
                                params: item.contact?.linkedinUrl
                                  ? { scanned: item.contact.linkedinUrl }
                                  : {},
                              })
                        }
                        accessibilityLabel={prep ? 'View meeting prep' : 'Prep a meeting'}
                        hitSlop={8}>
                        <Ionicons
                          name="cafe"
                          size={26}
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
            ) : item.status === 'sent' ? (
              // Sent rundown: a plain-text view of what actually went out, shown
              // as a sent bubble so it reads like the conversation it started.
              <View style={{ gap: 10 }}>
                {subject ? (
                  <Text
                    style={{
                      fontFamily: fonts.sansMedium,
                      fontSize: 11.5,
                      color: colors.inkTertiary,
                      textAlign: 'center',
                    }}>
                    Email · {subject}
                  </Text>
                ) : null}
                <View
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '94%',
                    backgroundColor: colors.marketing,
                    borderRadius: 20,
                    borderBottomRightRadius: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                  }}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.paper }}>
                    {body || (messagesQuery.isLoading ? 'Loading what you sent…' : 'Sent from your connected Gmail.')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
                  <Ionicons name="checkmark-done" size={14} color={colors.positive} />
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                    Sent · waiting on a reply
                  </Text>
                </View>
                <GmailButton onPress={openGmail} />
              </View>
            ) : (
              <Card style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    Subject
                  </Text>
                  <Input value={subject} onChangeText={setSubject} editable={false} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.inkSecondary }}>
                    Email
                  </Text>
                  <Input
                    value={body || (messagesQuery.isLoading ? 'Loading your draft…' : '')}
                    onChangeText={setBody}
                    multiline
                    editable={false}
                    style={{ minHeight: 200 }}
                  />
                </View>
                <View style={{ gap: 8 }}>
                  {/* An empty draft must not be sendable. A blank body here
                      means the pipeline never finished writing (no verified
                      email, or the draft is still landing), and Send would
                      fire a blank email at a real person. */}
                  {body ? (
                    <Button label="Send" fullWidth size="lg" onPress={send} />
                  ) : !messagesQuery.isLoading ? (
                    <Text
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12.5,
                        lineHeight: 18,
                        color: colors.inkSecondary,
                        textAlign: 'center',
                        paddingVertical: 6,
                      }}>
                      This draft is not ready to send. We could not lock down a
                      verified email for this person yet, so there is nothing
                      written. Try Find another contact, or check back shortly.
                    </Text>
                  ) : null}
                  <GmailButton onPress={openGmail} />
                  {body ? (
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
                      Sends from your connected Gmail, no need to leave the app.
                    </Text>
                  ) : null}
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {showScrollDown ? (
        <Pressable
          onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
          accessibilityLabel="Scroll down"
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: insets.bottom + 18,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.marketing,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}>
          <Ionicons name="chevron-down" size={22} color={colors.paper} />
        </Pressable>
      ) : null}
    </View>
  );
}
