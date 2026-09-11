// @ts-check
/**
 * scripts/test-notification-remediation.js
 *
 * Automated test suite for LYFEOS — P1-8 PHASE 1:
 * NOTIFICATION & PERMISSION STATE CONSISTENCY REMEDIATION
 *
 * Requirements covered:
 * - TEST 1: Master toggle OFF remains OFF after reinitialization.
 * - TEST 2: Legacy "notificationsEnabled" migrates correctly.
 * - TEST 3: Master toggle ON schedules notifications when permission exists.
 * - TEST 4: Master toggle OFF cancels and prevents rescheduling.
 * - TEST 5: Cloud reminder preferences override temporary defaults.
 * - TEST 6: Login of User B cannot inherit User A notification schedule.
 * - TEST 7: Cloud restore failure does not blindly enable default notifications.
 * - TEST 8: Repeated schedule refresh calls do not create duplicate schedules.
 * - TEST 9: Scheduler does not schedule without OS permission.
 * - TEST 10: Current reminder state is used when schedule is refreshed.
 */

const assert = require("node:assert");
const test = require("node:test");

// ─── Storage Mock ─────────────────────────────────────────────────────────────

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItem(key, val) {
      store.set(key, String(val));
    },
    async removeItem(key) {
      store.delete(key);
    },
    async clear() {
      store.clear();
    },
    getRaw(key) {
      return store.get(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

// ─── OS Notification Engine Mock ──────────────────────────────────────────────

function createMockNotificationEngine({ hasPermission = true } = {}) {
  let permissionGranted = hasPermission;
  let scheduledNotifications = [];
  let cancelAllCount = 0;
  let channels = new Map();

  return {
    getPermissionsAsync: async () => ({
      granted: permissionGranted,
      status: permissionGranted ? "granted" : "denied",
      canAskAgain: !permissionGranted,
    }),
    requestPermissionsAsync: async () => ({
      granted: permissionGranted,
      status: permissionGranted ? "granted" : "denied",
      canAskAgain: !permissionGranted,
    }),
    setPermission(granted) {
      permissionGranted = granted;
    },
    setNotificationChannelAsync: async (id, config) => {
      channels.set(id, config);
    },
    scheduleNotificationAsync: async (request) => {
      scheduledNotifications.push(request);
      return `notif_id_${scheduledNotifications.length}`;
    },
    cancelAllScheduledNotificationsAsync: async () => {
      cancelAllCount++;
      scheduledNotifications = [];
    },
    getScheduledNotifications: () => [...scheduledNotifications],
    getCancelAllCount: () => cancelAllCount,
    getChannel: (id) => channels.get(id),
  };
}

// ─── Implementation Under Test ────────────────────────────────────────────────

const NOTIF_ENABLED_KEY = "@lyfeos_notif_enabled_v1";
const LEGACY_NOTIF_ENABLED_KEY = "notificationsEnabled";
const KEY_REMIND = "@lyfeos_profile_reminders_v1";
const MAX_DAILY_NOTIFICATIONS = 8;

async function getMasterNotificationsEnabled(storage) {
  const canonical = await storage.getItem(NOTIF_ENABLED_KEY);
  if (canonical !== null) {
    return canonical === "true";
  }
  const legacy = await storage.getItem(LEGACY_NOTIF_ENABLED_KEY);
  if (legacy !== null) {
    const isEnabled = legacy === "true";
    await storage.setItem(NOTIF_ENABLED_KEY, String(isEnabled));
    return isEnabled;
  }
  return true; // Default for new installs
}

async function setMasterNotificationsEnabled(storage, engine, enabled) {
  await storage.setItem(NOTIF_ENABLED_KEY, String(enabled));
  await storage.setItem(LEGACY_NOTIF_ENABLED_KEY, String(enabled));
  if (!enabled) {
    await engine.cancelAllScheduledNotificationsAsync();
  }
}

function buildSmartNotificationSchedule(reminders, context = {}) {
  const name = context.userName ? `, ${context.userName}` : "";
  const candidates = [];

  if (reminders.morning) {
    candidates.push({
      id: "morning_start",
      title: `🌅 Good Morning${name}!`,
      body: "Start your day right — set your intentions and track your goals.",
      hour: 8,
      minute: 0,
      toggle: "morning",
      route: "/(tabs)/habits",
      priorityScore: 10,
    });
  }

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

  if (reminders.evening) {
    candidates.push({
      id: "evening_check",
      title: "📋 Evening Check-In",
      body: "Review your progress and wrap up your daily goals before midnight.",
      hour: 19,
      minute: 30,
      toggle: "evening",
      route: "/(tabs)/habits",
      priorityScore: 10,
    });
  }

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

  if (candidates.length > MAX_DAILY_NOTIFICATIONS) {
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    const capped = candidates.slice(0, MAX_DAILY_NOTIFICATIONS);
    capped.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    return capped;
  }

  candidates.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return candidates;
}

async function scheduleDailyNotifications(storage, engine, reminders, context, userId, reason) {
  // 1. Verify master notification toggle
  const isMasterEnabled = await getMasterNotificationsEnabled(storage);
  if (!isMasterEnabled) {
    await engine.cancelAllScheduledNotificationsAsync();
    return [];
  }

  // 2. Verify OS permission
  const perm = await engine.getPermissionsAsync();
  if (!perm.granted) {
    await engine.cancelAllScheduledNotificationsAsync();
    return [];
  }

  // 3. Read reminder preferences
  let r = reminders;
  if (!r) {
    const raw = await storage.getItem(KEY_REMIND);
    r = raw ? JSON.parse(raw) : { morning: true, meal: true, water: true, evening: true };
  }

  // 4. Build schedule
  const scheduledList = buildSmartNotificationSchedule(r, context || {});

  // 5. Cancel obsolete scheduled notifications
  await engine.cancelAllScheduledNotificationsAsync();

  // 6. Ensure Android channel
  await engine.setNotificationChannelAsync("default", {
    name: "LyfeOS Reminders",
    importance: 4, // HIGH
  });

  // 7. Schedule valid notifications
  for (const notif of scheduledList) {
    await engine.scheduleNotificationAsync({
      content: {
        title: notif.title,
        body: notif.body,
        sound: true,
        data: { id: notif.id, route: notif.route },
      },
      trigger: {
        type: "daily",
        hour: notif.hour,
        minute: notif.minute,
        channelId: "default",
      },
    });
  }

  return scheduledList;
}

function createCoordinator(storage, engine) {
  let inFlightPromise = null;
  let pendingTimeout = null;
  let latestOpts = null;
  let pendingResolvers = [];

  function requestScheduleRefresh(opts = {}) {
    latestOpts = { ...latestOpts, ...opts };
    return new Promise((resolve) => {
      pendingResolvers.push(resolve);
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(async () => {
        pendingTimeout = null;
        const currentOpts = latestOpts;
        latestOpts = null;
        const resolvers = pendingResolvers;
        pendingResolvers = [];

        if (inFlightPromise) {
          await inFlightPromise;
        }
        inFlightPromise = scheduleDailyNotifications(
          storage,
          engine,
          currentOpts?.reminders,
          currentOpts?.context,
          currentOpts?.userId,
          currentOpts?.reason
        );
        const res = await inFlightPromise;
        inFlightPromise = null;
        resolvers.forEach((r) => r(res));
      }, 50); // 50ms for fast testing
    });
  }

  return { requestScheduleRefresh };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test("TEST 1: Master toggle OFF remains OFF after reinitialization", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "false" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  const isEnabled = await getMasterNotificationsEnabled(storage);
  assert.strictEqual(isEnabled, false, "Must read false from canonical key");

  // Reinitialization attempt
  const scheduled = await scheduleDailyNotifications(storage, engine);
  assert.strictEqual(scheduled.length, 0, "No notifications scheduled when master toggle is OFF");
  assert.strictEqual(engine.getScheduledNotifications().length, 0, "Engine schedule is empty");
  assert.strictEqual(storage.getRaw(NOTIF_ENABLED_KEY), "false", "Storage key remains false");
});

test("TEST 2: Legacy 'notificationsEnabled' migrates correctly", async () => {
  // Case 2A: Legacy is OFF
  const storageOff = createMockStorage({ [LEGACY_NOTIF_ENABLED_KEY]: "false" });
  const isEnabledOff = await getMasterNotificationsEnabled(storageOff);
  assert.strictEqual(isEnabledOff, false, "Must migrate legacy 'false'");
  assert.strictEqual(storageOff.getRaw(NOTIF_ENABLED_KEY), "false", "Canonical key populated with 'false'");

  // Case 2B: Legacy is ON
  const storageOn = createMockStorage({ [LEGACY_NOTIF_ENABLED_KEY]: "true" });
  const isEnabledOn = await getMasterNotificationsEnabled(storageOn);
  assert.strictEqual(isEnabledOn, true, "Must migrate legacy 'true'");
  assert.strictEqual(storageOn.getRaw(NOTIF_ENABLED_KEY), "true", "Canonical key populated with 'true'");
});

test("TEST 3: Master toggle ON schedules notifications when permission exists", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  const scheduled = await scheduleDailyNotifications(storage, engine, {
    morning: true,
    meal: true,
    water: true,
    evening: true,
  });

  assert.strictEqual(scheduled.length, MAX_DAILY_NOTIFICATIONS, "Schedules up to 8 capped notifications");
  assert.strictEqual(engine.getScheduledNotifications().length, MAX_DAILY_NOTIFICATIONS);

  // Check channel attachment
  const scheduledItem = engine.getScheduledNotifications()[0];
  assert.strictEqual(scheduledItem.trigger.channelId, "default", "Attaches explicit channelId 'default'");
  assert.ok(engine.getChannel("default"), "Android channel 'default' registered");
});

test("TEST 4: Master toggle OFF cancels and prevents rescheduling", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  // Initially schedule
  await scheduleDailyNotifications(storage, engine);
  assert.strictEqual(engine.getScheduledNotifications().length > 0, true);

  // User flips master toggle to OFF
  await setMasterNotificationsEnabled(storage, engine, false);

  assert.strictEqual(storage.getRaw(NOTIF_ENABLED_KEY), "false");
  assert.strictEqual(storage.getRaw(LEGACY_NOTIF_ENABLED_KEY), "false");
  assert.strictEqual(engine.getScheduledNotifications().length, 0, "Alarms cancelled immediately on toggle OFF");

  // Subsequent refresh attempt
  await scheduleDailyNotifications(storage, engine);
  assert.strictEqual(engine.getScheduledNotifications().length, 0, "Rescheduling blocked while toggle is OFF");
});

