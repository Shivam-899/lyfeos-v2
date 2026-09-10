/**
 * utils/notifications.ts
 * Centralised smart notification engine for LyfeOS.
 * Handles permissions, Android channels, daily automatic schedules,
 * and context-aware smart personalization with anti-spam protection.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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

// ── Permissions ───────────────────────────────────────────────────────────────

/**
 * Checks whether notification permission is currently granted at the OS level.
 * Pure query — does not prompt the user or trigger any dialogs.
 */
export const hasNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === "web") return false;
    const settings = await Notifications.getPermissionsAsync();
    return Boolean(settings.granted || settings.status === "granted");
  } catch (e) {
    logError(e as Error, "hasNotificationPermission");
    return false;
  }
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    // Notifications only work on native (Android/iOS), not web
    if (Platform.OS === "web") return false;

    const settings = await Notifications.getPermissionsAsync();
    let isGranted = Boolean(settings.granted || settings.status === "granted");

    if (!isGranted) {
      const requestResult = await Notifications.requestPermissionsAsync();
      isGranted = Boolean(requestResult.granted || requestResult.status === "granted");
    }

    if (Platform.OS === "android" && isGranted) {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LyfeOS Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });
    }

    return isGranted;
  } catch (e) {
    logError(e as Error, "requestNotificationPermissions");
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
      morningBody = `You have ${pendingHabits.length} habit${pendingHabits.length === 1 ? "" : "s"}${pendingTodos.length > 0 ? ` and ${pendingTodos.length} task${pendingTodos.length === 1 ? "" : "s"}` : ""} scheduled today. Let's make it count!`;
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

  // 2. Breakfast Reminder (08:30) - Suppressed if already logged
  if (reminders.meal && !breakfastLogged) {
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

  // 3. Mid-Morning Hydration & Habit Reminder (11:00) - Suppressed if water goal already met
  if (reminders.water && !waterGoalMet) {
    const waterBody = currentGlasses > 0
      ? `You're at ${currentGlasses}/${targetWater} glasses. Take a quick water break to stay energized!`
      : "Time for a fresh glass of water to keep your hydration on track.";
    candidates.push({
      id: "water_midday",
      title: "💧 Hydration Check",
      body: waterBody,
      hour: 11,
      minute: 0,
      toggle: "water",
      route: "/(tabs)/calories",
      priorityScore: 6,
    });
  }

  // 4. Lunch Reminder (13:00) - Suppressed if already logged
  if (reminders.meal && !lunchLogged) {
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

  // 5. Evening Activity / Sports Reminder (17:30) - Suppressed if activity goal met
  if (reminders.evening && !activityGoalMet) {
    const actBody = totalActivityMins > 0
      ? `You've logged ${totalActivityMins} mins. ${targetActivityMins - totalActivityMins} mins left to hit your goal!`
      : "Time for your workout, sports session, or a refreshing evening walk!";
    candidates.push({
      id: "activity_evening",
      title: "🏃 Workout & Movement",
      body: actBody,
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
    let eveningBody = "Review your progress and wrap up your daily goals.";

    if (habitsWithStreak.length > 0) {
      const topStreak = habitsWithStreak[0];
      eveningTitle = `🔥 Streak at Risk!`;
      eveningBody = `Protect your ${topStreak.streak}-day streak on "${topStreak.title}". Complete it before midnight!`;
    } else if (pendingHabits.length > 0 || pendingTodos.length > 0) {
      eveningTitle = "📋 Finish Strong Today";
      eveningBody = `You have ${pendingHabits.length} habit${pendingHabits.length === 1 ? "" : "s"}${pendingTodos.length > 0 ? ` and ${pendingTodos.length} task${pendingTodos.length === 1 ? "" : "s"}` : ""} left to complete.`;
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

  // 7. Dinner Reminder (20:00) - Suppressed if already logged
  if (reminders.meal && !dinnerLogged) {
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
      habits,
      habitLogs,
      todos: (todos || []).filter((t: any) => !t.deletedAt),
      foodItems,
      waterLogs,
      dailyGoal,
      activityLogs,
      activityGoalMinutes: actGoalStr ? parseInt(actGoalStr) || 30 : 30,
    };
  } catch (e) {
    return {};
  }
}

// ── Main Scheduler ────────────────────────────────────────────────────────────

export const scheduleDailyNotifications = async (
  reminders?: ReminderToggles,
  context?: SmartNotificationContext
): Promise<void> => {
  try {
    if (Platform.OS === "web") return;

    // Check if master notifications toggle is explicitly disabled
    const enabledRaw = await AsyncStorage.getItem("@lyfeos_notif_enabled_v1");
    if (enabledRaw === "false") {
      await cancelAllNotifications();
      return;
    }

    const r: ReminderToggles = reminders ?? {
      morning: true,
      meal: true,
      water: true,
      evening: true,
    };

    const ctx = context ?? (await loadStoredNotificationContext());
    const scheduledList = buildSmartNotificationSchedule(r, ctx);

    await cancelAllNotifications();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LyfeOS Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });
    }

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
        },
      });
    }

    // Schedule or re-register Rate LyfeOS reminder if user is eligible
    await scheduleRateReminderIfEligible(ctx);
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
