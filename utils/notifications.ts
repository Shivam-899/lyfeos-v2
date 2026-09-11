/**
 * utils/notifications.ts
 * Centralised smart notification engine for LyfeOS.
 * Handles permissions, Android channels, daily automatic schedules,
 * and context-aware smart personalization with anti-spam protection.
 */

import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logError } from "./analytics";
import { getLocalDateString } from "./date";
import { getStoredJson, getStoredString, setStoredJson } from "./storage";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Master Notification Toggle & Timezone Storage ─────────────────────────────
export const NOTIF_ENABLED_KEY = "@lyfeos_notif_enabled_v1";
export const LEGACY_NOTIF_ENABLED_KEY = "notificationsEnabled";
export const LAST_TIMEZONE_KEY = "@lyfeos_last_timezone_v1";

/**
 * Reads the master notification toggle.
 * Performs a one-time migration from the legacy "notificationsEnabled" key if present.
 * Defaults to true for fresh installations if neither key exists.
 */
export const getMasterNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const canonical = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
    if (canonical !== null) {
      return canonical === "true";
    }

    // Check legacy key for migration
    const legacy = await AsyncStorage.getItem(LEGACY_NOTIF_ENABLED_KEY);
    if (legacy !== null) {
      const isEnabled = legacy === "true";
      // Migrate to canonical key
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(isEnabled));
      return isEnabled;
    }

    // Default to true for fresh installations (user has not explicitly disabled)
    return true;
  } catch (e) {
    logError(e as Error, "getMasterNotificationsEnabled");
    return true;
  }
};

/**
 * Updates the master notification toggle.
 * Writes to both the canonical key and the legacy key for backward compatibility.
 * When set to false, immediately cancels all scheduled OS notifications.
 */
export const setMasterNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(enabled)),
      AsyncStorage.setItem(LEGACY_NOTIF_ENABLED_KEY, String(enabled)),
    ]);
    if (!enabled) {
      await cancelAllNotifications();
      console.log("[Notifications] master toggle disabled — all notifications cancelled");
    }
  } catch (e) {
    logError(e as Error, "setMasterNotificationsEnabled");
  }
};

// ── Permissions & Channel Health ──────────────────────────────────────────────

export interface NotificationPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus | "granted" | "denied" | "undetermined";
}

/**
 * Checks whether the default Android notification channel exists and is not blocked by user settings.
 * Returns true on non-Android platforms.
 */
export const isAndroidChannelHealthy = async (channelId: string = "default"): Promise<boolean> => {
  try {
    if (Platform.OS !== "android") return true;
    const channel = await Notifications.getNotificationChannelAsync(channelId);
    if (!channel) {
      // Channel not yet registered; will be created on scheduling
      return true;
    }
    // If importance is NONE (0), notifications are blocked for this channel in System Settings
    if (channel.importance === Notifications.AndroidImportance.NONE) {
      return false;
    }
    return true;
  } catch (e) {
    logError(e as Error, "isAndroidChannelHealthy");
    return true;
  }
};

/**
 * Ensures the default Android notification channel is registered with the system.
 */
export const ensureNotificationChannel = async (): Promise<void> => {
  try {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync("default", {
      name: "LyfeOS Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B35",
    });
  } catch (e) {
    logError(e as Error, "ensureNotificationChannel");
  }
};

/**
 * Checks whether notification permission is currently granted at the OS level and channel is unblocked.
 * Pure query — does not prompt the user or trigger any dialogs.
 */
export const hasNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "web") return false;
    const settings = await Notifications.getPermissionsAsync();
    const isGranted = Boolean(settings.granted || settings.status === "granted");
    if (!isGranted) return false;

    // On Android, verify the target channel is not blocked
    if (Platform.OS === "android") {
      const channelHealthy = await isAndroidChannelHealthy("default");
      if (!channelHealthy) return false;
    }

    return true;
  } catch (e) {
    logError(e as Error, "hasNotificationPermission");
    return false;
  }
};

