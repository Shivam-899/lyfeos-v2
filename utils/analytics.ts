/**
 * utils/analytics.ts
 * Analytics and error-logging utilities for LyfeOS.
 *
 * NOTE: @react-native-firebase/analytics and @react-native-firebase/crashlytics
 * require a full native rebuild (expo run:android) to activate.
 * Until then, all functions are safe no-ops so the app works without them.
 *
 * TO ENABLE:
 *   1. Run: npm install @react-native-firebase/analytics @react-native-firebase/crashlytics
 *   2. Run: npx expo run:android
 *   3. Uncomment the real implementations below and remove the stub sections.
 */

// ── Real implementations (uncomment after native rebuild) ────────────────────
// import analytics from "@react-native-firebase/analytics";
// import crashlytics from "@react-native-firebase/crashlytics";

// ── Screen Tracking ───────────────────────────────────────────────────────────

export const logScreen = async (screenName: string): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Analytics] Screen: ${screenName}`);
    // TODO: Uncomment after native rebuild:
    // await analytics().logScreenView({ screen_name: screenName, screen_class: screenName });
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
    // TODO: Uncomment after native rebuild:
    // await analytics().logEvent(eventName, params);
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
    // TODO: Uncomment after native rebuild:
    // await analytics().setUserId(userId);
    // if (properties) {
    //   for (const [key, value] of Object.entries(properties)) {
    //     await analytics().setUserProperty(key, String(value));
    //   }
    // }
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] setAnalyticsUser failed:", e);
  }
};

// ── Crashlytics Error Logging ─────────────────────────────────────────────────

export const logError = (error: Error, context?: string): void => {
  try {
    if (__DEV__) console.warn(`[Crashlytics] ${context ?? ""}`, error);
    // TODO: Uncomment after native rebuild:
    // crashlytics().recordError(error);
    // if (context) crashlytics().log(context);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] logError failed:", e);
  }
};

// ── Crashlytics User Identification ──────────────────────────────────────────

export const setCrashlyticsUser = async (userId: string): Promise<void> => {
  try {
    if (__DEV__) console.log(`[Crashlytics] User: ${userId}`);
    // TODO: Uncomment after native rebuild:
    // await crashlytics().setUserId(userId);
  } catch (e) {
    if (__DEV__) console.warn("[Crashlytics] setCrashlyticsUser failed:", e);
  }
};
