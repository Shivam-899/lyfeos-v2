import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getLocalDateString } from "@/utils/date";
import { getStoredJson, removeStoredItem, setStoredJson } from "@/utils/storage";
import {
  fetchActivityFromCloud,
  syncActivityToCloud,
  normalizeActivityLog,
  normalizeStepsLog,
  mergeActivityLogs,
  mergeStepsLogs,
} from "@/utils/cloudSync";
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
  updatedAt?: number;
  deletedAt?: number;
}

export interface StepsLog {
  date: string;
  steps: number;
  distanceKm: number;
  caloriesBurned: number;
  activeMinutes: number;
  updatedAt?: number;
  deletedAt?: number;
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
  addActivityLog: (log: Omit<ActivityLog, "id" | "updatedAt" | "deletedAt"> | ActivityLog) => void;
  deleteActivityLog: (id: string) => void;
  logSteps: (steps: StepsLog | Omit<StepsLog, "updatedAt" | "deletedAt">) => void;
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
  const { user, isGuest } = useAuth();
  const authRef = useRef({ user, isGuest });
  useEffect(() => { authRef.current = { user, isGuest }; }, [user, isGuest]);

  const [rawActivityLogs, setRawActivityLogs] = useState<ActivityLog[]>([]);
  const [rawStepsLogs, setRawStepsLogs] = useState<StepsLog[]>([]);
  const [postActivityBanner, setPostActivityBannerState] = useState<PostActivityBanner | null>(null);
  const [weeklyCoachInsight, setWeeklyCoachInsightState] = useState<WeeklyCoachInsight | null>(null);

  // Public activity and steps logs exposed to UI contain only active (non-tombstoned) items
  const activityLogs = useMemo(() => rawActivityLogs.filter((l) => !l.deletedAt), [rawActivityLogs]);
  const stepsLogs = useMemo(() => rawStepsLogs.filter((s) => !s.deletedAt), [rawStepsLogs]);

  // ── Load from storage & Cloud sync ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [logs, steps, banner, insight] = await Promise.all([
          getStoredJson<ActivityLog[]>(LOGS_KEY, []),
          getStoredJson<StepsLog[]>(STEPS_KEY, []),
          getStoredJson<PostActivityBanner | null>(BANNER_KEY, null),
          getStoredJson<WeeklyCoachInsight | null>(INSIGHT_KEY, null),
        ]);

        const localNormalizedLogs: ActivityLog[] = (logs || []).map(normalizeActivityLog);
        const localNormalizedSteps: StepsLog[] = (steps || []).map(normalizeStepsLog);

        setRawActivityLogs(localNormalizedLogs);
        setRawStepsLogs(localNormalizedSteps);

        try {
          if (banner) {
            const hoursOld = (Date.now() - banner.loggedAt) / 3_600_000;
            if (hoursOld < 2) setPostActivityBannerState(banner);
            else void removeStoredItem(BANNER_KEY);
          }
          if (insight) setWeeklyCoachInsightState(insight);
        } catch {}

        // ── Cloud restore & merge on mount for authenticated non-guest users ──────
        if (user && !isGuest) {
          try {
            const cloudActivity = await fetchActivityFromCloud(user.uid);
            if (cloudActivity) {
              const cloudLogs: any[] = Array.isArray(cloudActivity.activityLogs) ? cloudActivity.activityLogs : [];
              const cloudSteps: any[] = Array.isArray(cloudActivity.stepsLogs) ? cloudActivity.stepsLogs : [];

              const mergedLogs: ActivityLog[] = mergeActivityLogs(localNormalizedLogs, cloudLogs);
              const mergedSteps: StepsLog[] = mergeStepsLogs(localNormalizedSteps, cloudSteps);

              const logsChanged = JSON.stringify(mergedLogs) !== JSON.stringify(localNormalizedLogs);
              const stepsChanged = JSON.stringify(mergedSteps) !== JSON.stringify(localNormalizedSteps);

              if (logsChanged || stepsChanged) {
                setRawActivityLogs(mergedLogs);
                setRawStepsLogs(mergedSteps);
                await Promise.all([
                  setStoredJson(LOGS_KEY, mergedLogs),
                  setStoredJson(STEPS_KEY, mergedSteps),
                ]);
              }

              // Check if cloud needs sync
              const cloudNormalizedLogs = cloudLogs.map(normalizeActivityLog);
              const cloudNormalizedSteps = cloudSteps.map(normalizeStepsLog);
              const cloudNeedsSync =
                mergedLogs.length !== cloudNormalizedLogs.length ||
                mergedSteps.length !== cloudNormalizedSteps.length ||
                JSON.stringify(mergedLogs) !== JSON.stringify(cloudNormalizedLogs) ||
                JSON.stringify(mergedSteps) !== JSON.stringify(cloudNormalizedSteps);

              if (cloudNeedsSync) {
                syncActivityToCloud(user.uid, {
                  activityLogs: mergedLogs,
                  stepsLogs: mergedSteps,
                });
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
      } catch (e) {
        logError(e as Error, "ActivityContext_mount_error");
      }
    })();
  }, [user, isGuest]);

  const addActivityLog = useCallback((log: Omit<ActivityLog, "id" | "updatedAt" | "deletedAt"> | ActivityLog) => {
    setRawActivityLogs(prev => {
      const now = Date.now();
      const newLog: ActivityLog = {
        ...log,
        id: ('id' in log && log.id) ? log.id : (now.toString() + Math.random().toString(36).slice(2, 7)),
        updatedAt: ('updatedAt' in log && typeof log.updatedAt === 'number') ? log.updatedAt : now,
      };
      delete (newLog as any).deletedAt;
      const next = [...prev, newLog];
      void setStoredJson(LOGS_KEY, next);
      const { user: currentUser, isGuest: currentIsGuest } = authRef.current;
      if (currentUser && !currentIsGuest) {
        syncActivityToCloud(currentUser.uid, { activityLogs: next }).catch((e) => logError(e, "sync_addActivityLog"));
      }
      return next;
    });
  }, []);

  const deleteActivityLog = useCallback((id: string) => {
    setRawActivityLogs(prev => {
      const now = Date.now();
      const next = prev.map(l => {
        if (l.id === id) {
          return { ...l, deletedAt: now, updatedAt: now };
        }
        return l;
      });
      void setStoredJson(LOGS_KEY, next);
      const { user: currentUser, isGuest: currentIsGuest } = authRef.current;
      if (currentUser && !currentIsGuest) {
        syncActivityToCloud(currentUser.uid, { activityLogs: next }).catch((e) => logError(e, "sync_deleteActivityLog"));
      }
      return next;
    });
  }, []);

  const logSteps = useCallback((entry: StepsLog | Omit<StepsLog, "updatedAt" | "deletedAt">) => {
    setRawStepsLogs(prev => {
      const now = Date.now();
      const normalizedEntry: StepsLog = {
        ...entry,
        updatedAt: ('updatedAt' in entry && typeof entry.updatedAt === 'number') ? entry.updatedAt : now,
      };
      delete (normalizedEntry as any).deletedAt;
      const filtered = prev.filter(s => s.date !== entry.date);
      const next = [...filtered, normalizedEntry];
      void setStoredJson(STEPS_KEY, next);
      const { user: currentUser, isGuest: currentIsGuest } = authRef.current;
      if (currentUser && !currentIsGuest) {
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
    const { user: currentUser, isGuest: currentIsGuest } = authRef.current;
    if (currentUser && !currentIsGuest) {
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
