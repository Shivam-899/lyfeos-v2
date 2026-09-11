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
  "@lyfeos_confetti_date_v1",
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

