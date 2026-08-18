import { Ionicons } from '@expo/vector-icons';
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
 * How close a match this person is to you, 1.0 to 10.0.
 *
 * Color is the fast read and the number is the precise one, so the badge does
 * both: a glance says strong/decent/weak, a second look says 9.2. Four bands
 * rather than a gradient, because a continuous ramp makes 7.9 and 8.1 look
 * meaningfully different when they are not.
 *
 * Renders only when the server sent a score (see Candidate.matchScore). It is
 * the one number on this card that a user would act on, so it is never
 * computed, defaulted, or filled in locally.
 */
function MatchScore({ score }: { score: number }) {
  const colors = useColors();
  const tone =
    score >= 8.5
      ? colors.positive
      : score >= 7
        ? colors.accent
        : score >= 5.5
          ? colors.waiting
          : colors.inkTertiary;

  return (
    <View
      accessible
      accessibilityLabel={`Match score ${score.toFixed(1)} out of 10`}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        // Tightened: every point this badge takes comes straight out of the
        // person's name and title beside it.
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 11,
        backgroundColor: tone + '16',
        borderWidth: 1,
        borderColor: tone + '3D',
      }}>
      <Text
        maxFontSizeMultiplier={1.1}
        style={{
          fontFamily: fonts.display,
          fontSize: 20,
          lineHeight: 23,
          color: tone,
        }}>
        {score.toFixed(1)}
      </Text>
      <Text
        maxFontSizeMultiplier={1}
        style={{
          fontFamily: fonts.sansBold,
          fontSize: 8.5,
          letterSpacing: 0.5,
          color: tone,
          opacity: 0.85,
        }}>
        MATCH
      </Text>
    </View>
  );
}

function Body({ person, appliedHere }: { person: Candidate; appliedHere?: boolean }) {
  const colors = useColors();
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
        <View style={{ alignItems: 'center', gap: 6 }}>
          {person.matchScore !== undefined ? <MatchScore score={person.matchScore} /> : null}
          {/* Their LinkedIn, when the ranker sent one. Rendered as the mark
              alone: everybody knows the glyph, and a labelled button would
              out-shout the name it sits beside. Stops the card's tap-to-expand
              from firing so opening a profile never also opens the sheet. */}
          {person.linkedinUrl ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                void Linking.openURL(person.linkedinUrl!);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open ${person.name}'s LinkedIn`}
              hitSlop={10}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accent + '12',
                borderWidth: 1,
                borderColor: colors.accent + '2E',
              }}>
              <Ionicons name="logo-linkedin" size={16} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {person.company ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 18 }}>
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
        </View>
      ) : null}

      <View style={{ gap: 15, marginTop: 20 }}>
        {/* School and relation on ONE row, no headers (2026-08-16). Two
            labelled sections for two chips spent about 60pt of card height
            restating what the icons already say — a graduation cap is
            "School" and a person glyph is "who they are". */}
        {person.school || person.relation || appliedHere ? (
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
