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

/** Redirect between the auth stack and the app based on sign-in status. */
function useAuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return status;
}

/** Inside ThemeProvider so the status bar and screen background follow the setting. */
function ThemedShell() {
  const colors = useColors();
  const { scheme, setSchool } = useTheme();
  const { profile } = useApp();
  const status = useAuthGate();
  useScreenshotShare();
  usePushNotifications();

  // Keep the school-colors theme pointed at the school the user signed up with.
  useEffect(() => {
    setSchool(resolveSchool(profile.school));
  }, [profile.school, setSchool]);

  if (status === 'loading') {
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
