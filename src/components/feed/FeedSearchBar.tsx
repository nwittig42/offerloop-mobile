import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { withRecentFilter } from '@/types';

import type { FeedMode } from './FeedSwitcher';

/**
 * The deck's search, in plain sight (Rylan 2026-09-08). Both decks already
 * took a sentence from the gear's settings screen ("IB analysts at Goldman in
 * New York") and rebuilt themselves from it; almost nobody found the gear.
 * This is the same sentence in a bar under the People / Apply switcher.
 *
 * Submit runs it (return key or the arrow); the X clears back to the deck we
 * rank for you. Nothing runs on keystrokes: a people search is one real
 * provider call against a daily cap, so it waits for an explicit go. Finding
 * people is free to the user; swiping right is what costs, same as always.
 */

const MIN_PROMPT = 3;
const MAX_PROMPT = 500;

export default function FeedSearchBar({ mode }: { mode: FeedMode }) {
  const colors = useColors();
  const { swipeSettings, updateSwipeSettings, showToast } = useApp();
  const active = (mode === 'jobs' ? swipeSettings.jobFilter : swipeSettings.peopleFilter)?.trim() || '';
  const [draft, setDraft] = useState(active);

  // Follow the deck: switching People <-> Apply, or the gear screen saving a
  // sentence, shows that deck's own sentence in the box.
  useEffect(() => {
    setDraft(active);
  }, [active, mode]);

  const submit = () => {
    const next = draft.trim().slice(0, MAX_PROMPT);
    if (next.length < MIN_PROMPT || next === active) return;
    if (mode === 'jobs') {
      updateSwipeSettings({
        jobFilter: next,
        jobFilterRecents: withRecentFilter(swipeSettings.jobFilterRecents ?? [], next),
      });
      showToast('Rebuilding your Apply deck around that.');
    } else {
      updateSwipeSettings({
        peopleFilter: next,
        peopleFilterRecents: withRecentFilter(swipeSettings.peopleFilterRecents ?? [], next),
      });
      showToast('Finding people who match that.');
    }
  };

  const clear = () => {
    setDraft('');
    if (!active) return;
    updateSwipeSettings(mode === 'jobs' ? { jobFilter: null } : { peopleFilter: null });
    showToast(mode === 'jobs' ? 'Back to the jobs we ranked for you.' : 'Back to the people we ranked for you.');
  };

  const canGo = draft.trim().length >= MIN_PROMPT && draft.trim() !== active;

  return (
    <View
      style={{
        marginTop: 10,
        marginHorizontal: 16,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? colors.marketing : colors.hairline,
        backgroundColor: colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 6,
        gap: 8,
      }}>
      <Ionicons name="search-outline" size={16} color={active ? colors.marketing : colors.inkTertiary} />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={
          mode === 'jobs'
            ? 'Search jobs, like "product internships in SF"'
            : 'Search people, like "IB analysts at Goldman in NYC"'
        }
        placeholderTextColor={colors.inkTertiary}
        accessibilityLabel={mode === 'jobs' ? 'Search the Apply deck' : 'Search the People deck'}
        style={{
          flex: 1,
          fontFamily: fonts.sans,
          fontSize: 13.5,
          color: colors.ink,
          paddingVertical: 0,
        }}
      />
      {draft.length ? (
        <Pressable
          onPress={clear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={18} color={colors.inkTertiary} />
        </Pressable>
      ) : null}
      {canGo ? (
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel="Run the search"
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.marketing,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}
