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

// ── Custom Events ─────────────────────────────────────────────────────────────

export const logEvent = async (
  eventName: string,
  params?: Record<string, any>
): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Analytics] Event: ${eventName}`, params);
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
    if (__DEV__) console.log(`[Analytics] User: ${userId}`, properties);
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

