import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import ConnectionBanner from '@/components/ConnectionBanner';
import NotificationPrompt from '@/components/NotificationPrompt';
import Toast from '@/components/Toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useScreenshotShare } from '@/hooks/useScreenshotShare';
import { AppProvider, useApp } from '@/store/app';
import { ThemeProvider, useColors, useTheme } from '@/theme/ThemeProvider';
import { resolveSchool } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// TEMP DIAGNOSTIC (crash-loop hunt 2026-07-10): surface the real JS fatal in an
// Alert before Expo's error recovery converts it to a silent native abort. The
// crash .ips strips the JS message, so this makes the next reproduce SHOW us the
// error. Remove once the crash is fixed.
if (typeof ErrorUtils !== 'undefined' && (ErrorUtils as any)?.setGlobalHandler) {
  const prev = (ErrorUtils as any).getGlobalHandler?.();
  (ErrorUtils as any).setGlobalHandler((err: any, isFatal?: boolean) => {
    try {
      const { Alert } = require('react-native');
      Alert.alert(
        isFatal ? 'Fatal JS error' : 'JS error',
        String(err?.message || err) + '\n\n' + String(err?.stack || '').split('\n').slice(0, 6).join('\n'),
      );
    } catch {}
    prev?.(err, isFatal);
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <ThemedShell />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Redirect between the auth stack, the first-run onboarding, and the app based
 *  on sign-in + onboarding status. */
function useAuthGate() {
  const { status } = useAuth();
  const { onboardingDone, needsOnboarding } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (status === 'signedOut') {
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }

    // Signed in. Leave the auth stack first.
    if (inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }

    // Force-show onboarding ONLY for a confirmed brand-new user. needsOnboarding
    // is false for any established profile (judged on real /me data), so existing
    // users are never force-trapped. Exit to /(tabs) explicitly — bare '/' is
    // ambiguous with the onboarding group index and caused the earlier loop.
    if (needsOnboarding && !inOnboarding) {
      router.replace('/(onboarding)');
    } else if (onboardingDone && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [status, onboardingDone, needsOnboarding, segments, router]);

  return status;
}

/** Inside ThemeProvider so the status bar and screen background follow the setting. */
function ThemedShell() {
  const colors = useColors();
  const { scheme, setSchool } = useTheme();
  const { profile, bootPending } = useApp();
  const status = useAuthGate();
  useScreenshotShare();
  usePushNotifications();

  // Keep the school-colors theme pointed at the school the user signed up with.
  useEffect(() => {
    setSchool(resolveSchool(profile.school));
  }, [profile.school, setSchool]);

  // bootPending: signed in but no profile from cache/network yet — hold the
  // spinner (~50ms for returning users) instead of flashing sample data as
  // real. A /me failure releases it to the honest "sample data" banner.
  if (status === 'loading' || bootPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="design" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="outreach/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
        <Stack.Screen name="attachments" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meeting-prep/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meeting-prep/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="company/[name]" options={{ presentation: 'card' }} />
        <Stack.Screen name="passed-jobs" options={{ presentation: 'card' }} />
        <Stack.Screen name="milestones" options={{ presentation: 'card' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        <Stack.Screen name="swipe-settings" options={{ presentation: 'modal' }} />
      </Stack>
      <ConnectionBanner />
      <Toast />
      <NotificationPrompt />
    </>
  );
}
