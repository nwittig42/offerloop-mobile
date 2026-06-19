import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { qk } from '@/api/queryKeys';
import { savePreferredLocations } from '@/api/endpoints/preferences';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Location preferences: the places a user would realistically take a job. The
 * feed reads these as a soft geo signal, so the swipe deck leans toward them
 * while still mixing in other spots for volume. Reached from Profile.
 */

// Common recruiting metros to tap-add. Custom locations via the input below.
const SUGGESTED = [
  'New York, NY',
  'San Francisco, CA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Boston, MA',
  'Seattle, WA',
  'Austin, TX',
  'Washington, DC',
  'Atlanta, GA',
  'Dallas, TX',
  'Miami, FL',
  'Denver, CO',
  'Remote',
];

export default function LocationPreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();
  const { profile, showToast } = useApp();

  const [selected, setSelected] = useState<string[]>(profile.preferredLocations ?? []);
  const [custom, setCustom] = useState('');

  const add = (loc: string) => {
    const v = loc.trim();
    if (!v) return;
    setSelected((prev) => (prev.some((p) => p.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
  };
  const remove = (loc: string) => setSelected((prev) => prev.filter((p) => p !== loc));

  const save = useMutation({
    mutationFn: () => savePreferredLocations(selected),
    onSuccess: (saved) => {
      // Patch the cached profile so the feed picks it up without a full refetch.
      qc.setQueryData(qk.me, (prev: any) => (prev ? { ...prev, preferredLocations: saved } : prev));
      qc.invalidateQueries({ queryKey: qk.feed });
      showToast('Location preferences saved');
      router.back();
    },
    onError: () => showToast('Could not save, try again'),
  });

  const unselectedSuggestions = SUGGESTED.filter(
    (s) => !selected.some((p) => p.toLowerCase() === s.toLowerCase()),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 26, color: colors.heading }}>
          Location preferences
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
          Where would you actually take a job? Your feed leans toward these places, but still mixes
          in others now and then so you don’t run out of jobs to swipe.
        </Text>

        {/* Selected */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
            Your locations {selected.length ? `(${selected.length})` : ''}
          </Text>
          {selected.length === 0 ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
              None yet — add a few below. With none set, you’ll see jobs from everywhere.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {selected.map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => remove(loc)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    backgroundColor: colors.accent + '15',
                    borderWidth: 1,
                    borderColor: colors.accent + '40',
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent }}>
                    {loc}
                  </Text>
                  <Ionicons name="close-circle" size={15} color={colors.accent} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Custom add */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.paper,
            }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Add a city or region"
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => {
                add(custom);
                setCustom('');
              }}
              style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.ink }}
            />
          </View>
          <Button
            label="Add"
            size="sm"
            onPress={() => {
              add(custom);
              setCustom('');
            }}
            disabled={!custom.trim()}
          />
        </View>

        {/* Suggestions */}
        {unselectedSuggestions.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.ink }}>
              Common metros
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {unselectedSuggestions.map((loc) => (
                <Pressable
                  key={loc}
                  onPress={() => add(loc)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    backgroundColor: colors.paper2,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}>
                  <Ionicons name="add" size={14} color={colors.inkSecondary} />
                  <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>
                    {loc}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Button
          label={save.isPending ? 'Saving…' : 'Save preferences'}
          onPress={() => save.mutate()}
          disabled={save.isPending}
        />
      </ScrollView>
    </View>
  );
}
