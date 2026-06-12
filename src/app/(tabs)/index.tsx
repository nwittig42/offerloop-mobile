import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { colors, fonts } from '@/theme/tokens';

/**
 * Feed: the swipe-to-draft card stack lands here in Phase 1.
 * Phase 0 ships the shell plus a link to the design gallery so brand
 * fidelity can be checked on a real device before feature work.
 */
export default function FeedScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Offerloop" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 26,
            color: colors.heading,
            textAlign: 'center',
          }}>
          The swipe feed arrives in Phase 1
        </Text>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            color: colors.inkSecondary,
            textAlign: 'center',
            lineHeight: 21,
          }}>
          Phase 0 is the design system. Open the gallery below to check the
          brand on this device.
        </Text>
        <Button label="Open design gallery" onPress={() => router.push('/design')} />
      </View>
    </View>
  );
}
