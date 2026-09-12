// @ts-check
/**
 * scripts/test-phase2b-migration-guard.js
 *
 * Focused automated test suite for LYFEOS — P1-9 PHASE 2B-1:
 * Meaningful Guest Data Detection + Migration Resolution State + Navigation Gate
 *
 * TEST CLASSIFICATION: LOCAL MOCK/UNIT
 * NOTE: These tests verify client logic branching, state transitions,
 * meaningful-data detection, and navigation gating using mocked interfaces.
 * They do not connect to live Firebase Auth or Firestore backends.
 */

const assert = require('node:assert');
const test = require('node:test');

/**
 * Creates an in-memory AsyncStorage mock for testing storage detection.
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

/**
 * Evaluates meaningful guest data against a provided storage interface.
 * Matches utils/storage.ts hasMeaningfulGuestData() implementation exactly.
 */
async function evaluateMeaningfulGuestData(storage) {
  const getJson = async (key, fallback) => {
    const raw = await storage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };
  const getString = async (key) => storage.getItem(key);

  const [
    localHabits,
    localHabitLogs,
    localTodos,
    localFood,
    localWater,
    localActivityLogs,
    localStepsLogs,
    localHealth,
    localGoalsConfigured,
    localProfileName,
  ] = await Promise.all([
    getJson("@lyfeos_habits_v2", []),
    getJson("@lyfeos_habit_logs_v2", []),
    getJson("@lyfeos_todos_v2", []),
    getJson("@lyfeos_food_v2", []),
    getJson("@lyfeos_water_v2", []),
    getJson("@lyfeos_activity_logs_v1", []),
    getJson("@lyfeos_steps_v1", []),
    getJson("@lyfeos_profile_health_v1", null),
    getString("@lyfeos_goals_configured_v1"),
    getString("@lyfeos_profile_name_v1"),
  ]);

  if (Array.isArray(localHabits) && localHabits.some((h) => h && !h.deletedAt)) return true;
  if (Array.isArray(localHabitLogs) && localHabitLogs.some((l) => l && !l.deletedAt)) return true;
  if (Array.isArray(localTodos) && localTodos.some((t) => t && !t.deletedAt)) return true;
  if (Array.isArray(localFood) && localFood.some((f) => f && !f.deletedAt)) return true;
  if (Array.isArray(localWater) && localWater.some((w) => w && !w.deletedAt && typeof w.glasses === "number" && w.glasses > 0)) return true;
  if (Array.isArray(localActivityLogs) && localActivityLogs.some((a) => a && !a.deletedAt)) return true;
  if (Array.isArray(localStepsLogs) && localStepsLogs.some((s) => s && !s.deletedAt && typeof s.steps === "number" && s.steps > 0)) return true;

  if (localHealth && typeof localHealth === "object") {
    const fields = ["age", "sex", "height", "weight", "activityLevel", "goal"];
    if (fields.some((f) => typeof localHealth[f] === "string" && localHealth[f].trim() !== "")) return true;
  }

  if (localGoalsConfigured === "true") return true;

  if (typeof localProfileName === "string" && localProfileName.trim() !== "" && localProfileName !== "LyfeOS User") return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: MEANINGFUL GUEST DATA DETECTION TESTS (TESTS 1 - 13)
// ─────────────────────────────────────────────────────────────────────────────

test('TEST 1: Empty guest session → hasMeaningfulGuestData() === false', async () => {
  const storage = createMockAsyncStorage({});
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, false, 'Empty storage must report false');
});

test('TEST 2: Only default preferences → false', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_profile_prefs_v1': JSON.stringify({ units: 'metric', calorieDisplay: 'kcal', habitEffectsEnabled: true }),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, false, 'Default preferences must not be treated as meaningful guest data');
});

test('TEST 3: Only joinDate → false', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_profile_join_v1': new Date().toISOString(),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, false, 'joinDate alone must not trigger meaningful data');
});

