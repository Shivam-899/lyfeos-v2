/**
 * utils/analytics.ts
 * Wraps Firebase Analytics and Crashlytics for LyfeOS.
 * All functions are safe to call — errors are caught and never crash the app.
 */

import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";

// ── Screen Tracking ───────────────────────────────────────────────────────────

export const logScreen = async (screenName: string): Promise<void> => {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (e) {
    // Never crash the app due to analytics failure
    if (__DEV__) console.warn("[Analytics] logScreen failed:", e);
  }
};

// ── Custom Events ─────────────────────────────────────────────────────────────

export const logEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    await analytics().logEvent(eventName, params);
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] logEvent failed:", e);
  }
};

// ── User Identification ───────────────────────────────────────────────────────

export const setAnalyticsUser = async (
  userId: string,
  properties?: Record<string, string>
): Promise<void> => {
  try {
    await analytics().setUserId(userId);
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        await analytics().setUserProperty(key, String(value));
      }
    }
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] setAnalyticsUser failed:", e);
  }
};

// ── Crashlytics Error Logging ─────────────────────────────────────────────────

export const logError = (error: Error, context?: string): void => {
  try {
    crashlytics().recordError(error);
    if (context) {
      crashlytics().log(context);
    }
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] logError failed:", e);
  }
};

// ── Crashlytics User Identification ──────────────────────────────────────────

export const setCrashlyticsUser = async (userId: string): Promise<void> => {
  try {
    await crashlytics().setUserId(userId);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] setCrashlyticsUser failed:", e);
  }
};
