import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { AD_UNIT_IDS, BannerAd, BannerAdSize, initializeAds, isAdsInitialized } from "@/utils/ads";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/useAppTheme";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="habits">
        <Icon sf={{ default: "star", selected: "star.fill" }} />
        <Label>Habits</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="todos">
        <Icon sf={{ default: "checklist", selected: "checklist" }} />
        <Label>Tasks</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calories">
        <Icon sf={{ default: "fork.knife", selected: "fork.knife" }} />
        <Label>Nutrition</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.ACCENT,
        tabBarInactiveTintColor: theme.MUTED,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : theme.BG,
          borderTopWidth: 1,
          borderTopColor: theme.BORDER,
          elevation: 0,
          height: isWeb ? 84 : 60 + insets.bottom,
          paddingBottom: isWeb ? 34 : insets.bottom,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={theme.isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.BG }]} />
          ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600" as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "house.fill" : "house"} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: "Habits",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "star.fill" : "star"} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "star" : "star-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="checklist" tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="calories"
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="fork.knife" tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "person.fill" : "person"} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const [adLoaded, setAdLoaded] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(isAdsInitialized());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isAdsInitialized()) {
      initializeAds().then(() => setIsSdkReady(true));
    }
  }, []);
  
  let content;
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    content = <NativeTabLayout />;
  } else {
    content = <ClassicTabLayout />;
  }

  return (
    <View style={{ flex: 1 }}>
      {content}
      <View style={[
        { position: "absolute", bottom: 0, width: "100%", alignItems: "center", marginBottom: (Platform.OS === "web" ? 84 : 60 + insets.bottom) + (insets.bottom > 0 ? 0 : 4) },
        !adLoaded && { height: 0, overflow: "hidden" },
      ]} pointerEvents="box-none">
        {isSdkReady && (
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => { setAdLoaded(true); console.log('✅ Banner Ad Loaded Successfully (Global)'); }}
            onAdFailedToLoad={(error) => { setAdLoaded(false); console.log('❌ Banner Ad Failed (Global):', JSON.stringify(error)); }}
          />
        )}
      </View>
    </View>
  );
}
