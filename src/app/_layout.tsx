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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import NotificationPrompt from '@/components/NotificationPrompt';
import Toast from '@/components/Toast';
import { AppProvider } from '@/store/app';
import { colors } from '@/theme/tokens';

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
        <AppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}>
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
            <Stack.Screen name="share" options={{ presentation: 'modal' }} />
            <Stack.Screen name="swipe-settings" options={{ presentation: 'modal' }} />
          </Stack>
          <Toast />
          <NotificationPrompt />
        </AppProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
