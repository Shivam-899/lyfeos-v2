import AsyncStorage from "@react-native-async-storage/async-storage";

function logStorageError(action: string, key: string, error: unknown) {
  console.warn(`[Storage] ${action} failed for ${key}:`, error);
}

export async function getStoredString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    logStorageError("Read", key, error);
    return null;
  }
}

export function parseStoredJson<T>(raw: string | null, key: string, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logStorageError("Parse", key, error);
    return fallback;
  }
}

export async function getStoredJson<T>(key: string, fallback: T): Promise<T> {
  return parseStoredJson(await getStoredString(key), key, fallback);
}

export async function setStoredString(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    logStorageError("Write", key, error);
    return false;
  }
}

export async function setStoredJson<T>(key: string, value: T): Promise<boolean> {
  return setStoredString(key, JSON.stringify(value));
}

export async function removeStoredItem(key: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    logStorageError("Remove", key, error);
    return false;
  }
}

export async function removeStoredItems(keys: string[]): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch (error) {
    logStorageError("Remove multiple", keys.join(", "), error);
    return false;
  }
}

export async function clearStoredData(): Promise<boolean> {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    logStorageError("Clear", "AsyncStorage", error);
    return false;
  }
}

/** Complete list of all known LyfeOS user data keys in AsyncStorage */
export const LYFEOS_STORAGE_KEYS = [
  // Core user data
  "@lyfeos_food_v2",
  "@lyfeos_water_v2",
  "@lyfeos_goal_v2",
  "@lyfeos_goals_configured_v1",
  "@lyfeos_food_meta_v1",
  "@lyfeos_habits_v2",
  "@lyfeos_habit_logs_v2",
  "@lyfeos_version",
  "@lyfeos_todos_v2",
  "@lyfeos_activity_logs_v1",
  "@lyfeos_steps_v1",
  "@lyfeos_activity_banner_v1",
  "@lyfeos_coach_insight_v1",
  "@lyfeos_profile_name_v1",
  "@lyfeos_profile_join_v1",
  "@lyfeos_profile_habitgoal_v1",
  "@lyfeos_profile_actgoal_v1",
  "@lyfeos_profile_health_v1",
  "@lyfeos_profile_reminders_v1",
  "@lyfeos_profile_prefs_v1",
  "@lyfeos_profile_meta_v1",
  "@lyfeos_theme_mode_v1",
  "@lyfeos_notifications_v1",
  "@lyfeos_notif_enabled_v1",
  "@lyfeos_notif_asked_v1",
  "@lyfeos_rate_reminder_v1",
  "@lyfeos_last_timezone_v1",
  "@lyfeos_confetti_date_v1",
  "@lyfeos_pending_migration_v1",
  // Legacy keys
  "@lyfeos_habits",
  "@lyfeos_habit_logs",
  "@lyfeos_todos",
  "@lyfeos_food",
  "@lyfeos_water",
  // User consent and counters
  "legalConsent",
  "habitCompletionCount",
  "notificationsEnabled",
  "lastFoodSearchDate",
  "foodSearchCount",
  "foodBonusSearches",
  "lastInterstitialDate",
  "todoBonusUnlocks",
  "habitBonusUnlocks",
  "lastActivityLogDate",
  "activityLogCount",
  "activityBonusLogs",
];

/**
 * Permanently removes all LyfeOS user data from AsyncStorage.
 * Scans dynamically for any '@lyfeos_' keys and deletes them along with all known keys.
 * Preserves 'hasSeenOnboarding' so user lands on login/welcome screen.
 */
export async function clearAllLyfeOSLocalData(): Promise<boolean> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const dynamicLyfeKeys = allKeys.filter(
      (k) => k.startsWith("@lyfeos_") || k.startsWith("lyfeos_")
    );
    const combinedKeys = Array.from(
      new Set([...LYFEOS_STORAGE_KEYS, ...dynamicLyfeKeys])
    );
    await AsyncStorage.multiRemove(combinedKeys);
    // Explicitly preserve onboarding completed so the user is routed to Login instead of Onboarding
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    return true;
  } catch (error) {
    logStorageError("clearAllLyfeOSLocalData", "all", error);
    return false;
  }
}