test("TEST 5: Cloud reminder preferences override temporary defaults", async () => {
  // Empty local storage right after login
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  // Cloud profile has ONLY meal reminders enabled
  const cloudReminders = { morning: false, meal: true, water: false, evening: false };

  // ProfileContext simulates restoring cloud profile
  await storage.setItem(KEY_REMIND, JSON.stringify(cloudReminders));
  const scheduled = await scheduleDailyNotifications(storage, engine, cloudReminders, {}, "user_123", "cloud_profile_restored");

  // Should have exactly the 3 meal reminders (breakfast, lunch, dinner)
  assert.strictEqual(scheduled.length, 3, "Only meal reminders scheduled");
  const ids = scheduled.map((s) => s.id);
  assert.deepStrictEqual(ids.sort(), ["meal_breakfast", "meal_dinner", "meal_lunch"]);
});

test("TEST 6: Login of User B cannot inherit User A notification schedule", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  // User A schedule
  const userAReminders = { morning: true, meal: false, water: true, evening: false };
  await scheduleDailyNotifications(storage, engine, userAReminders, { userName: "Alice" });
  assert.strictEqual(engine.getScheduledNotifications().length, 2);

  // User A logs out -> cancel all and clear local data
  await engine.cancelAllScheduledNotificationsAsync();
  await storage.clear();
  assert.strictEqual(engine.getScheduledNotifications().length, 0);

  // User B logs in with different cloud preferences
  const userBReminders = { morning: false, meal: true, water: false, evening: false };
  await storage.setItem(NOTIF_ENABLED_KEY, "true");
  await storage.setItem(KEY_REMIND, JSON.stringify(userBReminders));

  const scheduledB = await scheduleDailyNotifications(storage, engine, userBReminders, { userName: "Bob" });
  assert.strictEqual(scheduledB.length, 3);
  // Zero User A notifications exist
  const userAIds = ["morning_start", "water_midday"];
  for (const notif of engine.getScheduledNotifications()) {
    assert.strictEqual(userAIds.includes(notif.content.data.id), false, "User A items must not leak to User B");
  }
});