/**
 * Returns detailed permission status including canAskAgain and channel health.
 */
export const getDetailedNotificationPermissions = async (): Promise<NotificationPermissionResult> => {
  try {
    if (Platform.OS === "web") {
      return { granted: false, canAskAgain: false, status: "denied" };
    }
    const settings = await Notifications.getPermissionsAsync();
    let isGranted = Boolean(settings.granted || settings.status === "granted");
    const canAskAgain = settings.canAskAgain ?? true;

    if (isGranted && Platform.OS === "android") {
      const channelHealthy = await isAndroidChannelHealthy("default");
      if (!channelHealthy) {
        isGranted = false;
      }
    }

    return {
      granted: isGranted,
      canAskAgain,
      status: settings.status || (isGranted ? "granted" : "denied"),
    };
  } catch (e) {
    logError(e as Error, "getDetailedNotificationPermissions");
    return { granted: false, canAskAgain: false, status: "denied" };
  }
};

/**
 * Requests OS notification permissions.
 * Explicitly distinguishes between granted, denied, and permanently blocked (canAskAgain === false).
 */
export const requestNotificationPermissions = async (): Promise<NotificationPermissionResult> => {
  try {
    if (Platform.OS === "web") {
      return { granted: false, canAskAgain: false, status: "denied" };
    }

    const settings = await Notifications.getPermissionsAsync();
    let isGranted = Boolean(settings.granted || settings.status === "granted");
    let canAskAgain = settings.canAskAgain ?? true;
    let status = settings.status;

    if (!isGranted) {
      // If the OS cannot show the dialog anymore, return immediately so caller can show Settings fallback
      if (!canAskAgain) {
        return { granted: false, canAskAgain: false, status: status || "denied" };
      }

      const requestResult = await Notifications.requestPermissionsAsync();
      isGranted = Boolean(requestResult.granted || requestResult.status === "granted");
      canAskAgain = requestResult.canAskAgain ?? true;
      status = requestResult.status;
    }

    if (Platform.OS === "android" && isGranted) {
      await ensureNotificationChannel();
      const channelHealthy = await isAndroidChannelHealthy("default");
      if (!channelHealthy) {
        isGranted = false;
      }
    }

    return {
      granted: isGranted,
      canAskAgain,
      status: status || (isGranted ? "granted" : "denied"),
    };
  } catch (e) {
    logError(e as Error, "requestNotificationPermissions");
    return { granted: false, canAskAgain: false, status: "denied" };
  }
};

/**
 * Opens system application settings for LyfeOS so user can manually re-enable notifications.
 */
export const openNotificationSettings = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "web") return false;
    await Linking.openSettings();
    return true;
  } catch (e) {
    logError(e as Error, "openNotificationSettings");
    return false;
  }
};

/**
 * Compares current device timezone against last stored timezone.
 * If changed, updates cache and triggers a schedule refresh.
 */
export const checkTimezoneChangeAndRefresh = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "web") return false;
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!currentTimezone) return false;

    const storedTimezone = await AsyncStorage.getItem(LAST_TIMEZONE_KEY);
    if (!storedTimezone) {
      await AsyncStorage.setItem(LAST_TIMEZONE_KEY, currentTimezone);
      return false;
    }

    if (storedTimezone !== currentTimezone) {
      console.log(
        `[Notifications] timezone changed: ${storedTimezone} -> ${currentTimezone} — refreshing schedule`
      );
      await AsyncStorage.setItem(LAST_TIMEZONE_KEY, currentTimezone);
      await requestScheduleRefresh({ reason: "timezone_change" });
      return true;
    }

    return false;
  } catch (e) {
    logError(e as Error, "checkTimezoneChangeAndRefresh");
    return false;
  }
};

// ── Cancel All ────────────────────────────────────────────────────────────────

