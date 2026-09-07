import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getLocalDateString } from "@/utils/date";
import { getStoredJson, removeStoredItem, setStoredJson } from "@/utils/storage";
import { fetchActivityFromCloud, syncActivityToCloud } from "@/utils/cloudSync";
import { logError } from "@/utils/analytics";
import { useAuth } from "./AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  date: string;          // "YYYY-MM-DD"
  sport: string;
  emoji: string;
  duration: number;      // minutes
  intensity: "light" | "moderate" | "intense";
  caloriesBurned: number;
  hydrationNeededMl: number;
  hydrationGlasses: number;
  proteinNeededG: number;
  carbsNeededG: number;
  recoveryTimeHours: number;
  heartRateZone: string;
  healthBenefits: string[];
  tips: string[];
  postActivityMeal: string;
  sportCategory: string;
  steps?: number;
}

export interface StepsLog {
  date: string;
  steps: number;
  distanceKm: number;
  caloriesBurned: number;
  activeMinutes: number;
}

export interface PostActivityBanner {
  sport: string;
  emoji: string;
  meal: string;
  loggedAt: number;      // timestamp ms
}

export interface WeeklyCoachInsight {
  text: string;
  generatedAt: string;   // "YYYY-MM-DD"
}

interface ActivityContextType {
  activityLogs: ActivityLog[];
  stepsLogs: StepsLog[];
  postActivityBanner: PostActivityBanner | null;
  weeklyCoachInsight: WeeklyCoachInsight | null;
  addActivityLog: (log: Omit<ActivityLog, "id">) => void;
  deleteActivityLog: (id: string) => void;
  logSteps: (steps: StepsLog) => void;
  getStepsForDate: (date: string) => StepsLog | null;
  setPostActivityBanner: (b: PostActivityBanner | null) => void;
  setWeeklyCoachInsight: (insight: WeeklyCoachInsight) => void;
  getWeeklySports: () => { sport: string; emoji: string; sessions: number; totalMins: number; totalCals: number }[];
  getDailyActivityCalories: (date: string) => number;
  getDailyActivityMinutes: (date: string) => number;
  getBestStreak: () => number;
  getFavoriteSport: () => { sport: string; emoji: string; sessions: number } | null;
  getMostCalsBurned: () => ActivityLog | null;
  getLongestSession: () => ActivityLog | null;
  getMostActiveMonth: () => { sport: string; emoji: string } | null;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

const LOGS_KEY    = "@lyfeos_activity_logs_v1";
const STEPS_KEY   = "@lyfeos_steps_v1";
const BANNER_KEY  = "@lyfeos_activity_banner_v1";
const INSIGHT_KEY = "@lyfeos_coach_insight_v1";

function isoDate(d: Date) { return getLocalDateString(d); }

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return isoDate(d);
  });
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [stepsLogs, setStepsLogs] = useState<StepsLog[]>([]);
  const [postActivityBanner, setPostActivityBannerState] = useState<PostActivityBanner | null>(null);
  const [weeklyCoachInsight, setWeeklyCoachInsightState] = useState<WeeklyCoachInsight | null>(null);

  // ── Load from storage & Cloud sync ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [logs, steps, banner, insight] = await Promise.all([
        getStoredJson<ActivityLog[]>(LOGS_KEY, []),
        getStoredJson<StepsLog[]>(STEPS_KEY, []),
        getStoredJson<PostActivityBanner | null>(BANNER_KEY, null),
        getStoredJson<WeeklyCoachInsight | null>(INSIGHT_KEY, null),
      ]);
      setActivityLogs(logs);
      setStepsLogs(steps);

      try {
        if (banner) {
          const hoursOld = (Date.now() - banner.loggedAt) / 3_600_000;
          if (hoursOld < 2) setPostActivityBannerState(banner);
          else void removeStoredItem(BANNER_KEY);
        }
        if (insight) setWeeklyCoachInsightState(insight);
      } catch {}

      // ── Cloud restore on login for authenticated non-guest users ──────
      if (user && !user.isAnonymous) {
        try {
          const cloudActivity = await fetchActivityFromCloud(user.uid);
          if (cloudActivity) {
            if (Array.isArray(cloudActivity.activityLogs) && cloudActivity.activityLogs.length > 0) {
              if (logs.length === 0) {
                setActivityLogs(cloudActivity.activityLogs);
                await setStoredJson(LOGS_KEY, cloudActivity.activityLogs);
              } else {
                const existingIds = new Set(logs.map((l) => l.id));
                const toAdd = cloudActivity.activityLogs.filter((l: ActivityLog) => !existingIds.has(l.id));
                if (toAdd.length > 0) {
                  const merged = [...logs, ...toAdd];
                  setActivityLogs(merged);
                  await setStoredJson(LOGS_KEY, merged);
                }
              }
            }
            if (Array.isArray(cloudActivity.stepsLogs) && cloudActivity.stepsLogs.length > 0) {
              if (steps.length === 0) {
                setStepsLogs(cloudActivity.stepsLogs);
                await setStoredJson(STEPS_KEY, cloudActivity.stepsLogs);
              } else {
                const stepMap = new Map(steps.map((s) => [s.date, s]));
                for (const s of cloudActivity.stepsLogs) {
                  if (!stepMap.has(s.date)) {
                    stepMap.set(s.date, s);
                  }
                }
                const mergedSteps = Array.from(stepMap.values());
                setStepsLogs(mergedSteps);
                await setStoredJson(STEPS_KEY, mergedSteps);
              }
            }
            if (cloudActivity.coachInsight && !insight) {
              setWeeklyCoachInsightState(cloudActivity.coachInsight);
              await setStoredJson(INSIGHT_KEY, cloudActivity.coachInsight);
            }
          }
        } catch (e) {
          logError(e as Error, "fetchActivityFromCloud_onMount");
        }
      }
    })();
  }, [user]);

  const addActivityLog = useCallback((log: Omit<ActivityLog, "id">) => {
    setActivityLogs(prev => {
      const newLog: ActivityLog = { ...log, id: Date.now().toString() + Math.random().toString(36).slice(2, 7) };
      const next = [...prev, newLog];
      void setStoredJson(LOGS_KEY, next);
      const currentUser = userRef.current;
      if (currentUser && !currentUser.isAnonymous) {
        syncActivityToCloud(currentUser.uid, { activityLogs: next }).catch((e) => logError(e, "sync_addActivityLog"));
      }
      return next;
    });
  }, []);

  const deleteActivityLog = useCallback((id: string) => {
    setActivityLogs(prev => {
      const next = prev.filter(l => l.id !== id);
      void setStoredJson(LOGS_KEY, next);
      const currentUser = userRef.current;
      if (currentUser && !currentUser.isAnonymous) {
        syncActivityToCloud(currentUser.uid, { activityLogs: next }).catch((e) => logError(e, "sync_deleteActivityLog"));
      }
      return next;
    });
  }, []);

  const logSteps = useCallback((entry: StepsLog) => {
    setStepsLogs(prev => {
      const next = [...prev.filter(s => s.date !== entry.date), entry];
      void setStoredJson(STEPS_KEY, next);
      const currentUser = userRef.current;
      if (currentUser && !currentUser.isAnonymous) {
        syncActivityToCloud(currentUser.uid, { stepsLogs: next }).catch((e) => logError(e, "sync_logSteps"));
      }
      return next;
    });
  }, []);

  const getStepsForDate = useCallback((date: string) => {
    return stepsLogs.find(s => s.date === date) ?? null;
  }, [stepsLogs]);

  const setPostActivityBanner = useCallback((b: PostActivityBanner | null) => {
    setPostActivityBannerState(b);
    if (b) void setStoredJson(BANNER_KEY, b);
    else   void removeStoredItem(BANNER_KEY);
  }, []);

  const setWeeklyCoachInsight = useCallback((insight: WeeklyCoachInsight) => {
    setWeeklyCoachInsightState(insight);
    void setStoredJson(INSIGHT_KEY, insight);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncActivityToCloud(currentUser.uid, { coachInsight: insight }).catch((e) => logError(e, "sync_weeklyCoachInsight"));
    }
  }, []);

  const getWeeklySports = useCallback(() => {
    const days = last7Days();
    const weekLogs = activityLogs.filter(l => days.includes(l.date));
    const map = new Map<string, { sport: string; emoji: string; sessions: number; totalMins: number; totalCals: number }>();
    for (const l of weekLogs) {
      const key = l.sport;
      const existing = map.get(key);
      if (existing) {
        existing.sessions++;
        existing.totalMins += l.duration;
        existing.totalCals += l.caloriesBurned;
      } else {
        map.set(key, { sport: l.sport, emoji: l.emoji, sessions: 1, totalMins: l.duration, totalCals: l.caloriesBurned });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
  }, [activityLogs]);

  // ── FIX: include step-derived calories in addition to workout calories ──────
  const getDailyActivityCalories = useCallback((date: string) => {
    const workoutCals = activityLogs.filter(l => l.date === date).reduce((s, l) => s + l.caloriesBurned, 0);
    const stepEntry   = stepsLogs.find(s => s.date === date);
    return workoutCals + (stepEntry?.caloriesBurned ?? 0);
  }, [activityLogs, stepsLogs]);

  // ── FIX: include step-derived active minutes in addition to workout minutes ─
  const getDailyActivityMinutes = useCallback((date: string) => {
    const workoutMins = activityLogs.filter(l => l.date === date).reduce((s, l) => s + l.duration, 0);
    const stepEntry   = stepsLogs.find(s => s.date === date);
    return workoutMins + (stepEntry?.activeMinutes ?? 0);
  }, [activityLogs, stepsLogs]);

  const getBestStreak = useCallback(() => {
    if (activityLogs.length === 0) return 0;
    const activeDates = [...new Set(activityLogs.map(l => l.date))].sort();
    let best = 1, current = 1;
    for (let i = 1; i < activeDates.length; i++) {
      const prev = new Date(activeDates[i-1] + "T00:00:00");
      prev.setDate(prev.getDate() + 1);
      if (activeDates[i] === isoDate(prev)) { current++; best = Math.max(best, current); }
      else current = 1;
    }
    return best;
  }, [activityLogs]);

  const getFavoriteSport = useCallback(() => {
    const map = new Map<string, { sport: string; emoji: string; sessions: number }>();
    for (const l of activityLogs) {
      const e = map.get(l.sport);
      if (e) e.sessions++;
      else map.set(l.sport, { sport: l.sport, emoji: l.emoji, sessions: 1 });
    }
    let best: { sport: string; emoji: string; sessions: number } | null = null;
    for (const v of map.values()) {
      if (!best || v.sessions > best.sessions) best = v;
    }
    return best;
  }, [activityLogs]);

  const getMostCalsBurned = useCallback(() => {
    if (!activityLogs.length) return null;
    return activityLogs.reduce((best, l) => l.caloriesBurned > best.caloriesBurned ? l : best, activityLogs[0]);
  }, [activityLogs]);

  const getLongestSession = useCallback(() => {
    if (!activityLogs.length) return null;
    return activityLogs.reduce((best, l) => l.duration > best.duration ? l : best, activityLogs[0]);
  }, [activityLogs]);

  const getMostActiveMonth = useCallback(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const thisMonth = activityLogs.filter(l => l.date.startsWith(monthStr));
    const map = new Map<string, { sport: string; emoji: string; sessions: number }>();
    for (const l of thisMonth) {
      const e = map.get(l.sport);
      if (e) e.sessions++;
      else map.set(l.sport, { sport: l.sport, emoji: l.emoji, sessions: 1 });
    }
    let best: { sport: string; emoji: string; sessions: number } | null = null;
    for (const v of map.values()) {
      if (!best || v.sessions > best.sessions) best = v;
    }
    return best;
  }, [activityLogs]);

  return (
    <ActivityContext.Provider value={{
      activityLogs, stepsLogs, postActivityBanner, weeklyCoachInsight,
      addActivityLog, deleteActivityLog, logSteps, getStepsForDate,
      setPostActivityBanner, setWeeklyCoachInsight,
      getWeeklySports, getDailyActivityCalories, getDailyActivityMinutes,
      getBestStreak, getFavoriteSport, getMostCalsBurned, getLongestSession, getMostActiveMonth,
    }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}
