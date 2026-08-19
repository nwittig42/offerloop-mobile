import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchContacts, type Contact, type ContactState } from '@/api/endpoints/contacts';
import { fetchMeetingPreps } from '@/api/endpoints/meetingPreps';
import { fetchThreadMessages } from '@/api/endpoints/outreach';
import CompanyLogo from '@/components/CompanyLogo';
import Card from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * One person, everything about them in one place.
 *
 * This is where meeting prep moved to. A prep is a fact about a person, not a
 * category of its own, so it belongs on their page next to the emails, the
 * same way a note belongs on a contact card. That is what let the Network tab
 * drop from three competing sections to one list.
 *
 * Nothing renders unless the data is real: no thread, no thread section; no
 * prep, no prep section, just the button to make one.
 */

const STATE_COPY: Record<ContactState, { label: string; tone: 'positive' | 'waiting' | 'muted' }> = {
  replied: { label: 'Replied', tone: 'positive' },
  waiting: { label: 'Waiting on a reply', tone: 'waiting' },
  drafted: { label: 'Draft ready to send', tone: 'waiting' },
  new: { label: 'Not contacted yet', tone: 'muted' },
};

export default function ContactScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactId = String(id || '');

  // Reuses the list query, so opening a person off the list is instant and
  // costs no extra request.
  const contactsQuery = useQuery({ queryKey: ['contacts'], queryFn: () => fetchContacts() });
  const contact: Contact | undefined = (contactsQuery.data ?? []).find((c) => c.id === contactId);

  const threadQuery = useQuery({
    queryKey: ['thread', contactId],
    queryFn: () => fetchThreadMessages(contactId),
    enabled: !!contactId && !!contact && contact.state !== 'new',
  });

  const prepsQuery = useQuery({ queryKey: ['meeting-preps'], queryFn: fetchMeetingPreps });
  const preps = (prepsQuery.data ?? []).filter(
    (p) => contact && p.name && p.name.toLowerCase() === contact.name.toLowerCase(),
  );

  const messages = threadQuery.data ?? [];
  const state = contact ? STATE_COPY[contact.state] : null;
  const toneColor =
    state?.tone === 'positive'
      ? colors.positive
      : state?.tone === 'waiting'
        ? colors.waiting
        : colors.inkTertiary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.inkSecondary, flex: 1 }}>
          {contact?.company || 'Contact'}
        </Text>
      </View>

      {!contact ? (
        <View style={{ padding: 24 }}>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13.5,
              color: colors.inkSecondary,
              textAlign: 'center',
              lineHeight: 20,
            }}>
            {contactsQuery.isLoading ? 'Loading…' : "Couldn't find that person in your network."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <CompanyLogo name={contact.company} size={56} radius={14} />
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
              {contact.name}
            </Text>
            {contact.title || contact.company ? (
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  textAlign: 'center',
                }}>
                {[contact.title, contact.company].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {state ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: toneColor + '1A',
                }}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 11.5, color: toneColor }}>
                  {state.label}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push('/(tabs)/inbox')}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 8,
                // Vibrant blue, not ink (Rylan 2026-08-18 round 4: "a lot of
                // these black buttons... change to that vibrant blue").
                backgroundColor: colors.marketing,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                shadowColor: colors.marketing,
                shadowOpacity: 0.32,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}>
              <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: '#FFFFFF' }}>
                Write
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(
                  contact.linkedinUrl
                    ? `/meeting-prep/new?linkedin=${encodeURIComponent(contact.linkedinUrl)}`
                    : '/meeting-prep/new',
                )
              }
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 44,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}>
              <Ionicons name="cafe-outline" size={16} color={colors.ink} />
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.ink }}>
                Prep
              </Text>
            </Pressable>
          </View>

          {messages.length ? (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 11.5,
                  letterSpacing: 0.8,
                  color: colors.inkTertiary,
                }}>
                CONVERSATION
              </Text>
              {messages.map((m, i) => (
                <Card key={`${m.sentAt || i}`} style={{ gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: fonts.sansSemibold,
                      fontSize: 12,
                      color: m.isFromUser ? colors.inkSecondary : colors.positive,
                    }}>
                    {m.isFromUser ? 'You' : contact.name}
                    {m.sentAt ? ` · ${m.sentAt}` : ''}
                  </Text>
                  <Text
                    numberOfLines={6}
                    style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink, lineHeight: 19 }}>
                    {m.body}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}

          {preps.length ? (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontFamily: fonts.sansSemibold,
                  fontSize: 11.5,
                  letterSpacing: 0.8,
                  color: colors.inkTertiary,
                }}>
                MEETING PREP
              </Text>
              {preps.map((p) => (
                <Pressable key={p.id} onPress={() => router.push(`/meeting-prep/${p.id}`)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="cafe" size={18} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink }}>
                        {p.status === 'processing' ? 'Prep is building…' : 'Coffee chat brief'}
                      </Text>
                      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>
                        {p.createdLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: fonts.sansSemibold,
                fontSize: 11.5,
                letterSpacing: 0.8,
                color: colors.inkTertiary,
              }}>
              DETAILS
            </Text>
            <Card style={{ gap: 10 }}>
              {contact.email ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink }}>
                  {contact.email}
                </Text>
              ) : null}
              {contact.linkedinUrl ? (
                <Pressable onPress={() => Linking.openURL(contact.linkedinUrl)}>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.accent }}>
                    View LinkedIn profile
                  </Text>
                </Pressable>
              ) : null}
              {!contact.email && !contact.linkedinUrl ? (
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>
                  No contact details saved yet.
                </Text>
              ) : null}
            </Card>
          </View>

          {/* Same-company shortcut: the reason a student opens someone is
              often to find who else is in there with them. */}
          {contact.company ? (
            <Pressable
              onPress={() => router.push('/(tabs)/network')}
              accessibilityRole="button"
              style={{ alignSelf: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.accent }}>
                See everyone at {contact.company}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
