import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    emoji: "🧠",
    title: "Your Life, Organised",
    subtitle: "Track habits, calories, tasks & activity — all in one place",
  },
  {
    emoji: "🥗",
    title: "Smart Nutrition Tracking",
    subtitle: "Log meals with AI-powered Indian food database — no guesswork",
  },
  {
    emoji: "🔥",
    title: "Build Streaks, Break Limits",
    subtitle: "Daily habits that stick. Watch your streaks grow every day",
  },
  {
    emoji: "🎯",
    title: "Ready to Start?",
    subtitle: "Set your goals and let LyfeOS do the heavy lifting",
  },
];

const THEME = {
  BG: "#0F0F0F",
  TEXT: "#FFFFFF",
  MUTED: "#A1A1AA",
  ACCENT: "#FF6B35",
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<Animated.FlatList<any>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleComplete = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/login" as any);
  };

  const handleNext = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip Button */}
      <View style={styles.header}>
        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipBtn} /> // placeholder to maintain layout
        )}
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const dotStyle = useAnimatedStyle(() => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = interpolate(
                scrollX.value,
                inputRange,
                [8, 24, 8],
                Extrapolation.CLAMP
              );
              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.3, 1, 0.3],
                Extrapolation.CLAMP
              );
              return {
                width: dotWidth,
                opacity,
              };
            });
            return <Animated.View style={[styles.dot, dotStyle]} key={i.toString()} />;
          })}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.BG,
  },
  header: {
    height: 50,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 24,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: THEME.MUTED,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emojiContainer: {
    marginBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 140,
    backgroundColor: THEME.BG,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: THEME.ACCENT + "40", // 25% opacity orange
    shadowColor: THEME.ACCENT,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  emoji: {
    fontSize: 60,
  },
  textContainer: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    color: THEME.TEXT,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: THEME.MUTED,
    textAlign: "center",
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    backgroundColor: THEME.ACCENT,
    borderRadius: 4,
  },
  nextButton: {
    backgroundColor: THEME.ACCENT,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: THEME.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
