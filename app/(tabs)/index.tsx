import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { logScreen, logError } from "@/utils/analytics";
import { showInterstitialAd } from "../../utils/ads";
import { requestNotificationPermissions, scheduleDailyNotifications } from "@/utils/notifications";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
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
import { ConfettiEffect } from "@/components/ConfettiEffect";
import { useActivity } from "@/context/ActivityContext";
import { useCalories } from "@/context/CaloriesContext";
import { HABIT_COLORS, useHabits } from "@/context/HabitsContext";
import { useProfile } from "@/context/ProfileContext";
import { useTodos } from "@/context/TodosContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";

// ─── Notification Infrastructure ─────────────────────────────────────────────
const NOTIF_STORE_KEY = "@lyfeos_notifications_v1";
const NOTIF_ASKED_KEY = "@lyfeos_notif_asked_v1";
const CONFETTI_DATE_KEY = "@lyfeos_confetti_date_v1";
const ITEM_WIDTH = 44; // width of each day cell in scrollable strip

type NotifType = "info" | "habit" | "nutrition" | "activity" | "task" | "streak";
interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}
const NOTIF_ICONS: Record<NotifType, string> = {
  info: "ℹ️",
  habit: "✅",
  nutrition: "🍎",
  activity: "🏃",
  task: "📋",
  streak: "🔥",
};

// ─── Change 3: 6-tier color helpers ─────────────────────────────────────────
function getProgressColor(pct: number): string {
  if (pct === 100) return "#F59E0B"; // Gold
  if (pct >= 81) return "#22C55E"; // Green
  if (pct >= 61) return "#86EFAC"; // Light Green
  if (pct >= 41) return "#EAB308"; // Yellow
  if (pct >= 21) return "#FF6B35"; // Orange
  return "#EF4444";                  // Red (0–20)
}

function getPillColor(pct: number): string {
  if (pct === 100) return "#F59E0B";
  if (pct >= 70) return "#22C55E";
  if (pct >= 40) return "#FF6B35";
  return "#EF4444";
}

function getRingMotivation(pct: number): string {
  if (pct === 100) return "Perfect day! 🏆";
  if (pct >= 80) return "Almost there! 💪";
  if (pct >= 60) return "Great progress! 🌟";
  if (pct >= 40) return "Keep going! 🔥";
  if (pct > 0) return "Building momentum";
  return "Let's start! 🚀";
}

// ─── Change 4: Push notification scheduling helper ────────────────────────────
async function scheduleAllNotifications(
  reminders: { morning: boolean; meal: boolean; water: boolean; evening: boolean },
  firstName: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const nameStr = firstName ? `, ${firstName}` : "";

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("lyfeos_default", {
        name: "LyfeOS Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    if (reminders.morning) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Good morning${nameStr}! ☀️`,
          body: "Time to check in on your habits for today.",
          data: { route: "/(tabs)/habits" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        },
      });
    }

    if (reminders.meal) {
      const meals = [
        { hour: 8, minute: 30, name: "Breakfast" },
        { hour: 13, minute: 0, name: "Lunch" },
        { hour: 19, minute: 0, name: "Dinner" },
      ];
      for (const m of meals) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${m.name} time! 🍽️`,
            body: "Don't forget to log your meal.",
            data: { route: "/(tabs)/calories" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: m.hour,
            minute: m.minute,
          },
        });
      }
    }

    if (reminders.water) {
      for (let hour = 10; hour <= 22; hour += 2) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Hydration reminder 💧",
            body: "Time to drink a glass of water!",
            data: { route: "/(tabs)/calories" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute: 0,
          },
        });
      }
    }

    if (reminders.evening) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Evening check-in${nameStr} 🌙`,
          body: "How did today go? Review your progress.",
          data: { route: "/(tabs)/index" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 21,
          minute: 0,
        },
      });
    }
  } catch (e) {
    console.warn("[LyfeOS] Notification scheduling failed:", e);
  }
}

// ─── SmallRing (unchanged) ────────────────────────────────────────────────────
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

