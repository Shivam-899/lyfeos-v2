import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getStoredJson,
  getStoredString,
  setStoredJson,
  setStoredString,
} from "@/utils/storage";

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

const DEFAULT_GOAL: DailyGoal = {
  calories: 2000,
  carbs: 250,
  protein: 150,
  fat: 65,
  water: 8,
};

export function CaloriesProvider({ children }: { children: React.ReactNode }) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [dailyGoal, setDailyGoalState] = useState<DailyGoal>(DEFAULT_GOAL);
  const [goalsConfigured, setGoalsConfiguredState] = useState(false);

  useEffect(() => {
    (async () => {
      const [food, water, goal, configured] = await Promise.all([
        getStoredJson<FoodItem[]>(FOOD_KEY, []),
        getStoredJson<WaterLog[]>(WATER_KEY, []),
        getStoredJson<DailyGoal>(GOAL_KEY, DEFAULT_GOAL),
        getStoredString(GOALS_CONFIGURED_KEY),
      ]);
      setFoodItems(food);
      setWaterLogs(water);
      setDailyGoalState(goal);
      setGoalsConfiguredState(configured === "true");
    })();
  }, []);

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
      return next;
    });
  }, []);

  const deleteFoodItem = useCallback((id: string) => {
    setFoodItems((prev) => {
      const next = prev.filter((f) => f.id !== id);
      void setStoredJson(FOOD_KEY, next);
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
      return next;
    });
    setWaterLogs((prev) => {
      const next = prev.filter((w) => w.date !== date);
      void setStoredJson(WATER_KEY, next);
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
