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

  // Re-read AsyncStorage whenever the route changes so we see the updated
  // flag after onboarding writes it and navigates away.
  React.useEffect(() => {
    const loadOnboarding = async () => {
      const val = await AsyncStorage.getItem("hasSeenOnboarding");
      setHasSeenOnboarding(val === "true");
    };
    loadOnboarding();
  }, [segments]); // re-read on every segment change so we catch the write from onboarding.tsx

  React.useEffect(() => {
    // Wait until both auth and onboarding states are resolved
    if (isInitializing || hasSeenOnboarding === null) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const isLoggedIn = user !== null || isGuest;

    // Identify user in Analytics + Crashlytics when auth resolves
    if (user !== null) {
      setAnalyticsUser(user.uid, { isGuest: String(user.isAnonymous) });
      setCrashlyticsUser(user.uid);
    }

    if (isLoggedIn) {
      // Logged-in user: always go to tabs
      if (!inTabsGroup) {
        router.replace("/(tabs)");
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
    // If segments were included, every navigation would re-trigger this
    // effect and create a redirect loop (the original bug).
    // We only want to re-route when auth state or onboarding state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isInitializing, isGuest, hasSeenOnboarding]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
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
