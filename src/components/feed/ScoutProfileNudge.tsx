import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveRankerSignals, saveTargetTrack, savePreferredLocations } from '@/api/endpoints/preferences';
import Input from '@/components/ui/Input';
import { markNudgeAnswered, markNudgeDismissed, type NudgeKey } from '@/lib/profileNudge';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, shadows } from '@/theme/tokens';

/**
 * Scout, asking for one thing.
 *
 * The gap survey (ProfileGapSurvey) handles the hard stop: no school, no dream
 * companies, empty deck, feature unusable. This handles the long tail — a
 * profile that WORKS but is thin, where each missing field quietly costs the
 * student people they will never see.
 *
 * Deliberately small: a card, one question, chips where possible, and a
 * dismiss that means it. Pacing lives in lib/profileNudge (one ask per three
 * days, retired after two dismissals). This component only renders and saves.
 *
 * Scout's face is the Yeti, never a sparkle — sparkles read as AI slop, which
 * is the whole reason the mark exists.
 */

const YETI = require('../../../assets/images/scout-yeti-head.png');

const CHIPS: Partial<Record<NudgeKey, string[]>> = {
  dreamCompanies: [
    'Goldman Sachs',
    'JPMorgan',
    'McKinsey',
    'Bain',
    'Google',
    'Amazon',
    'Blackstone',
    'Stripe',
  ],
  targetRoles: [
    'Investment Banking',
    'Consulting',
    'Software Engineer',
    'Product Manager',
    'Data Analyst',
    'Private Equity',
  ],
  locations: ['New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston', 'Remote'],
};

const PROMPTS: Record<NudgeKey, { ask: string; payoff: string }> = {
  school: {
    ask: 'Where do you go to school?',
    payoff: 'Alumni reply far more often. It’s the strongest signal I have.',
  },
  dreamCompanies: {
    ask: 'Any other firms on your list?',
    payoff: 'Each one I add pulls a fresh set of people into your deck.',
  },
  targetRoles: {
    ask: 'What roles are you going for?',
    payoff: 'Lets me write to the people who actually do that job.',
  },
  locations: {
    ask: 'Where do you want to work?',
    payoff: 'Moves people near you to the top of the deck.',
  },
};

export default function ScoutProfileNudge({
  nudge,
  onClose,
}: {
  nudge: NudgeKey;
  /** Called after answer or dismiss. The caller removes the card. */
  onClose: () => void;
}) {
  const colors = useColors();
  const { showToast } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const chips = useMemo(() => CHIPS[nudge] ?? [], [nudge]);
  const isText = nudge === 'school';
  const canSave = isText ? !!text.trim() : picked.length > 0;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      if (nudge === 'school') await saveRankerSignals({ school: text.trim() });
      else if (nudge === 'dreamCompanies') await saveRankerSignals({ dreamCompanies: picked });
      else if (nudge === 'targetRoles') await saveTargetTrack({ targetRoles: picked });
      else await savePreferredLocations(picked);

      await markNudgeAnswered(nudge);
      showToast('Got it. Your next deck will be better.');
      onClose();
    } catch {
      showToast('Could not save that. Try again later.');
    } finally {
      setSaving(false);
    }
  }, [nudge, text, picked, showToast, onClose]);

  const dismiss = useCallback(() => {
    void markNudgeDismissed(nudge);
    onClose();
  }, [nudge, onClose]);

  const { ask, payoff } = PROMPTS[nudge];

  return (
    <View
      style={[
        {
          backgroundColor: colors.paper,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: 16,
          gap: 12,
        },
        shadows.lg,
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
        <Image source={YETI} style={{ width: 34, height: 34 }} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
            {ask}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 12.5,
              color: colors.inkSecondary,
              lineHeight: 18,
              marginTop: 2,
            }}>
            {payoff}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={colors.inkTertiary} />
        </Pressable>
      </View>

      {isText ? (
        <Input
          value={text}
          onChangeText={setText}
          placeholder="e.g. USC"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => canSave && void save()}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {chips.map((c) => {
            const on = picked.includes(c);
            return (
              <Pressable
                key={c}
                onPress={() =>
                  setPicked((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                }
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 8,
                  borderRadius: 9,
                  backgroundColor: on ? colors.navy : colors.surface,
                  borderWidth: on ? 0 : 1,
                  borderColor: colors.hairline,
                }}>
                <Text
                  style={{
                    fontFamily: on ? fonts.sansSemibold : fonts.sansMedium,
                    fontSize: 12.5,
                    color: on ? colors.paper : colors.ink,
                  }}>
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={() => canSave && void save()}
          disabled={!canSave || saving}
          accessibilityRole="button"
          style={{
            flex: 1,
            height: 42,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSave ? colors.ink : colors.surface,
            opacity: saving ? 0.6 : 1,
          }}>
          <Text
            style={{
              fontFamily: fonts.sansSemibold,
              fontSize: 14,
              color: canSave ? colors.paper : colors.inkTertiary,
            }}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
        <Pressable onPress={dismiss} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.inkTertiary }}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
