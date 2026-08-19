import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import CompanyLogo from '@/components/CompanyLogo';
import Chip from '@/components/ui/Chip';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Candidate } from '@/types';

/**
 * A person in the People deck. Deliberately quieter than JobCard: the focal
 * point is the human, so the name is the headline and the company sits beside
 * a logo underneath, the mirror of the job card where the ROLE is the headline.
 *
 * Nothing here is invented. Every chip renders only when the ranker actually
 * sent that field, and there is no hometown row: the field is extracted
 * upstream but not wired onto the person yet.
 */

/** Initials tile, used when the ranker has no photo for this person. Never a
 *  stock avatar: a fake face on a real person is worse than no face. */
function PersonAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const colors = useColors();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface }}
      />
    );
  }
  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.accent + '1A',
        borderWidth: 1,
        borderColor: colors.accent + '33',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 25, color: colors.accent }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

/**
 * The fit read, as a word, never a number (Rylan 2026-08-18, matching the
 * website audit that retired the visible match score there too). "5.2 MATCH"
 * on a card sells against the person: a mid number reads as "we are not sure
 * about this one", especially for a user with a thin profile whose scores are
 * structurally low. Words carry the same glance-value without the grade-anxiety.
 *
 * Below the top two bands nothing renders at all: a lukewarm label is still a
 * lukewarm label. Renders only when the server sent a score, same as before.
 */
function MatchGrade({ score }: { score: number }) {
  const colors = useColors();
  if (score < 7) return null;
  const top = score >= 8.5;
  const tone = top ? colors.positive : colors.marketing;
  return (
    <View
      accessible
      accessibilityLabel={top ? 'Top match for you' : 'Strong fit for you'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 11,
        backgroundColor: tone + '16',
        borderWidth: 1,
        borderColor: tone + '3D',
      }}>
      {/* Words only, no glyph (Rylan 2026-08-18: no generic symbols as
          icons). The color band IS the fast read; a sparkle would just say
          "an AI wrote this". */}
      <Text
        maxFontSizeMultiplier={1.1}
        style={{
          fontFamily: fonts.sansBold,
          fontSize: 11.5,
          color: tone,
        }}>
        {top ? 'Top match' : 'Strong fit'}
      </Text>
    </View>
  );
}

