import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * People you swiped left on, reachable from Network. The People deck's undo
 * only covers the last pass and only this session (Rylan 2026-09-03: an
 * accidental left swipe on someone you wanted was gone for good). Putting
 * someone back clears the server-side "don't show again" mark and the deck
 * refetches, so they come around again.
 */
export default function PassedPeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { passedPeople, restorePassedPerson, showToast } = useApp();
  const colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
          People you passed on
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: insets.bottom + 40 }}>
        {passedPeople.length === 0 ? (
          <Text
            style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 21, paddingTop: 8 }}>
            You have not passed on anyone yet. Swipe left on the People deck and they
            collect here, in case you change your mind.
          </Text>
        ) : (
          passedPeople
            .slice()
            .reverse()
            .map((person) => (
              <Card key={person.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={person.name} photoUrl={person.photoUrl} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.heading }}>
                      {person.name}
                    </Text>
                    <Text
                      style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}
                      numberOfLines={1}>
                      {[person.title, person.company].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Put back in the deck"
                  variant="outline"
                  size="sm"
                  icon="arrow-undo-outline"
                  onPress={() => {
                    restorePassedPerson(person.id);
                    showToast(`${person.name} is back in your deck`);
                  }}
                />
              </Card>
            ))
        )}
      </ScrollView>
    </View>
  );
}