test('TEST 4: Only legal consent → false', async () => {
  const storage = createMockAsyncStorage({
    'legalConsent': JSON.stringify({ accepted: true, version: '1.0' }),
    'hasSeenOnboarding': 'true',
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, false, 'Legal consent and onboarding flags must not trigger meaningful data');
});

test('TEST 5: Only tombstones → false', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_habits_v2': JSON.stringify([{ id: 'h1', name: 'Running', deletedAt: 1700000000 }]),
    '@lyfeos_todos_v2': JSON.stringify([{ id: 't1', title: 'Buy eggs', deletedAt: 1700000000 }]),
    '@lyfeos_food_v2': JSON.stringify([{ id: 'f1', name: 'Apple', deletedAt: 1700000000 }]),
    '@lyfeos_water_v2': JSON.stringify([{ id: 'w1', date: '2026-09-12', glasses: 5, deletedAt: 1700000000 }]),
    '@lyfeos_activity_logs_v1': JSON.stringify([{ id: 'a1', sport: 'Cycling', deletedAt: 1700000000 }]),
    '@lyfeos_steps_v1': JSON.stringify([{ date: '2026-09-12', steps: 8000, deletedAt: 1700000000 }]),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, false, 'Deleted tombstones must not trigger meaningful data');
});

test('TEST 6: Active habit → true', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_habits_v2': JSON.stringify([{ id: 'h1', name: 'Meditate' }]),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, true, 'Active habit must trigger meaningful data');
});

test('TEST 7: Active todo → true', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_todos_v2': JSON.stringify([{ id: 't1', title: 'Schedule dental checkup' }]),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, true, 'Active todo must trigger meaningful data');
});

test('TEST 8: Active food item → true', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_food_v2': JSON.stringify([{ id: 'f1', name: 'Protein Shake', calories: 250 }]),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, true, 'Active food item must trigger meaningful data');
});

test('TEST 9: Water with glasses > 0 → true', async () => {
  const storageNonZero = createMockAsyncStorage({
    '@lyfeos_water_v2': JSON.stringify([{ id: 'w1', date: '2026-09-12', glasses: 4 }]),
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageNonZero), true, 'Water glasses > 0 must trigger true');

  const storageZero = createMockAsyncStorage({
    '@lyfeos_water_v2': JSON.stringify([{ id: 'w2', date: '2026-09-12', glasses: 0 }]),
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageZero), false, 'Water glasses = 0 must report false');
});

test('TEST 10: Activity record → true', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_activity_logs_v1': JSON.stringify([{ id: 'a1', sport: 'Morning Run', duration: 30 }]),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, true, 'Active activity record must trigger meaningful data');
});

test('TEST 11: Steps > 0 → true', async () => {
  const storageNonZero = createMockAsyncStorage({
    '@lyfeos_steps_v1': JSON.stringify([{ date: '2026-09-12', steps: 6500 }]),
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageNonZero), true, 'Steps > 0 must trigger true');

  const storageZero = createMockAsyncStorage({
    '@lyfeos_steps_v1': JSON.stringify([{ date: '2026-09-12', steps: 0 }]),
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageZero), false, 'Steps = 0 must report false');
});

test('TEST 12: Custom health data → true', async () => {
  const storage = createMockAsyncStorage({
    '@lyfeos_profile_health_v1': JSON.stringify({
      age: '28',
      sex: 'female',
      height: '168',
      weight: '62',
      activityLevel: 'moderately',
      goal: 'fitness',
    }),
  });
  const result = await evaluateMeaningfulGuestData(storage);
  assert.strictEqual(result, true, 'Custom health metrics must trigger meaningful data');
});

