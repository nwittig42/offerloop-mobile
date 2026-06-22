import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * QR scanner for career fairs: point at someone's LinkedIn QR (the app's
 * "share profile" code, or a badge/vCard that embeds a linkedin.com/in/ URL),
 * pull the profile URL out, and hand it back to the Meeting Prep screen — which
 * then runs the free preview and lets you prep them on the spot.
 */

/** Pull a linkedin.com/in/ profile URL out of whatever the QR encodes (a bare
 *  URL, a tracking link, or a vCard with a URL field). Returns '' if none. */
function extractLinkedInUrl(raw: string): string {
  const m = raw.match(/(https?:\/\/)?([\w-]+\.)?linkedin\.com\/in\/[^\s"'<>]+/i);
  if (!m) return '';
  let url = m[0].replace(/[).,;]+$/, ''); // strip trailing punctuation
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export default function ScanLinkedInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    const url = extractLinkedInUrl(data || '');
    if (!url) {
      setError("That QR isn't a LinkedIn profile. Try their LinkedIn QR code.");
      return;
    }
    handled.current = true;
    // Hand the URL back to the prep screen, which seeds + previews it.
    router.replace({ pathname: '/meeting-prep/new', params: { scanned: url } });
  };

  const Header = (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', flex: 1 }}>
        Scan LinkedIn QR
      </Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
    </View>
  );

  // Permission not yet decided.
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  // Permission denied — explain + offer settings.
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: 24, justifyContent: 'center', gap: 16 }}>
        <Ionicons name="qr-code-outline" size={44} color={colors.navy} style={{ alignSelf: 'center' }} />
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.heading, textAlign: 'center' }}>
          Camera access
        </Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center', lineHeight: 21 }}>
          To scan a LinkedIn QR at a career fair, Offerloop needs camera access.
        </Text>
        <Button
          label={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          fullWidth
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
        <Button label="Not now" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {Header}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onScan}
      />
      {/* Reticle + hint */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 220,
            height: 220,
            borderRadius: 20,
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.9)',
          }}
        />
      </View>
      <View style={{ position: 'absolute', bottom: insets.bottom + 28, left: 24, right: 24, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: '#fff', textAlign: 'center' }}>
          Point at a LinkedIn QR code
        </Text>
        {error ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: '#ffd9d9', textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
