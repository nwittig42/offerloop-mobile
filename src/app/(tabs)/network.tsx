import { Text, View } from 'react-native';

import Header from '@/components/Header';
import { colors, fonts } from '@/theme/tokens';

/** Network: the mobile-lite pipeline tracker. Built in Phase 1 on mock data. */
export default function NetworkScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Network" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
          Your outreach pipeline summary lands here in Phase 1.
        </Text>
      </View>
    </View>
  );
}
