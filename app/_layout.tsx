import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
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

SplashScreen.preventAutoHideAsync().catch(() => {});

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isInitializing, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem("hasSeenOnboarding").then((val) => {
      setHasSeenOnboarding(val === "true");
    });
  }, []);

  React.useEffect(() => {
    if (isInitializing || hasSeenOnboarding === null) return;

    const inAuthGroup = segments[0] !== "(tabs)";
    const isLoggedIn = user !== null || isGuest;

    if (!isLoggedIn) {
      if (!hasSeenOnboarding && segments[0] !== ("onboarding" as any)) {
        router.replace("/onboarding" as any);
      } else if (hasSeenOnboarding && segments[0] !== ("login" as any)) {
        router.replace("/login" as any);
      }
    } else if (inAuthGroup) {
      router.replace("/(tabs)");
    }
    
    // Hide splash screen once we've successfully resolved the initial route
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 100);
  }, [user, isInitializing, isGuest, hasSeenOnboarding, segments]);

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
