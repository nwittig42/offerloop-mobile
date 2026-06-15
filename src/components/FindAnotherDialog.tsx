import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, shadows } from '@/theme/tokens';

/**
 * Centered confirm popup for "find another contact at this company", the
 * widen-your-reach move triggered by the plus button on Inbox and Network
 * rows. A real dialog (not a sheet) so the question is unmissable, and it
 * explains what the plus does, since the icon alone reads as vague.
 */
export function FindAnotherDialog({
  visible,
  company,
  creditCost,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  company: string | null;
  creditCost: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(17,19,24,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.paper,
              borderRadius: 16,
              padding: 22,
              gap: 14,
            },
            shadows.lg,
          ]}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.accent + '14',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="people-outline" size={22} color={colors.accent} />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.ink }}>
              Find another contact{company ? ` at ${company}` : ''}?
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
              One intro rarely lands an offer. Offerloop will find a different person on
              this team and draft a tailored email into your Inbox.
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Button
              label={`Find another contact (-${creditCost} credits)`}
              fullWidth
              onPress={() => {
                onConfirm();
                onClose();
              }}
            />
            <Button label="Not now" variant="ghost" fullWidth onPress={onClose} />
          </View>

          <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
            For full team lists and bulk outreach, use offerloop.ai
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default FindAnotherDialog;
