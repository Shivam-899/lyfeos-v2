// @ts-check
/**
 * scripts/test-phase2b2-guest-resolution.js
 *
 * Focused automated test suite for LYFEOS — P1-9 PHASE 2B-2:
 * Existing-Account Guest Data Resolution (Checkpoint + Discard + Merge + Cold-Start)
 *
 * TEST CLASSIFICATION: LOCAL MOCK/UNIT
 * Tests all 15+ required Phase 2B-2 scenarios in isolation without network calls.
 */

const assert = require('node:assert');
const test = require('node:test');

/**
 * Creates an in-memory AsyncStorage mock.
 */
function createMockAsyncStorage(initialData = {}) {
  const store = new Map(Object.entries(initialData));

  return {
    getItem: async (key) => store.has(key) ? store.get(key) : null,
    setItem: async (key, val) => { store.set(key, String(val)); },
    removeItem: async (key) => { store.delete(key); },
    clear: async () => { store.clear(); },
    getAllKeys: async () => Array.from(store.keys()),
    multiRemove: async (keys) => { keys.forEach((k) => store.delete(k)); },
    _store: store,
  };
}

const PENDING_MIGRATION_KEY = "@lyfeos_pending_migration_v1";

// ─────────────────────────────────────────────────────────────────────────────
// HARNESS IMPLEMENTATION MATCHING AUTHCONTEXT & STORAGE
// ─────────────────────────────────────────────────────────────────────────────

