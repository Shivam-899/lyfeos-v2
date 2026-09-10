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
import crashlytics from "@react-native-firebase/crashlytics";
import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import Constants from "expo-constants";

// ── Meta SDK Initialization ───────────────────────────────────────────────────

export const initializeMetaSDK = async (): Promise<void> => {
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
    // Record breadcrumb and update current screen attribute in Crashlytics
    crashlytics().log(`[Navigation] Screen: ${screenName}`);
    await crashlytics().setAttribute("current_screen", screenName);
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

  // 2. Meta (Facebook) App Events (Dual logging for attribution & key actions)
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

  try {
    AppEventsLogger.setUserID(userId || null);
  } catch (e) {
    if (__DEV__) console.warn("[Meta] setUserID failed:", e);
  }
};

// ── Crashlytics Observability & Error Logging ─────────────────────────────────

const SENSITIVE_KEY_PATTERN = /password|token|secret|credential|auth|bearer|key|email|phone|card|authorization/i;

/**
 * Filter and sanitize custom attributes to ensure zero PII or credentials
 * are transmitted to Firebase Crashlytics.
 */
export const sanitizeCrashlyticsAttributes = (
  attributes?: Record<string, any>
): Record<string, string> => {
  if (!attributes) return {};
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue; // Omit sensitive keys entirely
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "object") {
      try {
        const jsonStr = JSON.stringify(value);
        sanitized[key] = jsonStr.slice(0, 500);
      } catch {
        sanitized[key] = "[Unserializable]";
      }
    } else {
      sanitized[key] = String(value).slice(0, 500);
    }
  }
  return sanitized;
};

/**
 * Records non-fatal JavaScript errors to Firebase Crashlytics with
 * context breadcrumbs and non-sensitive diagnostic metadata.
 */
export const logError = (
  error: Error | unknown,
  context?: string,
  attributes?: Record<string, any>
): void => {
  try {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(
            typeof error === "string"
              ? error
              : typeof error === "object" && error !== null && "message" in error
              ? String((error as any).message)
              : "Unknown application error"
          );

    if (__DEV__) {
      console.warn(`[Crashlytics] ${context ?? "Error"}:`, normalizedError);
    }

    if (context) {
      crashlytics().log(`[Context] ${context}`);
      crashlytics().setAttribute("last_error_context", context.slice(0, 100));
    }

    if (attributes) {
      const sanitized = sanitizeCrashlyticsAttributes(attributes);
      if (Object.keys(sanitized).length > 0) {
        crashlytics().setAttributes(sanitized);
      }
    }

    crashlytics().recordError(normalizedError);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] logError failed:", e);
  }
};

/**
 * Adds an in-session breadcrumb to the Crashlytics session log.
 */
export const logCrashlyticsBreadcrumb = (message: string): void => {
  try {
    crashlytics().log(message.slice(0, 1000));
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] logBreadcrumb failed:", e);
  }
};

/**
 * Sets a custom Crashlytics attribute with sanitization.
 */
export const setCrashlyticsAttribute = async (
  key: string,
  value: string
): Promise<void> => {
  try {
    if (SENSITIVE_KEY_PATTERN.test(key)) return;
    await crashlytics().setAttribute(key, String(value).slice(0, 500));
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] setAttribute failed:", e);
  }
};

/**
 * Initializes release and environment metadata in Crashlytics.
 */
export const initializeCrashlyticsMetadata = async (): Promise<void> => {
  try {
    const appEnv =
      process.env.EXPO_PUBLIC_APP_ENV ||
      process.env.APP_ENV ||
      (__DEV__ ? "development" : "production");

    await crashlytics().setAttributes({
      app_version: Constants.expoConfig?.version || "2.2.2",
      build_env: appEnv,
      platform: "android",
    });
    if (__DEV__) console.log("[Crashlytics] Metadata initialized:", appEnv);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] Metadata init failed:", e);
  }
};

/**
 * Associates an authenticated user UID with Crashlytics without exposing PII.
 */
export const setCrashlyticsUser = async (userId: string): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Crashlytics] User: ${userId}`);
    await crashlytics().setUserId(userId || "");
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] setCrashlyticsUser failed:", e);
  }
};

/**
 * Controlled, TEST-ONLY fatal crash trigger for verifying Crashlytics reporting.
 * Guarded against unintended execution in production.
 */
export const triggerCrashlyticsTestCrash = async (confirmKey?: string): Promise<void> => {
  if (!__DEV__ && confirmKey !== "CONFIRM_TEST_CRASH") {
    console.warn("[Crashlytics] Test crash blocked in non-development environment.");
    return;
  }
  console.log("[Crashlytics] Triggering controlled test crash...");
  // Explicitly enable Crashlytics collection so debug builds also record the crash
  await crashlytics().setCrashlyticsCollectionEnabled(true);
  crashlytics().log("Controlled test crash triggered by developer verification");
  crashlytics().crash();
};