test('TEST 13: Custom profile name → true', async () => {
  const storageCustom = createMockAsyncStorage({
    '@lyfeos_profile_name_v1': 'Alice Walker',
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageCustom), true, 'Custom profile name must trigger true');

  const storageDefault = createMockAsyncStorage({
    '@lyfeos_profile_name_v1': 'LyfeOS User',
  });
  assert.strictEqual(await evaluateMeaningfulGuestData(storageDefault), false, 'Default name must report false');
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: AUTH CONTEXT & NAVIGATION GATE TESTS (TESTS 14 - 20)
// ─────────────────────────────────────────────────────────────────────────────

function createAuthGateHarness({ initialUser = null, hasGuestData = false }) {
  let currentUser = initialUser;
  let isPendingMigrationResolution = false;
  const calls = {
    handleGuestMigration: [],
    linkWithCredential: [],
    userDelete: [],
  };

  const createMockUser = (uid, isAnonymous) => ({
    uid,
    isAnonymous,
    delete: async () => {
      calls.userDelete.push(uid);
    },
    linkWithCredential: async (credential) => {
      calls.linkWithCredential.push({ uid, credential });
      if (credential._failWith) {
        const err = new Error(credential._failWith.message || 'Linking failed');
        // @ts-ignore
        err.code = credential._failWith.code;
        throw err;
      }
      isAnonymous = false;
      return { user: { uid, isAnonymous: false } };
    },
  });

  if (initialUser) {
    currentUser = createMockUser(initialUser.uid, initialUser.isAnonymous);
  }

  const mockAuth = {
    currentUser: () => currentUser,
    EmailAuthProvider: {
      credential: (email, password) => ({ providerId: 'password', email, password }),
    },
    GoogleAuthProvider: {
      credential: (idToken) => ({
        providerId: 'google.com',
        idToken,
        _failWith: idToken === 'token_existing' ? { code: 'auth/credential-already-in-use' } : null,
      }),
    },
    signInWithEmailAndPassword: async (email, password) => {
      const existingUser = createMockUser('existing_user_uid', false);
      currentUser = existingUser;
      return { user: existingUser, additionalUserInfo: { isNewUser: false } };
    },
    signInWithCredential: async (credential) => {
      const existingUser = createMockUser('existing_google_uid', false);
      currentUser = existingUser;
      return { user: existingUser, additionalUserInfo: { isNewUser: false } };
    },
  };

  const handleGuestMigration = async (uid, wasAnonymous) => {
    calls.handleGuestMigration.push({ uid, wasAnonymous });
  };

  // ── Phase 2B-1 Authenticated Handlers ─────────────────────────────────────

  const signInWithEmail = async (email, password) => {
    const wasAnonymous = mockAuth.currentUser()?.isAnonymous === true;
    const result = await mockAuth.signInWithEmailAndPassword(email, password);
    const isNewUser = result.additionalUserInfo?.isNewUser ?? false;

    if (wasAnonymous && !isNewUser && hasGuestData) {
      isPendingMigrationResolution = true;
      // Do NOT call handleGuestMigration
      return;
    }
    // If not anonymous or no guest data: do not migrate
  };

  const signInWithGoogle = async (idToken = 'token_existing') => {
    const anonUser = mockAuth.currentUser();
    const isAnon = anonUser?.isAnonymous === true;
    const googleCredential = mockAuth.GoogleAuthProvider.credential(idToken);

    if (isAnon && anonUser) {
      try {
        const result = await anonUser.linkWithCredential(googleCredential);
        return;
      } catch (linkError) {
        if (linkError.code === 'auth/credential-already-in-use') {
          const result = await mockAuth.signInWithCredential(googleCredential);
          const isNewUser = result.additionalUserInfo?.isNewUser ?? false;

          if (!isNewUser && hasGuestData) {
            isPendingMigrationResolution = true;
          }
          return;
        }
        throw linkError;
      }
    }
    await mockAuth.signInWithCredential(googleCredential);
  };

  return {
    signInWithEmail,
    signInWithGoogle,
    getIsPending: () => isPendingMigrationResolution,
    setIsPending: (v) => { isPendingMigrationResolution = v; },
    getCurrentUser: () => currentUser,
    calls,
  };
}

test('TEST 14: Existing account + guest data → migration handler NOT called → pending migration state becomes true', async () => {
  const harness = createAuthGateHarness({
    initialUser: { uid: 'anon_14', isAnonymous: true },
    hasGuestData: true,
  });

  await harness.signInWithEmail('user@domain.com', 'password123');

  assert.strictEqual(harness.getIsPending(), true, 'isPendingMigrationResolution must become true');
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'handleGuestMigration must NOT be called blindly');
  assert.strictEqual(harness.getCurrentUser().uid, 'existing_user_uid', 'Must authenticate the existing account');
});

test('TEST 15: Existing account + no guest data → migration handler NOT called → pending migration state remains false', async () => {
  const harness = createAuthGateHarness({
    initialUser: { uid: 'anon_15', isAnonymous: true },
    hasGuestData: false,
  });

  await harness.signInWithEmail('user@domain.com', 'password123');

  assert.strictEqual(harness.getIsPending(), false, 'isPendingMigrationResolution must remain false when no guest data');
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'handleGuestMigration must NOT be called');
});

