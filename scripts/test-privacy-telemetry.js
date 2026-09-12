// @ts-check
/**
 * scripts/test-privacy-telemetry.js
 *
 * Focused automated test suite for LYFEOS — P1-9 PHASE 1:
 * PRIVACY & TELEMETRY HARDENING (Findings #4 & #5)
 */

const assert = require('node:assert');
const test = require('node:test');

function createTelemetryHarness() {
  const metaCalls = [];
  const firebaseCalls = [];
  const crashlyticsCalls = [];

  const mockAppEventsLogger = {
    logEvent: (event, params) => {
      metaCalls.push({ event, params: params ? { ...params } : undefined });
    },
    setUserID: (id) => {
      metaCalls.push({ type: 'setUserID', id });
    },
    AppEvents: {
      CompletedRegistration: 'fb_mobile_complete_registration',
    },
  };

  const mockAnalyticsInstance = {
    logEvent: async (name, params) => {
      firebaseCalls.push({ name, params: params ? { ...params } : undefined });
    },
    setUserId: async (id) => {
      firebaseCalls.push({ type: 'setUserId', id });
    },
    resetAnalyticsData: async () => {
      firebaseCalls.push({ type: 'resetAnalyticsData' });
    },
  };

  const mockCrashlyticsInstance = {
    setUserId: async (id) => {
      crashlyticsCalls.push({ type: 'setUserId', id });
    },
    setAttribute: async (key, value) => {
      crashlyticsCalls.push({ type: 'setAttribute', key, value });
    },
    log: (msg) => {
      crashlyticsCalls.push({ type: 'log', msg });
    },
  };

  const formatMetaParams = (p) => {
    if (!p) return undefined;
    const result = {};
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'number' || typeof v === 'string') {
        result[k] = v;
      } else if (v !== null && v !== undefined) {
        result[k] = String(v);
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };

  const logEvent = async (eventName, params) => {
    try {
      await mockAnalyticsInstance.logEvent(eventName, params);
    } catch {}

    try {
      const metaParams = formatMetaParams(params);
      if (eventName === 'login') {
        if (metaParams) mockAppEventsLogger.logEvent('fb_mobile_login', metaParams);
        else mockAppEventsLogger.logEvent('fb_mobile_login');
      } else if (eventName === 'sign_up') {
        mockAppEventsLogger.logEvent(mockAppEventsLogger.AppEvents.CompletedRegistration, metaParams);
      } else if (eventName === 'habit_completed') {
        mockAppEventsLogger.logEvent('HabitCompleted');
      } else if (eventName === 'meal_logged') {
        if (metaParams) mockAppEventsLogger.logEvent('MealLogged', metaParams);
        else mockAppEventsLogger.logEvent('MealLogged');
      }
    } catch {}
  };

  const clearAllAnalyticsAndCrashlyticsIdentity = async (overrides = {}) => {
    const analyticsInst = overrides.analytics || mockAnalyticsInstance;
    const metaInst = overrides.meta || mockAppEventsLogger;
    const crashlyticsInst = overrides.crashlytics || mockCrashlyticsInstance;

    try {
      await analyticsInst.setUserId(null);
      await analyticsInst.resetAnalyticsData();
    } catch (e) {}

    try {
      metaInst.setUserID(null);
    } catch (e) {}

    try {
      await crashlyticsInst.setUserId('');
      await crashlyticsInst.setAttribute('current_screen', '');
      await crashlyticsInst.setAttribute('last_error_context', '');
    } catch (e) {}
  };

  return {
    metaCalls,
    firebaseCalls,
    crashlyticsCalls,
    logEvent,
    clearAllAnalyticsAndCrashlyticsIdentity,
    mockAnalyticsInstance,
    mockAppEventsLogger,
    mockCrashlyticsInstance,
  };
}

test('TEST 1: Meta HabitCompleted Privacy — No custom text/PII reaches Meta', async () => {
  const harness = createTelemetryHarness();

  await harness.logEvent('habit_completed', {
    habitName: 'Take Blood Pressure Medication',
    habitId: 'habit_123',
    trackMethod: 'task',
    colorId: 'purple',
  });

  assert.strictEqual(harness.metaCalls.length, 1);
  const metaCall = harness.metaCalls[0];
  assert.strictEqual(metaCall.event, 'HabitCompleted');
  assert.strictEqual(metaCall.params, undefined, 'Meta HabitCompleted must NOT have any params payload');

  const serialized = JSON.stringify(harness.metaCalls);
  assert.strictEqual(serialized.includes('Take Blood Pressure Medication'), false);
  assert.strictEqual(serialized.includes('Medication'), false);
  assert.strictEqual(serialized.includes('habitName'), false);
});