export const cancelAllNotifications = async (): Promise<void> => {
  try {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    logError(e as Error, "cancelAllNotifications");
  }
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReminderToggles {
  morning: boolean;
  meal: boolean;
  water: boolean;
  evening: boolean;
}

export interface SmartNotificationContext {
  userName?: string;
  habits?: Array<{ id: string; title: string; weekDays: number[] }>;
  habitLogs?: Array<{ habitId: string; date: string; completed: boolean }>;
  todos?: Array<{ id: string; title: string; completed: boolean; dueDate?: string; priority?: string }>;
  foodItems?: Array<{ meal: string; date: string; calories: number }>;
  waterLogs?: Array<{ date: string; glasses: number }>;
  dailyGoal?: { water?: number; calories?: number };
  activityLogs?: Array<{ date: string; sport: string; duration: number }>;
  activityGoalMinutes?: number;
}

export interface ScheduledNotificationItem {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  toggle: keyof ReminderToggles;
  route: string;
  priorityScore: number; // Higher = higher priority in anti-spam capping
}

// ── Schedule Builder (Pure Logic) ─────────────────────────────────────────────

export const MAX_DAILY_NOTIFICATIONS = 8;

export function buildSmartNotificationSchedule(
  reminders: ReminderToggles,
  context: SmartNotificationContext,
  currentDateStr: string = getLocalDateString()
): ScheduledNotificationItem[] {
  const name = context.userName ? `, ${context.userName}` : "";
  const dow = new Date(currentDateStr + "T00:00:00").getDay();

  const habits = context.habits || [];
  const habitLogs = context.habitLogs || [];
  const todos = context.todos || [];
  const foodItems = context.foodItems || [];
  const waterLogs = context.waterLogs || [];
  const activityLogs = context.activityLogs || [];

  // Habits evaluation for today
  const habitsToday = habits.filter((h) => h.weekDays.includes(dow));
  const completedHabitIds = new Set(
    habitLogs.filter((l) => l.date === currentDateStr && l.completed).map((l) => l.habitId)
  );
  const pendingHabits = habitsToday.filter((h) => !completedHabitIds.has(h.id));

  // Find habit streak at risk (completed in recent days, but not yet completed today)
  const habitsWithStreak: Array<{ title: string; streak: number }> = [];
  for (const habit of pendingHabits) {
    let streak = 0;
    const checkDate = new Date(currentDateStr + "T00:00:00");
    // Check previous consecutive days
    for (let i = 1; i <= 30; i++) {
      checkDate.setDate(checkDate.getDate() - 1);
      const dStr = getLocalDateString(checkDate);
      const wasDone = habitLogs.some((l) => l.habitId === habit.id && l.date === dStr && l.completed);
      if (wasDone) streak++;
      else break;
    }
    if (streak >= 3) {
      habitsWithStreak.push({ title: habit.title, streak });
    }
  }

  // Todos evaluation
  const pendingTodos = todos.filter(
    (t) => !t.completed && (t.dueDate === currentDateStr || (t.dueDate && t.dueDate < currentDateStr))
  );

  // Meals evaluation
  const mealsLogged = new Set(
    foodItems.filter((f) => f.date === currentDateStr).map((f) => f.meal.toLowerCase())
  );
  const breakfastLogged = mealsLogged.has("breakfast");
  const lunchLogged = mealsLogged.has("lunch");
  const dinnerLogged = mealsLogged.has("dinner");

  // Water evaluation
  const currentGlasses = waterLogs.find((w) => w.date === currentDateStr)?.glasses ?? 0;
  const targetWater = context.dailyGoal?.water ?? 8;
  const waterGoalMet = currentGlasses >= targetWater;

  // Activity evaluation
  const activitiesToday = activityLogs.filter((a) => a.date === currentDateStr);
  const totalActivityMins = activitiesToday.reduce((sum, a) => sum + (a.duration || 0), 0);
  const targetActivityMins = context.activityGoalMinutes ?? 30;
  const activityGoalMet = totalActivityMins >= targetActivityMins;

  const candidates: ScheduledNotificationItem[] = [];

  // 1. Morning Day-Start Check-In (08:00)
  if (reminders.morning) {
    let morningBody = "Start your day right — set your intentions and track your goals.";
    if (pendingHabits.length > 0 || pendingTodos.length > 0) {
      morningBody = "You have scheduled habits and tasks today. Let's make it count!";
    } else if (habitsToday.length > 0 && pendingHabits.length === 0) {
      morningBody = "Great start! You've already completed today's morning habits.";
    }

    candidates.push({
      id: "morning_start",
      title: `🌅 Good Morning${name}!`,
      body: morningBody,
      hour: 8,
      minute: 0,
      toggle: "morning",
      route: "/(tabs)/habits",
      priorityScore: 10,
    });
  }

  // 2. Breakfast Reminder (08:30)
  if (reminders.meal) {
    candidates.push({
      id: "meal_breakfast",
      title: "🥗 Breakfast Time",
      body: "Don't forget to fuel up and log your breakfast in LyfeOS!",
      hour: 8,
      minute: 30,
      toggle: "meal",
      route: "/(tabs)/calories",
      priorityScore: 7,
    });
  }

  // 3. Mid-Morning Hydration & Habit Reminder (11:00)
  if (reminders.water) {
    candidates.push({
      id: "water_midday",
      title: "💧 Hydration Check",
      body: "Stay hydrated throughout your day. Take a quick water break to recharge!",
      hour: 11,
      minute: 0,
      toggle: "water",
      route: "/(tabs)/calories",
      priorityScore: 6,
    });
  }

  // 4. Lunch Reminder (13:00)
  if (reminders.meal) {
    candidates.push({
      id: "meal_lunch",
      title: "🍱 Lunch Reminder",
      body: "Time to recharge! Log your lunch to stay on track with your macros.",
      hour: 13,
      minute: 0,
      toggle: "meal",
      route: "/(tabs)/calories",
      priorityScore: 8,
    });
  }

  // 5. Evening Activity / Sports Reminder (17:30)
  if (reminders.evening) {
    candidates.push({
      id: "activity_evening",
      title: "🏃 Workout & Movement",
      body: "Time for your workout, sports session, or a refreshing evening walk!",
      hour: 17,
      minute: 30,
      toggle: "evening",
      route: "/(tabs)/habits",
      priorityScore: 7,
    });
  }

  // 6. Evening Task & Habit Check + Streak Guard (19:30)
  if (reminders.evening) {
    let eveningTitle = "📋 Evening Check-In";
    let eveningBody = "Review your progress and wrap up your daily goals before midnight.";

    if (habitsWithStreak.length > 0) {
      eveningTitle = "🔥 Streak at Risk!";
      eveningBody = "Protect your active habit streaks — complete your daily habits before midnight!";
    } else if (pendingHabits.length > 0 || pendingTodos.length > 0) {
      eveningTitle = "📋 Finish Strong Today";
      eveningBody = "You have scheduled habits and tasks left to complete today. Let's finish strong!";
    } else if (habitsToday.length > 0) {
      eveningTitle = "🌟 All Habits & Tasks Done!";
      eveningBody = "You've crushed all your scheduled habits and tasks today. Great work!";
    }

    candidates.push({
      id: "evening_check",
      title: eveningTitle,
      body: eveningBody,
      hour: 19,
      minute: 30,
      toggle: "evening",
      route: "/(tabs)/habits",
      priorityScore: 10,
    });
  }

  // 7. Dinner Reminder (20:00)
  if (reminders.meal) {
    candidates.push({
      id: "meal_dinner",
      title: "🍽️ Dinner Time",
      body: "Log your dinner and complete your daily nutrition tracking.",
      hour: 20,
      minute: 0,
      toggle: "meal",
      route: "/(tabs)/calories",
      priorityScore: 8,
    });
  }

  // 8. Nightly Daily Review (21:30)
  if (reminders.evening) {
    candidates.push({
      id: "nightly_review",
      title: `🌙 Daily Review${name}`,
      body: "How did today go? Take 2 minutes to review your habits, nutrition, and steps.",
      hour: 21,
      minute: 30,
      toggle: "evening",
      route: "/(tabs)/index",
      priorityScore: 9,
    });
  }

  // 9. Wind-Down & Sleep Reminder (23:00)
  if (reminders.evening) {
    candidates.push({
      id: "wind_down",
      title: "😴 Wind Down & Rest",
      body: "Great job today. Time to unplug, rest up, and recharge for tomorrow.",
      hour: 23,
      minute: 0,
      toggle: "evening",
      route: "/(tabs)/index",
      priorityScore: 5,
    });
  }

  // Anti-spam filter: If candidates exceed MAX_DAILY_NOTIFICATIONS, sort by priorityScore desc
  if (candidates.length > MAX_DAILY_NOTIFICATIONS) {
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    const capped = candidates.slice(0, MAX_DAILY_NOTIFICATIONS);
    // Sort chronologically for execution
    capped.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return capped;
  }

  // Sort chronologically
  candidates.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return candidates;
}

// ── Storage Context Loader ────────────────────────────────────────────────────

async function loadStoredNotificationContext(): Promise<SmartNotificationContext> {
  try {
    const [habits, habitLogs, todos, foodItems, waterLogs, dailyGoal, activityLogs, userName, actGoalStr] =
      await Promise.all([
        getStoredJson<any[]>("@lyfeos_habits_v2", []),
        getStoredJson<any[]>("@lyfeos_habit_logs_v2", []),
        getStoredJson<any[]>("@lyfeos_todos_v2", []),
        getStoredJson<any[]>("@lyfeos_food_v2", []),
        getStoredJson<any[]>("@lyfeos_water_v2", []),
        getStoredJson<any>("@lyfeos_goal_v2", { water: 8 }),
        getStoredJson<any[]>("@lyfeos_activity_logs_v1", []),
        AsyncStorage.getItem("@lyfeos_profile_name_v1"),
        AsyncStorage.getItem("@lyfeos_profile_actgoal_v1"),
      ]);

    return {
      userName: userName || undefined,
      habits: (habits || []).filter((h: any) => !h.deletedAt),
      habitLogs: (habitLogs || []).filter((l: any) => !l.deletedAt),
      todos: (todos || []).filter((t: any) => !t.deletedAt),
      foodItems: (foodItems || []).filter((f: any) => !f.deletedAt),
      waterLogs: (waterLogs || []).filter((w: any) => !w.deletedAt),
      dailyGoal,
      activityLogs: (activityLogs || []).filter((l: any) => !l.deletedAt),
      activityGoalMinutes: actGoalStr ? parseInt(actGoalStr) || 30 : 30,
    };
  } catch (e) {
    return {};
  }
}

// ── Main Scheduler ────────────────────────────────────────────────────────────

export interface ScheduleRefreshOptions {
  reason?: string;
  userId?: string;
  reminders?: ReminderToggles;
  context?: SmartNotificationContext;
}

let activeSchedulingPromise: Promise<void> | null = null;
let pendingRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingRefreshOptions: ScheduleRefreshOptions | undefined;
let pendingResolvers: Array<() => void> = [];

/**
 * Centralized, debounced notification refresh coordinator.
 * Coalesces rapid calls (e.g. data updates, tab switches, foregrounding) into a single execution.
 */
export const requestScheduleRefresh = (options?: ScheduleRefreshOptions): Promise<void> => {
  pendingRefreshOptions = { ...pendingRefreshOptions, ...options };

  return new Promise((resolve) => {
    pendingResolvers.push(resolve);

    if (pendingRefreshTimeout) {
      clearTimeout(pendingRefreshTimeout);
    }

    pendingRefreshTimeout = setTimeout(async () => {
      pendingRefreshTimeout = null;
      const opts = pendingRefreshOptions;
      pendingRefreshOptions = undefined;
      const resolvers = pendingResolvers;
      pendingResolvers = [];

      try {
        if (activeSchedulingPromise) {
          await activeSchedulingPromise;
        }
        activeSchedulingPromise = scheduleDailyNotifications(
          opts?.reminders,
          opts?.context,
          opts?.userId,
          opts?.reason
        );
        await activeSchedulingPromise;
      } finally {
        activeSchedulingPromise = null;
        resolvers.forEach((r) => r());
      }
    }, 400);
  });
};

export const scheduleDailyNotifications = async (
  reminders?: ReminderToggles,
  context?: SmartNotificationContext,
  userId?: string,
  reason?: string
): Promise<void> => {
  try {
    if (Platform.OS === "web") return;

    // 1. Verify master notification toggle
    const isMasterEnabled = await getMasterNotificationsEnabled();
    if (!isMasterEnabled) {
      console.log("[Notifications] master toggle disabled — cancelling schedule");
      await cancelAllNotifications();
      return;
    }

    // 2. Verify actual OS notification permission
    const hasPermission = await hasNotificationPermission();
    if (!hasPermission) {
      console.log("[Notifications] permission unavailable — cancelling schedule");
      await cancelAllNotifications();
      return;
    }

    // Safe diagnostic logging
    if (userId) {
      const safeId = userId.length > 8 ? `${userId.slice(0, 4)}...${userId.slice(-4)}` : userId;
      console.log(`[Notifications] scheduling for user ${safeId} (${reason || "standard"})`);
    } else if (reason) {
      console.log(`[Notifications] scheduling (${reason})`);
    }

    // 3. Read current reminder preferences
    let r: ReminderToggles;
    if (reminders) {
      r = reminders;
    } else {
      const raw = await AsyncStorage.getItem("@lyfeos_profile_reminders_v1");
      r = raw
        ? JSON.parse(raw)
        : {
            morning: true,
            meal: true,
            water: true,
            evening: true,
          };
    }

    // 4. Build current notification schedule
    const ctx = context ?? (await loadStoredNotificationContext());
    const scheduledList = buildSmartNotificationSchedule(r, ctx);

    // 5. Cancel obsolete scheduled notifications
    await cancelAllNotifications();

    // 6. Ensure Android channel is registered and healthy
    if (Platform.OS === "android") {
      await ensureNotificationChannel();
      const channelHealthy = await isAndroidChannelHealthy("default");
      if (!channelHealthy) {
        console.log("[Notifications] Android channel 'default' is blocked — cancelling schedule");
        await cancelAllNotifications();
        return;
      }
    }

    // 7. Schedule current valid notifications with explicit channelId
    for (const notif of scheduledList) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          sound: true,
          data: { id: notif.id, route: notif.route },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: notif.hour,
          minute: notif.minute,
          channelId: "default",
        },
      });
    }

    // 8. Schedule or re-register Rate LyfeOS reminder if user is eligible
    await scheduleRateReminderIfEligible(ctx);

    console.log(`[Notifications] schedule refreshed (${scheduledList.length} items)`);
  } catch (e) {
    logError(e as Error, "scheduleDailyNotifications");
  }
};