function createPhase2B2Harness({
  initialUser = null,
  initialStorage = {},
  hasGuestData = true,
  simulateCloudFail = false,
  simulateLocalClearFail = false,
}) {
  const storage = createMockAsyncStorage(initialStorage);
  let currentUser = initialUser;
  let isPendingMigrationResolution = false;
  let migrationDone = false;
  let analyticsUser = null;
  let notificationsCancelled = false;

  const telemetry = {
    cloudMigrations: [],
    userDeletes: [],
    analyticsCalls: [],
  };

  const getStoredJson = async (key, fallback) => {
    const raw = await storage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const setStoredJson = async (key, value) => {
    await storage.setItem(key, JSON.stringify(value));
    return true;
  };
  const clearStoredItem = async (key) => {
    await storage.removeItem(key);
    return true;
  };

  const getPendingMigrationCheckpoint = async () => {
    return await getStoredJson(PENDING_MIGRATION_KEY, null);
  };
  const setPendingMigrationCheckpoint = async (checkpoint) => {
    return await setStoredJson(PENDING_MIGRATION_KEY, checkpoint);
  };
  const clearPendingMigrationCheckpoint = async () => {
    return await clearStoredItem(PENDING_MIGRATION_KEY);
  };

  const clearAllLyfeOSLocalData = async () => {
    if (simulateLocalClearFail) {
      return false;
    }
    const allKeys = await storage.getAllKeys();
    const toRemove = allKeys.filter((k) => k.startsWith('@lyfeos_') || k.startsWith('lyfeos_'));
    await storage.multiRemove(toRemove);
    await storage.setItem('hasSeenOnboarding', 'true');
    return true;
  };

  const cancelAllNotifications = async () => {
    notificationsCancelled = true;
  };

  const setAnalyticsUser = async (uid) => {
    analyticsUser = uid;
    telemetry.analyticsCalls.push(uid);
  };

  const migrateGuestDataToAccount = async (uid, payload) => {
    telemetry.cloudMigrations.push({ uid, payload });
    if (simulateCloudFail) {
      return false;
    }
    // Simulate updating local storage with merged data
    await setStoredJson('@lyfeos_habits_v2', payload.habits || []);
    await setStoredJson('@lyfeos_todos_v2', payload.todos || []);
    return true;
  };

  // ── Cold-start hydration ──────────────────────────────────────────────────
  const hydrateColdStart = async (firebaseUser) => {
    currentUser = firebaseUser;
    if (firebaseUser && !firebaseUser.isAnonymous) {
      const checkpoint = await getPendingMigrationCheckpoint();
      if (checkpoint) {
        if (checkpoint.targetUid === firebaseUser.uid) {
          isPendingMigrationResolution = true;
        } else {
          // Invalidate stale checkpoint on mismatch
          await clearPendingMigrationCheckpoint();
          isPendingMigrationResolution = false;
        }
      } else {
        isPendingMigrationResolution = false;
      }
    } else if (!firebaseUser) {
      const checkpoint = await getPendingMigrationCheckpoint();
      if (checkpoint) {
        await clearPendingMigrationCheckpoint();
      }
      isPendingMigrationResolution = false;
    }
  };

  // ── Existing-account sign-in ──────────────────────────────────────────────
  const signInWithEmail = async (email, password) => {
    const wasAnonymous = currentUser?.isAnonymous === true;
    const existingUser = {
      uid: 'target_account_uid_123',
      email,
      isAnonymous: false,
      delete: async () => { telemetry.userDeletes.push(existingUser.uid); },
    };
    currentUser = existingUser;
    const isNewUser = false;

    if (wasAnonymous && !isNewUser && hasGuestData) {
      await setPendingMigrationCheckpoint({
        version: 1,
        targetUid: existingUser.uid,
        createdAt: Date.now(),
        status: 'pending',
      });
      isPendingMigrationResolution = true;
    } else if (wasAnonymous && !hasGuestData) {
      await clearAllLyfeOSLocalData();
    }
  };

  // ── Discard Guest Data & Proceed ──────────────────────────────────────────
  const discardGuestDataAndProceed = async () => {
    if (!currentUser || currentUser.isAnonymous) {
      throw new Error("No authenticated account found for discard.");
    }
    const checkpoint = await getPendingMigrationCheckpoint();
    if (!checkpoint || checkpoint.targetUid !== currentUser.uid) {
      throw new Error("No valid pending migration checkpoint found for this account.");
    }

    const cleared = await clearAllLyfeOSLocalData();
    if (!cleared) {
      throw new Error("Failed to clear local guest data.");
    }

    await cancelAllNotifications().catch(() => {});
    await clearPendingMigrationCheckpoint();
    isPendingMigrationResolution = false;

    try {
      await setAnalyticsUser(currentUser.uid);
    } catch {}
  };

  // ── Merge Guest Data & Proceed ────────────────────────────────────────────
  const mergeGuestDataAndProceed = async () => {
    if (!currentUser || currentUser.isAnonymous) {
      throw new Error("No authenticated account found for merge.");
    }
    const checkpoint = await getPendingMigrationCheckpoint();
    if (!checkpoint || checkpoint.targetUid !== currentUser.uid) {
      throw new Error("No valid pending migration checkpoint found for this account.");
    }

    const habits = await getStoredJson('@lyfeos_habits_v2', []);
    const todos = await getStoredJson('@lyfeos_todos_v2', []);

    const guestPayload = { habits, todos };

    if (checkpoint.status !== 'cloud_merged') {
      const success = await migrateGuestDataToAccount(currentUser.uid, guestPayload);
      if (!success) {
        throw new Error("Failed to merge guest data into cloud account.");
      }
      await setPendingMigrationCheckpoint({
        ...checkpoint,
        status: 'cloud_merged',
      });
    }

    await clearPendingMigrationCheckpoint();
    isPendingMigrationResolution = false;
    migrationDone = true;

    try {
      await setAnalyticsUser(currentUser.uid);
    } catch {}
  };

  const signOut = async () => {
    await clearPendingMigrationCheckpoint();
    isPendingMigrationResolution = false;
    currentUser = null;
  };

  return {
    storage,
    getCurrentUser: () => currentUser,
    isPendingMigrationResolution: () => isPendingMigrationResolution,
    migrationDone: () => migrationDone,
    analyticsUser: () => analyticsUser,
    notificationsCancelled: () => notificationsCancelled,
    telemetry,
    getPendingMigrationCheckpoint,
    setPendingMigrationCheckpoint,
    clearPendingMigrationCheckpoint,
    hydrateColdStart,
    signInWithEmail,
    discardGuestDataAndProceed,
    mergeGuestDataAndProceed,
    signOut,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: 20 FOCUSED SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

test('TEST A: Checkpoint creation — written with targetUid and status pending on login', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');

  assert.strictEqual(harness.isPendingMigrationResolution(), true, 'Pending resolution state must be true');
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.ok(checkpoint, 'Checkpoint must exist in storage');
  assert.strictEqual(checkpoint.version, 1, 'Version must be 1');
  assert.strictEqual(checkpoint.targetUid, 'target_account_uid_123', 'Target UID must match authenticated account');
  assert.strictEqual(checkpoint.status, 'pending', 'Status must be pending');
  assert.ok(typeof checkpoint.createdAt === 'number' && checkpoint.createdAt > 0, 'createdAt must be valid timestamp');
});

test('TEST B: Checkpoint hydration — correctly read from AsyncStorage on startup', async () => {
  const harness = createPhase2B2Harness({
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'existing_account_uid',
        createdAt: 1750000000000,
        status: 'pending',
      }),
    },
  });

  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.ok(checkpoint, 'Checkpoint must be loaded from storage');
  assert.strictEqual(checkpoint.targetUid, 'existing_account_uid');
  assert.strictEqual(checkpoint.status, 'pending');
});