/**
 * Inspects local AsyncStorage to determine if the device contains genuine,
 * meaningful user data created during a guest session.
 *
 * Strict deterministic criteria (P1-9 Phase 2B-1):
 * - Returns FALSE if local storage only contains default preferences, joinDate,
 *   legal consent, empty arrays, or soft-deleted tombstones.
 * - Returns TRUE if at least one active habit, active habit log, active todo,
 *   active food item, water log (>0 glasses), active workout, steps record (>0 steps),
 *   custom health profile metric, custom calorie goal, or custom profile name exists.
 */
export async function hasMeaningfulGuestData(): Promise<boolean> {
  try {
    const [
      localHabits,
      localHabitLogs,
      localTodos,
      localFood,
      localWater,
      localActivityLogs,
      localStepsLogs,
      localHealth,
      localGoalsConfigured,
      localProfileName,
    ] = await Promise.all([
      getStoredJson<any[]>("@lyfeos_habits_v2", []),
      getStoredJson<any[]>("@lyfeos_habit_logs_v2", []),
      getStoredJson<any[]>("@lyfeos_todos_v2", []),
      getStoredJson<any[]>("@lyfeos_food_v2", []),
      getStoredJson<any[]>("@lyfeos_water_v2", []),
      getStoredJson<any[]>("@lyfeos_activity_logs_v1", []),
      getStoredJson<any[]>("@lyfeos_steps_v1", []),
      getStoredJson<any>("@lyfeos_profile_health_v1", null),
      getStoredString("@lyfeos_goals_configured_v1"),
      getStoredString("@lyfeos_profile_name_v1"),
    ]);

    // 1. Active habit (not soft-deleted)
    if (Array.isArray(localHabits) && localHabits.some((h) => h && !h.deletedAt)) {
      return true;
    }

    // 2. Active habit log (not soft-deleted)
    if (Array.isArray(localHabitLogs) && localHabitLogs.some((l) => l && !l.deletedAt)) {
      return true;
    }

    // 3. Active todo (not soft-deleted)
    if (Array.isArray(localTodos) && localTodos.some((t) => t && !t.deletedAt)) {
      return true;
    }

    // 4. Active food item (not soft-deleted)
    if (Array.isArray(localFood) && localFood.some((f) => f && !f.deletedAt)) {
      return true;
    }

    // 5. Water with glasses > 0 (not soft-deleted)
    if (
      Array.isArray(localWater) &&
      localWater.some((w) => w && !w.deletedAt && typeof w.glasses === "number" && w.glasses > 0)
    ) {
      return true;
    }

    // 6. Active workout / activity record (not soft-deleted)
    if (Array.isArray(localActivityLogs) && localActivityLogs.some((a) => a && !a.deletedAt)) {
      return true;
    }

    // 7. Active steps record with steps > 0 (not soft-deleted)
    if (
      Array.isArray(localStepsLogs) &&
      localStepsLogs.some((s) => s && !s.deletedAt && typeof s.steps === "number" && s.steps > 0)
    ) {
      return true;
    }

    // 8. Custom health profile metrics differing from empty/default
    if (localHealth && typeof localHealth === "object") {
      const meaningfulHealthFields = ["age", "sex", "height", "weight", "activityLevel", "goal"];
      const hasCustomHealth = meaningfulHealthFields.some((field) => {
        const val = localHealth[field];
        return typeof val === "string" && val.trim() !== "";
      });
      if (hasCustomHealth) {
        return true;
      }
    }

    // 9. Configured custom calorie goal
    if (localGoalsConfigured === "true") {
      return true;
    }

    // 10. Custom profile name differing from default
    if (
      typeof localProfileName === "string" &&
      localProfileName.trim() !== "" &&
      localProfileName !== "LyfeOS User"
    ) {
      return true;
    }

    return false;
  } catch (error) {
    logStorageError("hasMeaningfulGuestData", "all", error);
    return false;
  }
}

export interface PendingMigrationCheckpoint {
  version: 1;
  targetUid: string;
  createdAt: number;
  status: "pending" | "cloud_merged";
}

export const PENDING_MIGRATION_KEY = "@lyfeos_pending_migration_v1";

export async function getPendingMigrationCheckpoint(): Promise<PendingMigrationCheckpoint | null> {
  return await getStoredJson<PendingMigrationCheckpoint | null>(PENDING_MIGRATION_KEY, null);
}

export async function setPendingMigrationCheckpoint(checkpoint: PendingMigrationCheckpoint): Promise<boolean> {
  return await setStoredJson(PENDING_MIGRATION_KEY, checkpoint);
}

export async function clearPendingMigrationCheckpoint(): Promise<boolean> {
  return await removeStoredItem(PENDING_MIGRATION_KEY);
}