// ── Rate LyfeOS Reminder Engine ──────────────────────────────────────────────

export const RATE_REMINDER_KEY = "@lyfeos_rate_reminder_v1";

export interface RateReminderState {
  scheduledFor: string | null;     // ISO timestamp of the planned trigger time
  lastTriggeredAt: string | null;  // ISO timestamp when the scheduled reminder time was passed
  cooldownUntil: string | null;    // ISO timestamp (30 days from last trigger)
}

const DEFAULT_RATE_REMINDER_STATE: RateReminderState = {
  scheduledFor: null,
  lastTriggeredAt: null,
  cooldownUntil: null,
};

/**
 * Evaluates user activity and schedules a gentle, one-shot "Rate LyfeOS" reminder notification.
 *
 * Rules:
 * 1. User has used LyfeOS for at least 7 calendar days since first meaningful usage (joinDate).
 * 2. User has had at least 5 meaningful active days across habit, food, or activity logs.
 * 3. Never schedules while a 30-day cooldown is active.
 * 4. Idempotent: If a reminder is already scheduled in the future, it is safely re-registered
 *    with the OS (since cancelAllNotifications cleared previous notifications) without creating duplicates.
 * 5. When a scheduled reminder's time has passed, begins a 30-day cooldown.
 * 6. Never directly invokes Google Play in-app review; tapping routes the user to the Profile tab.
 */