// ─── Change 2: Calendar Modal ─────────────────────────────────────────────────
function CalendarModal({
  visible,
  onClose,
  habits,
  getHabitLog,
  onSelectDate,
}: {
  visible: boolean;
  onClose: () => void;
  habits: any[];
  getHabitLog: (id: string, date: string) => any;
  onSelectDate: (date: string) => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const [viewMonth, setViewMonth] = useState(new Date());
  const todayStr = getLocalDateString();

  const checkCompleted = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00");
      const wd = d.getDay();
      const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
      return (
        dayHabits.length > 0 &&
        dayHabits.some((h) => !!getHabitLog(h.id, dateStr)?.completed)
      );
    },
    [habits, getHabitLog],
  );

  // Build weeks grid for the viewed month
  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start the grid from the Sunday of the first week
    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    const result: { date: string; d: Date; inMonth: boolean }[][] = [];
    const cur = new Date(start);
    while (cur <= lastDay) {
      const week: { date: string; d: Date; inMonth: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        week.push({
          date: getLocalDateString(cur),
          d: new Date(cur),
          inMonth: cur.getMonth() === month,
        });
        cur.setDate(cur.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [viewMonth]);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.calOverlay} onPress={onClose}>
        <Pressable
          style={[styles.calSheet, { backgroundColor: theme.CARD }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Month navigation */}
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              style={styles.calNavBtn}
            >
              <Ionicons name="chevron-back" size={22} color={theme.TEXT} />
            </TouchableOpacity>
            <Text style={[styles.calMonthLabel, { color: theme.TEXT }]}>
              {viewMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              onPress={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              style={styles.calNavBtn}
            >
              <Ionicons name="chevron-forward" size={22} color={theme.TEXT} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header row */}
          <View style={styles.calDayHeaders}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={i} style={[styles.calDayHeader, { color: theme.MUTED }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Week rows */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.calWeekRow}>
              {week.map((day, di) => {
                const isFuture = day.date > todayStr;
                const isToday = day.date === todayStr;
                const done = !isFuture && day.inMonth && checkCompleted(day.date);
                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.calDayBtn}
                    onPress={() => {
                      if (!isFuture) {
                        onSelectDate(day.date);
                      }
                    }}
                    disabled={isFuture}
                  >
                    <View
                      style={[
                        styles.calDayCircle,
                        done && { backgroundColor: "#FF6B35" },
                        isToday && !done && {
                          borderWidth: 2,
                          borderColor: "#FF6B35",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calDayNum,
                          {
                            color: done
                              ? "#fff"
                              : isToday
                                ? "#FF6B35"
                                : !day.inMonth
                                  ? theme.MUTED
                                  : isFuture
                                    ? theme.BORDER
                                    : theme.TEXT,
                            fontWeight: isToday ? ("800" as const) : ("500" as const),
                          },
                        ]}
                      >
                        {day.d.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Back to Today */}
          <TouchableOpacity
            style={styles.calTodayBtn}
            onPress={() => {
              setViewMonth(new Date());
              onSelectDate(todayStr);
            }}
          >
            <Text style={styles.calTodayText}>Back to Today</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Change 2: Scrollable Week Strip (replaces WeekBar) ──────────────────────
function ScrollableWeekStrip({
  habits,
  getHabitLog,
  joinDate,
}: {
  habits: any[];
  getHabitLog: (id: string, date: string) => any;
  joinDate: string;
}) {
  const theme = useAppTheme();
  const flatRef = useRef<FlatList>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [monthLabel, setMonthLabel] = useState("");
  const todayStr = getLocalDateString();

  // Build day array: from max(joinDate, 90 days ago) to today + 6 days
  const days = useMemo(() => {
    const result: { date: string; d: Date }[] = [];
    const ninetyAgo = new Date();
    ninetyAgo.setDate(ninetyAgo.getDate() - 89);
    let actualStart = new Date(ninetyAgo);
    if (joinDate) {
      const jd = new Date(joinDate);
      jd.setHours(0, 0, 0, 0);
      if (jd > actualStart) actualStart = jd;
    }
    const end = new Date();
    end.setDate(end.getDate() + 6);
    const cur = new Date(actualStart);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      result.push({ date: getLocalDateString(cur), d: new Date(cur) });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [joinDate]);

  const todayIndex = useMemo(
    () => days.findIndex((d) => d.date === todayStr),
    [days, todayStr],
  );

  // Scroll so today is visible near right edge on mount
  useEffect(() => {
    if (todayIndex >= 0) {
      const timer = setTimeout(() => {
        const screenW = Dimensions.get("window").width;
        const offset = Math.max(
          0,
          todayIndex * ITEM_WIDTH - screenW + ITEM_WIDTH * 3 + 32,
        );
        flatRef.current?.scrollToOffset({ offset, animated: false });
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [todayIndex]);

  const checkCompleted = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00");
      const wd = d.getDay();
      const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
      return (
        dayHabits.length > 0 &&
        dayHabits.some((h) => !!getHabitLog(h.id, dateStr)?.completed)
      );
    },
    [habits, getHabitLog],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const mid = viewableItems[Math.floor(viewableItems.length / 2)];
      if (mid?.item?.d) {
        setMonthLabel(
          mid.item.d.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }),
        );
      }
    }
  }, []);

  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <View>
      {/* Month label + calendar icon */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontSize: 11, color: theme.MUTED, fontWeight: "600" as const }}>
          {monthLabel}
        </Text>
        <TouchableOpacity onPress={() => setCalOpen(true)} style={{ padding: 4 }}>
          <Ionicons name="calendar-outline" size={16} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* Horizontal scrollable strip */}
      <FlatList
        ref={flatRef}
        data={days}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.date}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        onScrollToIndexFailed={() => { }}
        renderItem={({ item }) => {
          const isFuture = item.date > todayStr;
          const isToday = item.date === todayStr;
          const done = !isFuture && checkCompleted(item.date);
          return (
            <View style={{ width: ITEM_WIDTH, alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  fontSize: 9,
                  color: isToday ? "#FF6B35" : theme.MUTED,
                  fontWeight: "600" as const,
                }}
              >
                {DAY_LETTERS[item.d.getDay()]}
              </Text>
              <View
                style={[
                  {
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: "center" as const,
                    justifyContent: "center" as const,
                  },
                  done && { backgroundColor: "#FF6B35" },
                  isToday && !done && {
                    borderWidth: 2,
                    borderColor: "#FF6B35",
                    backgroundColor: "#FF6B3522",
                  },
                  !done && !isToday && !isFuture && {
                    backgroundColor: theme.CARD2,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: (isToday ? "800" : "600") as "800" | "600",
                    color: done
                      ? "#fff"
                      : isToday
                        ? "#FF6B35"
                        : isFuture
                          ? theme.BORDER
                          : theme.TEXT,
                  }}
                >
                  {item.d.getDate()}
                </Text>
              </View>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: done ? "#FF6B35" : "transparent",
                }}
              />
            </View>
          );
        }}
      />

      <CalendarModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        habits={habits}
        getHabitLog={getHabitLog}
        onSelectDate={(date) => {
          setCalOpen(false);
          const idx = days.findIndex((d) => d.date === date);
          if (idx >= 0 && flatRef.current) {
            const screenW = Dimensions.get("window").width;
            flatRef.current.scrollToOffset({
              offset: Math.max(0, idx * ITEM_WIDTH - screenW / 2),
              animated: true,
            });
          }
        }}
      />
    </View>
  );
}

// ─── MacroBar (unchanged) ─────────────────────────────────────────────────────
function MacroBar({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
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

// ─── PillBadge (updated colors) ───────────────────────────────────────────────
function PillBadge({
  icon,
  label,
  pct,
  color,
}: {
  icon: string;
  label: string;
  pct: number;
  color: string;
}) {
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

// ─── Change 4: In-app Notification Sheet ─────────────────────────────────────
function NotifSheet({
  visible,
  notifications,
  onClose,
  onMarkAllRead,
}: {
  visible: boolean;
  notifications: NotifItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  function timeAgo(ts: number): string {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={[styles.notifSheet, { backgroundColor: theme.CARD }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, { color: theme.TEXT }]}>
              Notifications
            </Text>
            {notifications.some((n) => !n.read) && (
              <TouchableOpacity onPress={onMarkAllRead}>
                <Text style={styles.markReadText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {notifications.length === 0 ? (
            <View style={styles.notifEmpty}>
              <Text style={{ fontSize: 36 }}>🔔</Text>
              <Text style={[styles.notifEmptyText, { color: theme.MUTED }]}>
                No notifications yet
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((n) => (
                <View
                  key={n.id}
                  style={[
                    styles.notifItem,
                    {
                      borderBottomColor: theme.BORDER,
                      opacity: n.read ? 0.55 : 1,
                    },
                  ]}
                >
                  {!n.read && <View style={styles.notifUnreadDot} />}
                  <Text style={styles.notifItemIcon}>{NOTIF_ICONS[n.type]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifItemTitle, { color: theme.TEXT }]}>
                      {n.title}
                    </Text>
                    <Text style={[styles.notifItemBody, { color: theme.MUTED }]}>
                      {n.body}
                    </Text>
                  </View>
                  <Text style={[styles.notifTime, { color: theme.MUTED }]}>
                    {timeAgo(n.timestamp)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Change 4: Push Notification Permission Sheet ─────────────────────────────
function NotifPermSheet({
  visible,
  onAllow,
  onLater,
}: {
  visible: boolean;
  onAllow: () => void;
  onLater: () => void;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onLater}
    >
      <View style={styles.permOverlay}>
        <View style={[styles.permSheet, { backgroundColor: theme.CARD }]}>
          <Text style={styles.permEmoji}>🔔</Text>
          <Text style={[styles.permTitle, { color: theme.TEXT }]}>
            Stay on Track
          </Text>
          <Text style={[styles.permBody, { color: theme.MUTED }]}>
            Enable notifications to get habit reminders, meal logging prompts,
            hydration alerts, and streak-at-risk warnings.
          </Text>
          <TouchableOpacity style={styles.permAllow} onPress={onAllow}>
            <Text style={styles.permAllowText}>Allow Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permLater} onPress={onLater}>
            <Text style={[styles.permLaterText, { color: theme.MUTED }]}>
              Maybe Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── FabSheet (unchanged logic, style consolidated) ───────────────────────────
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
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.fabOverlay} onPress={onClose}>
        <View
          style={[
            styles.fabSheet,
            { backgroundColor: theme.CARD2, borderColor: theme.BORDER },
          ]}
        >
          {actions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.fabAction}
              onPress={() => {
                onClose();
                onAction(a.key);
              }}
            >
              <View
                style={[
                  styles.fabActionIcon,
                  { backgroundColor: a.color + "22" },
                ]}
              >
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <Text style={[styles.fabActionLabel, { color: a.color }]}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── Main Home Screen ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, TEXT: WHITE } = theme;
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Contexts
  const { habits, getStreak, getCompletionRate, getHabitLog } = useHabits();
  const { todos } = useTodos();
  const { getDayStats, getWaterForDate, dailyGoal } = useCalories();
  const { getDailyActivityCalories, getDailyActivityMinutes } = useActivity();
  // Change 1 & 4: pull userName, reminders, joinDate from profile
  const { userName, reminders, joinDate } = useProfile();

  // State
  const [fabOpen, setFabOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [notifPermSheetOpen, setNotifPermSheetOpen] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const today = getLocalDateString();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Data ──────────────────────────────────────────────────────────────────
  const todayStats = getDayStats(today);
  const water = getWaterForDate(today);
  const todayWeekDay = new Date().getDay();
  const todayHabits = habits.filter((h) => h.weekDays.includes(todayWeekDay));
  const activityCals = getDailyActivityCalories(today);
  const activityMins = getDailyActivityMinutes(today);
  const activeTodos = todos.filter((t) => !t.completed);
  const highPriority = activeTodos.filter(
    (t) => t.priority === "high" || t.priority === "urgent",
  );

  const avgCompletion =
    habits.length > 0
      ? Math.round(
        habits.reduce((s, h) => s + getCompletionRate(h.id), 0) / habits.length,
      )
      : 0;

  const maxStreak =
    habits.length > 0
      ? Math.max(...habits.map((h) => getStreak(h.id).current))
      : 0;

  const totalTodos = todos.length;
  const doneTodos = todos.filter((t) => t.completed).length;
  const tasksPct = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) : 0;
  const calPct = Math.round(
    Math.min((todayStats.calories / (dailyGoal.calories || 1)) * 100, 100),
  );

  const overallPct =
    habits.length === 0 && totalTodos === 0
      ? 0
      : Math.round((avgCompletion + tasksPct + calPct) / 3);
  // Change 3: dynamic ring color
  const ringColor = getProgressColor(overallPct);

  const isNewUser =
    habits.length === 0 && totalTodos === 0 && todayStats.calories === 0;

  // Change 1: extract first name for personalized greeting
  const firstName =
    !userName || userName === "LyfeOS User" || !userName.trim()
      ? ""
      : userName.split(" ")[0];

  // ── Change 1: Time-based greeting with user name ──────────────────────────
  function getGreetingText(): string {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return `Good Morning ☀️`;
    if (h >= 12 && h < 17) return `Good Afternoon ⛅`;
    if (h >= 17 && h < 21) return `Good Evening 🌙`;
    return `Good Night 🌙`;
  }

  // ── Screen tracking (analytics) ───────────────────────────────────────────
  useEffect(() => {
    logScreen("Home");
  }, []);

  // ── Show interstitial ad once per day ─────────────────────────────────────
  useEffect(() => {
    const showDailyAd = async () => {
      try {
        const lastAdDate = await AsyncStorage.getItem("lastInterstitialDate");
        const today = new Date().toDateString();
        if (lastAdDate !== today) {
          await AsyncStorage.setItem("lastInterstitialDate", today);
          // Wait 2 minutes after app load before showing ad
          setTimeout(() => {
            showInterstitialAd().catch(e => console.log('Interstitial failed silently:', e));
          }, 120000);
        }
      } catch (e) {
        // Silently fail — never block the user
      }
    };
    showDailyAd();
  }, []);

  // ── Setup notifications on mount ──────────────────────────────────────────
  // Fix #2: Only touch the OS permission layer if the user has already gone
  // through the custom priming modal (NOTIF_ASKED_KEY is set). If not set,
  // we leave it alone so the modal can fire the OS dialog at the right time.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const setupNotifications = async () => {
      try {
        const asked = await AsyncStorage.getItem(NOTIF_ASKED_KEY);
        if (!asked) return; // new user — let the priming modal handle it

        // Existing user: silently refresh schedule if permission is already granted.
        // Read reminders from AsyncStorage directly to avoid stale context closure.
        const granted = await requestNotificationPermissions();
        if (granted) {
          const raw = await AsyncStorage.getItem("@lyfeos_profile_reminders_v1");
          const reminders = raw
            ? JSON.parse(raw)
            : { morning: true, meal: true, water: true, evening: true };
          await scheduleDailyNotifications(reminders);
        }
      } catch (e) {
        logError(e as Error, "setupNotifications");
      }
    };
    setupNotifications();
  }, []);

  // ── Change 4: Load notifications from AsyncStorage ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIF_STORE_KEY);
        const stored: NotifItem[] = raw ? JSON.parse(raw) : [];
        if (stored.length === 0) {
          // Seed welcome notification on first launch
          const welcome: NotifItem = {
            id: "welcome_001",
            type: "info",
            title: "Welcome to LyfeOS! 🎉",
            body: "Start your health journey today. Add your first habit to get going.",
            timestamp: Date.now(),
            read: false,
          };
          const next = [welcome];
          setNotifications(next);
          await AsyncStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(next));
        } else {
          setNotifications(stored);
        }
      } catch { }
    })();
  }, []);

  // ── Change 3: Confetti fires once on the day overallPct hits 100% ─────────
  const confettiShownRef = useRef(false);
  useEffect(() => {
    if (overallPct === 100 && !confettiShownRef.current) {
      (async () => {
        try {
          const storedDate = await AsyncStorage.getItem(CONFETTI_DATE_KEY);
          if (storedDate !== today) {
            confettiShownRef.current = true;
            setConfettiTrigger((t) => t + 1);
            await AsyncStorage.setItem(CONFETTI_DATE_KEY, today);
          }
        } catch { }
      })();
    }
  }, [overallPct, today]);

  // ── Change 4: Show notification permission prompt once (native only) ───────
  useEffect(() => {
    if (Platform.OS === "web") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const asked = await AsyncStorage.getItem(NOTIF_ASKED_KEY);
        if (!asked && !cancelled) {
          timer = setTimeout(() => setNotifPermSheetOpen(true), 2500);
        }
      } catch { }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Change 4: Handle push notification tap → navigate to relevant screen ──
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: { remove: () => void } | null = null;
    try {
      sub = Notifications.addNotificationResponseReceivedListener(
        (resp) => {
          const route = resp.notification.request.content.data
            ?.route as string | undefined;
          if (route) router.push(route as any);
        },
      );
    } catch (e) {
      console.warn("[LyfeOS] Notification listener failed:", e);
    }
    return () => {
      if (sub) sub.remove();
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleAllowNotifications() {
    setNotifPermSheetOpen(false);
    try {
      await AsyncStorage.setItem(NOTIF_ASKED_KEY, "true");
      if (Platform.OS === "web") return;

      // Fix #3: For new users, default all four sub-toggles to ON so the
      // reminders promised by the priming modal are actually scheduled.
      // Only write the default if the key is absent — never overwrite an
      // existing user's saved preferences.
      const KEY_REMIND = "@lyfeos_profile_reminders_v1";
      const existingReminders = await AsyncStorage.getItem(KEY_REMIND);
      const newUserReminders = { morning: true, meal: true, water: true, evening: true };
      if (!existingReminders) {
        await AsyncStorage.setItem(KEY_REMIND, JSON.stringify(newUserReminders));
      }
      const remindersToSchedule = existingReminders
        ? JSON.parse(existingReminders)
        : newUserReminders;

      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleDailyNotifications(remindersToSchedule);

        // Add in-app notification confirming push is enabled
        const notif: NotifItem = {
          id: `notif_perm_${Date.now()}`,
          type: "info",
          title: "Notifications enabled! 🔔",
          body: "You'll receive reminders based on your profile preferences.",
          timestamp: Date.now(),
          read: false,
        };
        setNotifications((prev) => {
          const next = [notif, ...prev].slice(0, 20);
          AsyncStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(next)).catch(
            () => { },
          );
          return next;
        });
      }
    } catch (e) {
      logError(e as Error, "handleAllowNotifications");
    }
  }

  async function handleLaterNotifications() {
    setNotifPermSheetOpen(false);
    try {
      await AsyncStorage.setItem(NOTIF_ASKED_KEY, "true");
    } catch { }
  }

  async function handleMarkAllRead() {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(next);
    try {
      await AsyncStorage.setItem(NOTIF_STORE_KEY, JSON.stringify(next));
    } catch { }
  }

  // Bug 2 fix: FAB actions navigate to correct screens
  function handleFabAction(key: string) {
    if (key === "habit") router.push("/(tabs)/habits");
    else if (key === "scan") router.push("/(tabs)/calories");
    else if (key === "task") router.push("/(tabs)/todos");
    else if (key === "activity") router.push("/(tabs)/habits?tab=activity");
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER — Change 1: greeting + user name ─────────────────────── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, alignItems: "flex-start", gap: 2 }}>
            <Text style={{ fontSize: 14, color: MUTED, fontWeight: "600" }}>{getGreetingText()}</Text>
            {!!firstName && <Text style={{ fontSize: 26, color: WHITE, fontWeight: "800", letterSpacing: -0.5 }}>{firstName}</Text>}
            <Text style={[styles.dateText, { marginTop: 0, fontSize: 12, opacity: 0.8 }]}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          {/* Change 4: Bell opens notification sheet */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => setNotifSheetOpen(true)}
          >
            <Ionicons name="notifications-outline" size={22} color={WHITE} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* ── STREAK + SCROLLABLE WEEK STRIP — Change 2 ──────────────────── */}
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
          <ScrollableWeekStrip
            habits={habits}
            getHabitLog={getHabitLog}
            joinDate={joinDate}
          />
        </View>

        {/* ── DAILY PROGRESS RING — Change 3: dynamic color + motivation ─── */}
        <View style={[styles.card, styles.ringCard]}>
          <CircularProgress
            size={160}
            progress={overallPct / 100}
            color={ringColor}
            strokeWidth={12}
            backgroundColor={BORDER}
          >
            {/* Change 3: ring % text color matches ring color */}
            <Text style={[styles.ringPct, { color: ringColor }]}>{overallPct}%</Text>
            <Text style={styles.ringLabel}>{getRingMotivation(overallPct)}</Text>
          </CircularProgress>
          <View style={styles.pillRow}>
            <PillBadge
              icon="✅"
              label="Habits"
              pct={avgCompletion}
              color={getPillColor(avgCompletion)}
            />
            <PillBadge
              icon="📋"
              label="Tasks"
              pct={tasksPct}
              color={getPillColor(tasksPct)}
            />
            <PillBadge
              icon="🍎"
              label="Nutrition"
              pct={calPct}
              color={getPillColor(calPct)}
            />
          </View>
        </View>

        {/* ── QUICK STATS ROW — Change 7: kcal shows "consumed/goal" ──────── */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { borderColor: "#FF6B3533" }]}
            onPress={() => router.push("/(tabs)/habits")}
          >
            <Ionicons name="flame" size={18} color="#FF6B35" />
            <Text style={[styles.statNum, { color: "#FF6B35" }]}>{maxStreak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { borderColor: "#5BC8FB33" }]}
            onPress={() => router.push("/(tabs)/calories")}
          >
            <Ionicons name="water" size={18} color="#5BC8FB" />
            <Text style={[styles.statNum, { color: "#5BC8FB" }]}>
              {water}/{dailyGoal.water}
            </Text>
            <Text style={styles.statLabel}>glasses</Text>
          </TouchableOpacity>
          {/* Change 7: shows e.g. "1470/2000" with goal in grey */}
          <TouchableOpacity
            style={[styles.statCard, { borderColor: "#F59E0B33" }]}
            onPress={() => router.push("/(tabs)/calories")}
          >
            <Ionicons name="flash" size={18} color="#F59E0B" />
            <Text style={[styles.statNum, { color: "#F59E0B" }]}>
              {todayStats.calories}
              {dailyGoal.calories > 0 ? (
                <Text style={styles.statGoal}>/{dailyGoal.calories}</Text>
              ) : null}
            </Text>
            <Text style={styles.statLabel}>kcal</Text>
          </TouchableOpacity>
        </View>

        {/* ── TODAY'S HABITS ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Habits</Text>
            <TouchableOpacity
              style={styles.seeAll}
              onPress={() => router.push("/(tabs)/habits")}
            >
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
              const colorInfo =
                HABIT_COLORS.find((c) => c.id === h.colorId) ?? HABIT_COLORS[0];
              const done = !!getHabitLog(h.id, today);
              const streak = getStreak(h.id);
              const isLast = idx === arr.length - 1;
              return (
                <View
                  key={h.id}
                  style={[styles.habitRow, isLast && styles.habitRowLast]}
                >
                  <View
                    style={[
                      styles.habitCheck,
                      done
                        ? { backgroundColor: "#34C759", borderColor: "#34C759" }
                        : { backgroundColor: "transparent", borderColor: BORDER },
                    ]}
                  >
                    {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View
                    style={[
                      styles.habitIconBox,
                      {
                        backgroundColor: colorInfo.icon + "22",
                        borderColor: colorInfo.icon + "44",
                      },
                    ]}
                  >
                    <Text style={styles.habitEmoji}>{h.emoji}</Text>
                  </View>
                  <Text
                    style={[styles.habitName, done && styles.habitNameDone]}
                    numberOfLines={1}
                  >
                    {h.name}
                  </Text>
                  {streak.current > 0 && (
                    <View
                      style={[
                        styles.streakBadge,
                        { backgroundColor: colorInfo.icon + "22" },
                      ]}
                    >
                      <Text style={styles.streakBadgeFireIcon}>🔥</Text>
                      <Text
                        style={[
                          styles.streakBadgeText,
                          { color: colorInfo.icon },
                        ]}
                      >
                        {streak.current}d
                      </Text>
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
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => router.push("/(tabs)/calories")}
              >
                <Ionicons name="camera-outline" size={13} color="#20D9A0" />
                <Text style={styles.scanBtnText}>Scan Food</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.seeAll}
                onPress={() => router.push("/(tabs)/calories")}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </View>
          <MacroBar
            label="Carbs"
            value={todayStats.carbs}
            goal={dailyGoal.carbs}
            color="#5BC8FB"
          />
          <View style={styles.macroDivider} />
          <MacroBar
            label="Protein"
            value={todayStats.protein}
            goal={dailyGoal.protein}
            color="#FF6B35"
          />
          <View style={styles.macroDivider} />
          <MacroBar
            label="Fat"
            value={todayStats.fat}
            goal={dailyGoal.fat}
            color="#F59E0B"
          />
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
            <TouchableOpacity
              style={styles.seeAll}
              onPress={() => router.push("/(tabs)/todos")}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="chevron-forward" size={14} color="#FF6B35" />
            </TouchableOpacity>
          </View>
          {activeTodos.length === 0 ? (
            <Text style={styles.allClearText}>All clear! 🎉</Text>
          ) : (
            activeTodos.slice(0, 2).map((t, i) => {
              const dotColor =
                t.priority === "high" || t.priority === "urgent"
                  ? "#FF4757"
                  : t.priority === "medium"
                    ? "#F59E0B"
                    : "#34C759";
              return (
                <View
                  key={t.id}
                  style={[
                    styles.taskRow,
                    i === activeTodos.slice(0, 2).length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View style={[styles.taskDot, { backgroundColor: dotColor }]} />
                  <Text style={styles.taskName} numberOfLines={1}>
                    {t.title}
                  </Text>
                  {(t.priority === "high" || t.priority === "urgent") && (
                    <Ionicons name="alert-circle" size={15} color="#FF4757" />
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ── ACTIVITY TODAY — Change 6: "0 min" not "— min" ─────────────── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Today</Text>
            <TouchableOpacity
              style={styles.logActivityBtn}
              onPress={() => router.push("/(tabs)/habits?tab=activity")}
            >
              <Ionicons name="add" size={14} color="#FF6B35" />
              <Text style={styles.logActivityText}>Log Activity</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityRingsRow}>
            <View style={styles.activityRingItem}>
              <SmallRing
                size={64}
                progress={Math.min(activityCals / 500, 1)}
                color="#FF4757"
              >
                <Ionicons name="flame" size={18} color="#FF4757" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Move</Text>
              <Text style={styles.activityRingVal}>{activityCals} cal</Text>
            </View>
            <View style={styles.activityRingItem}>
              <SmallRing
                size={64}
                progress={Math.min(activityMins / 60, 1)}
                color="#34C759"
              >
                <Ionicons name="timer-outline" size={18} color="#34C759" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Exercise</Text>
              {/* Change 6: show "0 min" instead of "— min" */}
              <Text style={styles.activityRingVal}>
                {activityMins > 0 ? `${activityMins} min` : "0 min"}
              </Text>
            </View>
            <View style={styles.activityRingItem}>
              <SmallRing
                size={64}
                progress={Math.min(water / dailyGoal.water, 1)}
                color="#5BC8FB"
              >
                <Ionicons name="trending-up" size={18} color="#5BC8FB" />
              </SmallRing>
              <Text style={styles.activityRingLabel}>Hydration</Text>
              <Text style={styles.activityRingVal}>{water}/{dailyGoal.water} gl</Text>
            </View>
          </View>
        </View>

        {/* ── GET STARTED (new user only) ────────────────────────────────── */}
        {isNewUser && (
          <View style={styles.card}>
            <View style={styles.getStartedHeader}>
              <Ionicons name="leaf-outline" size={28} color="#FF6B35" />
              <Text style={styles.getStartedTitle}>Get Started</Text>
            </View>
            {[
              {
                step: 1,
                label: "Add your first habit",
                route: "/(tabs)/habits" as const,
              },
              {
                step: 2,
                label: "Set your calorie goal",
                route: "/(tabs)/calories" as const,
              },
              {
                step: 3,
                label: "Log your first meal",
                route: "/(tabs)/calories" as const,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.step}
                style={styles.getStartedRow}
                onPress={() => router.push(item.route)}
              >
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

      {/* ── Change 3: Confetti (rendered outside ScrollView, not clipped) ── */}
      <ConfettiEffect
        trigger={confettiTrigger}
        originX={Dimensions.get("window").width / 2}
        originY={Dimensions.get("window").height * 0.35}
      />

      {/* ── FAB — Change 5: safe area fix (insets.bottom + 80) ───────────── */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 80 }]}>
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

      {/* Change 4: Notification center sheet */}
      <NotifSheet
        visible={notifSheetOpen}
        notifications={notifications}
        onClose={() => setNotifSheetOpen(false)}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Change 4: Push permission sheet (native only) */}
      {Platform.OS !== "web" && (
        <NotifPermSheet
          visible={notifPermSheetOpen}
          onAllow={handleAllowNotifications}
          onLater={handleLaterNotifications}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16, gap: 14 },

    // Header
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    // Change 1: greeting style is now the main header text (replaces "Dashboard")
    greeting: {
      fontSize: 18,
      color: t.TEXT,
      fontWeight: "700" as const,
      marginBottom: 3,
    },
    dateText: { fontSize: 12, color: t.MUTED, marginTop: 1 },
    bellBtn: {
      backgroundColor: t.CARD,
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: t.BORDER,
      position: "relative" as const,
    },
    bellDot: {
      position: "absolute" as const,
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#FF4757",
      borderWidth: 2,
      borderColor: t.BG,
    },

    // Card
    card: {
      backgroundColor: t.CARD,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: t.BORDER,
    },

    // Streak
    streakHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    streakFire: { fontSize: 26 },
    streakCount: { fontSize: 17, fontWeight: "800" as const, color: "#FF6B35" },
    streakSub: { fontSize: 11, color: t.MUTED, marginTop: 1 },
    streakEmpty: { fontSize: 14, fontWeight: "600" as const, color: t.MUTED },

    // Progress ring
    ringCard: { alignItems: "center", gap: 18 },
    // Change 3: ringPct color is applied inline (dynamic), only size/weight here
    ringPct: { fontSize: 32, fontWeight: "800" as const },
    ringLabel: { fontSize: 11, color: t.MUTED, marginTop: 2 },
    pillRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap" as const,
      justifyContent: "center",
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pillIcon: { fontSize: 12 },
    pillPct: { fontSize: 11, fontWeight: "700" as const },
    pillLabel: { fontSize: 11, color: t.MUTED },

    // Quick stats
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: t.CARD,
      borderRadius: 14,
      padding: 12,
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
    },
    statNum: { fontSize: 14, fontWeight: "800" as const, color: t.TEXT },
    // Change 7: grey subdued goal text within stat number
    statGoal: { fontSize: 10, fontWeight: "400" as const, color: t.MUTED },
    statLabel: { fontSize: 10, color: t.MUTED },

    // Section header
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
    seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: { fontSize: 13, color: "#FF6B35", fontWeight: "600" as const },

    // Habits
    emptyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
    emptyRowText: { fontSize: 13, color: t.MUTED },
    emptyRowAction: { fontSize: 13, color: "#FF6B35", fontWeight: "600" as const },
    habitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: t.BORDER,
    },
    habitRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    habitCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    habitIconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      flexShrink: 0,
    },
    habitEmoji: { fontSize: 15 },
    habitName: { flex: 1, fontSize: 13, fontWeight: "600" as const, color: t.TEXT },
    habitNameDone: {
      textDecorationLine: "line-through" as const,
      color: t.MUTED,
    },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    streakBadgeFireIcon: { fontSize: 10 },
    streakBadgeText: { fontSize: 10, fontWeight: "700" as const },

    // Nutrition
    nutritionActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    scanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "#20D9A018",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: "#20D9A044",
    },
    scanBtnText: { fontSize: 11, color: "#20D9A0", fontWeight: "700" as const },
    macroRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    macroLabel: { fontSize: 11, color: t.MUTED, width: 44 },
    macroTrack: {
      flex: 1,
      height: 5,
      backgroundColor: t.BORDER,
      borderRadius: 3,
      overflow: "hidden" as const,
    },
    macroFill: { height: "100%" as any, borderRadius: 3 },
    macroVal: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: t.TEXT,
      width: 32,
      textAlign: "right" as const,
    },
    macroDivider: { height: 8 },
    calRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 12,
      backgroundColor: t.CARD2,
      borderRadius: 10,
      padding: 10,
    },
    calLabel: { fontSize: 13, color: t.MUTED },
    calValue: { fontSize: 15, fontWeight: "800" as const, color: t.TEXT },
    calGoal: { fontSize: 12, fontWeight: "400" as const, color: t.MUTED },

    // Tasks
    allClearText: {
      fontSize: 14,
      color: t.MUTED,
      textAlign: "center" as const,
      paddingVertical: 8,
    },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: t.BORDER,
    },
    taskDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    taskName: { flex: 1, fontSize: 13, color: t.TEXT, fontWeight: "500" as const },

    // Activity
    activityRingsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingTop: 4,
    },
    activityRingItem: { alignItems: "center", gap: 6 },
    activityRingLabel: { fontSize: 11, color: t.MUTED, fontWeight: "500" as const },
    activityRingVal: { fontSize: 11, color: t.TEXT, fontWeight: "700" as const },
    logActivityBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#FF6B3518",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: "#FF6B3533",
    },
    logActivityText: { fontSize: 11, color: "#FF6B35", fontWeight: "700" as const },

    // Get started
    getStartedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    getStartedTitle: { fontSize: 17, fontWeight: "700" as const, color: t.TEXT },
    getStartedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.BORDER,
    },
    getStartedNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "#FF6B3522",
      alignItems: "center",
      justifyContent: "center",
    },
    getStartedNumText: { fontSize: 12, fontWeight: "800" as const, color: "#FF6B35" },
    getStartedLabel: {
      flex: 1,
      fontSize: 14,
      color: t.TEXT,
      fontWeight: "500" as const,
    },

    // FAB
    fabContainer: { position: "absolute" as const, right: 16, zIndex: 50 },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#FF6B35",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#FF6B35",
      shadowOpacity: 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    fabOpen: { backgroundColor: t.BORDER },
    fabOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 140,
    },
    fabSheet: { borderRadius: 20, padding: 8, width: 220, borderWidth: 1 },
    fabAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
    },
    fabActionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    fabActionLabel: { fontSize: 14, fontWeight: "600" as const },

    // ── Calendar Modal ───────────────────────────────────────────────────────
    calOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    calSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    calHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    calNavBtn: { padding: 6 },
    calMonthLabel: { fontSize: 16, fontWeight: "700" as const },
    calDayHeaders: { flexDirection: "row", marginBottom: 6 },
    calDayHeader: {
      flex: 1,
      textAlign: "center" as const,
      fontSize: 11,
      fontWeight: "600" as const,
    },
    calWeekRow: { flexDirection: "row", marginBottom: 4 },
    calDayBtn: { flex: 1, alignItems: "center", paddingVertical: 3 },
    calDayCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    calDayNum: { fontSize: 12 },
    calTodayBtn: {
      marginTop: 14,
      backgroundColor: "#FF6B3520",
      borderRadius: 12,
      padding: 13,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#FF6B3540",
    },
    calTodayText: { color: "#FF6B35", fontWeight: "700" as const, fontSize: 14 },

    // ── Notification Sheet ───────────────────────────────────────────────────
    sheetOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    notifSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: "72%" as any,
      paddingBottom: 36,
    },
    notifHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    notifTitle: { fontSize: 18, fontWeight: "700" as const },
    markReadText: { fontSize: 13, color: "#FF6B35", fontWeight: "600" as const },
    notifEmpty: { alignItems: "center", paddingVertical: 36 },
    notifEmptyText: { fontSize: 14, marginTop: 10 },
    notifItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      position: "relative" as const,
    },
    notifUnreadDot: {
      position: "absolute" as const,
      left: -2,
      top: 20,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#FF6B35",
    },
    notifItemIcon: { fontSize: 20, marginTop: 1 },
    notifItemTitle: { fontSize: 13, fontWeight: "700" as const },
    notifItemBody: { fontSize: 12, marginTop: 2, lineHeight: 17 },
    notifTime: { fontSize: 10, marginTop: 2, flexShrink: 0 },

    // ── Permission Sheet ─────────────────────────────────────────────────────
    permOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    permSheet: {
      borderRadius: 24,
      padding: 28,
      width: "100%",
      alignItems: "center",
    },
    permEmoji: { fontSize: 48, marginBottom: 14 },
    permTitle: {
      fontSize: 22,
      fontWeight: "800" as const,
      marginBottom: 10,
      textAlign: "center" as const,
    },
    permBody: {
      fontSize: 14,
      textAlign: "center" as const,
      lineHeight: 21,
      marginBottom: 28,
    },
    permAllow: {
      backgroundColor: "#FF6B35",
      borderRadius: 14,
      padding: 14,
      width: "100%",
      alignItems: "center",
      marginBottom: 10,
    },
    permAllowText: { color: "#fff", fontWeight: "700" as const, fontSize: 16 },
    permLater: { padding: 10 },
    permLaterText: { fontSize: 14 },
  });