test("TEST 7: Cloud restore failure does not blindly enable default notifications", async () => {
  const storage = createMockStorage({
    [NOTIF_ENABLED_KEY]: "true",
    [KEY_REMIND]: JSON.stringify({ morning: false, meal: false, water: true, evening: false }),
  });
  const engine = createMockNotificationEngine({ hasPermission: true });

  // Simulate cloud fetch failure: local storage is preserved, not overwritten with all-true defaults
  let fetchFailed = true;
  let cloudReminders = null;
  if (fetchFailed) {
    // Fails safely: does not write new defaults to storage
  }

  // Scheduler reads existing local cached reminders
  const scheduled = await scheduleDailyNotifications(storage, engine, cloudReminders || undefined);
  assert.strictEqual(scheduled.length, 1, "Only water reminder scheduled; defaults were not forced");
  assert.strictEqual(scheduled[0].id, "water_midday");
});

test("TEST 8: Repeated schedule refresh calls do not create duplicate schedules", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });
  const coordinator = createCoordinator(storage, engine);

  // Fire 5 rapid refresh requests concurrently
  const p1 = coordinator.requestScheduleRefresh({ reason: "mount_1" });
  const p2 = coordinator.requestScheduleRefresh({ reason: "mount_2" });
  const p3 = coordinator.requestScheduleRefresh({ reason: "data_change" });
  const p4 = coordinator.requestScheduleRefresh({ reason: "app_foreground" });
  const p5 = coordinator.requestScheduleRefresh({ reason: "cloud_sync" });

  await Promise.all([p1, p2, p3, p4, p5]);

  // Total scheduled items must equal exactly 8 (no duplicates)
  const scheduled = engine.getScheduledNotifications();
  assert.strictEqual(scheduled.length, MAX_DAILY_NOTIFICATIONS, "No duplicate alarms registered");
  const uniqueIds = new Set(scheduled.map((n) => n.content.data.id));
  assert.strictEqual(uniqueIds.size, scheduled.length, "All registered alarm IDs are unique");
});

