import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Landing screen for the magic-link deep link offerloop://finish-signin.
 * The actual sign-in is completed by AuthProvider's URL listener; this
 * screen just gives the link somewhere real to land (it used to hit Expo
 * Router's Unmatched Route page ON TOP of a successful sign-in) and routes
 * onward once the session flips. The auth gate leaves this screen alone
 * while the link is being processed.
 */
export default function FinishSignInScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (status === 'signedIn') {
      router.replace('/(tabs)');
      return;
    }
    // Signed out and still here after a grace period: the link was expired
    // or opened on the wrong device. The sign-in screen explains resending.
    // (A sign-in mid-wait re-runs this effect, which clears the timer.)
    const t = setTimeout(() => router.replace('/(auth)/sign-in'), 8000);
    return () => clearTimeout(t);
  }, [status, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: colors.surface,
        paddingHorizontal: 40,
      }}>
      <Image
        source={require('../../assets/images/offerloop-mark.png')}
        style={{ width: 48, height: 48 }}
        resizeMode="contain"
        accessibilityLabel="Offerloop"
      />
      <ActivityIndicator color={colors.navy} />
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink }}>
        Signing you in…
      </Text>
      <Text
        style={{
          fontFamily: fonts.sans,
          fontSize: 12.5,
          color: colors.inkSecondary,
          textAlign: 'center',
          lineHeight: 18,
        }}>
        One moment while we finish setting up your session.
      </Text>
    </View>
  );
}
