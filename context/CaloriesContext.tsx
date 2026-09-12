import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getStoredJson,
  getStoredString,
  setStoredJson,
  setStoredString,
} from "@/utils/storage";
import { logEvent, logError } from "@/utils/analytics";
import {
  syncCaloriesToCloud,
  fetchCaloriesFromCloud,
  normalizeFoodItem,
  normalizeWaterLog,
  mergeFoodItems,
  mergeWaterLogs,
} from "@/utils/cloudSync";
import { useAuth } from "@/context/AuthContext";

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  portionSize?: string;
  meal: MealType;
  date: string;
  potassium?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface DailyGoal {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  water: number;
}

export interface WaterLog {
  id: string;
  date: string;
  glasses: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface DayStats {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
  items: FoodItem[];
}

interface CaloriesContextType {
  foodItems: FoodItem[];
  waterLogs: WaterLog[];
  dailyGoal: DailyGoal;
  goalsConfigured: boolean;
  setDailyGoal: (goal: DailyGoal) => void;
  setGoalsConfigured: (v: boolean) => void;
  addFoodItem: (item: Omit<FoodItem, "id" | "updatedAt"> & { updatedAt?: number }) => void;
  deleteFoodItem: (id: string) => void;
  logWater: (date: string, delta: number) => void;
  getWaterForDate: (date: string) => number;
  getDayStats: (date: string) => DayStats;
  clearTodayData: (date: string) => void;
}

const CaloriesContext = createContext<CaloriesContextType | undefined>(undefined);

const FOOD_KEY             = "@lyfeos_food_v2";
const WATER_KEY            = "@lyfeos_water_v2";
const GOAL_KEY             = "@lyfeos_goal_v2";
const GOALS_CONFIGURED_KEY = "@lyfeos_goals_configured_v1";
// Tracks when food/water data was last mutated locally (Date.now() ms).
// Kept as a separate key so FoodItem[] shape is never changed.
const FOOD_META_KEY        = "@lyfeos_food_meta_v1";

const DEFAULT_GOAL: DailyGoal = {
  calories: 2000,
  carbs: 250,
  protein: 150,
  fat: 65,
  water: 8,
};

export function CaloriesProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  // Keep a ref so callbacks always see the latest user/isGuest without re-creating them
  const authRef = useRef({ user, isGuest });
  useEffect(() => { authRef.current = { user, isGuest }; }, [user, isGuest]);

  const [rawFoodItems, setRawFoodItems] = useState<FoodItem[]>([]);
  const [rawWaterLogs, setRawWaterLogs] = useState<WaterLog[]>([]);
  const [dailyGoal, setDailyGoalState] = useState<DailyGoal>(DEFAULT_GOAL);
  const [goalsConfigured, setGoalsConfiguredState] = useState(false);

  // Active items exposed to UI consumers (soft-deleted tombstones are hidden)
  const foodItems = useMemo(
    () => rawFoodItems.filter((f) => !f.deletedAt),
    [rawFoodItems]
  );
  const waterLogs = useMemo(
    () => rawWaterLogs.filter((w) => !w.deletedAt),
    [rawWaterLogs]
  );

