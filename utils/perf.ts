/**
 * utils/perf.ts
 * Firebase Performance Monitoring utility for LyfeOS.
 *
 * Provides safe, lightweight custom traces for measuring critical operations
 * (e.g. background cloud sync, authentication flows, and AI analysis)
 * with automatic PII sanitization and zero impact on UX.
 */

import perf, { FirebasePerformanceTypes } from "@react-native-firebase/perf";

const SENSITIVE_ATTR_PATTERN = /password|token|secret|credential|auth|bearer|key|email|phone|card|authorization/i;

/**
 * Sanitize trace attributes to ensure no secrets or sensitive user data are recorded.
 */
function sanitizeTraceAttributes(
  attributes?: Record<string, string>
): Record<string, string> {
  if (!attributes) return {};
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_ATTR_PATTERN.test(key)) continue;
    if (value === null || value === undefined) continue;
    // Firebase Perf attribute limits: key <= 32 chars, value <= 100 chars
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
    sanitized[safeKey] = String(value).slice(0, 100);
  }
  return sanitized;
}

/**
 * Start a custom Firebase Performance trace.
 * Returns a handle with stop(), putAttribute(), and putMetric() methods.
 */
export const startTrace = async (
  traceName: string,
  initialAttributes?: Record<string, string>
): Promise<{
  stop: () => Promise<void>;
  putAttribute: (name: string, value: string) => void;
  putMetric: (metricName: string, value: number) => void;
}> => {
  let nativeTrace: FirebasePerformanceTypes.Trace | null = null;
  try {
    const cleanName = traceName.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 100);
    nativeTrace = await perf().startTrace(cleanName);

    if (initialAttributes) {
      const sanitized = sanitizeTraceAttributes(initialAttributes);
      for (const [k, v] of Object.entries(sanitized)) {
        nativeTrace.putAttribute(k, v);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn(`[Perf] Failed to start trace "${traceName}":`, e);
  }

  return {
    stop: async () => {
      try {
        if (nativeTrace) {
          await nativeTrace.stop();
        }
      } catch (e) {
        if (__DEV__) console.warn(`[Perf] Failed to stop trace "${traceName}":`, e);
      }
    },
    putAttribute: (name: string, value: string) => {
      try {
        if (nativeTrace && !SENSITIVE_ATTR_PATTERN.test(name)) {
          const safeKey = name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
          nativeTrace.putAttribute(safeKey, String(value).slice(0, 100));
        }
      } catch (e) {
        if (__DEV__) console.warn(`[Perf] Failed putAttribute on "${traceName}":`, e);
      }
    },
    putMetric: (metricName: string, value: number) => {
      try {
        if (nativeTrace && typeof value === "number" && !isNaN(value)) {
          const safeMetric = metricName.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
          nativeTrace.putMetric(safeMetric, Math.round(value));
        }
      } catch (e) {
        if (__DEV__) console.warn(`[Perf] Failed putMetric on "${traceName}":`, e);
      }
    },
  };
};

/**
 * Measures the execution duration of an asynchronous operation using a custom trace.
 * Guarantees trace completion even if the operation throws an error.
 */
export const measureTrace = async <T>(
  traceName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> => {
  const trace = await startTrace(traceName, attributes);
  try {
    const result = await operation();
    trace.putAttribute("status", "success");
    return result;
  } catch (error) {
    trace.putAttribute("status", "error");
    throw error;
  } finally {
    await trace.stop();
  }
};