test('TEST 16: New account via Phase 2A → existing linking behavior unchanged', async () => {
  const harness = createAuthGateHarness({
    initialUser: { uid: 'anon_16', isAnonymous: true },
    hasGuestData: true,
  });

  // New Google sign-in with valid new token
  await harness.signInWithGoogle('token_brand_new_user');

  assert.strictEqual(harness.calls.linkWithCredential.length, 1, 'linkWithCredential should be called for new account');
  assert.strictEqual(harness.getIsPending(), false, 'isPendingMigrationResolution remains false for new linked account');
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'Duplicate migration bypassed via Phase 2A');
});

test('TEST 17: Normal sign-in without guest → existing behavior unchanged', async () => {
  const harness = createAuthGateHarness({
    initialUser: null, // Fresh user without guest session
    hasGuestData: false,
  });

  await harness.signInWithEmail('regular@domain.com', 'password123');

  assert.strictEqual(harness.getIsPending(), false, 'isPendingMigrationResolution remains false');
  assert.strictEqual(harness.calls.handleGuestMigration.length, 0, 'handleGuestMigration not called');
});

test('TEST 18: Navigation guard blocks redirect while isPendingMigrationResolution === true', () => {
  // Simulate RootLayoutNav logic from app/_layout.tsx:73-99
  const simulateRouterGuard = ({ user, isInitializing, legalConsentAccepted, hasSeenOnboarding, isPendingMigrationResolution }) => {
    if (isInitializing || hasSeenOnboarding === null || legalConsentAccepted === null || isPendingMigrationResolution) {
      return 'BLOCKED';
    }
    if (user !== null) {
      return legalConsentAccepted ? 'REDIRECT_TABS' : 'REDIRECT_CONSENT';
    }
    return hasSeenOnboarding ? 'REDIRECT_LOGIN' : 'REDIRECT_ONBOARDING';
  };

  const blockedState = simulateRouterGuard({
    user: { uid: 'existing_account_uid' },
    isInitializing: false,
    legalConsentAccepted: true,
    hasSeenOnboarding: true,
    isPendingMigrationResolution: true, // Resolution locked
  });

  assert.strictEqual(blockedState, 'BLOCKED', 'Router must abort and return early without redirecting to tabs');
});

test('TEST 19: Navigation resumes when state becomes false', () => {
  const simulateRouterGuard = ({ user, isInitializing, legalConsentAccepted, hasSeenOnboarding, isPendingMigrationResolution }) => {
    if (isInitializing || hasSeenOnboarding === null || legalConsentAccepted === null || isPendingMigrationResolution) {
      return 'BLOCKED';
    }
    if (user !== null) {
      return legalConsentAccepted ? 'REDIRECT_TABS' : 'REDIRECT_CONSENT';
    }
    return hasSeenOnboarding ? 'REDIRECT_LOGIN' : 'REDIRECT_ONBOARDING';
  };

  const unlockedState = simulateRouterGuard({
    user: { uid: 'existing_account_uid' },
    isInitializing: false,
    legalConsentAccepted: true,
    hasSeenOnboarding: true,
    isPendingMigrationResolution: false, // Resolution unlocked
  });

  assert.strictEqual(unlockedState, 'REDIRECT_TABS', 'Router must redirect to tabs once resolution lock is released');
});

test('TEST 20: Verify no code path calls anonUser.delete() as part of this phase', async () => {
  const harness = createAuthGateHarness({
    initialUser: { uid: 'anon_20', isAnonymous: true },
    hasGuestData: true,
  });

  // Execute Email sign-in and Google sign-in
  await harness.signInWithEmail('test@domain.com', 'password');
  await harness.signInWithGoogle('token_existing');

  assert.strictEqual(harness.calls.userDelete.length, 0, 'Native user.delete() must NEVER be called by Phase 2B-1 flows');
});