  useEffect(() => {
    (async () => {
      const [storedFood, storedWater, goal, configured, localMeta] = await Promise.all([
        getStoredJson<any[]>(FOOD_KEY, []),
        getStoredJson<any[]>(WATER_KEY, []),
        getStoredJson<DailyGoal>(GOAL_KEY, DEFAULT_GOAL),
        getStoredString(GOALS_CONFIGURED_KEY),
        getStoredJson<{ lastModified: number }>(FOOD_META_KEY, { lastModified: 0 }),
      ]);

      const initialFood = (storedFood || [])
        .map((f) => normalizeFoodItem(f, f.updatedAt || localMeta.lastModified || 0))
        .filter((f): f is FoodItem => f !== null);
      const initialWater = (storedWater || [])
        .map((w) => normalizeWaterLog(w, w.updatedAt || localMeta.lastModified || 0))
        .filter((w): w is WaterLog => w !== null);

      setRawFoodItems(initialFood);
      setRawWaterLogs(initialWater);
      setDailyGoalState(goal);
      setGoalsConfiguredState(configured === "true");

      // ── Cloud sync: fetch from Firestore if logged-in non-guest user ──────
      if (user && !isGuest) {
        try {
          const cloudCalories = await fetchCaloriesFromCloud(user.uid);

          if (cloudCalories) {
            const cloudFood: any[] = Array.isArray(cloudCalories.foodItems) ? cloudCalories.foodItems : [];
            const cloudWater: any[] = Array.isArray(cloudCalories.waterLogs) ? cloudCalories.waterLogs : [];

            // Perform item-level bidirectional merge with Delete-Wins and conflict resolution
            const mergedFood = mergeFoodItems(initialFood, cloudFood) as FoodItem[];
            const mergedWater = mergeWaterLogs(initialWater, cloudWater) as WaterLog[];

            setRawFoodItems(mergedFood);
            setRawWaterLogs(mergedWater);
            await setStoredJson(FOOD_KEY, mergedFood);
            await setStoredJson(WATER_KEY, mergedWater);

            let finalGoal = goal;
            if (cloudCalories.dailyGoal) {
              finalGoal = cloudCalories.dailyGoal;
              setDailyGoalState(finalGoal);
              await setStoredJson(GOAL_KEY, finalGoal);
            }
            let finalConfigured = configured === "true";
            if (cloudCalories.goalsConfigured !== null && cloudCalories.goalsConfigured !== undefined) {
              finalConfigured = Boolean(cloudCalories.goalsConfigured);
              setGoalsConfiguredState(finalConfigured);
              await setStoredString(GOALS_CONFIGURED_KEY, String(finalConfigured));
            }

            const mergedLastModified = Math.max(
              localMeta.lastModified || 0,
              typeof cloudCalories.lastModified === "number" ? cloudCalories.lastModified : 0,
              ...mergedFood.map((f) => f.updatedAt || 0),
              ...mergedWater.map((w) => w.updatedAt || 0),
              Date.now()
            );
            await setStoredJson(FOOD_META_KEY, { lastModified: mergedLastModified });

            // Push merged state back to cloud so both device and cloud stay completely in sync
            syncCaloriesToCloud(
              user.uid,
              buildCaloriesPayload(mergedFood, mergedWater, mergedLastModified),
              finalGoal,
              finalConfigured,
            ).catch((e) => logError(e as Error, "syncCaloriesToCloud_onMountMerge"));
          }
        } catch (e) {
          // Network / Firestore error — silently keep local data, never overwrite.
          logError(e as Error, "fetchCaloriesFromCloud_onMount");
        }
      }
    })();
  }, [user, isGuest]);

  // Builds the Firestore payload.
  const buildCaloriesPayload = (
    food: FoodItem[],
    water: WaterLog[],
    lastModified: number = Date.now(),
  ) => ({
    foodItems: food,
    waterLogs: water,
    lastModified,
  });

  // Stamps local metadata (FOOD_META_KEY) and fires a cloud upload.
  // Called after every food/water mutation with the latest raw items.
  const persistAndSync = (food: FoodItem[], water: WaterLog[]) => {
    const lastModified = Date.now();
    void setStoredJson(FOOD_META_KEY, { lastModified });
    const { user: u, isGuest: g } = authRef.current;
    if (u && !g) {
      syncCaloriesToCloud(
        u.uid,
        buildCaloriesPayload(food, water, lastModified),
        dailyGoal,
        goalsConfigured,
      ).catch((e) => logError(e as Error, "syncCaloriesToCloud"));
    }
  };

  const setDailyGoal = useCallback(async (goal: DailyGoal) => {
    setDailyGoalState(goal);
    setGoalsConfiguredState(true);
    await Promise.all([
      setStoredJson(GOAL_KEY, goal),
      setStoredString(GOALS_CONFIGURED_KEY, "true"),
    ]);
    const { user: u, isGuest: g } = authRef.current;
    if (u && !g) {
      syncCaloriesToCloud(
        u.uid,
        buildCaloriesPayload(rawFoodItems, rawWaterLogs),
        goal,
        true,
      ).catch((e) => logError(e as Error, "syncCaloriesToCloud_dailyGoal"));
    }
  }, [rawFoodItems, rawWaterLogs]);

  const setGoalsConfigured = useCallback(async (v: boolean) => {
    setGoalsConfiguredState(v);
    await setStoredString(GOALS_CONFIGURED_KEY, String(v));
    const { user: u, isGuest: g } = authRef.current;
    if (u && !g) {
      syncCaloriesToCloud(
        u.uid,
        buildCaloriesPayload(rawFoodItems, rawWaterLogs),
        dailyGoal,
        v,
      ).catch((e) => logError(e as Error, "syncCaloriesToCloud_goalsConfigured"));
    }
  }, [rawFoodItems, rawWaterLogs, dailyGoal]);