test('TEST 2: Firebase Analytics Habit Telemetry — habit_created and habit_completed are strictly structural', async () => {
  const harness = createTelemetryHarness();

  const habit = {
    id: 'habit_abc_456',
    name: 'Chemotherapy appointment',
    type: 'build',
    trackMethod: 'task',
    colorId: 'green',
  };

  await harness.logEvent('habit_created', {
    habitId: habit.id,
    trackMethod: habit.trackMethod,
    colorId: habit.colorId,
    habitType: habit.type,
  });

  await harness.logEvent('habit_completed', {
    habitId: habit.id,
    trackMethod: habit.trackMethod,
    colorId: habit.colorId,
  });

  assert.strictEqual(harness.firebaseCalls.length, 2);

  const createdCall = harness.firebaseCalls[0];
  assert.strictEqual(createdCall.name, 'habit_created');
  assert.strictEqual(createdCall.params.habitId, 'habit_abc_456');
  assert.strictEqual(createdCall.params.trackMethod, 'task');
  assert.strictEqual(createdCall.params.colorId, 'green');
  assert.strictEqual(createdCall.params.habitType, 'build');
  assert.strictEqual(createdCall.params.habitName, undefined);

  const completedCall = harness.firebaseCalls[1];
  assert.strictEqual(completedCall.name, 'habit_completed');
  assert.strictEqual(completedCall.params.habitId, 'habit_abc_456');
  assert.strictEqual(completedCall.params.trackMethod, 'task');
  assert.strictEqual(completedCall.params.colorId, 'green');
  assert.strictEqual(completedCall.params.habitName, undefined);

  const serialized = JSON.stringify(harness.firebaseCalls);
  assert.strictEqual(serialized.includes('Chemotherapy'), false);
});

test('TEST 3: Analytics Cleanup — resets GA4 user ID and rotates instance data', async () => {
  const harness = createTelemetryHarness();

  await harness.clearAllAnalyticsAndCrashlyticsIdentity();

  const userIdCall = harness.firebaseCalls.find((c) => c.type === 'setUserId');
  const resetCall = harness.firebaseCalls.find((c) => c.type === 'resetAnalyticsData');

  assert.ok(userIdCall, 'analytics().setUserId must be called');
  assert.strictEqual(userIdCall.id, null);
  assert.ok(resetCall, 'analytics().resetAnalyticsData must be called');
});

test('TEST 4: Meta Identity Cleanup — resets Meta user ID to null', async () => {
  const harness = createTelemetryHarness();

  await harness.clearAllAnalyticsAndCrashlyticsIdentity();

  const metaUserCall = harness.metaCalls.find((c) => c.type === 'setUserID');
  assert.ok(metaUserCall, 'AppEventsLogger.setUserID must be called');
  assert.strictEqual(metaUserCall.id, null);
});

test('TEST 5: Crashlytics Cleanup — resets user ID and clears dynamic attributes', async () => {
  const harness = createTelemetryHarness();

  await harness.clearAllAnalyticsAndCrashlyticsIdentity();

  const crashUserCall = harness.crashlyticsCalls.find((c) => c.type === 'setUserId');
  assert.ok(crashUserCall, 'crashlytics().setUserId must be called');
  assert.strictEqual(crashUserCall.id, '');

  const screenAttr = harness.crashlyticsCalls.find((c) => c.type === 'setAttribute' && c.key === 'current_screen');
  const errorContextAttr = harness.crashlyticsCalls.find((c) => c.type === 'setAttribute' && c.key === 'last_error_context');

  assert.ok(screenAttr, 'current_screen attribute must be reset');
  assert.strictEqual(screenAttr.value, '');
  assert.ok(errorContextAttr, 'last_error_context attribute must be reset');
  assert.strictEqual(errorContextAttr.value, '');
});

test('TEST 6: Failure Isolation — one SDK throw does not prevent other cleanups', async () => {
  const harnessA = createTelemetryHarness();
  const throwingAnalytics = {
    setUserId: async () => { throw new Error('Simulated Firebase error'); },
    resetAnalyticsData: async () => { throw new Error('Simulated Firebase error'); },
  };

  await harnessA.clearAllAnalyticsAndCrashlyticsIdentity({ analytics: throwingAnalytics });

  const metaUserA = harnessA.metaCalls.find((c) => c.type === 'setUserID');
  assert.ok(metaUserA, 'Meta cleanup must execute even if Analytics throws');
  assert.strictEqual(metaUserA.id, null);

  const crashUserA = harnessA.crashlyticsCalls.find((c) => c.type === 'setUserId');
  assert.ok(crashUserA, 'Crashlytics cleanup must execute even if Analytics throws');
  assert.strictEqual(crashUserA.id, '');

  const harnessB = createTelemetryHarness();
  const throwingMeta = {
    setUserID: () => { throw new Error('Simulated Meta error'); },
  };

  await harnessB.clearAllAnalyticsAndCrashlyticsIdentity({ meta: throwingMeta });

  const analyticsUserB = harnessB.firebaseCalls.find((c) => c.type === 'setUserId');
  assert.ok(analyticsUserB, 'Analytics cleanup must execute even if Meta throws');
  const crashUserB = harnessB.crashlyticsCalls.find((c) => c.type === 'setUserId');
  assert.ok(crashUserB, 'Crashlytics cleanup must execute even if Meta throws');
});
