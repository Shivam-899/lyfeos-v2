import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { CircularProgress } from "@/components/CircularProgress";
import { useActivity } from "@/context/ActivityContext";
import { useCalories } from "@/context/CaloriesContext";
import { HABIT_COLORS, useHabits } from "@/context/HabitsContext";
import { useTodos } from "@/context/TodosContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";


// ─── Tiny ring for Activity section ───────────────────────────────────────────
function SmallRing({
  size = 64,
  progress,
  color,
  children,
}: {
  size?: number;
  progress: number;
  color: string;
  children?: React.ReactNode;
}) {
  const { BORDER } = useAppTheme();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        {children}
      </View>
    </View>
  );
}

// ─── 7-day week dots ──────────────────────────────────────────────────────────
function WeekBar({ completed }: { completed: boolean[] }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <View style={styles.weekRow}>
      {days.map((d, i) => (
        <View key={i} style={styles.weekDayCol}>
          <View style={[
            styles.weekDot,
            completed[i] && styles.weekDotDone,
            i === todayIdx && !completed[i] && styles.weekDotToday,
          ]}>
            {completed[i] && <View style={styles.weekDotInner} />}
          </View>
          <Text style={[styles.weekDayLabel, i === todayIdx && { color: "#FF6B35" }]}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Macro progress bar ───────────────────────────────────────────────────────
function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const pct = Math.min((value / (goal || 1)) * 100, 100);
  return (
    <View style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroVal}>{value}g</Text>
    </View>
  );
}

// ─── Pill badge ───────────────────────────────────────────────────────────────
function PillBadge({ icon, label, pct, color }: { icon: string; label: string; pct: number; color: string }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.pill, { backgroundColor: color + "20" }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillPct, { color }]}>{pct}%</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ─── FAB action sheet ─────────────────────────────────────────────────────────
function FabSheet({
  visible,
  onClose,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (key: string) => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const actions = [
    { key: "scan", icon: "camera-outline", label: "Scan Food", color: "#20D9A0" },
    { key: "habit", icon: "star-outline", label: "Add Habit", color: "#FF6B35" },
    { key: "task", icon: "checkmark-circle-outline", label: "Add Task", color: "#8B5CF6" },
    { key: "activity", icon: "fitness-outline", label: "Log Activity", color: "#5BC8FB" },
  ] as const;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.fabOverlay} onPress={onClose}>
        <View style={styles.fabSheet}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.fabAction}
              onPress={() => { onClose(); onAction(a.key); }}
            >
              <View style={[styles.fabActionIcon, { backgroundColor: a.color + "22" }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.fabActionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, GREEN, BLUE, TEXT: WHITE } = theme;
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { habits, getStreak, getCompletionRate, getHabitLog } = useHabits();
  const { todos } = useTodos();
  const { getDayStats, getWaterForDate, dailyGoal } = useCalories();
  const { getDailyActivityCalories, getDailyActivityMinutes } = useActivity();
  const [fabOpen, setFabOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);

  const today = getLocalDateString();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Data ──────────────────────────────────────────────────────────────────
  const todayStats = getDayStats(today);
  const water = getWaterForDate(today);
  const todayWeekDay = new Date().getDay();
  const todayHabits = habits.filter((h) => h.weekDays.includes(todayWeekDay));
  // Real activity data for rings (Bug 10 & 11 fix)
  const activityCals = getDailyActivityCalories(today);
  const activityMins = getDailyActivityMinutes(today);

  const activeTodos = todos.filter((t) => !t.completed);
  // Bug 6 fix: include "urgent" in high-priority filter
  const highPriority = activeTodos.filter((t) => t.priority === "high" || t.priority === "urgent");

  const avgCompletion = habits.length > 0
    ? Math.round(habits.reduce((s, h) => s + getCompletionRate(h.id), 0) / habits.length)
    : 0;

  // streak = best current streak across all habits
  const maxStreak = habits.length > 0
    ? Math.max(...habits.map((h) => getStreak(h.id).current))
    : 0;

  // tasks completion %
  const totalTodos = todos.length;
  const doneTodos = todos.filter((t) => t.completed).length;
  const tasksPct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;

  // nutrition %
  const calPct = Math.round(Math.min((todayStats.calories / (dailyGoal.calories || 1)) * 100, 100));

  const getProgressColor = (pct: number) => {
    if (pct > 80) return "#22C55E";
    if (pct >= 50) return "#EAB308";
    return "#FF6B35";
  };

  // overall progress ring
  const overallPct = habits.length === 0 && totalTodos === 0
    ? 0
    : Math.round((avgCompletion + tasksPct + calPct) / 3);
  const ringColor = getProgressColor(overallPct);

  // 7-day bar: did user complete any habit each day this week?
  const weekDone = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const diff = i - ((dayOfWeek + 6) % 7);
    const date = new Date(d);
    date.setDate(d.getDate() + diff);
    const dateStr = getLocalDateString(date);
    const wd = date.getDay();
    const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
    // Bug 4 fix: check .completed, not just log existence
    return dayHabits.length > 0 && dayHabits.some((h) => !!getHabitLog(h.id, dateStr)?.completed);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning ☀️";
    if (h < 17) return "Good afternoon 🌤";
    return "Good evening 🌙";
  }

  // Bug 2 fix: FAB actions navigate to correct screens
  function handleFabAction(key: string) {
    if (key === "habit") router.push("/(tabs)/habits");
    else if (key === "scan") router.push("/(tabs)/calories");
    else if (key === "task") router.push("/(tabs)/todos");
    else if (key === "activity") router.push("/(tabs)/habits?tab=activity");
  }

  // ── Empty state (brand new user) ─────────────────────────────────────────
  const isNewUser = habits.length === 0 && totalTodos === 0 && todayStats.calories === 0;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.appName}>Dashboard</Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => setNotifSeen(true)}>
            <Ionicons name="notifications-outline" size={22} color={WHITE} />
            {!notifSeen && highPriority.length > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* ── STREAK + 7-DAY BAR ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.streakHeader}>
            {maxStreak > 0 ? (
              <>
                <Text style={styles.streakFire}>🔥</Text>
                <View>
                  <Text style={styles.streakCount}>{maxStreak} Day Streak</Text>
                  <Text style={styles.streakSub}>Keep it up! You're on a roll 💪</Text>
                </View>
              </>
            ) : (
              <Text style={styles.streakEmpty}>Start your streak today 🔥</Text>
            )}
          </View>
          <WeekBar completed={weekDone} />
        </View>

        {/* ── DAILY PROGRESS RING ────────────────────────────────────────── */}
        <View style={[styles.card, styles.ringCard]}>
          <CircularProgress
            size={160}
            progress={overallPct / 100}
            color={ringColor}
            strokeWidth={12}
            backgroundColor="#FF6B3566"
          >
            <Text style={styles.ringPct}>{overallPct}%</Text>
            <Text style={styles.ringLabel}>Today's Progress</Text>
          </CircularProgress>
          <View style={styles.pillRow}>
            <PillBadge icon="✅" label="Habits" pct={avgCompletion} color={getProgressColor(avgCompletion)} />
            <PillBadge icon="📋" label="Tasks" pct={tasksPct} color={getProgressColor(tasksPct)} />
            <PillBadge icon="🍎" label="Nutrition" pct={calPct} color={getProgressColor(calPct)} />
          </View>
        </View>

        {/* ── QUICK STATS ROW ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={[styles.statCard, { borderColor: "#FF6B3533" }]} onPress={() => router.push("/(tabs)/habits")}>
            <Ionicons name="flame" size={18} color="#FF6B35" />
            <Text style={[styles.statNum, { color: "#FF6B35" }]}>{maxStreak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { borderColor: "#5BC8FB33" }]} onPress={() => router.push("/(tabs)/calories")}>
            <Ionicons name="water" size={18} color="#5BC8FB" />
            <Text style={[styles.statNum, { color: "#5BC8FB" }]}>{water}/{dailyGoal.water}</Text>
            <Text style={styles.statLabel}>glasses</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statCard, { borderColor: "#F59E0B33" }]} onPress={() => router.push("/(tabs)/calories")}>
            <Ionicons name="flash" size={18} color="#F59E0B" />
            <Text style={[styles.statNum, { color: "#F59E0B" }]}>{todayStats.calories}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </TouchableOpacity>
        </View>

        {/* ── TODAY'S HABITS ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push("/(tabs)/habits")}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
            </TouchableOpacity>
          </View>
          {todayHabits.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyRowText}>No habits yet — </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/habits")}>
                <Text style={styles.emptyRowAction}>tap to add your first 💪</Text>
              </TouchableOpacity>
            </View>
          ) : (
            todayHabits.slice(0, 3).map((h, idx, arr) => {
              const colorInfo = HABIT_COLORS.find((c) => c.id === h.colorId) ?? HABIT_COLORS[0];
              const done = !!getHabitLog(h.id, today);
              const streak = getStreak(h.id);
              const isLast = idx === arr.length - 1;
              return (
                <View key={h.id} style={[styles.habitRow, isLast && styles.habitRowLast]}>
                  {/* Checkbox circle */}
                  <View style={[
                    styles.habitCheck,
                    done
                      ? { backgroundColor: "#34C759", borderColor: "#34C759" }
                      : { backgroundColor: "transparent", borderColor: BORDER },
                  ]}>
                    {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  {/* Emoji + name */}
                  <View style={[styles.habitIconBox, { backgroundColor: colorInfo.icon + "22", borderColor: colorInfo.icon + "44" }]}>
                    <Text style={styles.habitEmoji}>{h.emoji}</Text>
                  </View>
                  <Text style={[styles.habitName, done && styles.habitNameDone]} numberOfLines={1}>{h.name}</Text>
                  {streak.current > 0 && (
                    <View style={[styles.streakBadge, { backgroundColor: colorInfo.icon + "22" }]}>
                      <Text style={styles.streakBadgeFireIcon}>🔥</Text>
                      <Text style={[styles.streakBadgeText, { color: colorInfo.icon }]}>{streak.current}d</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ── NUTRITION SNAPSHOT ─────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <View style={styles.nutritionActions}>
              <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/(tabs)/calories")}>
                <Ionicons name="camera-outline" size={13} color="#20D9A0" />
                <Text style={styles.scanBtnText}>Scan Food</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.seeAll} onPress={() => router.push("/(tabs)/calories")}>
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </View>
          <MacroBar label="Carbs" value={todayStats.carbs} goal={dailyGoal.carbs} color="#5BC8FB" />
          <View style={styles.macroDivider} />
          <MacroBar label="Protein" value={todayStats.protein} goal={dailyGoal.protein} color="#FF6B35" />
          <View style={styles.macroDivider} />
          <MacroBar label="Fat" value={todayStats.fat} goal={dailyGoal.fat} color="#F59E0B" />
          <View style={styles.calRow}>
            <Text style={styles.calLabel}>Calories today</Text>
            <Text style={styles.calValue}>
              {todayStats.calories}
              <Text style={styles.calGoal}> / {dailyGoal.calories} kcal</Text>
            </Text>
          </View>
        </View>

        {/* ── TASKS SNAPSHOT ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <TouchableOpacity style={styles.seeAll} onPress={() => router.push("/(tabs)/todos")}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
            </TouchableOpacity>
          </View>
          {activeTodos.length === 0 ? (
            <Text style={styles.allClearText}>All clear! 🎉</Text>
          ) : (
            activeTodos.slice(0, 2).map((t, i) => {
              // Bug 6 fix: urgent priority gets red colour same as high
              const dotColor =
                t.priority === "high" || t.priority === "urgent"
                  ? "#FF4757"
                  : t.priority === "medium"
                  ? "#F59E0B"
                  : "#34C759";
              return (
                <View key={t.id} style={[styles.taskRow, i === activeTodos.slice(0, 2).length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.taskDot, { backgroundColor: dotColor }]} />
                  <Text style={styles.taskName} numberOfLines={1}>{t.title}</Text>
                  {(t.priority === "high" || t.priority === "urgent") && <Ionicons name="alert-circle" size={15} color="#FF4757" />}
                </View>
              );
            })
          )}
        </View>

        {/* ── ACTIVITY TODAY ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Today</Text>
            <TouchableOpacity style={styles.logActivityBtn} onPress={() => router.push("/(tabs)/habits?tab=activity")}>
              <Ionicons name="add" size={14} color="#FF6B35" />
              <Text style={styles.logActivityText}>Log Activity</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityRingsRow}>
            {/* Bug 10 fix: use actual workout calories from ActivityContext */}
            <View style={styles.activityRingItem}>
              <SmallRing size={64} progress={Math.min(activityCals / 500, 1)} color="#FF4757">
                <Ionicons name="flame" size={18} color="#FF4757" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Move</Text>
              <Text style={styles.activityRingVal}>{activityCals} cal</Text>
            </View>
            {/* Bug 11 fix: use actual exercise minutes from ActivityContext */}
            <View style={styles.activityRingItem}>
              <SmallRing size={64} progress={Math.min(activityMins / 60, 1)} color="#34C759">
                <Ionicons name="timer-outline" size={18} color="#34C759" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Exercise</Text>
              <Text style={styles.activityRingVal}>{activityMins > 0 ? `${activityMins} min` : "— min"}</Text>
            </View>
            <View style={styles.activityRingItem}>
              <SmallRing size={64} progress={Math.min(water / dailyGoal.water, 1)} color="#5BC8FB">
                <Ionicons name="trending-up" size={18} color="#5BC8FB" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Hydration</Text>
              <Text style={styles.activityRingVal}>{water}/{dailyGoal.water} gl</Text>
            </View>
          </View>
        </View>

        {/* ── EMPTY / GET STARTED ────────────────────────────────────────── */}
        {isNewUser && (
          <View style={styles.card}>
            <View style={styles.getStartedHeader}>
              <Ionicons name="leaf-outline" size={28} color="#FF6B35" />
              <Text style={styles.getStartedTitle}>Get Started</Text>
            </View>
            {[
              { step: 1, label: "Add your first habit", route: "/(tabs)/habits" as const },
              { step: 2, label: "Set your calorie goal", route: "/(tabs)/calories" as const },
              { step: 3, label: "Log your first meal", route: "/(tabs)/calories" as const },
            ].map((item) => (
              <TouchableOpacity key={item.step} style={styles.getStartedRow} onPress={() => router.push(item.route)}>
                <View style={styles.getStartedNum}>
                  <Text style={styles.getStartedNumText}>{item.step}</Text>
                </View>
                <Text style={styles.getStartedLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <View style={[styles.fabContainer, { bottom: 80 }]}>
        <TouchableOpacity
          style={[styles.fab, fabOpen && styles.fabOpen]}
          onPress={() => setFabOpen((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name={fabOpen ? "close" : "add"} size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <FabSheet
        visible={fabOpen}
        onClose={() => setFabOpen(false)}
        onAction={handleFabAction}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },

  // Header
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 },
  greeting: { fontSize: 13, color: t.MUTED, fontWeight: "500" as const, marginBottom: 2 },
  appName: { fontSize: 26, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  dateText: { fontSize: 12, color: t.MUTED, marginTop: 3 },
  bellBtn: { backgroundColor: t.CARD, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: t.BORDER, position: "relative" as const },
  bellDot: { position: "absolute" as const, top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4757", borderWidth: 2, borderColor: t.BG },

  // Card
  card: { backgroundColor: t.CARD, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.BORDER },

  // Streak
  streakHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  streakFire: { fontSize: 26 },
  streakCount: { fontSize: 17, fontWeight: "800" as const, color: "#FF6B35" },
  streakSub: { fontSize: 11, color: t.MUTED, marginTop: 1 },
  streakEmpty: { fontSize: 14, fontWeight: "600" as const, color: t.MUTED },
  weekRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  weekDayCol: { alignItems: "center", gap: 4, flex: 1 },
  weekDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.CARD2, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  weekDotDone: { backgroundColor: "#FF6B35", borderColor: "transparent" },
  weekDotToday: { borderColor: "#FF6B35", backgroundColor: "#FF6B3522" },
  weekDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  weekDayLabel: { fontSize: 9, color: t.MUTED, fontWeight: "600" as const },

  // Progress ring
  ringCard: { alignItems: "center", gap: 18 },
  ringPct: { fontSize: 32, fontWeight: "800" as const, color: t.TEXT },
  ringLabel: { fontSize: 11, color: t.MUTED, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillIcon: { fontSize: 12 },
  pillPct: { fontSize: 11, fontWeight: "700" as const },
  pillLabel: { fontSize: 11, color: t.MUTED },

  // Quick stats
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: t.CARD, borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  statNum: { fontSize: 16, fontWeight: "800" as const, color: t.TEXT },
  statLabel: { fontSize: 10, color: t.MUTED },

  // Section header
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, color: "#FF6B35", fontWeight: "600" as const },

  // Habits
  emptyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  emptyRowText: { fontSize: 13, color: t.MUTED },
  emptyRowAction: { fontSize: 13, color: "#FF6B35", fontWeight: "600" as const },
  habitRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.BORDER },
  habitRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  habitCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  habitIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },
  habitEmoji: { fontSize: 15 },
  habitName: { flex: 1, fontSize: 13, fontWeight: "600" as const, color: t.TEXT },
  habitNameDone: { textDecorationLine: "line-through" as const, color: t.MUTED },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  streakBadgeFireIcon: { fontSize: 10 },
  streakBadgeText: { fontSize: 10, fontWeight: "700" as const },

  // Nutrition
  nutritionActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#20D9A018", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#20D9A044" },
  scanBtnText: { fontSize: 11, color: "#20D9A0", fontWeight: "700" as const },
  macroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  macroLabel: { fontSize: 11, color: t.MUTED, width: 44 },
  macroTrack: { flex: 1, height: 5, backgroundColor: t.BORDER, borderRadius: 3, overflow: "hidden" as const },
  macroFill: { height: "100%" as any, borderRadius: 3 },
  macroVal: { fontSize: 11, fontWeight: "600" as const, color: t.TEXT, width: 32, textAlign: "right" as const },
  macroDivider: { height: 8 },
  calRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: t.CARD2, borderRadius: 10, padding: 10 },
  calLabel: { fontSize: 13, color: t.MUTED },
  calValue: { fontSize: 15, fontWeight: "800" as const, color: t.TEXT },
  calGoal: { fontSize: 12, fontWeight: "400" as const, color: t.MUTED },

  // Tasks
  allClearText: { fontSize: 14, color: t.MUTED, textAlign: "center" as const, paddingVertical: 8 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.BORDER },
  taskDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  taskName: { flex: 1, fontSize: 13, color: t.TEXT, fontWeight: "500" as const },

  // Activity
  activityRingsRow: { flexDirection: "row", justifyContent: "space-around", paddingTop: 4 },
  activityRingItem: { alignItems: "center", gap: 6 },
  activityRingLabel: { fontSize: 11, color: t.MUTED, fontWeight: "500" as const },
  activityRingVal: { fontSize: 11, color: t.TEXT, fontWeight: "700" as const },
  logActivityBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FF6B3518", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#FF6B3533" },
  logActivityText: { fontSize: 11, color: "#FF6B35", fontWeight: "700" as const },

  // Get started
  getStartedHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  getStartedTitle: { fontSize: 17, fontWeight: "700" as const, color: t.TEXT },
  getStartedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER },
  getStartedNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FF6B3522", alignItems: "center", justifyContent: "center" },
  getStartedNumText: { fontSize: 12, fontWeight: "800" as const, color: "#FF6B35" },
  getStartedLabel: { flex: 1, fontSize: 14, color: t.TEXT, fontWeight: "500" as const },

  // FAB
  fabContainer: { position: "absolute" as const, right: 16, zIndex: 50 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FF6B35", alignItems: "center", justifyContent: "center", shadowColor: "#FF6B35", shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabOpen: { backgroundColor: t.BORDER },
  fabOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", alignItems: "center", paddingBottom: 140 },
  fabSheet: { backgroundColor: t.CARD2, borderRadius: 20, padding: 8, width: 220, borderWidth: 1, borderColor: t.BORDER },
  fabAction: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12 },
  fabActionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fabActionLabel: { fontSize: 14, fontWeight: "600" as const },
});
