import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useActivity } from "@/context/ActivityContext";
import { useCalories } from "@/context/CaloriesContext";
import { useProfile } from "@/context/ProfileContext";
import { showRewardedAd } from "../utils/ads";
import {
  ActivityAnalysis,
  analyzeActivity,
  calculateSteps,
  estimateCalories,
} from "@/utils/analyzeActivity";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT  = "#FF6B35";
const PURPLE  = "#8B5CF6";

// ── MaterialCommunityIcons name map for activities ────────────────────────────
// All activity icons use MaterialCommunityIcons for visual consistency
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
const ACTIVITY_ICONS: Record<string, MCIName> = {
  // Cardio
  "Running":          "run-fast",
  "Walking":          "walk",
  "Cycling":          "bike",
  "Swimming":         "swim",
  "Hiking":           "hiking",
  // Sports
  "Badminton":        "badminton",
  "Tennis":           "tennis",
  "Football":         "soccer",
  "Basketball":       "basketball",
  "Cricket":          "cricket",
  "Volleyball":       "volleyball",
  "Boxing":           "boxing-glove",
  "Table Tennis":     "table-tennis",
  "Rugby":            "rugby",
  "Rock Climbing":    "carabiner",
  "Golf":             "golf",
  "Gymnastics":       "gymnastics",
  "Martial Arts":     "karate",
  "Skiing":           "ski",
  // Wellness
  "Yoga":             "yoga",
  "Meditation":       "meditation",
  "Stretching":       "human-handsup",
  "Breathing Exercises": "lungs",
  "Rest Day":         "sleep",
  "Ice Bath":         "snowflake",
  // Lifestyle
  "Steps":            "shoe-print",
  "Dog Walking":      "dog-side",
  "Household Chores": "broom",
  "Shopping":         "shopping",
  "Cleaning":         "spray",
  "Gardening":        "flower",
  "Other Sport":      "dumbbell",
};

function getActivityIcon(name: string): MCIName {
  return ACTIVITY_ICONS[name] ?? "dumbbell";
}

// ── Activity category definitions (Change 8) ─────────────────────────────────
const CARDIO_ACTIVITIES = [
  { icon: "Running",  name: "Running" },
  { icon: "Walking",  name: "Walking" },
  { icon: "Cycling",  name: "Cycling" },
  { icon: "Swimming", name: "Swimming" },
  { icon: "Hiking",   name: "Hiking" },
];

const SPORTS_ACTIVITIES = [
  { icon: "Cricket",        name: "Cricket" },
  { icon: "Football",       name: "Football" },
  { icon: "Basketball",     name: "Basketball" },
  { icon: "Tennis",         name: "Tennis" },
  { icon: "Badminton",      name: "Badminton" },
  { icon: "Volleyball",     name: "Volleyball" },
  { icon: "Boxing",         name: "Boxing" },
  { icon: "Table Tennis",   name: "Table Tennis" },
  { icon: "Rock Climbing",  name: "Rock Climbing" },
  { icon: "Rugby",          name: "Rugby" },
  { icon: "Golf",           name: "Golf" },
  { icon: "Gymnastics",     name: "Gymnastics" },
  { icon: "Martial Arts",   name: "Martial Arts" },
  { icon: "Skiing",         name: "Skiing" },
];

const WELLNESS_ACTIVITIES = [
  { icon: "Yoga",                  name: "Yoga" },
  { icon: "Meditation",            name: "Meditation" },
  { icon: "Stretching",            name: "Stretching" },
  { icon: "Breathing Exercises",   name: "Breathing Exercises" },
  { icon: "Rest Day",              name: "Rest Day" },
  { icon: "Ice Bath",              name: "Ice Bath" },
];

const LIFESTYLE_ACTIVITIES = [
  { icon: "Steps",            name: "Steps" },
  { icon: "Dog Walking",      name: "Dog Walking" },
  { icon: "Household Chores", name: "Household Chores" },
  { icon: "Shopping",         name: "Shopping" },
  { icon: "Cleaning",         name: "Cleaning" },
  { icon: "Gardening",        name: "Gardening" },
  { icon: "Other Sport",      name: "Other Sport" },
];

const ALL_ACTIVITIES = [
  ...CARDIO_ACTIVITIES,
  ...SPORTS_ACTIVITIES,
  ...WELLNESS_ACTIVITIES,
  ...LIFESTYLE_ACTIVITIES,
];

const POPULAR_ACTIVITIES = [
  { icon: "Running",   name: "Running" },
  { icon: "Walking",   name: "Walking" },
  { icon: "Yoga",      name: "Yoga" },
  { icon: "Cycling",   name: "Cycling" },
  { icon: "Swimming",  name: "Swimming" },
  { icon: "Badminton", name: "Badminton" },
  { icon: "Steps",     name: "Steps" },
  { icon: "Stretching",name: "Stretching" },
];

const INTENSITIES = [
  { key: "light",    label: "Light",    icon: "🟢", desc: "Easy, conversational pace" },
  { key: "moderate", label: "Moderate", icon: "🟡", desc: "Elevated heart rate" },
  { key: "intense",  label: "Intense",  icon: "🔴", desc: "Maximum effort, sweating" },
] as const;

// Duration chips (Change 5) — 15, 30, 60, Custom
const DURATION_CHIPS = [15, 30, 60, "custom"] as const;
type DurationChip = typeof DURATION_CHIPS[number];

const ZONE_COLORS: Record<string, string> = {
  "fat burn": "#EAB308", cardio: "#EF4444", peak: "#8B5CF6",
};

// ── Utility ───────────────────────────────────────────────────────────────────
function isoDate(d = new Date()) { return getLocalDateString(d); }

// ── Progress ring (for steps) ─────────────────────────────────────────────────
function StepsRing({ size = 100, progress, children }: { size?: number; progress: number; children?: React.ReactNode }) {
  const theme = useAppTheme();
  const { BORDER, GREEN } = theme;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <Circle cx={size/2} cy={size/2} r={r} fill="none" stroke={GREEN} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

// ── Pulsing loading dots ──────────────────────────────────────────────────────
function PulsingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.delay(800 - delay),
      ]));
    Animated.parallel([anim(dot1, 0), anim(dot2, 200), anim(dot3, 400)]).start();
  }, []);

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
      ))}
    </View>
  );
}

