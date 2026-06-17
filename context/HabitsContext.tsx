import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { getStoredJson, getStoredString, removeStoredItems, setStoredJson, setStoredString } from "@/utils/storage";
import { logEvent, logError } from "@/utils/analytics";
import { syncHabitsToCloud, fetchHabitsFromCloud } from "@/utils/cloudSync";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showInterstitialAd } from "../utils/ads";

export type TrackMethod = "task" | "amount" | "time";
export type HabitType = "build" | "quit";

export interface HabitColor {
  bg: string;
  icon: string;
  id: string;
}

export const HABIT_COLORS: HabitColor[] = [
  { id: "green", bg: "#B8F0C8", icon: "#34C759" },
  { id: "purple", bg: "#DDD6FE", icon: "#8B5CF6" },
  { id: "yellow", bg: "#FEF08A", icon: "#F59E0B" },
  { id: "orange", bg: "#FED7AA", icon: "#F97316" },
  { id: "pink", bg: "#FBCFE8", icon: "#EC4899" },
  { id: "blue", bg: "#BFDBFE", icon: "#3B82F6" },
  { id: "teal", bg: "#CCFBF1", icon: "#14B8A6" },
  { id: "red", bg: "#FEE2E2", icon: "#EF4444" },
];

// Expanded emoji library (~60 emojis) — grouped by category in AddHabitSheet UI.
// Stored as a flat array for backwards compatibility with existing habits.
export const HABIT_EMOJIS = [
  // Fitness
  "🏃", "💪", "🏋️", "🚴", "🏊", "🤸", "⚽", "🎾", "🏸", "🥊", "🧗", "🏅",
  // Health
  "💊", "💧", "🍎", "🥗", "🥦", "😴", "🩺", "🌡️", "🫀", "🧬", "🍵", "🫁",
  // Mind
  "📚", "🧠", "🎯", "🎨", "🎵", "🌿", "📝", "💡", "🧩", "🎭", "🎲", "🔬",
  // Productivity
  "⏰", "✅", "📋", "🗓️", "💼", "📊", "🚀", "💻", "✍️", "🔑", "📱", "🎙️",
  // Lifestyle
  "☕", "🌙", "🌅", "🏠", "🌱", "🎁", "🛁", "🐕", "🌸", "❤️", "🍳", "🧹",
];

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  trackMethod: TrackMethod;
  colorId: string;
  emoji: string;
  targetAmount?: number;
  targetTimeSeconds?: number;
  weekDays: number[];    // Array of weekday numbers 0–6 (0=Sun)
  createdAt: string;
  description?: string; // Optional short note/description
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;          // "YYYY-MM-DD"
  completed: boolean;
  amount?: number;
  timeSeconds?: number;
}

interface HabitsContextType {
  habits: Habit[];
  habitLogs: HabitLog[];
  addHabit: (habit: Omit<Habit, "id" | "createdAt">) => void;
  updateHabit: (habitId: string, updates: Partial<Omit<Habit, "id" | "createdAt">>) => void;
  deleteHabit: (habitId: string) => void;
  logHabit: (habitId: string, date: string, data: Partial<HabitLog>) => void;
  getHabitLog: (habitId: string, date: string) => HabitLog | undefined;
  getHabitsForDate: (date: string, weekDay: number) => Habit[];
  getStreak: (habitId: string) => { current: number; best: number };
  getCompletionRate: (habitId: string) => number;
  clearTodayHabitLogs: (date: string) => void;
}

const HabitsContext = createContext<HabitsContextType | undefined>(undefined);

const DATA_VERSION = "v2_empty";
const VERSION_KEY = "@lyfeos_version";
const HABITS_KEY = "@lyfeos_habits_v2";
const HABIT_LOGS_KEY = "@lyfeos_habit_logs_v2";