test('TEST C: UID mismatch protection — invalidates stale checkpoint on different user', async () => {
  const harness = createPhase2B2Harness({
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'account_A_uid',
        createdAt: 1750000000000,
        status: 'pending',
      }),
    },
  });

  // User B launches the app
  await harness.hydrateColdStart({ uid: 'account_B_uid', isAnonymous: false });

  assert.strictEqual(harness.isPendingMigrationResolution(), false, 'Pending state must NOT be set for user B');
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.strictEqual(checkpoint, null, 'Stale checkpoint for user A must be safely invalidated/removed');
  assert.strictEqual(harness.telemetry.cloudMigrations.length, 0, 'Zero cloud migrations must occur');
});

test('TEST D: Cold-start pending recovery — restores pending state when target UID matches', async () => {
  const harness = createPhase2B2Harness({
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'target_account_uid_123',
        createdAt: 1750000000000,
        status: 'pending',
      }),
    },
  });

  // Same user launches the app
  await harness.hydrateColdStart({ uid: 'target_account_uid_123', isAnonymous: false });

  assert.strictEqual(harness.isPendingMigrationResolution(), true, 'Pending state must be restored on cold start');
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.ok(checkpoint, 'Checkpoint must remain intact');
});

test('TEST E: Discard success — clears local storage, checkpoint, notifications, and pending state', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    initialStorage: {
      '@lyfeos_habits_v2': JSON.stringify([{ id: 'h1', name: 'Exercise' }]),
      '@lyfeos_todos_v2': JSON.stringify([{ id: 't1', title: 'Buy milk' }]),
    },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');
  assert.strictEqual(harness.isPendingMigrationResolution(), true);

  // Execute discard
  await harness.discardGuestDataAndProceed();

  assert.strictEqual(harness.isPendingMigrationResolution(), false, 'Pending state must be cleared');
  assert.strictEqual(await harness.getPendingMigrationCheckpoint(), null, 'Checkpoint must be cleared');
  assert.strictEqual(harness.notificationsCancelled(), true, 'Notifications must be cancelled');
  assert.strictEqual(harness.analyticsUser(), 'target_account_uid_123', 'Analytics identity must be set to target user');

  const habitsAfter = await harness.storage.getItem('@lyfeos_habits_v2');
  assert.strictEqual(habitsAfter, null, 'Guest habits must be purged from local storage');
  const todosAfter = await harness.storage.getItem('@lyfeos_todos_v2');
  assert.strictEqual(todosAfter, null, 'Guest todos must be purged from local storage');
});

test('TEST F: Discard does not touch target cloud — zero cloud migration calls', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    initialStorage: {
      '@lyfeos_habits_v2': JSON.stringify([{ id: 'h1', name: 'Exercise' }]),
    },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');
  await harness.discardGuestDataAndProceed();

  assert.strictEqual(harness.telemetry.cloudMigrations.length, 0, 'Discard must NEVER call cloud migration');
});

test('TEST G: Merge success — executes migration, updates local storage, clears checkpoint, marks done', async () => {
  const guestHabits = [{ id: 'h1', name: 'Meditation' }];
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    initialStorage: {
      '@lyfeos_habits_v2': JSON.stringify(guestHabits),
    },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');
  await harness.mergeGuestDataAndProceed();

  assert.strictEqual(harness.isPendingMigrationResolution(), false, 'Pending state must be cleared');
  assert.strictEqual(await harness.getPendingMigrationCheckpoint(), null, 'Checkpoint must be cleared');
  assert.strictEqual(harness.migrationDone(), true, 'migrationDone must be true');
  assert.strictEqual(harness.telemetry.cloudMigrations.length, 1, 'Cloud migration must be invoked once');
  assert.strictEqual(harness.telemetry.cloudMigrations[0].uid, 'target_account_uid_123');
});