// ── Recovery nutrient card ────────────────────────────────────────────────────
function NutrientCard({ emoji, label, value, sub, color, onPress, tooltip }: {
  emoji: string; label: string; value: string; sub?: string; color: string;
  onPress?: () => void; tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={[styles.nutrientCard, { backgroundColor: color + "18", borderColor: color + "33" }]}
        onPress={() => { if (tooltip) setShowTip(true); if (onPress) onPress(); }}>
        <Text style={styles.nutrientEmoji}>{emoji}</Text>
        <Text style={[styles.nutrientValue, { color }]}>{value}</Text>
        {sub && <Text style={styles.nutrientSub}>{sub}</Text>}
        <Text style={styles.nutrientLabel}>{label}</Text>
      </TouchableOpacity>
      <Modal visible={showTip} transparent animationType="fade" onRequestClose={() => setShowTip(false)}>
        <TouchableOpacity style={styles.tipOverlay} activeOpacity={1} onPress={() => setShowTip(false)}>
          <View style={[styles.tipBox, { backgroundColor: theme.CARD2, borderColor: color + "55" }]}>
            <Text style={styles.tipBoxText}>{tooltip}</Text>
            <TouchableOpacity style={[styles.tipBoxBtn, { backgroundColor: color }]} onPress={() => setShowTip(false)}>
              <Text style={styles.tipBoxBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ── Activity Icon Cell ────────────────────────────────────────────────────────
function ActivityCell({ name, isSelected, onPress }: {
  name: string; isSelected: boolean; onPress: () => void;
}) {
  const theme = useAppTheme();
  const iconName = getActivityIcon(name);
  return (
    <TouchableOpacity
      style={[
        styles_activity.cell,
        { backgroundColor: theme.CARD, borderColor: isSelected ? ACCENT : "transparent" },
        isSelected && { backgroundColor: "#FF6B3512" },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[
        styles_activity.iconCircle,
        { backgroundColor: isSelected ? ACCENT + "22" : theme.BORDER + "88" },
      ]}>
        <MaterialCommunityIcons
          name={iconName}
          size={26}
          color={isSelected ? ACCENT : theme.SUBTEXT}
        />
      </View>
      <Text
        style={[styles_activity.label, { color: isSelected ? ACCENT : theme.TEXT }]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles_activity = StyleSheet.create({
  cell: {
    width: "23.5%",
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 8,
    gap: 6,
    minHeight: 88,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "600" as const,
    textAlign: "center",
    lineHeight: 13,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ActivityTracker() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, SUBTEXT, TEXT, GREEN, BLUE, YELLOW, RED } = theme;
  const styles = makeStyles(theme);
  const { healthProfile } = useProfile();
  const { logWater, dailyGoal } = useCalories();
  const {
    addActivityLog, activityLogs, getWeeklySports, getDailyActivityCalories,
    getDailyActivityMinutes, getBestStreak, getFavoriteSport, getMostCalsBurned,
    getLongestSession, getMostActiveMonth, setPostActivityBanner, weeklyCoachInsight,
    setWeeklyCoachInsight, logSteps, getStepsForDate,
  } = useActivity();

  const today = isoDate();
  const stepsToday = getStepsForDate(today);
  const weight = parseFloat(healthProfile.weight) || 70;
  const age    = parseInt(healthProfile.age)     || 25;
  const height = parseFloat(healthProfile.height) || 170;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [selectedSport, setSelectedSport] = useState("");
  const [duration, setDuration] = useState(30);
  const [customDurationChip, setCustomDurationChip] = useState<DurationChip>(30);
  const [customDurationText, setCustomDurationText] = useState("");
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [intensity, setIntensity] = useState<"light" | "moderate" | "intense">("moderate");
  const [customSport, setCustomSport] = useState("");

  // ── Search & Filter Tabs ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "cardio" | "sports" | "wellness" | "lifestyle">("all");
  const [searchLayoutY, setSearchLayoutY] = useState(0);

  // ── Activity log limit display ─────────────────────────────────────────────
  const [activityLogsRemaining, setActivityLogsRemaining] = useState<number | null>(null);

  const updateActivityLimitDisplay = React.useCallback(async () => {
    try {
      const today = new Date().toDateString();
      const lastLogDate = await AsyncStorage.getItem('lastActivityLogDate');
      const countStr = await AsyncStorage.getItem('activityLogCount');
      const count = lastLogDate === today ? parseInt(countStr || '0') : 0;
      setActivityLogsRemaining(Math.max(0, 1 - count));
    } catch (e) {
      console.log('Activity limit display error (non-fatal):', e);
    }
  }, []);

  useEffect(() => {
    updateActivityLimitDisplay();
  }, [updateActivityLimitDisplay]);

  const getFilteredActivities = () => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      return ALL_ACTIVITIES.filter(s => s.name.toLowerCase().includes(query));
    }
    switch (selectedTab) {
      case "cardio":    return CARDIO_ACTIVITIES;
      case "sports":    return SPORTS_ACTIVITIES;
      case "wellness":  return WELLNESS_ACTIVITIES;
      case "lifestyle": return LIFESTYLE_ACTIVITIES;
      default:          return POPULAR_ACTIVITIES;
    }
  };

  // ── Steps input ────────────────────────────────────────────────────────────
  const [stepsSheet, setStepsSheet] = useState(false);
  const [stepsInput, setStepsInput] = useState("");
  const stepsPreview = stepsInput ? calculateSteps(parseInt(stepsInput) || 0, weight, height) : null;

  // ── AI flow ────────────────────────────────────────────────────────────────
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [resultSheet, setResultSheet] = useState(false);
  const [analysis, setAnalysis] = useState<ActivityAnalysis | null>(null);
  const [aiError, setAiError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pulse anim for loading screen ─────────────────────────────────────────
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!loadingSheet) return;

    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ]));

    animation.start();

    return () => {
      animation.stop();
      pulseAnim.setValue(1);
    };
  }, [loadingSheet]);

  function showToast(msg: string) {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimeout.current = setTimeout(() => setToastVisible(false), 3200);
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const todayCalsBurned    = getDailyActivityCalories(today);
  const todayActiveMinutes = getDailyActivityMinutes(today);
  const weeklySports       = getWeeklySports();
  const favSport           = getFavoriteSport();
  const bestCalsBurned     = getMostCalsBurned();
  const longestSession     = getLongestSession();
  const mostActiveMonth    = getMostActiveMonth();
  const loggedTodayCount   = activityLogs.filter(log => log.date === today).length;

  // Change 10: Recent activities (up to 5 unique, most recent first)
  const recentActivities = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; date: string }[] = [];
    for (let i = activityLogs.length - 1; i >= 0; i--) {
      const l = activityLogs[i];
      if (!seen.has(l.sport)) {
        seen.add(l.sport);
        result.push({ name: l.sport, date: l.date });
        if (result.length >= 5) break;
      }
    }
    return result;
  }, [activityLogs]);

  const activeSportName  = selectedSport === "Other Sport" ? (customSport.trim() || "Other Sport") : selectedSport;
  const activeSportIcon  = getActivityIcon(activeSportName || "Other Sport");

  // Change 9: Live calorie preview
  const previewCalories = selectedSport && duration > 0
    ? estimateCalories(activeSportName, duration, intensity, weight)
    : null;

  const intensityLabel: Record<string, string> = {
    light: "Light", moderate: "Moderate", intense: "Intense",
  };

  // ── Handle duration chip selection ─────────────────────────────────────────
  const handleDurationChip = (chip: DurationChip) => {
    if (chip === "custom") {
      setCustomDurationChip("custom");
      setShowCustomDuration(true);
    } else {
      setCustomDurationChip(chip);
      setDuration(chip);
      setShowCustomDuration(false);
      setCustomDurationText("");
    }
    // Reset result when duration changes so old result doesn't persist
    setShowResult(false);
  };

  const handleCustomDurationChange = (text: string) => {
    setCustomDurationText(text);
    const n = parseInt(text.replace(/[^0-9]/g, "")) || 0;
    if (n >= 1 && n <= 600) setDuration(n);
  };

  // ── Handle Analyze & Log ───────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!activeSportName) { Alert.alert("Select an activity", "Please choose a sport or activity first."); return; }
    if (showCustomDuration) {
      const n = parseInt(customDurationText) || 0;
      if (n < 1) { Alert.alert("Enter duration", "Please enter a valid duration (1–600 minutes)."); return; }
      if (n > 600) { Alert.alert("Too long", "Please enter a duration of 600 minutes or less."); return; }
      setDuration(n);
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiError("");
    setAnalysis(null);
    setShowResult(false);
    setIsAnalyzing(true);
    setLoadingSheet(true);
    try {
      // Fake AI processing delay to maintain the illusion of AI analysis
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = await analyzeActivity(activeSportName, duration, intensity, weight, age);
      setAnalysis(result);
      setLoadingSheet(false);
      setResultSheet(true);
      setShowResult(true);
    } catch (e: any) {
      setLoadingSheet(false);
      setShowResult(false);
      setAiError("Something went wrong. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Handle Log This Session ────────────────────────────────────────────────
  const handleLogSession = async () => {
    if (!analysis) return;
    // Check daily activity log limit (1 free per day, then requires watching a rewarded ad)
    try {
      const todayDate = new Date().toDateString();
      const lastLogDate = await AsyncStorage.getItem('lastActivityLogDate');
      const countStr = await AsyncStorage.getItem('activityLogCount');
      let count = lastLogDate === todayDate ? parseInt(countStr || '0') : 0;

      if (count === 0) {
        // First log of the day — free
        await AsyncStorage.setItem('lastActivityLogDate', todayDate);
        await AsyncStorage.setItem('activityLogCount', '1');
        updateActivityLimitDisplay(); // reflect updated count immediately
      } else {
        // Need to watch rewarded ad for subsequent logs
        const watched = await showRewardedAd();
        if (!watched) {
          Alert.alert(
            "Daily Limit Reached",
            "Watch an ad to log more activities today, or come back tomorrow!",
            [{ text: "OK", style: "cancel" }]
          );
          return;
        }
        await AsyncStorage.setItem('activityLogCount', String(count + 1));
        updateActivityLimitDisplay(); // reflect updated count immediately
      }
    } catch (e) {
      // Silently fail — never block the user from logging
      console.log('Activity log limit check failed (non-fatal):', e);
    }

    const log = {
      date: today,
      sport: activeSportName,
      emoji: "🏅",
      duration,
      intensity,
      caloriesBurned: analysis.calories_burned,
      hydrationNeededMl: analysis.hydration_needed_ml,
      hydrationGlasses: analysis.hydration_glasses,
      proteinNeededG: analysis.protein_needed_g,
      carbsNeededG: analysis.carbs_needed_g,
      recoveryTimeHours: analysis.recovery_time_hours,
      heartRateZone: analysis.heart_rate_zone,
      healthBenefits: analysis.health_benefits,
      tips: analysis.tips,
      postActivityMeal: analysis.post_activity_meal,
      sportCategory: analysis.sport_category,
    };
    addActivityLog(log);
    setPostActivityBanner({ sport: activeSportName, emoji: "🏅", meal: analysis.post_activity_meal, loggedAt: Date.now() });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResultSheet(false);
    setShowResult(false);
    setSelectedSport("");
    showToast(`💧 Added ${analysis.hydration_glasses.toFixed(1)} glasses to your water goal`);
  };

  const handleTapHydration = () => {
    if (!analysis) return;
    logWater(today, analysis.hydration_glasses);
    showToast(`💧 +${analysis.hydration_glasses.toFixed(1)} glasses added to today's water!`);
  };

  // ── Log steps ──────────────────────────────────────────────────────────────
  const handleLogSteps = () => {
    const n = parseInt(stepsInput) || 0;
    if (n <= 0) { Alert.alert("Enter steps", "Please enter a valid step count."); return; }
    const calc = calculateSteps(n, weight, height);
    logSteps({ date: today, steps: n, ...calc });
    setStepsSheet(false);
    setStepsInput("");
    showToast(`👟 ${n.toLocaleString()} steps logged!`);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Whether to show empty state (Change 1) ─────────────────────────────────
  const hasActivityToday = loggedTodayCount > 0 || stepsToday !== null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* ── Change 1 + 2: Stats Row / Empty State ──────────────────── */}
        {hasActivityToday ? (
          /* Real stats — Change 2: steps removed, replaced with activities count */
          <View style={styles.dailyRow}>
            <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomColor: ACCENT }]}>
              <Ionicons name="flame" size={18} color={ACCENT} />
              <Text style={[styles.dailyVal, { color: ACCENT }]}>{todayCalsBurned}</Text>
              <Text style={styles.dailyLabel}>kcal burned</Text>
            </View>
            <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomColor: BLUE }]}>
              <Ionicons name="timer-outline" size={18} color={BLUE} />
              <Text style={[styles.dailyVal, { color: BLUE }]}>{todayActiveMinutes}</Text>
              <Text style={styles.dailyLabel}>active mins</Text>
            </View>
            <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomColor: GREEN }]}>
              <Ionicons name="trophy-outline" size={18} color={GREEN} />
              <Text style={[styles.dailyVal, { color: GREEN }]}>{loggedTodayCount}</Text>
              <Text style={styles.dailyLabel}>activities</Text>
            </View>
          </View>
        ) : (
          /* Empty state — motivational onboarding cards */
          <View style={styles.dailyRow}>
            <View style={[styles.motivationalCard, { backgroundColor: ACCENT + "12", borderColor: ACCENT + "33" }]}>
              <Text style={styles.motivationalEmoji}>🔥</Text>
              <Text style={[styles.motivationalTitle, { color: ACCENT }]}>Ready to Move?</Text>
              <Text style={[styles.motivationalSub, { color: MUTED }]}>Tap below to start</Text>
            </View>
            <View style={[styles.motivationalCard, { backgroundColor: BLUE + "12", borderColor: BLUE + "33" }]}>
              <Text style={styles.motivationalEmoji}>💪</Text>
              <Text style={[styles.motivationalTitle, { color: BLUE }]}>Log Activity</Text>
              <Text style={[styles.motivationalSub, { color: MUTED }]}>Build momentum</Text>
            </View>
            <View style={[styles.motivationalCard, { backgroundColor: GREEN + "12", borderColor: GREEN + "33" }]}>
              <Text style={styles.motivationalEmoji}>🎯</Text>
              <Text style={[styles.motivationalTitle, { color: GREEN }]}>Start Strong</Text>
              <Text style={[styles.motivationalSub, { color: MUTED }]}>Every step counts</Text>
            </View>
          </View>
        )}

        {/* ── Steps Tracker Card (unchanged) ───────────────────────────── */}
        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEmoji}>👟</Text>
            <Text style={styles.cardTitle}>Steps Today</Text>
            <TouchableOpacity style={styles.logStepsBtn} onPress={() => setStepsSheet(true)}>
              <Ionicons name="add" size={12} color={ACCENT} />
              <Text style={styles.logStepsBtnText}>Log Steps</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.stepsContent}>
            <View style={{ alignItems: "center" }}>
              <StepsRing size={88} progress={(stepsToday?.steps ?? 0) / 10_000}>
                <Text style={[styles.stepsNum, { fontSize: 16 }]}>{stepsToday?.steps?.toLocaleString() ?? "0"}</Text>
                <Text style={styles.stepsGoalText}>/ 10k</Text>
              </StepsRing>
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Goal: 10,000 steps</Text>
            </View>
            <View style={styles.stepsStats}>
              <StepsStat icon="map-outline" color={BLUE}   label="Distance"   value={stepsToday ? `${stepsToday.distanceKm} km` : "0 km"} />
              <StepsStat icon="flame-outline" color={ACCENT} label="Calories"  value={stepsToday ? `${stepsToday.caloriesBurned} kcal` : "0 kcal"} />
              <StepsStat icon="time-outline" color={GREEN}  label="Active Mins" value={stepsToday ? `${stepsToday.activeMinutes} min` : "0 min"} />
            </View>
          </View>
        </View>

        {/* ── Change 10: Recent Activities ─────────────────────────────── */}
        {recentActivities.length > 0 && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={18} color={ACCENT} />
              <Text style={styles.cardTitle}>Recent Activities</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentActivities.map((act) => (
                <TouchableOpacity
                  key={act.name}
                  style={[
                    styles.recentChip,
                    {
                      backgroundColor: selectedSport === act.name ? ACCENT + "18" : CARD2,
                      borderColor: selectedSport === act.name ? ACCENT : BORDER,
                    },
                  ]}
                  onPress={() => {
                    setSelectedSport(act.name === selectedSport ? "" : act.name);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                >
                  <MaterialCommunityIcons
                    name={getActivityIcon(act.name)}
                    size={18}
                    color={selectedSport === act.name ? ACCENT : MUTED}
                  />
                  <Text style={[
                    styles.recentChipText,
                    { color: selectedSport === act.name ? ACCENT : TEXT },
                  ]}>
                    {act.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Activity Type Picker (Change 4 + 8) ──────────────────────── */}
        <View
          style={[styles.card, { backgroundColor: CARD }]}
          onLayout={(e) => setSearchLayoutY(e.nativeEvent.layout.y)}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="dumbbell" size={18} color={ACCENT} />
            <Text style={styles.cardTitle}>Choose Activity</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={16} color={MUTED} style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search any activity..."
              placeholderTextColor={MUTED}
              clearButtonMode="while-editing"
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: searchLayoutY - 20, animated: true });
                }, 150);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Tabs — Cardio | Sports | Wellness | Lifestyle */}
          {searchQuery.trim().length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
              style={{ marginBottom: 12 }}
            >
              {([
                { key: "cardio",    label: "❤️ Cardio" },
                { key: "sports",    label: "🏅 Sports" },
                { key: "wellness",  label: "🧘 Wellness" },
                { key: "lifestyle", label: "🏠 Lifestyle" },
              ] as const).map(tab => {
                const isActive = selectedTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                    onPress={() => {
                      setSelectedTab(tab.key as typeof selectedTab);
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Activity Grid — MaterialCommunityIcons (Change 4) */}
          {getFilteredActivities().length === 0 ? (
            <Text style={styles.noResultsText}>No activities found for "{searchQuery}"</Text>
          ) : (
            <View style={styles.sportGrid}>
              {getFilteredActivities().map(s => (
                <ActivityCell
                  key={s.name}
                  name={s.name}
                  isSelected={selectedSport === s.name}
                  onPress={() => {
                    setSelectedSport(selectedSport === s.name ? "" : s.name);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                  }}
                />
              ))}
            </View>
          )}

          {selectedSport === "Other Sport" && (
            <TextInput
              style={[styles.customInput, { marginTop: 12 }]}
              value={customSport}
              onChangeText={setCustomSport}
              placeholder="e.g. Kite surfing, Fencing..."
              placeholderTextColor={MUTED}
            />
          )}
        </View>

        {/* ── Duration + Intensity + Preview + Analyze (Changes 5, 9, 6E) */}
        {selectedSport !== "" && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            {/* Duration (Change 5) */}
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_CHIPS.map(chip => {
                const isActive = customDurationChip === chip;
                const label = chip === "custom" ? "Custom" : `${chip} min`;
                return (
                  <TouchableOpacity
                    key={String(chip)}
                    style={[styles.durChip, isActive && styles.durChipActive]}
                    onPress={() => handleDurationChip(chip)}
                  >
                    <Text style={[styles.durChipText, isActive && { color: "#fff" }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom duration input */}
            {showCustomDuration && (
              <View style={styles.customDurWrap}>
                <TextInput
                  style={[styles.customDurInput, { color: TEXT, borderColor: ACCENT }]}
                  keyboardType="number-pad"
                  placeholder="Enter minutes (1–600)"
                  placeholderTextColor={MUTED}
                  value={customDurationText}
                  onChangeText={handleCustomDurationChange}
                  maxLength={3}
                  autoFocus
                />
                <Text style={[styles.customDurUnit, { color: MUTED }]}>min</Text>
              </View>
            )}

            {/* Intensity */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Intensity</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map(it => (
                <TouchableOpacity key={it.key} style={[styles.intensityCell, intensity === it.key && styles.intensityCellActive]}
                  onPress={() => { setIntensity(it.key); setShowResult(false); }}>
                  <Text style={styles.intensityIcon}>{it.icon}</Text>
                  <Text style={[styles.intensityLabel, intensity === it.key && { color: TEXT }]}>{it.label}</Text>
                  <Text style={styles.intensityDesc}>{it.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Change 9: Live Preview Card — only shown AFTER "Analyze & Log with AI" is tapped */}
            {showResult && previewCalories !== null && (
              <View style={[styles.previewCard, { backgroundColor: ACCENT + "0E", borderColor: ACCENT + "30" }]}>
                <Text style={[styles.previewTitle, { color: ACCENT }]}>Estimated Burn</Text>
                <View style={styles.previewRow}>
                  <View style={styles.previewItem}>
                    <Ionicons name="flame" size={18} color={ACCENT} />
                    <Text style={[styles.previewValue, { color: ACCENT }]}>≈ {previewCalories} kcal</Text>
                  </View>
                  <View style={[styles.previewDivider, { backgroundColor: ACCENT + "25" }]} />
                  <View style={styles.previewItem}>
                    <Ionicons name="timer-outline" size={18} color={BLUE} />
                    <Text style={[styles.previewValue, { color: BLUE }]}>{duration} min</Text>
                  </View>
                  <View style={[styles.previewDivider, { backgroundColor: ACCENT + "25" }]} />
                  <View style={styles.previewItem}>
                    <Ionicons name="trending-up-outline" size={18} color={PURPLE} />
                    <Text style={[styles.previewValue, { color: PURPLE }]}>{intensityLabel[intensity]}</Text>
                  </View>
                </View>
              </View>
            )}

            {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}

            {/* Change 6E/7: Keep AI button exactly as-is, with loading state */}
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: ACCENT, opacity: isAnalyzing ? 0.7 : 1 }]}
              onPress={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing
                ? <PulsingDots />
                : <Ionicons name="sparkles" size={18} color="#fff" />}
              <Text style={styles.analyzeBtnText}>{isAnalyzing ? "Analyzing..." : "Analyze & Log with AI"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Weekly Sports Breakdown ──────────────────────────────────── */}
        {weeklySports.length > 0 && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar" size={18} color={YELLOW} />
              <Text style={styles.cardTitle}>Sports Breakdown This Week</Text>
            </View>
            {weeklySports.map(s => (
              <View key={s.sport} style={styles.weekSportRow}>
                <View style={[styles.weekSportIconWrap, { backgroundColor: ACCENT + "15" }]}>
                  <MaterialCommunityIcons name={getActivityIcon(s.sport)} size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weekSportName}>{s.sport}</Text>
                  <Text style={styles.weekSportSub}>{s.sessions} session{s.sessions !== 1 ? "s" : ""} · {s.totalMins} mins · {s.totalCals} kcal</Text>
                </View>
                <View style={[styles.sessionBadge, { backgroundColor: ACCENT + "22" }]}>
                  <Text style={[styles.sessionBadgeText, { color: ACCENT }]}>{s.sessions}×</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Personal Sport Records ───────────────────────────────────── */}
        {activityLogs.length > 0 && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy" size={18} color={YELLOW} />
              <Text style={styles.cardTitle}>Personal Records</Text>
            </View>
            {favSport && (
              <RecordRow icon="heart" color={PURPLE} label="Favourite Activity" value={`${favSport.sport} (${favSport.sessions}×)`} />
            )}
            {longestSession && (
              <RecordRow icon="timer" color={BLUE} label="Longest Session" value={`${longestSession.sport} · ${longestSession.duration} min`} />
            )}
            {bestCalsBurned && (
              <RecordRow icon="flame" color={ACCENT} label="Most Calories Burned" value={`${bestCalsBurned.caloriesBurned} kcal (${bestCalsBurned.sport})`} />
            )}
            {mostActiveMonth && (
              <RecordRow icon="calendar" color={GREEN} label="Most Active This Month" value={mostActiveMonth.sport} last />
            )}
          </View>
        )}

        {/* ── Change 3: Weekly Activity Summary (replaces AI Coach Coming Soon) */}
        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={18} color={ACCENT} />
            <Text style={styles.cardTitle}>Weekly Activity Summary</Text>
          </View>

          {weeklySports.length === 0 ? (
            <View style={styles.weekSummaryEmpty}>
              <MaterialCommunityIcons name="run-fast" size={36} color={MUTED} style={{ marginBottom: 8 }} />
              <Text style={[styles.weekSummaryEmptyTitle, { color: TEXT }]}>No activities this week</Text>
              <Text style={[styles.weekSummaryEmptySub, { color: MUTED }]}>
                Log your first activity above to see your weekly stats here.
              </Text>
            </View>
          ) : (
            <>
              {/* Summary stats */}
              <View style={styles.weekSummaryStatsRow}>
                <View style={[styles.weekSummaryStat, { backgroundColor: ACCENT + "12" }]}>
                  <Ionicons name="flame" size={16} color={ACCENT} />
                  <Text style={[styles.weekSummaryStatValue, { color: ACCENT }]}>
                    {weeklySports.reduce((s, a) => s + a.totalCals, 0)}
                  </Text>
                  <Text style={[styles.weekSummaryStatLabel, { color: MUTED }]}>kcal burned</Text>
                </View>
                <View style={[styles.weekSummaryStat, { backgroundColor: BLUE + "12" }]}>
                  <Ionicons name="timer-outline" size={16} color={BLUE} />
                  <Text style={[styles.weekSummaryStatValue, { color: BLUE }]}>
                    {weeklySports.reduce((s, a) => s + a.totalMins, 0)}
                  </Text>
                  <Text style={[styles.weekSummaryStatLabel, { color: MUTED }]}>active mins</Text>
                </View>
                <View style={[styles.weekSummaryStat, { backgroundColor: GREEN + "12" }]}>
                  <Ionicons name="repeat-outline" size={16} color={GREEN} />
                  <Text style={[styles.weekSummaryStatValue, { color: GREEN }]}>
                    {weeklySports.reduce((s, a) => s + a.sessions, 0)}
                  </Text>
                  <Text style={[styles.weekSummaryStatLabel, { color: MUTED }]}>sessions</Text>
                </View>
              </View>

              {/* Activity breakdown list */}
              {weeklySports.slice(0, 4).map(s => (
                <View key={s.sport} style={[styles.weekSummaryRow, { borderBottomColor: BORDER }]}>
                  <MaterialCommunityIcons name={getActivityIcon(s.sport)} size={18} color={ACCENT} style={{ width: 24 }} />
                  <Text style={[styles.weekSummaryActivity, { color: TEXT }]}>{s.sport}</Text>
                  <Text style={[styles.weekSummaryMins, { color: MUTED }]}>{s.totalMins} min</Text>
                  <Text style={[styles.weekSummaryCals, { color: ACCENT }]}>{s.totalCals} kcal</Text>
                </View>
              ))}

              {/* Best activity badge */}
              {weeklySports.length > 0 && (
                <View style={[styles.bestActivityBadge, { backgroundColor: YELLOW + "15", borderColor: YELLOW + "40" }]}>
                  <Ionicons name="trophy" size={14} color={YELLOW} />
                  <Text style={[styles.bestActivityText, { color: TEXT }]}>
                    Best this week: <Text style={{ fontWeight: "800" as const, color: YELLOW }}>{weeklySports[0].sport}</Text>
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* ── Sticky Bottom Bar ─────────────────────────────────────────── */}
      <View style={[styles.stickyBottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.stickyLogBtn}
          onPress={() => {
            if (selectedSport) {
              handleAnalyze();
            } else {
              Alert.alert("Select an activity", "Please choose a sport or activity first.");
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.stickyLogBtnText}>
            {loggedTodayCount > 0
              ? `＋ Log Activity (${loggedTodayCount} logged today)`
              : "＋ Log Activity"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      <Toast message={toastMsg} visible={toastVisible} />

      {/* ── Steps Sheet ────────────────────────────────────────────── */}
      <StepsSheet
        visible={stepsSheet}
        onClose={() => { setStepsSheet(false); setStepsInput(""); }}
        value={stepsInput}
        onChange={setStepsInput}
        preview={stepsPreview}
        onLog={handleLogSteps}
      />

      {/* ── AI Loading Sheet (Change 6E/7: preserved exactly) ──────── */}
      <Modal visible={loadingSheet} transparent animationType="slide" onRequestClose={() => setLoadingSheet(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.loadingSheet, { backgroundColor: CARD }]}>
            <View style={styles.handle} />
            <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
              <MaterialCommunityIcons name={activeSportIcon} size={72} color={ACCENT} />
            </Animated.View>
            <Text style={styles.loadingTitle}>Analyzing your {activeSportName || "session"} with AI…</Text>
            <PulsingDots />
            <Text style={styles.loadingSubtext}>Calculating calories, recovery needs & tips</Text>
          </View>
        </View>
      </Modal>

      {/* ── AI Result Sheet ─────────────────────────────────────────── */}
      <Modal visible={resultSheet} transparent animationType="slide" onRequestClose={() => setResultSheet(false)}>
        <View style={styles.sheetOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.resultSheet, { backgroundColor: CARD }]}>
              <View style={styles.handle} />

              {analysis && (
                <>
                  {/* Header */}
                  <View style={styles.resultHeaderRow}>
                    <MaterialCommunityIcons name={activeSportIcon} size={22} color={ACCENT} />
                    <Text style={styles.resultHeader}>
                      {activeSportName} · {duration} min · {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
                    </Text>
                  </View>

                  {/* Calories hero */}
                  <View style={[styles.caloriesHero, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "33" }]}>
                    <Text style={styles.caloriesNum}>≈ {analysis.calories_burned}</Text>
                    <Text style={styles.caloriesLabel}>Estimated Calories Burned</Text>
                    <View style={[styles.zonePill, { backgroundColor: (ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW) + "25", borderColor: (ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW) + "55" }]}>
                      <Text style={[styles.zonePillText, { color: ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW }]}>
                        ❤️ {analysis.heart_rate_zone.charAt(0).toUpperCase() + analysis.heart_rate_zone.slice(1)} Zone
                      </Text>
                    </View>
                  </View>

                  {/* Change 6F: AI-style summary sentence */}
                  {analysis.summary && (
                    <View style={[styles.summaryCard, { backgroundColor: PURPLE + "0E", borderColor: PURPLE + "30" }]}>
                      <Ionicons name="sparkles" size={14} color={PURPLE} />
                      <Text style={[styles.summaryText, { color: TEXT }]}>{analysis.summary}</Text>
                    </View>
                  )}

                  {/* Recovery needs */}
                  <Text style={styles.subTitle}>Recovery Needs</Text>
                  <View style={styles.nutrientRow}>
                    <NutrientCard emoji="💧" label="Hydration" color={BLUE}
                      value={`${analysis.hydration_needed_ml}ml`}
                      sub={`${analysis.hydration_glasses.toFixed(1)} glasses`}
                      onPress={handleTapHydration}
                      tooltip={`Tap to add ${analysis.hydration_glasses.toFixed(1)} glasses to today's water goal. Stay hydrated for optimal recovery!`} />
                    <NutrientCard emoji="🥩" label="Protein" color={ACCENT}
                      value={`+${analysis.protein_needed_g}g`}
                      tooltip={`Good protein sources with ~${analysis.protein_needed_g}g:\n• ${Math.round(analysis.protein_needed_g/30)} chicken breasts\n• ${Math.round(analysis.protein_needed_g/8)} eggs\n• ${Math.round(analysis.protein_needed_g/25)}g of Greek yogurt`} />
                    <NutrientCard emoji="🍚" label="Carbs" color={YELLOW}
                      value={`+${analysis.carbs_needed_g}g`}
                      tooltip={`Good carb sources with ~${analysis.carbs_needed_g}g:\n• ${Math.round(analysis.carbs_needed_g/45)} cups of rice\n• ${Math.round(analysis.carbs_needed_g/27)} bananas\n• ${Math.round(analysis.carbs_needed_g/30)} slices of bread`} />
                  </View>

                  {/* Post-meal suggestion */}
                  <View style={[styles.mealCard, { backgroundColor: GREEN + "12", borderColor: GREEN + "33" }]}>
                    <View style={styles.mealCardHeader}>
                      <Ionicons name="restaurant" size={16} color={GREEN} />
                      <Text style={[styles.mealCardTitle, { color: GREEN }]}>Eat This After Your Session 🍽️</Text>
                    </View>
                    <Text style={styles.mealCardText}>{analysis.post_activity_meal}</Text>
                  </View>

                  {/* Health benefits */}
                  <Text style={styles.subTitle}>Why {activeSportName} Is Great For You</Text>
                  <View style={styles.benefitsRow}>
                    {analysis.health_benefits.map((b, i) => (
                      <View key={i} style={[styles.benefitPill, { backgroundColor: BLUE + "15", borderColor: BLUE + "33" }]}>
                        <Text style={[styles.benefitPillText, { color: BLUE }]}>{b}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Tips */}
                  <Text style={styles.subTitle}>Quick Tips 💡</Text>
                  {analysis.tips.map((t, i) => (
                    <View key={i} style={styles.tipRow}>
                      <Ionicons name="bulb-outline" size={16} color={YELLOW} />
                      <Text style={styles.tipText}>{t}</Text>
                    </View>
                  ))}

                  {/* Recovery time */}
                  <View style={[styles.recoveryFooter, { backgroundColor: PURPLE + "12", borderColor: PURPLE + "22" }]}>
                    <Ionicons name="time-outline" size={14} color={PURPLE} />
                    <Text style={[styles.recoveryText, { color: PURPLE }]}>
                      Rest recommended: {analysis.recovery_time_hours}h before next intense session
                    </Text>
                  </View>

                  {/* Action buttons */}
                  {/* Activity log limit indicator */}
                  {activityLogsRemaining !== null && (
                    <Text style={[styles.limitIndicatorText, activityLogsRemaining === 0 && { color: ACCENT }]}>
                      {activityLogsRemaining > 0
                        ? `✨ ${activityLogsRemaining} free activity log left today`
                        : '📺 Watch an ad to log more activities today'}
                    </Text>
                  )}
                  <TouchableOpacity style={[styles.logBtn, { backgroundColor: ACCENT }]} onPress={handleLogSession}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.logBtnText}>✅ Log This Session</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editLink} onPress={() => setResultSheet(false)}>
                    <Text style={styles.editLinkText}>✏️ Edit Details</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Steps sheet ────────────────────────────────────────────────────────────────
function StepsSheet({ visible, onClose, value, onChange, preview, onLog }: {
  visible: boolean; onClose: () => void; value: string;
  onChange: (v: string) => void;
  preview: { distanceKm: number; caloriesBurned: number; activeMinutes: number; goalPct: number } | null;
  onLog: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BLUE, ACCENT, GREEN } = theme;
  const styles = makeStyles(theme);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[styles.stepsSheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              style={{ width: "100%" }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              <View style={styles.handle} />
              <Text style={styles.stepsSheetTitle}>Log Steps</Text>
              <TextInput style={styles.stepsSheetInput} value={value} onChangeText={onChange}
                keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.MUTED}
                autoFocus selectTextOnFocus />
              <Text style={styles.stepsSheetUnit}>steps</Text>
              {preview && (
                <View style={styles.stepsPreviewRow}>
                  <View style={styles.stepsPreviewCell}>
                    <Text style={[styles.stepsPreviewVal, { color: BLUE }]}>{preview.distanceKm} km</Text>
                    <Text style={styles.stepsPreviewLabel}>Distance</Text>
                  </View>
                  <View style={styles.stepsPreviewCell}>
                    <Text style={[styles.stepsPreviewVal, { color: ACCENT }]}>{preview.caloriesBurned} kcal</Text>
                    <Text style={styles.stepsPreviewLabel}>Calories</Text>
                  </View>
                  <View style={styles.stepsPreviewCell}>
                    <Text style={[styles.stepsPreviewVal, { color: GREEN }]}>{preview.activeMinutes} min</Text>
                    <Text style={styles.stepsPreviewLabel}>Active</Text>
                  </View>
                </View>
              )}
              {preview && (
                <View style={styles.goalProgressBar}>
                  <View style={[styles.goalProgressFill, { width: `${preview.goalPct}%` as any, backgroundColor: GREEN }]} />
                </View>
              )}
              {preview && <Text style={styles.goalProgressText}>{preview.goalPct}% of daily goal (10,000 steps)</Text>}
              <TouchableOpacity style={[styles.logBtn, { backgroundColor: GREEN, marginTop: 16 }]} onPress={onLog}>
                <Text style={styles.logBtnText}>Log Steps</Text>
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Steps stat cell ───────────────────────────────────────────────────────────
function StepsStat({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.stepsStatCell}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.stepsStatVal, { color }]}>{value}</Text>
      <Text style={styles.stepsStatLabel}>{label}</Text>
    </View>
  );
}

// ── Record row ────────────────────────────────────────────────────────────────
function RecordRow({ icon, color, label, value, last }: { icon: string; color: string; label: string; value: string; last?: boolean }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.recordRow, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.recordIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recordLabel}>{label}</Text>
        <Text style={styles.recordValue}>{value}</Text>
      </View>
      <Ionicons name="trophy" size={14} color={theme.YELLOW} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  scrollContent: { padding: 14, gap: 12 },

  // ── Daily stats (real data)
  dailyRow: { flexDirection: "row", gap: 8 },
  dailyStat: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: t.BORDER, borderBottomWidth: 3, paddingVertical: 16 },
  dailyVal: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.5 },
  dailyLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const, textAlign: "center" },

  // ── Change 1: Motivational empty state cards
  motivationalCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingVertical: 18,
    gap: 4,
  },
  motivationalEmoji: { fontSize: 24, marginBottom: 2 },
  motivationalTitle: { fontSize: 12, fontWeight: "800" as const, textAlign: "center" },
  motivationalSub: { fontSize: 10, textAlign: "center", fontWeight: "500" as const },

  // ── Card
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.BORDER },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardEmoji: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, flex: 1 },

  // ── Change 10: Recent activities
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  recentChipText: { fontSize: 13, fontWeight: "600" as const },

  // ── Steps card
  logStepsBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: ACCENT },
  logStepsBtnText: { fontSize: 11, fontWeight: "700" as const, color: ACCENT },
  stepsContent: { flexDirection: "row", alignItems: "center", gap: 20 },
  stepsNum: { fontSize: 20, fontWeight: "800" as const, color: t.TEXT, textAlign: "center" },
  stepsGoalText: { fontSize: 10, color: t.MUTED, textAlign: "center" },
  stepsStats: { flex: 1, gap: 8 },
  stepsStatCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepsStatVal: { fontSize: 14, fontWeight: "700" as const, flex: 1 },
  stepsStatLabel: { fontSize: 11, color: t.MUTED },

  // ── Change 8: Category tabs
  tabsContainer: { gap: 8, paddingBottom: 6 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER },
  tabBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabBtnText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  tabBtnTextActive: { color: "#fff", fontWeight: "700" as const },

  // Limit indicator (activity log)
  limitIndicatorText: { fontSize: 12, color: t.MUTED, fontFamily: 'Inter_400Regular', textAlign: 'center' as const, marginBottom: 8, marginTop: 2 },

  // ── Search bar
  searchBarContainer: { flexDirection: "row", alignItems: "center", backgroundColor: t.CARD2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  searchIcon: { marginRight: 8 },
  searchBarInput: { flex: 1, color: t.TEXT, fontSize: 14, padding: 0 },

  // ── Activity grid
  sportGrid: { flexDirection: "row", flexWrap: "wrap" as const, justifyContent: "space-between" },
  noResultsText: { fontSize: 13, color: t.MUTED, textAlign: "center", paddingVertical: 20 },
  customInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: ACCENT, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.TEXT, marginBottom: 16 },

  // ── Duration & Intensity
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 },
  durationRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  durChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, alignItems: "center" },
  durChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  durChipText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },
  customDurWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 4 },
  customDurInput: {
    flex: 1, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 20, fontWeight: "700" as const, textAlign: "center",
    color: t.TEXT, backgroundColor: t.CARD2,
  },
  customDurUnit: { fontSize: 14, fontWeight: "600" as const },
  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  intensityCell: { flex: 1, alignItems: "center", padding: 10, borderRadius: 14, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, gap: 4 },
  intensityCellActive: { borderColor: ACCENT, backgroundColor: ACCENT + "15" },
  intensityIcon: { fontSize: 20 },
  intensityLabel: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED },
  intensityDesc: { fontSize: 9, color: t.MUTED, textAlign: "center" },

  // ── Change 9: Preview card
  previewCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 10,
    textAlign: "center",
  },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  previewItem: { alignItems: "center", gap: 4, flex: 1 },
  previewValue: { fontSize: 14, fontWeight: "700" as const },
  previewDivider: { width: 1, height: 32, marginHorizontal: 4 },

  // ── Analyze button
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  aiError: { fontSize: 12, color: t.RED, marginBottom: 12, textAlign: "center" },

  // ── Weekly sports breakdown
  weekSportRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER, gap: 10 },
  weekSportIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  weekSportName: { fontSize: 14, fontWeight: "700" as const, color: t.TEXT, marginBottom: 2 },
  weekSportSub: { fontSize: 11, color: t.MUTED },
  sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sessionBadgeText: { fontSize: 12, fontWeight: "700" as const },

  // ── Personal records
  recordRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER, gap: 10 },
  recordIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recordLabel: { fontSize: 11, color: t.MUTED, marginBottom: 2 },
  recordValue: { fontSize: 13, fontWeight: "700" as const, color: t.TEXT },

  // ── Change 3: Weekly summary card
  weekSummaryEmpty: { alignItems: "center", paddingVertical: 24 },
  weekSummaryEmptyTitle: { fontSize: 15, fontWeight: "700" as const, marginBottom: 6 },
  weekSummaryEmptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  weekSummaryStatsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  weekSummaryStat: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4 },
  weekSummaryStatValue: { fontSize: 18, fontWeight: "800" as const, letterSpacing: -0.5 },
  weekSummaryStatLabel: { fontSize: 10, fontWeight: "600" as const, textAlign: "center" },
  weekSummaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, gap: 10 },
  weekSummaryActivity: { flex: 1, fontSize: 13, fontWeight: "600" as const },
  weekSummaryMins: { fontSize: 12, fontWeight: "500" as const, width: 50, textAlign: "right" },
  weekSummaryCals: { fontSize: 12, fontWeight: "700" as const, width: 60, textAlign: "right" },
  bestActivityBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  bestActivityText: { fontSize: 13, fontWeight: "600" as const },

  // ── Loading sheet
  sheetOverlay: { flex: 1, backgroundColor: t.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  loadingSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 32, alignItems: "center", gap: 12 },
  handle: { width: 40, height: 4, backgroundColor: t.isDark ? "#333" : "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  loadingTitle: { fontSize: 18, fontWeight: "700" as const, color: t.TEXT, textAlign: "center" },
  loadingSubtext: { fontSize: 13, color: t.MUTED, textAlign: "center", marginTop: 4 },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },

  // ── Result sheet
  resultSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 0 },
  resultHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 },
  resultHeader: { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, textAlign: "center", flex: 1 },
  caloriesHero: { borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, marginBottom: 12 },
  caloriesNum: { fontSize: 56, fontWeight: "800" as const, color: ACCENT, letterSpacing: -2 },
  caloriesLabel: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const, marginBottom: 8 },
  zonePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  zonePillText: { fontSize: 12, fontWeight: "700" as const },

  // Change 6F: Summary sentence
  summaryCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 14 },
  summaryText: { flex: 1, fontSize: 13, lineHeight: 20, fontStyle: "italic" as const },

  subTitle: { fontSize: 13, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  nutrientRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  nutrientCard: { borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  nutrientEmoji: { fontSize: 20 },
  nutrientValue: { fontSize: 16, fontWeight: "800" as const },
  nutrientSub: { fontSize: 9, color: t.MUTED },
  nutrientLabel: { fontSize: 9, color: t.MUTED, fontWeight: "600" as const, textAlign: "center" },
  mealCard: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12 },
  mealCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  mealCardTitle: { fontSize: 13, fontWeight: "700" as const },
  mealCardText: { fontSize: 13, color: t.TEXT, lineHeight: 20 },
  benefitsRow: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 },
  benefitPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  benefitPillText: { fontSize: 12, fontWeight: "600" as const },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  tipText: { flex: 1, fontSize: 13, color: t.TEXT, lineHeight: 20 },
  recoveryFooter: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 16, marginTop: 4 },
  recoveryText: { fontSize: 12, fontWeight: "600" as const, flex: 1 },
  logBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  logBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  editLink: { alignItems: "center", paddingVertical: 12 },
  editLinkText: { fontSize: 14, color: t.MUTED },

  // ── Tooltip
  tipOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  tipBox: { borderRadius: 18, padding: 20, maxWidth: 300, borderWidth: 1, alignItems: "center", gap: 14 },
  tipBoxText: { fontSize: 13, color: t.TEXT, textAlign: "center", lineHeight: 20 },
  tipBoxBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  tipBoxBtnText: { color: "#fff", fontWeight: "700" as const },

  // ── Steps sheet
  stepsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, alignItems: "center", width: "100%" },
  stepsSheetTitle: { fontSize: 20, fontWeight: "700" as const, color: t.TEXT, marginBottom: 20 },
  stepsSheetInput: { fontSize: 56, fontWeight: "800" as const, color: t.TEXT, textAlign: "center", letterSpacing: -2, marginBottom: 4, width: "100%" },
  stepsSheetUnit: { fontSize: 14, color: t.MUTED, marginBottom: 20 },
  stepsPreviewRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  stepsPreviewCell: { alignItems: "center", gap: 2 },
  stepsPreviewVal: { fontSize: 16, fontWeight: "700" as const },
  stepsPreviewLabel: { fontSize: 10, color: t.MUTED },
  goalProgressBar: { width: "100%", height: 6, backgroundColor: t.BORDER, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  goalProgressFill: { height: 6, borderRadius: 3 },
  goalProgressText: { fontSize: 11, color: t.MUTED, marginBottom: 4 },

  // ── Toast
  toast: {
    position: "absolute" as const, bottom: 90, left: 20, right: 20,
    backgroundColor: t.CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.BLUE + "44",
    alignItems: "center", zIndex: 100,
  },
  toastText: { fontSize: 13, fontWeight: "600" as const, color: t.TEXT, textAlign: "center" },

  // ── Sticky bottom bar
  stickyBottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: t.BG, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.BORDER, zIndex: 10 },
  stickyLogBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  stickyLogBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" as const },
});