export async function scheduleRateReminderIfEligible(
  context?: SmartNotificationContext
): Promise<void> {
  try {
    if (Platform.OS === "web") return;

    // Check notification permission silently (never prompt here)
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== "granted") {
      return;
    }

    const state = await getStoredJson<RateReminderState>(
      RATE_REMINDER_KEY,
      DEFAULT_RATE_REMINDER_STATE
    );

    const now = new Date();

    // 1. Check if an active cooldown is in effect (30 days after a reminder trigger)
    if (state.cooldownUntil && new Date(state.cooldownUntil).getTime() > now.getTime()) {
      return;
    }

    // 2. Check if a previously scheduled reminder's time has passed
    // Android does not provide a reliable delivery callback in this setup, so we treat
    // "the scheduled reminder time has passed" as the practical indicator to begin the 30-day cooldown.
    if (state.scheduledFor && new Date(state.scheduledFor).getTime() <= now.getTime()) {
      const cooldownDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const updatedState: RateReminderState = {
        scheduledFor: null,
        lastTriggeredAt: now.toISOString(),
        cooldownUntil: cooldownDate.toISOString(),
      };
      await setStoredJson(RATE_REMINDER_KEY, updatedState);
      return;
    }

    // 3. If already scheduled for a future time, re-register the existing single notification
    // after cancelAllNotifications() without moving the time or creating duplicates
    if (state.scheduledFor && new Date(state.scheduledFor).getTime() > now.getTime()) {
      const targetDate = new Date(state.scheduledFor);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⭐ Enjoying LyfeOS?",
          body: "Your feedback helps us improve. Take a moment to rate LyfeOS.",
          sound: true,
          data: {
            id: "rate_reminder",
            route: "/(tabs)/profile",
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: "default",
        },
      });
      return;
    }

    // 4. Check eligibility criteria:
    // a) At least 7 calendar days since first meaningful usage / join date
    const joinDateStr = await getStoredString("@lyfeos_profile_join_v1");
    if (!joinDateStr) return;
    const joinTimestamp = new Date(joinDateStr).getTime();
    if (isNaN(joinTimestamp)) return;

    const daysSinceJoin = (now.getTime() - joinTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceJoin < 7) {
      return;
    }

    // b) At least 5 meaningful active days across habit, food, and activity logs
    const ctx = context ?? (await loadStoredNotificationContext());
    const activeDates = new Set<string>();

    if (ctx.habitLogs) {
      for (const log of ctx.habitLogs) {
        if (log?.date) activeDates.add(log.date);
      }
    }
    if (ctx.foodItems) {
      for (const item of ctx.foodItems) {
        if (item?.date) activeDates.add(item.date);
      }
    }
    if (ctx.activityLogs) {
      for (const act of ctx.activityLogs) {
        if (act?.date) activeDates.add(act.date);
      }
    }

    if (activeDates.size < 5) {
      return;
    }

    // 5. User is eligible: schedule one gentle reminder for 19:00 tomorrow (local time)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(19, 0, 0, 0);

    // Safeguard against edge cases
    if (targetDate.getTime() <= now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⭐ Enjoying LyfeOS?",
        body: "Your feedback helps us improve. Take a moment to rate LyfeOS.",
        sound: true,
        data: {
          id: "rate_reminder",
          route: "/(tabs)/profile",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        channelId: "default",
      },
    });

    const nextState: RateReminderState = {
      scheduledFor: targetDate.toISOString(),
      lastTriggeredAt: state.lastTriggeredAt,
      cooldownUntil: null,
    };
    await setStoredJson(RATE_REMINDER_KEY, nextState);
  } catch (e) {
    logError(e as Error, "scheduleRateReminderIfEligible");
  }
}