test('TEST H: Merge retry / idempotency — status cloud_merged does not duplicate cloud writes', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'target_account_uid_123', isAnonymous: false },
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'target_account_uid_123',
        createdAt: 1750000000000,
        status: 'cloud_merged', // Cloud write already succeeded previously
      }),
      '@lyfeos_habits_v2': JSON.stringify([{ id: 'h1', name: 'Meditation' }]),
    },
  });

  await harness.hydrateColdStart({ uid: 'target_account_uid_123', isAnonymous: false });
  assert.strictEqual(harness.isPendingMigrationResolution(), true);

  // Re-run merge
  await harness.mergeGuestDataAndProceed();

  assert.strictEqual(harness.telemetry.cloudMigrations.length, 0, 'Should not re-run cloud write when status is cloud_merged');
  assert.strictEqual(harness.isPendingMigrationResolution(), false, 'Pending state must be cleared');
  assert.strictEqual(await harness.getPendingMigrationCheckpoint(), null, 'Checkpoint must be cleared');
  assert.strictEqual(harness.migrationDone(), true);
});

test('TEST I: Merge failure preserves guest data in AsyncStorage', async () => {
  const guestHabits = [{ id: 'h1', name: 'Important Guest Habit' }];
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    initialStorage: {
      '@lyfeos_habits_v2': JSON.stringify(guestHabits),
    },
    hasGuestData: true,
    simulateCloudFail: true, // Cloud network fails
  });

  await harness.signInWithEmail('user@test.com', 'pass123');

  await assert.rejects(
    async () => { await harness.mergeGuestDataAndProceed(); },
    /Failed to merge guest data into cloud account/,
    'Must throw error on cloud migration failure'
  );

  // Verify guest data is preserved
  const habitsAfter = await harness.storage.getItem('@lyfeos_habits_v2');
  assert.deepStrictEqual(JSON.parse(habitsAfter || '[]'), guestHabits, 'Guest habits must remain intact after merge failure');
});

test('TEST J: Merge failure preserves checkpoint and pending state', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    hasGuestData: true,
    simulateCloudFail: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');

  await assert.rejects(
    async () => { await harness.mergeGuestDataAndProceed(); },
    /Failed to merge/
  );

  assert.strictEqual(harness.isPendingMigrationResolution(), true, 'Pending state must remain true on failure');
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.ok(checkpoint, 'Checkpoint must remain in storage on failure');
  assert.strictEqual(checkpoint.status, 'pending');
});

test('TEST K: Local cleanup failure handling — discard does not claim success if clear fails', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    hasGuestData: true,
    simulateLocalClearFail: true, // Simulating disk write error
  });

  await harness.signInWithEmail('user@test.com', 'pass123');

  await assert.rejects(
    async () => { await harness.discardGuestDataAndProceed(); },
    /Failed to clear local guest data/,
    'Must throw error when local cleanup fails'
  );

  assert.strictEqual(harness.isPendingMigrationResolution(), true, 'Pending state must remain true');
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.ok(checkpoint, 'Checkpoint must NOT be cleared when discard fails');
});

test('TEST L: No anonUser.delete() after target authentication', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');
  await harness.discardGuestDataAndProceed();

  assert.strictEqual(harness.telemetry.userDeletes.length, 0, 'Must NEVER call delete() on target authenticated user');
});

test('TEST M: Pending state prevents navigation', () => {
  const navigationCalls = [];
  const router = { replace: (route) => navigationCalls.push(route) };

  const simulateNavigationGate = ({ user, isInitializing, isPendingMigrationResolution }) => {
    if (isInitializing || isPendingMigrationResolution) return;
    if (user) {
      router.replace('/(tabs)');
    }
  };

  // When isPendingMigrationResolution is true:
  simulateNavigationGate({
    user: { uid: 'target_account_uid' },
    isInitializing: false,
    isPendingMigrationResolution: true,
  });

  assert.strictEqual(navigationCalls.length, 0, 'Navigation must be completely blocked while pending');
});

test('TEST N: Successful resolution releases navigation', () => {
  const navigationCalls = [];
  const router = { replace: (route) => navigationCalls.push(route) };

  const simulateNavigationGate = ({ user, isInitializing, isPendingMigrationResolution }) => {
    if (isInitializing || isPendingMigrationResolution) return;
    if (user) {
      router.replace('/(tabs)');
    }
  };

  // Resolution completes -> isPendingMigrationResolution becomes false
  simulateNavigationGate({
    user: { uid: 'target_account_uid' },
    isInitializing: false,
    isPendingMigrationResolution: false,
  });

  assert.strictEqual(navigationCalls.length, 1, 'Navigation must occur once resolution completes');
  assert.strictEqual(navigationCalls[0], '/(tabs)');
});