  const addFoodItem = useCallback((item: Omit<FoodItem, "id" | "updatedAt"> & { updatedAt?: number }) => {
    const now = Date.now();
    setRawFoodItems((prev) => {
      const newItem: FoodItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        updatedAt: item.updatedAt ?? now,
      };
      delete newItem.deletedAt;
      const next = [...prev, newItem];
      void setStoredJson(FOOD_KEY, next);
      setRawWaterLogs((currentWater) => {
        persistAndSync(next, currentWater);
        return currentWater;
      });
      return next;
    });
    // Fire analytics event (non-blocking)
    logEvent("meal_logged", { mealType: item.meal }).catch(() => { });
  }, []);

  const deleteFoodItem = useCallback((id: string) => {
    const now = Date.now();
    setRawFoodItems((prev) => {
      const next = prev.map((f) => {
        if (f.id === id && !f.deletedAt) {
          return { ...f, deletedAt: now, updatedAt: now };
        }
        return f;
      });
      void setStoredJson(FOOD_KEY, next);
      setRawWaterLogs((currentWater) => {
        persistAndSync(next, currentWater);
        return currentWater;
      });
      return next;
    });
  }, []);

  const logWater = useCallback((date: string, delta: number) => {
    const now = Date.now();
    setRawWaterLogs((prev) => {
      const idx = prev.findIndex((w) => w.date === date);
      let next: WaterLog[];
      if (idx >= 0) {
        const existing = prev[idx];
        const currentGlasses = existing.deletedAt ? 0 : existing.glasses;
        const newGlasses = Math.max(0, currentGlasses + delta);
        next = [...prev];
        const updated: WaterLog = {
          ...existing,
          glasses: newGlasses,
          updatedAt: now,
        };
        delete updated.deletedAt;
        next[idx] = updated;
      } else {
        next = [
          ...prev,
          {
            id: Date.now().toString(),
            date,
            glasses: Math.max(0, delta),
            updatedAt: now,
          },
        ];
      }
      void setStoredJson(WATER_KEY, next);
      setRawFoodItems((currentFood) => {
        persistAndSync(currentFood, next);
        return currentFood;
      });
      return next;
    });
  }, []);

  const getWaterForDate = useCallback((date: string) => {
    return waterLogs.find((w) => w.date === date)?.glasses ?? 0;
  }, [waterLogs]);

  const getDayStats = useCallback((date: string): DayStats => {
    const items = foodItems.filter((f) => f.date === date);

    const aggregateNutrient = (key: keyof FoodItem) => {
      const hasData = items.some((f) => f[key] !== undefined && f[key] !== null);
      return hasData ? items.reduce((s, f) => s + (Number(f[key]) || 0), 0) : undefined;
    };

    return {
      calories: items.reduce((s, f) => s + f.calories, 0),
      carbs: items.reduce((s, f) => s + (f.carbs ?? 0), 0),
      protein: items.reduce((s, f) => s + (f.protein ?? 0), 0),
      fat: items.reduce((s, f) => s + (f.fat ?? 0), 0),
      fiber: aggregateNutrient("fiber"),
      sugar: aggregateNutrient("sugar"),
      sodium: aggregateNutrient("sodium"),
      potassium: aggregateNutrient("potassium"),
      calcium: aggregateNutrient("calcium"),
      iron: aggregateNutrient("iron"),
      magnesium: aggregateNutrient("magnesium"),
      zinc: aggregateNutrient("zinc"),
      vitaminA: aggregateNutrient("vitaminA"),
      vitaminC: aggregateNutrient("vitaminC"),
      vitaminD: aggregateNutrient("vitaminD"),
      vitaminB12: aggregateNutrient("vitaminB12"),
      items,
    };
  }, [foodItems]);

  const clearTodayData = useCallback((date: string) => {
    const now = Date.now();
    setRawFoodItems((prev) => {
      const next = prev.map((f) => {
        if (f.date === date && !f.deletedAt) {
          return { ...f, deletedAt: now, updatedAt: now };
        }
        return f;
      });
      void setStoredJson(FOOD_KEY, next);
      setRawWaterLogs((prevWater) => {
        const nextWater = prevWater.map((w) => {
          if (w.date === date && !w.deletedAt) {
            return { ...w, deletedAt: now, updatedAt: now };
          }
          return w;
        });
        void setStoredJson(WATER_KEY, nextWater);
        persistAndSync(next, nextWater);
        return nextWater;
      });
      return next;
    });
  }, []);

  return (
    <CaloriesContext.Provider
      value={{
        foodItems, waterLogs, dailyGoal, goalsConfigured,
        setDailyGoal, setGoalsConfigured,
        addFoodItem, deleteFoodItem, logWater, getWaterForDate, getDayStats,
        clearTodayData,
      }}
    >
      {children}
    </CaloriesContext.Provider>
  );
}

export function useCalories() {
  const ctx = useContext(CaloriesContext);
  if (!ctx) throw new Error("useCalories must be used within CaloriesProvider");
  return ctx;
}
