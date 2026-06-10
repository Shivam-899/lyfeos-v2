import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import {
  ActivityAnalysis,
  analyzeActivity,
  calculateSteps,
} from "@/utils/analyzeActivity";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { BlurView } from "expo-blur";
import { getLocalDateString } from "@/utils/date";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT  = "#FF6B35";
const PURPLE  = "#8B5CF6";

// ── Sport definitions ─────────────────────────────────────────────────────────
const SPORTS_GAMES = [
  { emoji: "🏸", name: "Badminton" },  { emoji: "🎾", name: "Tennis" },
  { emoji: "⚽", name: "Football" },   { emoji: "🏀", name: "Basketball" },
  { emoji: "🏏", name: "Cricket" },   { emoji: "🏐", name: "Volleyball" },
  { emoji: "🏊", name: "Swimming" },  { emoji: "🚴", name: "Cycling" },
  { emoji: "🥊", name: "Boxing" },    { emoji: "🤸", name: "Gymnastics" },
  { emoji: "⛳", name: "Golf" },      { emoji: "🏓", name: "Table Tennis" },
  { emoji: "🥋", name: "Martial Arts" }, { emoji: "🏉", name: "Rugby" },
  { emoji: "🎿", name: "Skiing" },    { emoji: "🧗", name: "Rock Climbing" },
  { emoji: "➕", name: "Other Sport" },
];

const DAILY_MOVEMENT = [
  { emoji: "👣", name: "Steps" },   { emoji: "🚶", name: "Walking" },
  { emoji: "🏃", name: "Running" }, { emoji: "🧹", name: "Household Chores" },
  { emoji: "🛒", name: "Shopping" }, { emoji: "🐕", name: "Dog Walking" },
];

const MIND_RECOVERY = [
  { emoji: "🧘", name: "Yoga" },    { emoji: "🧠", name: "Meditation" },
  { emoji: "😴", name: "Rest Day" }, { emoji: "🧊", name: "Ice Bath" },
  { emoji: "🤸", name: "Stretching" },
];

const ALL_SPORTS = [...SPORTS_GAMES, ...DAILY_MOVEMENT, ...MIND_RECOVERY];

const POPULAR_ACTIVITIES = [
  { emoji: "🏃", name: "Running" },
  { emoji: "🚶", name: "Walking" },
  { emoji: "🧘", name: "Yoga" },
  { emoji: "🤸", name: "Stretching" },
  { emoji: "🏸", name: "Badminton" },
  { emoji: "🏊", name: "Swimming" },
  { emoji: "🚴", name: "Cycling" },
  { emoji: "👣", name: "Steps" },
];

const INTENSITIES = [
  { key: "light",    label: "Light",    icon: "🟢", desc: "Easy, conversational pace" },
  { key: "moderate", label: "Moderate", icon: "🟡", desc: "Elevated heart rate" },
  { key: "intense",  label: "Intense",  icon: "🔴", desc: "Maximum effort, sweating" },
] as const;

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120];

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

// ── Pulsing loading indicator ─────────────────────────────────────────────────
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

