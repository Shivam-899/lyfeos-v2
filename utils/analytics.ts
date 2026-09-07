/**
 * utils/analytics.ts
 * Analytics and error-logging utilities for LyfeOS.
 *
 * @react-native-firebase/analytics is now installed and active.
 * All analytics functions call the real Firebase Analytics SDK.
 *
 * NOTE: @react-native-firebase/crashlytics is still deferred (not yet installed).
 * logError() and setCrashlyticsUser() remain safe no-ops until Crashlytics is added.
 */

import analytics from "@react-native-firebase/analytics";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";

// ── Meta SDK Production Guard ─────────────────────────────────────────────────

/**
 * Returns true only in production environments.
 * Meta SDK is completely disabled in development builds (__DEV__) and preview builds.
 */
export const isMetaEnabled = (): boolean => {
  if (__DEV__) return false;
  if (process.env.EXPO_PUBLIC_APP_ENV && process.env.EXPO_PUBLIC_APP_ENV !== "production") {
    return false;
  }
  return true;
};

// ── Meta SDK Initialization ───────────────────────────────────────────────────

export const initializeMetaSDK = async (): Promise<void> => {
  if (!isMetaEnabled()) {
    if (__DEV__) console.log("[Meta] SDK initialization skipped (disabled in development/preview)");
    return;
  }
  try {
    Settings.initializeSDK();
    if (__DEV__) console.log("[Meta] SDK initialized successfully");
  } catch (e) {
    if (__DEV__) console.warn("[Meta] SDK initialization failed:", e);
  }
};

// ── Screen Tracking ───────────────────────────────────────────────────────────

export const logScreen = async (screenName: string): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Analytics] Screen: ${screenName}`);
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] logScreen failed:", e);
  }
};

// Helper to ensure parameters passed to Meta SDK match its `{ [key: string]: string | number }` requirement
const formatMetaParams = (p?: Record<string, any>): Record<string, string | number> | undefined => {
  if (!p) return undefined;
  const result: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "number" || typeof v === "string") {
      result[k] = v;
    } else if (v !== null && v !== undefined) {
      result[k] = String(v);
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

// ── Custom Events ─────────────────────────────────────────────────────────────

export const logEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  // 1. Firebase Analytics (Existing & unchanged)
  try {
    if (__DEV__) console.log(`[Analytics] Event: ${eventName}`, params);
    await analytics().logEvent(eventName, params);
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] logEvent failed:", e);
  }

  // 2. Meta (Facebook) App Events (Dual logging for attribution & key actions - Production only)
  if (isMetaEnabled()) {
    try {
      const metaParams = formatMetaParams(params);
      if (eventName === "login") {
        if (metaParams) {
          AppEventsLogger.logEvent("fb_mobile_login", metaParams);
        } else {
          AppEventsLogger.logEvent("fb_mobile_login");
        }
      } else if (eventName === "sign_up") {
        const regParams: Record<string, string | number> = {
          fb_registration_method: String(params?.method ?? "email"),
          ...(metaParams ?? {}),
        };
        AppEventsLogger.logEvent(AppEventsLogger.AppEvents.CompletedRegistration, regParams);
      } else if (eventName === "habit_completed") {
        if (metaParams) {
          AppEventsLogger.logEvent("HabitCompleted", metaParams);
        } else {
          AppEventsLogger.logEvent("HabitCompleted");
        }
      } else if (eventName === "meal_logged") {
        if (metaParams) {
          AppEventsLogger.logEvent("MealLogged", metaParams);
        } else {
          AppEventsLogger.logEvent("MealLogged");
        }
      }
    } catch (e) {
      if (__DEV__) console.warn("[Meta] logEvent failed:", e);
    }
  }
};

// ── User Identification ───────────────────────────────────────────────────────

export const setAnalyticsUser = async (
  userId: string,
  properties?: Record<string, string>
): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Analytics] User: ${userId}`, properties);
    await analytics().setUserId(userId || null);
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        await analytics().setUserProperty(key, String(value));
      }
    }
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] setAnalyticsUser failed:", e);
  }

  if (isMetaEnabled()) {
    try {
      AppEventsLogger.setUserID(userId || null);
    } catch (e) {
      if (__DEV__) console.warn("[Meta] setUserID failed:", e);
    }
  }
};

// ── Crashlytics Error Logging ─────────────────────────────────────────────────
// NOTE: @react-native-firebase/crashlytics is not yet installed.
// logError() is a safe no-op stub until Crashlytics is activated.

export const logError = (error: Error, context?: string): void => {
  try {
    if (__DEV__) console.warn(`[Crashlytics] ${context ?? ""}`, error);
    // TODO: Activate after installing @react-native-firebase/crashlytics:
    // crashlytics().recordError(error);
    // if (context) crashlytics().log(context);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] logError failed:", e);
  }
};

// ── Crashlytics User Identification ──────────────────────────────────────────
// NOTE: Stub — activate after installing @react-native-firebase/crashlytics.

export const setCrashlyticsUser = async (userId: string): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Crashlytics] User: ${userId}`);
    // TODO: Activate after installing @react-native-firebase/crashlytics:
    // await crashlytics().setUserId(userId);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] setCrashlyticsUser failed:", e);
  }
};