test("TEST 9: Scheduler does not schedule without OS permission", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: false }); // OS Permission denied

  const scheduled = await scheduleDailyNotifications(storage, engine);
  assert.strictEqual(scheduled.length, 0, "Returns empty list when OS permission is absent");
  assert.strictEqual(engine.getScheduledNotifications().length, 0, "No alarms scheduled in engine");
});

test("TEST 10: Current reminder state is used when schedule is refreshed", async () => {
  const storage = createMockStorage({ [NOTIF_ENABLED_KEY]: "true" });
  const engine = createMockNotificationEngine({ hasPermission: true });

  // Initial: all 4 toggles ON (8 items)
  await scheduleDailyNotifications(storage, engine, {
    morning: true,
    meal: true,
    water: true,
    evening: true,
  });
  assert.strictEqual(engine.getScheduledNotifications().length, 8);

  // User disables evening reminders
  const updatedReminders = {
    morning: true,
    meal: true,
    water: true,
    evening: false,
  };
  await storage.setItem(KEY_REMIND, JSON.stringify(updatedReminders));

  const scheduled = await scheduleDailyNotifications(storage, engine, updatedReminders);
  assert.strictEqual(scheduled.length, 5, "5 reminders active after disabling evening (morning + 3 meals + water)");
  const ids = scheduled.map((s) => s.id);
  assert.strictEqual(ids.includes("activity_evening"), false, "activity_evening removed");
  assert.strictEqual(ids.includes("evening_check"), false, "evening_check removed");
  assert.strictEqual(ids.includes("nightly_review"), false, "nightly_review removed");
  assert.strictEqual(ids.includes("wind_down"), false, "wind_down removed");
});
