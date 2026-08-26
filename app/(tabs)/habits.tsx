import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { logScreen } from "@/utils/analytics";
import { AD_UNIT_IDS, BannerAd, BannerAdSize, setInterstitialBlocked } from "@/utils/ads";
import { StatusBar } from "expo-status-bar";
import {
  Animated,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddHabitSheet } from "@/components/AddHabitSheet";
import { ActivityTracker } from "@/components/ActivityTracker";
import { CalendarStrip } from "@/components/CalendarStrip";
import { HabitTile } from "@/components/HabitTile";
import { Habit, useHabits } from "@/context/HabitsContext";
import { useActivity } from "@/context/ActivityContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { useLocalSearchParams } from "expo-router";
import { getLocalDateString } from "@/utils/date";


// ── Constants ────────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";

const CATEGORIES = ["All", "Health", "Fitness", "Mind", "Sleep", "Custom"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_EMOJIS: Record<string, Category> = {
  // Health
  "💊": "Health", "💧": "Health", "🍎": "Health", "☕": "Health",
  "🥗": "Health", "🥦": "Health", "😴": "Health", "🩺": "Health",
  "🌡️": "Health", "🫀": "Health", "🧬": "Health", "🍵": "Health", "🫁": "Health",
  // Fitness
  "🏃": "Fitness", "💪": "Fitness", "🎯": "Fitness",
  "🏋️": "Fitness", "🚴": "Fitness", "🏊": "Fitness", "🤸": "Fitness",
  "⚽": "Fitness", "🎾": "Fitness", "🏸": "Fitness", "🥊": "Fitness",
  "🧗": "Fitness", "🏅": "Fitness",
  // Mind
  "📚": "Mind", "🧘": "Mind", "🎨": "Mind", "🎵": "Mind", "🌿": "Mind",
  "🧠": "Mind", "📝": "Mind", "💡": "Mind", "🧩": "Mind",
  "🎭": "Mind", "🎲": "Mind", "🔬": "Mind",
  // Sleep / Lifestyle
  "🌙": "Sleep", "🌅": "Sleep",
};

function habitCategory(h: Habit): Category {
  return CATEGORY_EMOJIS[h.emoji] ?? "Custom";
}

const QUICK_HABITS = [
  { emoji: "💧", name: "Drink Water", colorId: "blue", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "🚶", name: "Daily Walk", colorId: "green", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "📚", name: "Read 10 Min", colorId: "purple", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "🧘", name: "Meditation", colorId: "teal", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "🏃", name: "Morning Run", colorId: "orange", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "✍️", name: "Journal", colorId: "pink", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "📵", name: "No Social Media", colorId: "red", weekDays: [0, 1, 2, 3, 4, 5, 6] },
  { emoji: "⏰", name: "Wake Up Early", colorId: "yellow", weekDays: [0, 1, 2, 3, 4, 5, 6] },
];

// ── Weekly Summary ────────────────────────────────────────────────────────────
function WeeklySummary({ habits, getHabitLog }: {
  habits: Habit[];
  getHabitLog: (id: string, date: string) => { completed?: boolean } | undefined;
}) {
  const theme = useAppTheme();
  const { GREEN } = theme;
  const styles = makeStyles(theme);
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const bars = days.map((d) => {
    const dateStr = getLocalDateString(d);
    const wd = d.getDay();
    const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
    if (dayHabits.length === 0) return { d, pct: 0 };
    const done = dayHabits.filter((h) => getHabitLog(h.id, dateStr)?.completed).length;
    return { d, pct: done / dayHabits.length };
  });

  const bestIdx = bars.reduce((bi, b, i) => (b.pct > bars[bi].pct ? i : bi), 0);
  const hasSomeData = bars.some((b) => b.pct > 0);

  // Fixed bar height in pixels (60px track). Percentage strings don't work in RN
  // when parent uses flex:1. Convert to pixel value.
  const TRACK_HEIGHT = 60;

  return (
    <View style={styles.weekCard}>
      <Text style={styles.weekTitle}>This Week</Text>
      {!hasSomeData ? (
        <Text style={styles.weekEmpty}>Complete habits to see your weekly progress here ✨</Text>
      ) : (
        <View style={[styles.barsRow, { height: TRACK_HEIGHT + 20 }]}>
          {bars.map((b, i) => {
            const isToday = i === 6;
            const fillH = Math.round(Math.max(b.pct * TRACK_HEIGHT, b.pct > 0 ? 6 : 0));
            return (
              <View key={i} style={styles.barItem}>
                <View style={[styles.barTrack, { height: TRACK_HEIGHT }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: fillH,
                        backgroundColor: isToday ? ACCENT : b.pct === 1 ? GREEN : ACCENT + "88",
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barDayLabel, isToday && { color: ACCENT }]}>
                  {DAY_NAMES[b.d.getDay()].slice(0, 1)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      {hasSomeData && (
        <Text style={styles.weekBest}>
          Your best day was {DAY_NAMES[bars[bestIdx].d.getDay()]} 🏆
        </Text>
      )}
    </View>
  );
}

// ── Celebration Overlay ───────────────────────────────────────────────────────
function CelebrationOverlay({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      // Reset opacity when hidden so it's ready for next show
      opacity.setValue(0);
    }
  }, [visible]);

  // Bug 14 fix: don't early-return null — that unmounts the component and kills
  // the fade-out animation mid-flight. Always render; control via opacity only.
  return (
    <Animated.View style={[styles.celebOverlay, { opacity }]} pointerEvents="none">
      <Text style={styles.celebEmoji}>🎉</Text>
      <Text style={styles.celebTitle}>Perfect Day!</Text>
      <Text style={styles.celebSub}>All habits done!</Text>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HabitsScreen() {
  const [adLoaded, setAdLoaded] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, MUTED, BORDER, GREEN, TEXT: WHITE, isDark } = theme;
  const styles = makeStyles(theme);
  const { habits, addHabit, getHabitsForDate, getHabitLog, getStreak } = useHabits();

  // Earliest habit creation date for CalendarStrip back-nav limit
  const earliestCreatedAt = habits.length > 0
    ? habits.reduce((earliest, h) => h.createdAt < earliest ? h.createdAt : earliest, habits[0].createdAt)
    : undefined;

  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"rituals" | "activity">("rituals");

  // Screen tracking (analytics)
  useEffect(() => {
    logScreen("Habits");
  }, []);

  useEffect(() => {
    if (tab === "activity") {
      setActiveTab("activity");
    } else if (tab === "rituals") {
      setActiveTab("rituals");
    }
  }, [tab]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [quickTemplate, setQuickTemplate] = useState<{ name: string, emoji: string, colorId: string } | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const [showCelebration, setShowCelebration] = useState(false);

  const dateStr = getLocalDateString(selectedDate);
  const weekDay = selectedDate.getDay();
  const todayHabits = getHabitsForDate(dateStr, weekDay);
  const todayStr = getLocalDateString();
  const isViewingToday = dateStr === todayStr;

  // Completion stats
  const done = todayHabits.filter((h) => getHabitLog(h.id, dateStr)?.completed).length;
  const total = todayHabits.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  // Overall streak (max across all habits)
  const maxStreak = habits.reduce((max, h) => {
    const s = getStreak(h.id).current;
    return s > max ? s : max;
  }, 0);

  // Fix #6: block interstitial ads while the Add Habit form is open so a
  // delayed ad (home-screen 120 s timer or habit-completion counter) cannot
  // interrupt the user mid-flow. Clear the flag on close and on unmount.
  useEffect(() => {
    setInterstitialBlocked(showAddSheet);
    return () => { if (showAddSheet) setInterstitialBlocked(false); };
  }, [showAddSheet]);

  // Watch for "all done" on today
  const prevAllDone = useRef(false);
  useEffect(() => {
    if (isViewingToday && allDone && !prevAllDone.current) {
      setShowCelebration(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => setShowCelebration(false), 2200);
      return () => clearTimeout(t);
    }
    prevAllDone.current = allDone;
  }, [allDone, isViewingToday]);

  // Filter by category
  const filteredHabits =
    selectedCategory === "All"
      ? todayHabits
      : todayHabits.filter((h) => habitCategory(h) === selectedCategory);

  // Sort: incomplete first, complete last
  const sortedHabits = [...filteredHabits].sort((a, b) => {
    const aDone = !!(getHabitLog(a.id, dateStr)?.completed);
    const bDone = !!(getHabitLog(b.id, dateStr)?.completed);
    if (aDone === bDone) return 0;
    return aDone ? 1 : -1;
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleAllDone = () => {
    if (isViewingToday && !prevAllDone.current) {
      setShowCelebration(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setShowCelebration(false), 2200);
    }
  };

  const quickAddHabit = (q: (typeof QUICK_HABITS)[number]) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setQuickTemplate({ name: q.name, emoji: q.emoji, colorId: q.colorId });
    setShowAddSheet(true);
  };

  const { activityLogs, getStepsForDate } = useActivity();
  const hasActivityToday = activityLogs.some((log) => log.date === todayStr) || getStepsForDate(todayStr) !== null;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={BG} />
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: BG }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.screenTitle}>{activeTab === "rituals" ? "Rituals" : "Activity"}</Text>
            {activeTab === "rituals" && maxStreak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={styles.streakText}>{maxStreak} day{maxStreak !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
          {activeTab === "rituals" && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowAddSheet(true);
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sub-tab switcher ─────────────────────────────────────── */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === "rituals" ? styles.tabSwitchBtnActive : styles.tabSwitchBtnUnselected]}
            onPress={() => {
              setActiveTab("rituals");
              if (Platform.OS !== "web") Haptics.selectionAsync();
            }}
          >
            <Text style={[styles.tabSwitchText, activeTab === "rituals" ? styles.tabSwitchTextActive : styles.tabSwitchTextUnselected]}>
              ⭐ Rituals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === "activity" ? styles.tabSwitchBtnActive : styles.tabSwitchBtnUnselected]}
            onPress={() => {
              setActiveTab("activity");
              if (Platform.OS !== "web") Haptics.selectionAsync();
            }}
          >
            <Text style={[styles.tabSwitchText, activeTab === "activity" ? styles.tabSwitchTextActive : styles.tabSwitchTextUnselected]}>
              🏃 Activity
            </Text>
          </TouchableOpacity>
        </View>

        {!hasActivityToday && (
          <Text style={styles.motivationalSubtitle}>
            {getMotivationalSubtitle()}
          </Text>
        )}

        {/* ── Calendar strip (only for rituals tab) ──────────────────── */}
        {activeTab === "rituals" && (
          <CalendarStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            earliestCreatedAt={earliestCreatedAt}
          />
        )}
      </View>

      {/* ── Activity Tab ──────────────────────────────────────────────── */}
      {activeTab === "activity" && <ActivityTracker />}

      {/* ── Rituals Tab ───────────────────────────────────────────────── */}
      {activeTab === "rituals" && (
        <FlatList
          style={{ flex: 1 }}
          data={sortedHabits}
          keyExtractor={(h) => `${h.id}-${dateStr}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          ListHeaderComponent={
            <>
              {/* ── Completion Banner ──────────────────────────────────── */}
              {total > 0 && (
                <View style={[
                  styles.completionCard,
                  allDone && { backgroundColor: "#16a34a22", borderColor: "#22C55E44" },
                ]}>
                  <View style={styles.completionLeft}>
                    {allDone ? (
                      <Text style={styles.completionTitle}>🎉 All done! Perfect day!</Text>
                    ) : done === 0 ? (
                      <>
                        <Text style={styles.completionTitle}>Let's get started 💪</Text>
                        <Text style={styles.completionSub}>{total} habit{total !== 1 ? "s" : ""} scheduled</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.completionTitle}>
                          {done} of {total} habits completed
                        </Text>
                        <Text style={styles.completionSub}>Keep going, you're doing great!</Text>
                      </>
                    )}
                    {/* Progress bar */}
                    <View style={styles.progressBar}>
                      <View style={[
                        styles.progressFill,
                        {
                          width: `${pct}%` as any,
                          backgroundColor: allDone ? GREEN : ACCENT,
                        },
                      ]} />
                    </View>
                  </View>
                  <Text style={[styles.pctText, allDone && { color: GREEN }]}>{pct}%</Text>
                </View>
              )}

              {/* ── Category Filter Chips ──────────────────────────────── */}
              {total > 0 && (
                <FlatList
                  horizontal
                  data={CATEGORIES}
                  keyExtractor={(c) => c}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                  renderItem={({ item: cat }) => (
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        selectedCategory === cat && styles.chipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text style={[
                        styles.chipText,
                        selectedCategory === cat && styles.chipTextActive,
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              {/* Section label */}
              {total > 0 && (
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>
                    {isViewingToday ? "Today" : formatDateLabel(selectedDate)}
                  </Text>
                  {filteredHabits.length > 0 && (
                    <Text style={styles.sectionCount}>{filteredHabits.length} habit{filteredHabits.length !== 1 ? "s" : ""}</Text>
                  )}
                </View>
              )}
            </>
          }
          renderItem={({ item: habit }) => (
            <HabitTile
              key={`${habit.id}-${dateStr}`}
              habit={habit}
              date={dateStr}
              onAllDone={handleAllDone}
              allHabits={todayHabits}
            />
          )}
          ListEmptyComponent={
            total === 0 ? (
              /* ── Full empty state ─────────────────────────────────── */
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>Build your first habit</Text>
                <Text style={styles.emptyDesc}>
                  Small steps lead to big changes.{"\n"}Start with just one habit.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowAddSheet(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>Add Your First Habit</Text>
                </TouchableOpacity>
                <Text style={styles.emptyIdeasLabel}>Need ideas?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChips}>
                  {QUICK_HABITS.map((q) => (
                    <TouchableOpacity
                      key={q.name}
                      style={styles.quickChip}
                      onPress={() => quickAddHabit(q)}
                    >
                      <Text style={styles.quickChipText}>{q.emoji} {q.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              /* ── Category has no habits ───────────────────────────── */
              <View style={styles.emptyCategory}>
                <Text style={styles.emptyCategoryText}>No {selectedCategory} habits today</Text>
                <TouchableOpacity onPress={() => setSelectedCategory("All")}>
                  <Text style={styles.emptyCategoryAction}>Show all</Text>
                </TouchableOpacity>
              </View>
            )
          }
          ListFooterComponent={
            habits.length > 0 ? (
              <WeeklySummary habits={habits} getHabitLog={getHabitLog} />
            ) : null
          }
        />
      )}

      {/* ── Banner Ad ─────────────────────────────────────────────── */}
      {/* BannerAd is always mounted so it persists across tab switches and
          does not trigger a new ad request on every navigation focus.
          The container collapses to height 0 until onAdLoaded fires,
          eliminating the blank placeholder when no ad has filled yet. */}
      <View style={[
        { width: "100%", alignItems: "center", marginBottom: (Platform.OS === "web" ? 84 : 60 + insets.bottom) + (insets.bottom > 0 ? 0 : 4) },
        !adLoaded && { height: 0, overflow: "hidden" },
      ]}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          onAdLoaded={() => { setAdLoaded(true); console.log('✅ Banner Ad Loaded Successfully (Habits Tab)'); }}
          onAdFailedToLoad={(error) => { setAdLoaded(false); console.log('❌ Banner Ad Failed (Habits Tab):', JSON.stringify(error)); }}
        />
      </View>

      <AddHabitSheet
        visible={showAddSheet}
        onClose={() => { setShowAddSheet(false); setQuickTemplate(undefined); }}
        initialName={quickTemplate?.name}
        initialEmoji={quickTemplate?.emoji}
        initialColorId={quickTemplate?.colorId}
      />
      <CelebrationOverlay visible={showCelebration} />
    </View>
  );
}

function getMotivationalSubtitle() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Start your day strong 💪";
  } else if (hour >= 12 && hour < 17) {
    return "Keep the momentum going 🔥";
  } else {
    return "Finish strong tonight 🌙";
  }
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.BG },

  // Header
  header: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  screenTitle: { fontSize: 28, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakFire: { fontSize: 14 },
  streakText: { fontSize: 12, fontWeight: "800" as const, color: "#fff" },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  motivationalSubtitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: t.SUBTEXT,
    textAlign: "center",
    marginBottom: 12,
  },

  // Sub-tab switcher
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: t.CARD2,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: t.BORDER,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 11,
  },
  tabSwitchBtnUnselected: {
    backgroundColor: t.CARD,
  },
  tabSwitchBtnActive: {
    backgroundColor: "#FF6B35",
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabSwitchText: { fontSize: 13, fontWeight: "600" as const },
  tabSwitchTextUnselected: { color: t.TEXT },
  tabSwitchTextActive: { color: "#ffffff", fontWeight: "700" as const },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Completion Banner
  completionCard: {
    backgroundColor: t.CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: t.BORDER,
  },
  completionLeft: { flex: 1 },
  completionTitle: { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 3 },
  completionSub: { fontSize: 12, color: t.MUTED, marginBottom: 8 },
  progressBar: {
    height: 6,
    backgroundColor: t.BORDER,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: { height: 6, borderRadius: 3, minWidth: 4 },
  pctText: { fontSize: 26, fontWeight: "800" as const, color: ACCENT, letterSpacing: -1, flexShrink: 0 },

  // Category chips
  chipsRow: { gap: 8, paddingBottom: 14, paddingTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: t.CARD,
    borderWidth: 1,
    borderColor: t.BORDER,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },
  chipTextActive: { color: "#fff" },

  // Section row
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 17, fontWeight: "700" as const, color: t.TEXT },
  sectionCount: { fontSize: 12, color: t.MUTED, fontWeight: "500" as const },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800" as const, color: t.TEXT, marginBottom: 10, textAlign: "center" },
  emptyDesc: { fontSize: 14, color: t.MUTED, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 28,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyAddBtnText: { fontSize: 16, fontWeight: "700" as const, color: "#fff" },
  emptyIdeasLabel: { fontSize: 13, color: t.MUTED, marginBottom: 12, fontWeight: "600" as const },
  quickChips: { flexDirection: "row", gap: 8 },
  quickChip: {
    backgroundColor: t.CARD,
    borderWidth: 1,
    borderColor: t.BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: { fontSize: 13, color: t.TEXT, fontWeight: "600" as const },

  // Empty category
  emptyCategory: { alignItems: "center", paddingVertical: 24 },
  emptyCategoryText: { fontSize: 14, color: t.MUTED, marginBottom: 8 },
  emptyCategoryAction: { fontSize: 14, color: ACCENT, fontWeight: "600" as const },

  weekCard: {
    backgroundColor: t.CARD,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.BORDER,
  },
  weekTitle: { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 14 },
  weekEmpty: { fontSize: 13, color: t.MUTED, textAlign: "center", paddingVertical: 20, fontWeight: "500" as const },
  barsRow: { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  barItem: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: {
    width: "100%",
    backgroundColor: t.BORDER,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 6 },
  barDayLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const },
  weekBest: { fontSize: 12, color: t.MUTED, marginTop: 12, textAlign: "center", fontWeight: "500" as const },

  // Celebration overlay
  celebOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  celebEmoji: { fontSize: 64, marginBottom: 16 },
  celebTitle: { fontSize: 30, fontWeight: "800" as const, color: t.TEXT, marginBottom: 8 },
  celebSub: { fontSize: 16, color: t.MUTED },
});