function Body({ person, appliedHere }: { person: Candidate; appliedHere?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PersonAvatar name={person.name} photoUrl={person.photoUrl} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            // Shrinks rather than wrapping "Nathan Cash" onto two lines. The
            // name is the focal point of this card, so it should hold one
            // line as long as it can.
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={{
              fontFamily: fonts.sansBold,
              fontSize: 23,
              color: colors.heading,
              lineHeight: 28,
              letterSpacing: -0.3,
            }}>
            {person.name}
          </Text>
          {person.title ? (
            <Text
              // Three, not two. Real PDL titles are long ("Vice President,
              // Asset & Wealth Management") and the badge column narrows this
              // one, so two lines clipped the part that says what they do —
              // which is the half a student needs.
              numberOfLines={3}
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 14.5,
                color: colors.inkSecondary,
                marginTop: 3,
                lineHeight: 19,
              }}>
              {person.title}
              {/* What the title is OF. "Vice President" on its own is not a
                  job a student can react to — vice president of what? The
                  department rides on the same line, dimmer, so the title
                  still reads first. */}
              {person.department ? (
                <Text style={{ color: colors.inkTertiary }}>
                  {'  ·  '}
                  {person.department}
                </Text>
              ) : null}
            </Text>
          ) : null}
        </View>
        {/* Beside the name, not floating in a corner: it is a property of this
            person, so it reads as part of the introduction. */}
        <View style={{ alignItems: 'center', gap: 7 }}>
          {person.matchScore !== undefined ? <MatchGrade score={person.matchScore} /> : null}
          {/* Their LinkedIn, when the ranker sent one. LinkedIn's own blue at
              full size: the one place on the card a borrowed brand color is
              correct, because it is a doorway to LinkedIn, and the fill makes
              it the card's most tappable-looking object after the name. Stops
              the card's tap from firing so opening a profile never also
              triggers anything underneath. */}
          {person.linkedinUrl ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                void Linking.openURL(person.linkedinUrl!);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open ${person.name}'s LinkedIn`}
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0A66C2',
                shadowColor: '#0A66C2',
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              }}>
              <Ionicons name="logo-linkedin" size={24} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {person.company ? (
        /* The company row is a doorway (Rylan 2026-08-18): the company page
           already exists, so the logo+name go there. stopPropagation keeps the
           deck's own gestures out of it, same as the LinkedIn button. */
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/company/${encodeURIComponent(person.company!)}`);
          }}
          accessibilityRole="link"
          accessibilityLabel={`Open the ${person.company} page`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 18 }}>
          <CompanyLogo name={person.company} size={44} radius={12} />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink }}>
              {person.company}
            </Text>
            {person.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={13} color={colors.inkTertiary} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: fonts.sansMedium,
                    fontSize: 13.5,
                    color: colors.inkSecondary,
                  }}>
                  {person.location}
                </Text>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkTertiary} />
        </Pressable>
      ) : null}

      <View style={{ gap: 15, marginTop: 20 }}>
        {/* School and relation on ONE row, no headers (2026-08-16). Two
            labelled sections for two chips spent about 60pt of card height
            restating what the icons already say — a graduation cap is
            "School" and a person glyph is "who they are". */}
        {person.school || person.relation || person.joinedYear || appliedHere ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {/* The reason this person is in front of you, when it is the
                strongest one there is: you already applied to this company, so
                the email has a real hook and a reason to be read. First in the
                row on purpose. */}
            {appliedHere ? (
              <Chip
                label="You applied here"
                tone="positive"
                icon="checkmark-circle-outline"
                size="lg"
              />
            ) : null}
            {person.school ? (
              <Chip label={person.school} tone="accent" icon="school-outline" size="lg" numberOfLines={1} />
            ) : null}
            {person.relation ? (
              <Chip
                label={person.relation}
                tone={person.relation === 'Hiring manager' ? 'positive' : 'brand'}
                icon={person.relation === 'Recruiter' ? 'people-outline' : 'person-outline'}
                size="lg"
              />
            ) : null}
            {/* Tenure, from the ranker's joined_year. A recent joiner is the
                deck's best outreach hook (they remember interviewing); long
                tenure is its own signal (they know the place). Real data only,
                and nothing renders when the year is missing. */}
            {person.joinedYear ? (
              <Chip
                label={
                  new Date().getFullYear() - person.joinedYear <= 1
                    ? 'Recently joined'
                    : `There since ${person.joinedYear}`
                }
                tone={
                  new Date().getFullYear() - person.joinedYear <= 1 ? 'positive' : 'accent'
                }
                size="lg"
              />
            ) : null}
          </View>
        ) : null}

        {/* Reasons as ROWS, not chips. The ranker writes sentences ("Goldman
            Sachs is one of your target companies -- they're a vice president
            there"), and a sentence in a pill either clips or turns into a
            paragraph with a border round it. A row wraps naturally, and a
            checkmark column makes three of them scan as a list.

            Capped at three: past that it stops being a reason and becomes a
            wall, and the deck's whole promise is a glance. */}
        {person.reasons?.length ? (
          <View style={{ gap: 9 }}>
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 12,
                letterSpacing: 0.3,
                color: colors.inkTertiary,
              }}>
              Why we surfaced them
            </Text>
            {person.reasons.slice(0, 3).map((reason) => (
              <View key={reason} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.positive}
                  style={{ marginTop: 1 }}
                />
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    fontFamily: fonts.sansMedium,
                    fontSize: 13.5,
                    color: colors.ink,
                    lineHeight: 19,
                  }}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
}

/**
 * One person, whole. There is no expanded state (Nick 2026-08-17: "does that
 * actually do anything, if not get rid of it completely").
 *
 * It did not. The card carried a "Tap for details" footer, and tapping it
 * re-rendered the SAME body inside a ScrollView, with one addition: a chip
 * reading "LinkedIn on file" — a fact the collapsed card already states with
 * the LinkedIn badge beside the match score, and a chip you could not even tap
 * through to the profile. So the affordance promised more and delivered a
 * restatement, which is worse than not offering it.
 *
 * Everything a person card knows fits on one face: who they are, where, the
 * match, and why we surfaced them. If a genuine detail view ever exists (their
 * recent posts, the company's news, the draft we would send), it earns a tap
 * back at that point.
 */
export default function PersonCard({
  person,
  appliedHere = false,
}: {
  person: Candidate;
  /** You have an application in at this company. Passed down rather than
   *  looked up here so the card stays a pure render of what it is given. */
  appliedHere?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Body person={person} appliedHere={appliedHere} />
    </View>
  );
}