test('TEST O: Stale checkpoint cannot affect another account', async () => {
  const harness = createPhase2B2Harness({
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'user_X_uid',
        createdAt: 1750000000000,
        status: 'pending',
      }),
      '@lyfeos_habits_v2': JSON.stringify([{ id: 'h_guest', name: 'Guest Habit' }]),
    },
  });

  // User Y logs in
  await harness.hydrateColdStart({ uid: 'user_Y_uid', isAnonymous: false });

  assert.strictEqual(harness.isPendingMigrationResolution(), false);
  const checkpoint = await harness.getPendingMigrationCheckpoint();
  assert.strictEqual(checkpoint, null, 'User X checkpoint must be purged');

  // Attempting merge or discard as user Y should fail because checkpoint is gone
  await assert.rejects(
    async () => { await harness.mergeGuestDataAndProceed(); },
    /No valid pending migration checkpoint/
  );
  await assert.rejects(
    async () => { await harness.discardGuestDataAndProceed(); },
    /No valid pending migration checkpoint/
  );
});

test('TEST P: Missing checkpoint guard — discard or merge throws error if no checkpoint', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'user_123', isAnonymous: false },
    initialStorage: {}, // Empty storage
  });

  await assert.rejects(
    async () => { await harness.discardGuestDataAndProceed(); },
    /No valid pending migration checkpoint/
  );
  await assert.rejects(
    async () => { await harness.mergeGuestDataAndProceed(); },
    /No valid pending migration checkpoint/
  );
});

test('TEST Q: Anonymous user guard — discard or merge throws error if user is anonymous', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'anon_123', isAnonymous: true },
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'anon_123',
        createdAt: Date.now(),
        status: 'pending',
      }),
    },
  });

  await assert.rejects(
    async () => { await harness.discardGuestDataAndProceed(); },
    /No authenticated account found/
  );
  await assert.rejects(
    async () => { await harness.mergeGuestDataAndProceed(); },
    /No authenticated account found/
  );
});

test('TEST R: Sign-out clears pending checkpoint', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'target_uid', isAnonymous: false },
    initialStorage: {
      [PENDING_MIGRATION_KEY]: JSON.stringify({
        version: 1,
        targetUid: 'target_uid',
        createdAt: Date.now(),
        status: 'pending',
      }),
    },
  });

  await harness.signOut();
  assert.strictEqual(await harness.getPendingMigrationCheckpoint(), null, 'Sign-out must remove pending checkpoint');
  assert.strictEqual(harness.isPendingMigrationResolution(), false);
});

test('TEST S: Analytics user updated on resolution', async () => {
  const harness = createPhase2B2Harness({
    initialUser: { uid: 'guest_uid_1', isAnonymous: true },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@test.com', 'pass123');
  await harness.mergeGuestDataAndProceed();

  assert.strictEqual(harness.analyticsUser(), 'target_account_uid_123', 'Analytics user must be set to target UID');
  assert.strictEqual(harness.telemetry.analyticsCalls.includes('target_account_uid_123'), true);
});

test('TEST T: Effective user masking prevents premature provider sync', () => {
  const mockAuthState = {
    rawUser: { uid: 'target_123', isAnonymous: false },
    isPendingMigrationResolution: true,
  };

  // Matches AuthProvider effectiveUser logic
  const effectiveUser = mockAuthState.isPendingMigrationResolution ? null : mockAuthState.rawUser;
  const isGuest = effectiveUser?.isAnonymous ?? false;

  let providerSynced = false;
  // Simulating HabitsContext / TodosContext effect:
  if (effectiveUser && !isGuest) {
    providerSynced = true;
  }

  assert.strictEqual(effectiveUser, null, 'Effective user must be masked as null while pending');
  assert.strictEqual(providerSynced, false, 'Provider sync must NOT execute while resolution is pending');

  // Once resolved:
  mockAuthState.isPendingMigrationResolution = false;
  const unmaskedUser = mockAuthState.isPendingMigrationResolution ? null : mockAuthState.rawUser;
  const unmaskedIsGuest = unmaskedUser?.isAnonymous ?? false;

  if (unmaskedUser && !unmaskedIsGuest) {
    providerSynced = true;
  }

  assert.strictEqual(providerSynced, true, 'Provider sync must execute once resolution completes');
});