export function HabitsProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  // Keep a ref so callbacks always see the latest user/isGuest without re-creating them
  const authRef = React.useRef({ user, isGuest });
  React.useEffect(() => { authRef.current = { user, isGuest }; }, [user, isGuest]);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const version = await getStoredString(VERSION_KEY);
        if (version !== DATA_VERSION) {
          // Clear old mock data, start fresh
          await removeStoredItems([
            "@lyfeos_habits",
            "@lyfeos_habit_logs",
            "@lyfeos_todos",
            "@lyfeos_food",
            "@lyfeos_water",
          ]);
          await setStoredString(VERSION_KEY, DATA_VERSION);
          setHabits([]);
          setHabitLogs([]);
        } else {
          const [storedHabits, storedLogs] = await Promise.all([
            getStoredJson<Habit[]>(HABITS_KEY, []),
            getStoredJson<HabitLog[]>(HABIT_LOGS_KEY, []),
          ]);
          setHabits(storedHabits);
          setHabitLogs(storedLogs);

          // Cloud sync: fetch from Firestore if logged-in non-guest user
          if (user && !isGuest) {
            const cloudHabits = await fetchHabitsFromCloud(user.uid);
            if (cloudHabits && cloudHabits.length > 0) {
              setHabits(cloudHabits);
              await setStoredJson(HABITS_KEY, cloudHabits);
            }
          }
        }
      } catch {
        setHabits([]);
        setHabitLogs([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, [user, isGuest]);

  const persist = useCallback(async (h: Habit[], l: HabitLog[]) => {
    await Promise.all([
      setStoredJson(HABITS_KEY, h),
      setStoredJson(HABIT_LOGS_KEY, l),
    ]);
  }, []);

  // ── Show interstitial ad every 3rd habit completion ——————————————————
  const maybeShowCompletionAd = async () => {
    try {
      const countStr = await AsyncStorage.getItem('habitCompletionCount');
      const count = parseInt(countStr || '0') + 1;
      await AsyncStorage.setItem('habitCompletionCount', String(count));
      if (count % 3 === 0) {
        showInterstitialAd().catch(e => console.log('Habit completion ad failed silently:', e));
      }
    } catch (e) {
      console.log('Ad counter error (non-fatal):', e);
    }
  };

  const addHabit = useCallback((habit: Omit<Habit, "id" | "createdAt">) => {
    const newHabit: Habit = {
      ...habit,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    // Bug 3 fix: read latest habitLogs from inside setHabitLogs updater to avoid stale closure
    setHabits((prevHabits) => {
      const next = [...prevHabits, newHabit];
      setHabitLogs((prevLogs) => {
        persist(next, prevLogs);
        const { user: u, isGuest: g } = authRef.current;
        if (u && !g) { syncHabitsToCloud(u.uid, next); }
        return prevLogs;
      });
      return next;
    });
    // Fire analytics event (non-blocking)
    logEvent("habit_created", { habitName: habit.name }).catch(() => { });
  }, [persist]);

  const updateHabit = useCallback((habitId: string, updates: Partial<Omit<Habit, "id" | "createdAt">>) => {
    // Bug 3 fix: read latest habitLogs from inside setHabitLogs updater to avoid stale closure
    setHabits((prevHabits) => {
      const next = prevHabits.map((h) => h.id === habitId ? { ...h, ...updates } : h);
      setHabitLogs((prevLogs) => {
        persist(next, prevLogs);
        const { user: u, isGuest: g } = authRef.current;
        if (u && !g) { syncHabitsToCloud(u.uid, next); }
        return prevLogs;
      });
      return next;
    });
  }, [persist]);

  const deleteHabit = useCallback((habitId: string) => {
    setHabits((prev) => {
      const next = prev.filter((h) => h.id !== habitId);
      setHabitLogs((logs) => {
        const nextLogs = logs.filter((l) => l.habitId !== habitId);
        persist(next, nextLogs);
        const { user: u, isGuest: g } = authRef.current;
        if (u && !g) { syncHabitsToCloud(u.uid, next); }
        return nextLogs;
      });
      return next;
    });
  }, [persist]);

  const logHabit = useCallback((habitId: string, date: string, data: Partial<HabitLog>) => {
    setHabitLogs((prev) => {
      const existingIdx = prev.findIndex((l) => l.habitId === habitId && l.date === date);
      let next: HabitLog[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...data };
      } else {
        const newLog: HabitLog = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          habitId,
          date,
          completed: false,
          ...data,
        };
        next = [...prev, newLog];
      }
      persist(habits, next);
      const { user: u, isGuest: g } = authRef.current;
      if (u && !g) { syncHabitsToCloud(u.uid, habits); }
      // Fire analytics when habit is completed
      if (data.completed === true) {
        const habit = habits.find((h) => h.id === habitId);
        logEvent("habit_completed", { habitName: habit?.name ?? habitId }).catch(() => { });
        // Show interstitial ad every 3rd completion (non-blocking, fire-and-forget)
        maybeShowCompletionAd();
      }
      return next;
    });
  }, [habits, persist]);

  const getHabitLog = useCallback((habitId: string, date: string) => {
    return habitLogs.find((l) => l.habitId === habitId && l.date === date);
  }, [habitLogs]);

  const getHabitsForDate = useCallback((date: string, weekDay: number) => {
    return habits.filter((h) => h.weekDays.includes(weekDay));
  }, [habits]);

  const getStreak = useCallback((habitId: string) => {
    const logDates = habitLogs
      .filter((l) => l.habitId === habitId && l.completed)
      .map((l) => l.date);

    if (logDates.length === 0) return { current: 0, best: 0 };

    const logSet = new Set(logDates);

    // Bug 12 fix: timezone-safe date subtraction using local date parts
    function localDateStr(d: Date): string {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    function subtractDay(dateStr: string): string {
      const [y, mo, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, mo - 1, d - 1);
      return localDateStr(dt);
    }
    function addDay(dateStr: string): string {
      const [y, mo, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, mo - 1, d + 1);
      return localDateStr(dt);
    }

    const todayDate = new Date();
    const today = localDateStr(todayDate);
    const yesterday = subtractDay(today);

    // Current streak: consecutive days going back from today (or yesterday if today not logged)
    let current = 0;
    const startDate = logSet.has(today) ? today : logSet.has(yesterday) ? yesterday : null;
    if (startDate) {
      let checkDate = startDate;
      while (logSet.has(checkDate)) {
        current++;
        checkDate = subtractDay(checkDate);
      }
    }

    // Best streak: longest consecutive run across all logged dates
    const sortedDates = [...logSet].sort();
    let best = 0;
    let tempStreak = 0;
    let prevDate: string | null = null;
    for (const dateStr of sortedDates) {
      if (prevDate === null) {
        tempStreak = 1;
      } else {
        const expectedNext = addDay(prevDate);
        tempStreak = dateStr === expectedNext ? tempStreak + 1 : 1;
      }
      best = Math.max(best, tempStreak);
      prevDate = dateStr;
    }

    return { current, best };
  }, [habitLogs]);

  const getCompletionRate = useCallback((habitId: string) => {
    const logs = habitLogs.filter((l) => l.habitId === habitId);
    if (logs.length === 0) return 0;
    const completed = logs.filter((l) => l.completed).length;
    return Math.round((completed / logs.length) * 100);
  }, [habitLogs]);

  const clearTodayHabitLogs = useCallback((date: string) => {
    setHabitLogs((prev) => {
      const next = prev.filter((l) => l.date !== date);
      persist(habits, next);
      return next;
    });
  }, [habits, persist]);

  if (!loaded) return null;

  return (
    <HabitsContext.Provider
      value={{
        habits,
        habitLogs,
        addHabit,
        updateHabit,
        deleteHabit,
        logHabit,
        getHabitLog,
        getHabitsForDate,
        getStreak,
        getCompletionRate,
        clearTodayHabitLogs,
      }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabits must be used within HabitsProvider");
  return ctx;
}
