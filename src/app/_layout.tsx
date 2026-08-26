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
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { configurePurchases, logInPurchases, logOutPurchases } from '@/api/purchases';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import ConnectionBanner from '@/components/ConnectionBanner';
import { TourProvider } from '@/components/tour/TourProvider';
import TourOverlay from '@/components/tour/TourOverlay';
import Toast from '@/components/Toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useScreenshotShare } from '@/hooks/useScreenshotShare';
import { loadAIConsent } from '@/lib/aiConsent';
import { noteAppOpen } from '@/lib/appRating';
import { AppProvider, useApp } from '@/store/app';
import { ThemeProvider, useColors, useTheme } from '@/theme/ThemeProvider';
import { resolveSchool } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// Cap Dynamic Type scaling at 1.3x app-wide. Full-size accessibility fonts
// (up to ~3x) broke dropdowns and keyboard layouts throughout the app; a
// 1.3 ceiling keeps larger-text users readable without shattering layouts.
// Revisit per-screen if we ever pursue full Dynamic Type support.
// @ts-expect-error defaultProps is a runtime escape hatch RN still honors.
Text.defaultProps = { ...(Text.defaultProps ?? {}), maxFontSizeMultiplier: 1.3 };
// @ts-expect-error same as above for inputs.
TextInput.defaultProps = { ...(TextInput.defaultProps ?? {}), maxFontSizeMultiplier: 1.3 };

// (diagnostic handler removed — root cause found: onboarding->tabs nav race)

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

/** Redirect between the auth stack, the AI-consent gate, the first-run
 *  onboarding, and the app based on sign-in + consent + onboarding status. */
function useAuthGate() {
  const { status } = useAuth();
  const { onboardingDone, needsOnboarding } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inConsent = segments[0] === 'ai-consent';

    if (status === 'signedOut') {
      // Screens outside (auth) that a signed-out person is allowed to be on.
      // Anything not listed gets sent to Welcome, which silently discards
      // whatever they were in the middle of, so add to this deliberately.
      //
      //  - finish-signin: the magic-link landing screen. The URL listener is
      //    completing the sign-in RIGHT NOW, so leave it alone (it has its own
      //    timeout fallback).
      const SIGNED_OUT_OK = ['finish-signin'];
      if (SIGNED_OUT_OK.includes(segments[0] as string)) return;
      if (!inAuthGroup) router.replace('/(auth)/welcome');
      return;
    }

    // Signed in. Leave the auth stack first.
    if (inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }

    // NO blanket consent gate here any more (2026-08-13). The disclosure now
    // fires in context, from lib/aiConsent's requireAIConsent(), immediately
    // before any call that sends user content to an AI provider. That is the
    // shape guideline 5.1.2(i) actually asks for (consent before the network
    // call, not before the app), and it stops a legal wall standing between
    // signup and the product.
    //
    // The safety of this rests entirely on every AI-bound endpoint calling
    // requireAIConsent(). If you add one, gate it. Currently gated: resume
    // upload/parse, resume build/refine/preview, Scout messages, Scout ask and
    // voice transcription, meeting prep preview and create, drafting, swipe to
    // draft, and auto-apply.
    if (inConsent) return;

    // Force-show onboarding ONLY for a confirmed brand-new user. needsOnboarding
    // is false for any established profile (judged on real /me data), so existing
    // users are never force-trapped. Exit to /(tabs) explicitly — bare '/' is
    // ambiguous with the onboarding group index and caused the earlier loop.
    if (needsOnboarding && !inOnboarding) {
      // Screens OUTSIDE the group that onboarding itself opens. Without this
      // list the guard bounces them straight back to intake, which made the
      // "I don't have either, build me one" button look dead (it pushed
      // /resume-from-text and was returned before the screen drew).
      const ONBOARDING_OK = ['resume-from-text'];
      if (ONBOARDING_OK.includes(segments[0] as string)) return;
      // Enter at /intake (resume, then feed preview); its last step hands off
      // to /(onboarding) for the remaining steps.
      router.replace('/(onboarding)/intake');
    } else if (onboardingDone && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [status, onboardingDone, needsOnboarding, segments, router]);

  return status;
}

/** Inside ThemeProvider so the status bar and screen background follow the setting. */
function ThemedShell() {
  const colors = useColors();
  // The web document has no background of its own: html, body and the React
  // root all compute to transparent, so anything the app does not paint over
  // falls through to the browser's white. Invisible in light mode, a white
  // band in dark. Native ignores this.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = globalThis.document;
    if (!doc) return;
    doc.documentElement.style.backgroundColor = colors.surface;
    doc.body.style.backgroundColor = colors.surface;
  }, [colors.surface]);

  const { scheme, setSchool } = useTheme();
  const { profile, bootPending } = useApp();
  const { user } = useAuth();
  const status = useAuthGate();
  useScreenshotShare();
  usePushNotifications();

  // RevenueCat: configure once, then keep app_user_id == Firebase uid so
  // purchase webhooks land on the same Firestore doc web Stripe writes to.
  // No-ops entirely when the SDK key or native module is absent.
  // On a genuine account CHANGE (not cold start), also drop every cached
  // query: without this the previous account's balance and profile keep
  // rendering until each screen happens to refetch.
  const prevUid = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    configurePurchases();
    if (user?.uid) void logInPurchases(user.uid);
    else void logOutPurchases();
    const uid = user?.uid ?? null;
    // AI consent is stored per account; reload it alongside the RC identity.
    void loadAIConsent(uid);
    if (prevUid.current !== undefined && prevUid.current !== uid) {
      queryClient.clear();
    }
    prevUid.current = uid;
  }, [user?.uid]);

  // One tick toward the App Store rating prompt's backup trigger ("5 separate
  // days in the app"). Signed-in only, so a bounced visitor never counts, and
  // deduped by calendar day inside noteAppOpen.
  useEffect(() => {
    if (status !== 'signedIn') return;
    void noteAppOpen(Date.now());
  }, [status]);

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
    // Themed ground under everything. GestureHandlerRootView has no
    // background, so any region a screen does not paint itself fell through to
    // white: invisible in light mode, a white band above the header in dark.
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TourProvider>
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
        {/* Dev-only door to the gap survey, so it can be designed without
            breaking an account to reach it. Nothing links here. */}
        <Stack.Screen name="survey-preview" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        <Stack.Screen name="outreach/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="resume-preview" options={{ presentation: 'modal' }} />
        {/* A page, not a modal (2026-08-13): the resume builder is a multi-step
            form with its own back arrow, reached mid-signup from intake, and a
            sheet that swipes away mid-typing loses someone's answers. */}
        <Stack.Screen name="resume-from-text" options={{ presentation: 'card' }} />
        <Stack.Screen name="resume-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="attachments" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meeting-prep/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meeting-prep/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="company/[name]" options={{ presentation: 'card' }} />
        <Stack.Screen name="contact/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="what-we-send" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="passed-jobs" options={{ presentation: 'card' }} />
        <Stack.Screen name="milestones" options={{ presentation: 'card' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        <Stack.Screen name="outreach-template" options={{ presentation: 'modal' }} />
        {/* One screen, both decks, chosen by ?deck=jobs|people. */}
        <Stack.Screen name="feed-filter" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Above the tabs on purpose: the tour walks the user between them. */}
      <TourOverlay />
        <ConnectionBanner />
        <Toast />
      </TourProvider>
    </View>
  );
}
