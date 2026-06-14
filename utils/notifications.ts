/**
 * utils/notifications.ts
 * Centralised notification utilities for LyfeOS.
 * Handles permissions, Android channels, and daily reminder scheduling.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logError } from "./analytics";

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

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    // Notifications only work on native (Android/iOS), not web
    if (Platform.OS === "web") return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LyfeOS Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });
    }

    return finalStatus === "granted";
  } catch (e) {
    logError(e as Error, "requestNotificationPermissions");
    return false;
  }
};

// ── Cancel All ────────────────────────────────────────────────────────────────

export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    logError(e as Error, "cancelAllNotifications");
  }
};

// ── Schedule Daily Notifications ──────────────────────────────────────────────

export const scheduleDailyNotifications = async (): Promise<void> => {
  try {
    await cancelAllNotifications();

    const notifications = [
      {
        id: "morning",
        title: "🌅 Good Morning!",
        body: "Start your day right — check your habits and set your goals.",
        hour: 8,
        minute: 0,
      },
      {
        id: "breakfast",
        title: "🥗 Breakfast Time",
        body: "Don't forget to log your breakfast in LyfeOS!",
        hour: 8,
        minute: 30,
      },
      {
        id: "hydration1",
        title: "💧 Hydration Check",
        body: "Have you had enough water today? Stay hydrated!",
        hour: 11,
        minute: 0,
      },
      {
        id: "lunch",
        title: "🍱 Lunch Reminder",
        body: "Log your lunch to stay on track with your nutrition goals.",
        hour: 13,
        minute: 0,
      },
      {
        id: "hydration2",
        title: "💧 Hydration Check",
        body: "Time for a water break — your body will thank you.",
        hour: 15,
        minute: 0,
      },
      {
        id: "dinner",
        title: "🍽️ Dinner Time",
        body: "Log your dinner and complete your daily nutrition tracking.",
        hour: 19,
        minute: 0,
      },
      {
        id: "evening",
        title: "🌙 Evening Check-in",
        body: "How did today go? Complete your habits and review your progress.",
        hour: 21,
        minute: 0,
      },
    ];

    for (const notif of notifications) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notif.title,
          body: notif.body,
          sound: true,
          data: { id: notif.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: notif.hour,
          minute: notif.minute,
        },
      });
    }
  } catch (e) {
    logError(e as Error, "scheduleDailyNotifications");
  }
};
