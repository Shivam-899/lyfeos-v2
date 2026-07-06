import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { syncCaloriesToCloud, fetchCaloriesFromCloud } from "@/utils/cloudSync";
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
  addFoodItem: (item: Omit<FoodItem, "id">) => void;
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

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [dailyGoal, setDailyGoalState] = useState<DailyGoal>(DEFAULT_GOAL);
  const [goalsConfigured, setGoalsConfiguredState] = useState(false);

  useEffect(() => {
    (async () => {
      const [food, water, goal, configured, localMeta] = await Promise.all([
        getStoredJson<FoodItem[]>(FOOD_KEY, []),
        getStoredJson<WaterLog[]>(WATER_KEY, []),
        getStoredJson<DailyGoal>(GOAL_KEY, DEFAULT_GOAL),
        getStoredString(GOALS_CONFIGURED_KEY),
        getStoredJson<{ lastModified: number }>(FOOD_META_KEY, { lastModified: 0 }),
      ]);
      setFoodItems(food);
      setWaterLogs(water);
      setDailyGoalState(goal);
      setGoalsConfiguredState(configured === "true");

      // ── Cloud sync: fetch from Firestore if logged-in non-guest user ──────
      if (user && !isGuest) {
        try {
          const cloudCalories = await fetchCaloriesFromCloud(user.uid);

          if (cloudCalories) {
            // "Most recent wins" guard.
            //
            // Previously the cloud data was blindly accepted and written back to
            // local disk. This caused data loss when a cloud upload was
            // interrupted mid-flight (e.g., user force-closed the app): on next
            // launch the stale cloud record overwrote the correct local data.
            //
            // Timestamp semantics:
            //   localLastModified  — Date.now() ms written to FOOD_META_KEY every
            //                        time food or water state is mutated locally.
            //   cloudLastModified  — same value echoed into the cloud payload by
            //                        buildCaloriesPayload(); absent on pre-fix docs.
            //
            // Safe-side defaults (prefer local when uncertain):
            //   • Cloud doc has no timestamp  → treat as "unknown age" → keep local.
            //   • Local meta is 0 (never set) AND cloud has a real timestamp
            //     → this device never wrote data; cloud wins.
            const localTs: number = localMeta.lastModified ?? 0;
            const cloudTs: number = (cloudCalories as any).lastModified ?? 0;
            const cloudIsNewer = cloudTs > localTs;

            if (cloudIsNewer) {
              // Cloud is definitively newer — safe to overwrite local.
              if (cloudCalories.foodItems) setFoodItems(cloudCalories.foodItems);
              if (cloudCalories.waterLogs) setWaterLogs(cloudCalories.waterLogs);
              if (cloudCalories.foodItems) await setStoredJson(FOOD_KEY, cloudCalories.foodItems);
              if (cloudCalories.waterLogs) await setStoredJson(WATER_KEY, cloudCalories.waterLogs);
              // Persist cloud's timestamp locally so future comparisons are accurate.
              await setStoredJson(FOOD_META_KEY, { lastModified: cloudTs });
            } else {
              // Local is newer or age is ambiguous — do NOT overwrite local.
              // Re-push local data to cloud in the background to repair the
              // stale cloud record left by the previous interrupted upload.
              syncCaloriesToCloud(
                user.uid,
                buildCaloriesPayload(food, water, localTs || Date.now()),
              ).catch((e) => logError(e as Error, "reupload_after_stale_cloud"));
            }
          }
        } catch (e) {
          // Network / Firestore error — silently keep local data, never overwrite.
          logError(e as Error, "fetchCaloriesFromCloud_onMount");
        }
      }
    })();
  }, [user, isGuest]);

  // Builds the Firestore payload. lastModified lives in the wrapper object,
  // NOT inside FoodItem[], so the FoodItem interface stays unchanged.
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
  // Called after every food/water mutation so both storage layers stay in sync.
  const persistAndSync = (food: FoodItem[], water: WaterLog[]) => {
    const lastModified = Date.now();
    void setStoredJson(FOOD_META_KEY, { lastModified });
    const { user: u, isGuest: g } = authRef.current;
    if (u && !g) {
      syncCaloriesToCloud(
        u.uid,
        buildCaloriesPayload(food, water, lastModified),
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
  }, []);

  const setGoalsConfigured = useCallback(async (v: boolean) => {
    setGoalsConfiguredState(v);
    await setStoredString(GOALS_CONFIGURED_KEY, String(v));
  }, []);

  const addFoodItem = useCallback((item: Omit<FoodItem, "id">) => {
    setFoodItems((prev) => {
      const newItem: FoodItem = {
        ...item,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      };
      const next = [...prev, newItem];
      void setStoredJson(FOOD_KEY, next);
      setWaterLogs((currentWater) => {
        persistAndSync(next, currentWater);
        return currentWater;
      });
      return next;
    });
    // Fire analytics event (non-blocking)
    logEvent("meal_logged", { mealType: item.meal }).catch(() => { });
  }, []);

  const deleteFoodItem = useCallback((id: string) => {
    setFoodItems((prev) => {
      const next = prev.filter((f) => f.id !== id);
      void setStoredJson(FOOD_KEY, next);
      setWaterLogs((currentWater) => {
        persistAndSync(next, currentWater);
        return currentWater;
      });
      return next;
    });
  }, []);

  const logWater = useCallback((date: string, delta: number) => {
    setWaterLogs((prev) => {
      const idx = prev.findIndex((w) => w.date === date);
      let next: WaterLog[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], glasses: Math.max(0, next[idx].glasses + delta) };
      } else {
        next = [...prev, { id: Date.now().toString(), date, glasses: Math.max(0, delta) }];
      }
      void setStoredJson(WATER_KEY, next);
      setFoodItems((currentFood) => {
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
    setFoodItems((prev) => {
      const next = prev.filter((f) => f.date !== date);
      void setStoredJson(FOOD_KEY, next);
      setWaterLogs((prevWater) => {
        const nextWater = prevWater.filter((w) => w.date !== date);
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
