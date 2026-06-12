import { Text, View } from 'react-native';

import Header from '@/components/Header';
import { colors, fonts } from '@/theme/tokens';

/** Inbox: drafts, sent outreach, and replies. Built in Phase 1 on mock data. */
export default function InboxScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Inbox" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
          Drafts, sent outreach, and replies land here in Phase 1.
        </Text>
      </View>
    </View>
  );
}
