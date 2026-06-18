import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { initializeAds } from "@/utils/ads";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardAvoidingView, Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ActivityProvider } from "@/context/ActivityContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CaloriesProvider } from "@/context/CaloriesContext";
import { HabitsProvider } from "@/context/HabitsContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { TodosProvider } from "@/context/TodosContext";

SplashScreen.preventAutoHideAsync().catch(() => { });

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAnalyticsUser, setCrashlyticsUser } from "@/utils/analytics";

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isInitializing, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState<boolean | null>(null);
  const [legalConsentAccepted, setLegalConsentAccepted] = React.useState<boolean | null>(null);

  // Re-read AsyncStorage whenever the route changes so we pick up writes from
  // onboarding.tsx and legal-consent.tsx after they navigate away.
  React.useEffect(() => {
    const loadStorage = async () => {
      const val = await AsyncStorage.getItem("hasSeenOnboarding");
      setHasSeenOnboarding(val === "true");

      // ── Legal consent gate ────────────────────────────────────────────
      try {
        const consentStr = await AsyncStorage.getItem("legalConsent");
        if (!consentStr) {
          setLegalConsentAccepted(false);
        } else {
          const parsed = JSON.parse(consentStr);
          // Must be accepted AND match current CONSENT_VERSION ('1.0')
          // If CONSENT_VERSION bumps in the future, existing users re-see the screen
          setLegalConsentAccepted(parsed.accepted === true && parsed.version === '1.0');
        }
      } catch {
        setLegalConsentAccepted(false);
      }
    };
    loadStorage();
  }, [segments]); // re-read on every segment change

  React.useEffect(() => {
    // Wait until auth, onboarding, AND consent states are all resolved
    if (isInitializing || hasSeenOnboarding === null || legalConsentAccepted === null) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const inLegalConsent = segments[0] === ("legal-consent" as any);
    const isLoggedIn = user !== null || isGuest;

    // Identify user in Analytics + Crashlytics when auth resolves
    if (user !== null) {
      setAnalyticsUser(user.uid, { isGuest: String(user.isAnonymous) });
      setCrashlyticsUser(user.uid);
    }

    if (isLoggedIn) {
      // Logged-in user: check legal consent gate FIRST
      if (!legalConsentAccepted) {
        // Show consent screen; do not redirect if already there
        if (!inLegalConsent) {
          router.replace("/legal-consent" as any);
        }
      } else {
        // Consent accepted — go to tabs
        if (!inTabsGroup) {
          router.replace("/(tabs)");
        }
      }
    } else {
      // Not logged in: route based on onboarding status
      if (!hasSeenOnboarding) {
        // Only redirect to onboarding if not already there
        if (segments[0] !== ("onboarding" as any)) {
          router.replace("/onboarding" as any);
        }
      } else {
        // Only redirect to login if not already there
        if (segments[0] !== ("login" as any)) {
          router.replace("/login" as any);
        }
      }
    }

    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => { });
    }, 100);
    // NOTE: `segments` is intentionally NOT in the dependency array.
    // We only want to re-route when auth/onboarding/consent state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isInitializing, isGuest, hasSeenOnboarding, legalConsentAccepted]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="legal-consent" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // We now let RootLayoutNav hide the splash screen after redirects
  // to prevent flashing the index screen

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await initializeAds();
      } catch (e) {
        console.log('AdMob init failed silently:', e);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <HabitsProvider>
                <TodosProvider>
                  <CaloriesProvider>
                    <ActivityProvider>
                      <ProfileProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          <KeyboardProvider>
                            <KeyboardAvoidingView
                              behavior={Platform.OS === "ios" ? "padding" : "height"}
                              style={{ flex: 1 }}
                            >
                              <RootLayoutNav />
                            </KeyboardAvoidingView>
                          </KeyboardProvider>
                        </GestureHandlerRootView>
                      </ProfileProvider>
                    </ActivityProvider>
                  </CaloriesProvider>
                </TodosProvider>
              </HabitsProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
