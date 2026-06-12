import { Text, View } from 'react-native';

import Header from '@/components/Header';
import { colors, fonts } from '@/theme/tokens';

/**
 * Profile: credits, Loops, resume on file, personalization, settings.
 * Built in Phase 1 on mock data. No purchase links anywhere (App Store 3.1.1).
 */
export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Profile" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
          Credits, Loops, and settings land here in Phase 1.
        </Text>
      </View>
    </View>
  );
}