// SportSection has been replaced by the horizontal tab category switcher & grid layout inChoose Activity card

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
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<"light" | "moderate" | "intense">("moderate");
  const [customSport, setCustomSport] = useState("");

  // ── Search & Filter Tabs ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "sports" | "movement" | "mind">("all");
  const [searchLayoutY, setSearchLayoutY] = useState(0);

  const getFilteredActivities = () => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      return ALL_SPORTS.filter(s => s.name.toLowerCase().includes(query));
    }
    switch (selectedTab) {
      case "sports":
        return SPORTS_GAMES;
      case "movement":
        return DAILY_MOVEMENT;
      case "mind":
        return MIND_RECOVERY;
      case "all":
      default:
        return POPULAR_ACTIVITIES;
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

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Insight ────────────────────────────────────────────────────────────────
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Pulse anim for loading screen ─────────────────────────────────────────
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (loadingSheet) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])).start();
    }
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

  const activeSportName = selectedSport === "Other Sport" ? (customSport.trim() || "Other Sport") : selectedSport;
  const activeSportEmoji = selectedSport === "Other Sport" ? "🏅" : selectedEmoji;

  // ── Handle Analyze & Log ───────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!activeSportName) { Alert.alert("Select an activity", "Please choose a sport or activity first."); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiError("");
    setAnalysis(null);
    setLoadingSheet(true);
    try {
      const result = await analyzeActivity(activeSportName, duration, intensity, weight, age);
      setAnalysis(result);
      setLoadingSheet(false);
      setResultSheet(true);
    } catch (e: any) {
      setLoadingSheet(false);
      setAiError(e?.message?.includes("abort") ? "Analysis took too long. You can still log manually." : "Something went wrong. Please try again.");
    }
  };

  // ── Handle Log This Session ────────────────────────────────────────────────
  const handleLogSession = () => {
    if (!analysis) return;
    const log = {
      date: today,
      sport: activeSportName,
      emoji: activeSportEmoji,
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
    setPostActivityBanner({ sport: activeSportName, emoji: activeSportEmoji, meal: analysis.post_activity_meal, loggedAt: Date.now() });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResultSheet(false);
    setSelectedSport("");
    setSelectedEmoji("");
    showToast(`💧 Added ${analysis.hydration_glasses.toFixed(1)} glasses to your water goal based on ${activeSportName}`);
  };

  // ── Tap hydration card ─────────────────────────────────────────────────────
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

  const handleGenerateInsight = async () => {
    // Disabled - AI Coach coming soon
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const loggedTodayCount = activityLogs.filter(log => log.date === today).length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* ── Daily Stats Row ──────────────────────────────────────── */}
        <View style={styles.dailyRow}>
          <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomWidth: 3, borderBottomColor: ACCENT, paddingVertical: 16 }]}>
            <Ionicons name="flame" size={18} color={ACCENT} />
            <Text style={[styles.dailyVal, { color: ACCENT }]}>{todayCalsBurned}</Text>
            <Text style={styles.dailyLabel}>kcal burned</Text>
          </View>
          <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomWidth: 3, borderBottomColor: BLUE, paddingVertical: 16 }]}>
            <Ionicons name="timer-outline" size={18} color={BLUE} />
            <Text style={[styles.dailyVal, { color: BLUE }]}>{todayActiveMinutes}</Text>
            <Text style={styles.dailyLabel}>active mins</Text>
          </View>
          <View style={[styles.dailyStat, { backgroundColor: CARD, borderBottomWidth: 3, borderBottomColor: GREEN, paddingVertical: 16 }]}>
            <Ionicons name="footsteps-outline" size={18} color={GREEN} />
            <Text style={[styles.dailyVal, { color: GREEN }]}>{(stepsToday?.steps ?? 0).toLocaleString()}</Text>
            <Text style={styles.dailyLabel}>steps today</Text>
          </View>
        </View>

        {/* ── Steps Tracker Card ───────────────────────────────────── */}
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

        {/* ── Activity Type Picker (Choose Activity Redesign) ──────── */}
        <View
          style={[styles.card, { backgroundColor: CARD }]}
          onLayout={(e) => setSearchLayoutY(e.nativeEvent.layout.y)}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="fitness" size={18} color={ACCENT} />
            <Text style={styles.cardTitle}>Choose Activity</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={16} color={MUTED} style={styles.searchIcon} />
            <TextInput
              style={styles.searchBarInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search any activity or sport..."
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

          {/* Category Tabs */}
          {searchQuery.trim().length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
              style={{ marginBottom: 12 }}
            >
              {(["all", "sports", "movement", "mind"] as const).map(tab => {
                const isActive = selectedTab === tab;
                const label = tab === "all" ? "⭐ All" : tab === "sports" ? "🏅 Sports" : tab === "movement" ? "🚶 Movement" : "🧘 Mind";
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                    onPress={() => {
                      setSelectedTab(tab);
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Grid Layout */}
          {getFilteredActivities().length === 0 ? (
            <Text style={styles.noResultsText}>No activities found for "{searchQuery}"</Text>
          ) : (
            <View style={styles.sportGrid}>
              {getFilteredActivities().map(s => {
                const isSelected = selectedSport === s.name;
                return (
                  <TouchableOpacity
                    key={s.name}
                    style={[styles.sportCell, isSelected && styles.sportCellSelected]}
                    onPress={() => {
                      if (selectedSport === s.name) {
                        setSelectedSport("");
                        setSelectedEmoji("");
                      } else {
                        setSelectedSport(s.name);
                        setSelectedEmoji(s.emoji);
                      }
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                  >
                    <Text style={styles.sportEmoji}>{s.emoji}</Text>
                    <Text style={styles.sportLabel} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedSport === "Other Sport" && (
            <TextInput
              style={[styles.customInput, { marginTop: 12 }]}
              value={customSport}
              onChangeText={setCustomSport}
              placeholder="e.g. Kite surfing, Fencing..."
              placeholderTextColor={MUTED}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: searchLayoutY + 120, animated: true });
                }, 150);
              }}
            />
          )}
        </View>

        {/* ── Duration + Intensity ─────────────────────────────────── */}
        {selectedSport !== "" && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <Text style={styles.sectionLabel}>Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {DURATIONS.map(d => (
                <TouchableOpacity key={d} style={[styles.durChip, duration === d && styles.durChipActive]} onPress={() => setDuration(d)}>
                  <Text style={[styles.durChipText, duration === d && { color: "#fff" }]}>{d} min</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Intensity</Text>
            <View style={styles.intensityRow}>
              {INTENSITIES.map(it => (
                <TouchableOpacity key={it.key} style={[styles.intensityCell, intensity === it.key && styles.intensityCellActive]}
                  onPress={() => setIntensity(it.key)}>
                  <Text style={styles.intensityIcon}>{it.icon}</Text>
                  <Text style={[styles.intensityLabel, intensity === it.key && { color: TEXT }]}>{it.label}</Text>
                  <Text style={styles.intensityDesc}>{it.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}

            <TouchableOpacity style={[styles.analyzeBtn, { backgroundColor: ACCENT }]} onPress={handleAnalyze}>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.analyzeBtnText}>Analyze & Log with AI</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Weekly Sports Breakdown ──────────────────────────────── */}
        {weeklySports.length > 0 && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar" size={18} color={YELLOW} />
              <Text style={styles.cardTitle}>Sports Breakdown This Week</Text>
            </View>
            {weeklySports.map(s => (
              <View key={s.sport} style={styles.weekSportRow}>
                <Text style={styles.weekSportEmoji}>{s.emoji}</Text>
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

        {/* ── Personal Sport Records ───────────────────────────────── */}
        {activityLogs.length > 0 && (
          <View style={[styles.card, { backgroundColor: CARD }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy" size={18} color={YELLOW} />
              <Text style={styles.cardTitle}>Personal Records</Text>
            </View>
            {favSport && (
              <RecordRow icon="heart" color={PURPLE} label="Favourite Sport" value={`${favSport.emoji} ${favSport.sport} (${favSport.sessions}×)`} />
            )}
            {longestSession && (
              <RecordRow icon="timer" color={BLUE} label="Longest Session" value={`${longestSession.emoji} ${longestSession.sport} · ${longestSession.duration} min`} />
            )}
            {bestCalsBurned && (
              <RecordRow icon="flame" color={ACCENT} label="Most Calories Burned" value={`${bestCalsBurned.caloriesBurned} kcal (${bestCalsBurned.emoji} ${bestCalsBurned.sport})`} />
            )}
            {mostActiveMonth && (
              <RecordRow icon="calendar" color={GREEN} label="Most Active This Month" value={`${mostActiveMonth.emoji} ${mostActiveMonth.sport}`} last />
            )}
          </View>
        )}

        {/* ── Weekly Coach Insight Redesign ────────────────────────── */}
        <LinearGradient
          colors={["#FF6B35", "#FF6B3533"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, padding: 1, marginBottom: 8 }}
        >
          <View style={[styles.card, { backgroundColor: CARD2, borderWidth: 0, overflow: "hidden" }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="flash" size={18} color={ACCENT} />
              <Text style={styles.cardTitle}>Your Weekly Coach Insight</Text>
            </View>
            {weeklyCoachInsight ? (
              <View style={[styles.insightBox, { backgroundColor: "#FF6B3512", borderColor: "#FF6B3533" }]}>
                <Text style={styles.insightText}>{weeklyCoachInsight.text}</Text>
                <Text style={styles.insightDate}>Generated {weeklyCoachInsight.generatedAt}</Text>
              </View>
            ) : (
              <View style={styles.insightEmpty}>
                <Text style={styles.insightEmptyText}>Log activities this week to receive a personalized coaching insight.</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.insightBtn, { borderColor: ACCENT, backgroundColor: ACCENT }]}
              onPress={handleGenerateInsight}
              disabled={true}
            >
              {insightLoading ? (
                <Text style={[styles.insightBtnText, { color: "#fff" }]}>Generating...</Text>
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text style={[styles.insightBtnText, { color: "#fff" }]}>
                    {weeklyCoachInsight ? "Refresh Insight" : "Get Coach Insight"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Absolute Blur Overlay */}
            <View style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", zIndex: 10 }]}>
              <BlurView
                intensity={Platform.OS === "web" ? 75 : 35}
                tint={theme.isDark ? "dark" : "light"}
                style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center", padding: 16 }]}
              >
                <Ionicons name="sparkles" size={32} color={ACCENT} style={{ marginBottom: 8 }} />
                <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
                  🤖 AI Coach Coming Soon!
                </Text>
                <Text style={{ color: SUBTEXT, fontSize: 13, textAlign: "center" }}>
                  Get ready for personalized, AI-powered health and fitness advice.
                </Text>
              </BlurView>
            </View>
          </View>
        </LinearGradient>

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

      {/* ── AI Loading Sheet ────────────────────────────────────────── */}
      <Modal visible={loadingSheet} transparent animationType="slide" onRequestClose={() => setLoadingSheet(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.loadingSheet, { backgroundColor: CARD }]}>
            <View style={styles.handle} />
            <Animated.Text style={[styles.loadingEmoji, { transform: [{ scale: pulseAnim }] }]}>
              {activeSportEmoji || "🏅"}
            </Animated.Text>
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
                  <Text style={styles.resultHeader}>
                    {activeSportEmoji} {activeSportName} · {duration} min · {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
                  </Text>

                  {/* Calories hero card */}
                  <View style={[styles.caloriesHero, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "33" }]}>
                    <Text style={styles.caloriesNum}>{analysis.calories_burned}</Text>
                    <Text style={styles.caloriesLabel}>Calories Burned</Text>
                    <View style={[styles.zonePill, { backgroundColor: (ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW) + "25", borderColor: (ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW) + "55" }]}>
                      <Text style={[styles.zonePillText, { color: ZONE_COLORS[analysis.heart_rate_zone] ?? YELLOW }]}>
                        ❤️ {analysis.heart_rate_zone.charAt(0).toUpperCase() + analysis.heart_rate_zone.slice(1)} Zone
                      </Text>
                    </View>
                  </View>

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

  // Daily stats
  dailyRow: { flexDirection: "row", gap: 8 },
  dailyStat: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: t.BORDER },
  dailyVal: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.5 },
  dailyLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const, textAlign: "center" },

  // Card
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.BORDER },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardEmoji: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, flex: 1 },

  // Steps card
  logStepsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "transparent",
  },
  logStepsBtnText: { fontSize: 11, fontWeight: "700" as const, color: ACCENT },
  stepsContent: { flexDirection: "row", alignItems: "center", gap: 20 },
  stepsNum: { fontSize: 20, fontWeight: "800" as const, color: t.TEXT, textAlign: "center" },
  stepsGoalText: { fontSize: 10, color: t.MUTED, textAlign: "center" },
  stepsStats: { flex: 1, gap: 8 },
  stepsStatCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepsStatVal: { fontSize: 14, fontWeight: "700" as const, flex: 1 },
  stepsStatLabel: { fontSize: 11, color: t.MUTED },

  // Redesigned Category switcher, search, and grid styles
  tabsContainer: { gap: 8, paddingBottom: 6 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER },
  tabBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabBtnText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  tabBtnTextActive: { color: "#fff", fontWeight: "700" as const },
  searchBarContainer: { flexDirection: "row", alignItems: "center", backgroundColor: t.CARD2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  searchIcon: { marginRight: 8 },
  searchBarInput: { flex: 1, color: t.TEXT, fontSize: 14, padding: 0 },
  sportGrid: { flexDirection: "row", flexWrap: "wrap" as const, justifyContent: "space-between" },
  sportCell: { width: "23.5%", aspectRatio: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.CARD, borderRadius: 12, padding: 4, borderWidth: 1.2, borderColor: "transparent", marginBottom: 8 },
  sportCellSelected: { borderColor: ACCENT, backgroundColor: "#FF6B3512" },
  sportEmoji: { fontSize: 32, marginBottom: 4 },
  sportLabel: { fontSize: 11, fontWeight: "600" as const, color: t.TEXT, textAlign: "center" },
  noResultsText: { fontSize: 13, color: t.MUTED, textAlign: "center", paddingVertical: 20 },
  customInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: ACCENT, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: t.TEXT, marginBottom: 16 },

  // Duration & Intensity
  sectionLabel: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 },
  durChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER },
  durChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  durChipText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },
  intensityRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  intensityCell: { flex: 1, alignItems: "center", padding: 10, borderRadius: 14, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, gap: 4 },
  intensityCellActive: { borderColor: ACCENT, backgroundColor: ACCENT + "15" },
  intensityIcon: { fontSize: 20 },
  intensityLabel: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED },
  intensityDesc: { fontSize: 9, color: t.MUTED, textAlign: "center" },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  aiError: { fontSize: 12, color: t.RED, marginBottom: 12, textAlign: "center" },

  // Weekly sports
  weekSportRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER, gap: 10 },
  weekSportEmoji: { fontSize: 24 },
  weekSportName: { fontSize: 14, fontWeight: "700" as const, color: t.TEXT, marginBottom: 2 },
  weekSportSub: { fontSize: 11, color: t.MUTED },
  sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sessionBadgeText: { fontSize: 12, fontWeight: "700" as const },

  // Personal records
  recordRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER, gap: 10 },
  recordIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recordLabel: { fontSize: 11, color: t.MUTED, marginBottom: 2 },
  recordValue: { fontSize: 13, fontWeight: "700" as const, color: t.TEXT },

  // Coach insight
  coachIcon: { fontSize: 18 },
  insightBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 12 },
  insightText: { fontSize: 14, color: t.TEXT, lineHeight: 22 },
  insightDate: { fontSize: 10, color: t.MUTED, marginTop: 6 },
  insightEmpty: { padding: 14, alignItems: "center", marginBottom: 12 },
  insightEmptyText: { fontSize: 13, color: t.MUTED, textAlign: "center", lineHeight: 20 },
  insightBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  insightBtnText: { fontSize: 14, fontWeight: "700" as const },

  // Loading sheet
  sheetOverlay: { flex: 1, backgroundColor: t.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  loadingSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 32, alignItems: "center", gap: 12 },
  handle: { width: 40, height: 4, backgroundColor: t.isDark ? "#333" : "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  loadingEmoji: { fontSize: 72, marginBottom: 4 },
  loadingTitle: { fontSize: 18, fontWeight: "700" as const, color: t.TEXT, textAlign: "center" },
  loadingSubtext: { fontSize: 13, color: t.MUTED, textAlign: "center", marginTop: 4 },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },

  // Result sheet
  resultSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 0 },
  resultHeader: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, textAlign: "center", marginBottom: 16 },
  caloriesHero: { borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, marginBottom: 16 },
  caloriesNum: { fontSize: 56, fontWeight: "800" as const, color: ACCENT, letterSpacing: -2 },
  caloriesLabel: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const, marginBottom: 8 },
  zonePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  zonePillText: { fontSize: 12, fontWeight: "700" as const },
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

  // Tooltip
  tipOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  tipBox: { borderRadius: 18, padding: 20, maxWidth: 300, borderWidth: 1, alignItems: "center", gap: 14 },
  tipBoxText: { fontSize: 13, color: t.TEXT, textAlign: "center", lineHeight: 20 },
  tipBoxBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  tipBoxBtnText: { color: "#fff", fontWeight: "700" as const },

  // Steps sheet
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

  // Toast
  toast: {
    position: "absolute" as const, bottom: 90, left: 20, right: 20,
    backgroundColor: t.CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.BLUE + "44",
    alignItems: "center", zIndex: 100,
  },
  toastText: { fontSize: 13, fontWeight: "600" as const, color: t.TEXT, textAlign: "center" },

  // Sticky bottom bar
  stickyBottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: t.BG, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.BORDER, zIndex: 10 },
  stickyLogBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  stickyLogBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" as const },
});
