import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts, shadows } from '@/theme/tokens';

/**
 * A centered confirm dialog, in-app rather than the OS one.
 *
 * Built 2026-08-16 because Alert.alert is a NO-OP on react-native-web: the
 * whole review loop runs through the browser preview, and every ask-first
 * control in the app looked broken there. A tap opened nothing, so the control
 * read as dead, and the setting behind it was untestable without a device.
 *
 * It also stops these questions looking like the operating system asking them.
 * "We'll spend your credits" is the app's question, in the app's type, with the
 * app's buttons.
 *
 * Same shape as FindAnotherDialog, generalized: icon chip, title, body, one
 * confirm and one dismiss.
 */
export function ConfirmDialog({
  visible,
  icon,
  tone,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Not now',
  onConfirm,
  onClose,
}: {
  visible: boolean;
  /** Optional. Omit both this and `title` when the explanation IS the dialog
   *  and a chip plus a headline would only restate its first sentence. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Drives the icon chip and the confirm button. `caution` is for the choices
   *  that are hard to walk back, like sending mail without review. */
  tone?: 'accent' | 'caution';
  title?: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const accent = tone === 'caution' ? colors.waiting : colors.accent;

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
          {icon ? (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: accent + '14',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={icon} size={22} color={accent} />
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            {title ? (
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 18, color: colors.ink }}>
                {title}
              </Text>
            ) : null}
            {/* With no headline above it the body IS the message, so it carries
                the weight a title would have: darker ink, a step up in size. */}
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: title ? 13.5 : 15,
                color: title ? colors.inkSecondary : colors.ink,
                lineHeight: title ? 20 : 23,
              }}>
              {body}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Button
              label={confirmLabel}
              fullWidth
              variant={tone === 'caution' ? 'brand' : 'primary'}
              onPress={() => {
                onConfirm();
                onClose();
              }}
            />
            <Button label={cancelLabel} variant="ghost" fullWidth onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default ConfirmDialog;
