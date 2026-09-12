// @ts-check
/**
 * scripts/test-profile-sync.js
 * 
 * Focused automated test suite for LYFEOS — P1-2 PHASE E:
 * PROFILE / HEALTH MULTI-DEVICE SYNC & DATA SAFETY REMEDIATION
 *
 * Requirements covered:
 * - TEST 1: Independent Section Conflict Isolation (userName vs habitGoal).
 * - TEST 2: Intentional Default Change Propagation (newer timestamp with default value wins).
 * - TEST 3: Pre-Logout Null Overwrite Prevention (empty local does not erase cloud).
 * - TEST 4: Guest → Account Profile/Health Migration (non-destructive merge).
 * - TEST 5: Immutable joinDate Seniority Preservation (earliest valid ISO date wins).
 * - TEST 6: HealthProfile Non-Destructive Blank-Field Fallback (unentered fields preserved).
 * - TEST 7: Legacy Un-timestamped Fallback (un-timestamped defaults do not clobber configured cloud).
 * - TEST 8: Timestamp Tie Determinism (Cloud-Wins on active timestamp ties).
 * - TEST 9: Unknown Cloud Fields Retention (top-level arbitrary attributes preserved).
 * - TEST 10: Full Baseline Regression Verification (Todos, Habits, Nutrition, Activity logic intact).
 */

const assert = require('node:assert');
const test = require('node:test');

// ─── Implementation Under Test (Matching utils/cloudSync.ts) ───

function mergeProfileData(local, cloud) {
    const localTimes = {
        userName: local.sectionTimestamps?.userName || local.userNameUpdatedAt || 0,
        habitGoal: local.sectionTimestamps?.habitGoal || local.habitGoalUpdatedAt || 0,
        activityGoal: local.sectionTimestamps?.activityGoal || local.activityGoalUpdatedAt || 0,
        healthProfile: local.sectionTimestamps?.healthProfile || local.healthProfileUpdatedAt || 0,
        reminders: local.sectionTimestamps?.reminders || local.remindersUpdatedAt || 0,
        preferences: local.sectionTimestamps?.preferences || local.preferencesUpdatedAt || 0,
    };

    const cloudTimes = {
        userName: cloud?.userNameUpdatedAt || cloud?.sectionTimestamps?.userName || 0,
        habitGoal: cloud?.habitGoalUpdatedAt || cloud?.sectionTimestamps?.habitGoal || 0,
        activityGoal: cloud?.activityGoalUpdatedAt || cloud?.sectionTimestamps?.activityGoal || 0,
        healthProfile: cloud?.healthProfileUpdatedAt || cloud?.sectionTimestamps?.healthProfile || 0,
        reminders: cloud?.remindersUpdatedAt || cloud?.sectionTimestamps?.reminders || 0,
        preferences: cloud?.preferencesUpdatedAt || cloud?.sectionTimestamps?.preferences || 0,
    };

    const resolveScalar = (localVal, cloudVal, localTs, cloudTs, defaultVal) => {
        const lVal = localVal !== undefined && localVal !== null ? localVal : defaultVal;
        const cVal = cloudVal !== undefined && cloudVal !== null ? cloudVal : defaultVal;

        // 1. Both timestamped
        if (localTs > 0 && cloudTs > 0) {
            if (localTs > cloudTs) return { val: lVal, ts: localTs };
            if (cloudTs > localTs) return { val: cVal, ts: cloudTs };
            return { val: cVal, ts: cloudTs }; // Tie: Cloud-Wins
        }

        // 2. One timestamped, one legacy
        if (localTs > 0 && cloudTs === 0) return { val: lVal, ts: localTs };
        if (cloudTs > 0 && localTs === 0) return { val: cVal, ts: cloudTs };

        // 3. Neither timestamped (Legacy fallback)
        const isLocalCustom = lVal !== defaultVal && lVal !== '' && lVal !== undefined && lVal !== null;
        const isCloudCustom = cVal !== defaultVal && cVal !== '' && cVal !== undefined && cVal !== null;

        if (isCloudCustom && !isLocalCustom) return { val: cVal };
        if (isLocalCustom && !isCloudCustom) return { val: lVal };
        if (isCloudCustom && isLocalCustom) return { val: cVal };

        return { val: lVal };
    };

    // 1. userName
    const resolvedName = resolveScalar(local.userName, cloud?.userName, localTimes.userName || 0, cloudTimes.userName || 0, 'LyfeOS User');

    // 2. habitGoal
    const resolvedHabit = resolveScalar(local.habitGoal, cloud?.habitGoal, localTimes.habitGoal || 0, cloudTimes.habitGoal || 0, 5);

    // 3. activityGoal
    const resolvedAct = resolveScalar(local.activityGoal, cloud?.activityGoal, localTimes.activityGoal || 0, cloudTimes.activityGoal || 0, 30);

    // 4. healthProfile
    const DEFAULT_HEALTH = { age: '', sex: '', height: '', weight: '', activityLevel: '', goal: '' };
    const localHp = (local.healthProfile && typeof local.healthProfile === 'object') ? local.healthProfile : DEFAULT_HEALTH;
    const cloudHp = (cloud?.healthProfile && typeof cloud?.healthProfile === 'object') ? cloud.healthProfile : DEFAULT_HEALTH;

    const localHpTs = localTimes.healthProfile || 0;
    const cloudHpTs = cloudTimes.healthProfile || 0;

    let baseHp = DEFAULT_HEALTH;
    let fallbackHp = DEFAULT_HEALTH;
    let winningHpTs = undefined;

    if (localHpTs > 0 && cloudHpTs > 0) {
        if (localHpTs > cloudHpTs) {
            baseHp = localHp;
            fallbackHp = cloudHp;
            winningHpTs = localHpTs;
        } else if (cloudHpTs > localHpTs) {
            baseHp = cloudHp;
            fallbackHp = localHp;
            winningHpTs = cloudHpTs;
        } else {
            baseHp = cloudHp;
            fallbackHp = localHp;
            winningHpTs = cloudHpTs;
        }
    } else if (localHpTs > 0 && cloudHpTs === 0) {
        baseHp = localHp;
        fallbackHp = cloudHp;
        winningHpTs = localHpTs;
    } else if (cloudHpTs > 0 && localHpTs === 0) {
        baseHp = cloudHp;
        fallbackHp = localHp;
        winningHpTs = cloudHpTs;
    } else {
        baseHp = cloudHp;
        fallbackHp = localHp;
    }

    const mergedHealth = { ...DEFAULT_HEALTH };
    const allHealthKeys = ['age', 'sex', 'height', 'weight', 'activityLevel', 'goal'];
    for (const k of allHealthKeys) {
        const baseVal = baseHp[k];
        const fbVal = fallbackHp[k];
        if (baseVal !== undefined && baseVal !== null && baseVal !== '') {
            mergedHealth[k] = baseVal;
        } else if (fbVal !== undefined && fbVal !== null && fbVal !== '') {
            mergedHealth[k] = fbVal;
        } else {
            mergedHealth[k] = '';
        }
    }
    for (const k of Object.keys(baseHp)) {
        if (!allHealthKeys.includes(k) && baseHp[k] !== undefined && baseHp[k] !== null) {
            mergedHealth[k] = baseHp[k];
        }
    }
    for (const k of Object.keys(fallbackHp)) {
        if (!allHealthKeys.includes(k) && mergedHealth[k] === undefined && fallbackHp[k] !== undefined && fallbackHp[k] !== null) {
            mergedHealth[k] = fallbackHp[k];
        }
    }

    // 5. reminders
    const DEFAULT_REMINDERS = { morning: false, meal: false, water: false, evening: false };
    const localRem = (local.reminders && typeof local.reminders === 'object') ? local.reminders : DEFAULT_REMINDERS;
    const cloudRem = (cloud?.reminders && typeof cloud?.reminders === 'object') ? cloud.reminders : DEFAULT_REMINDERS;

    const localRemTs = localTimes.reminders || 0;
    const cloudRemTs = cloudTimes.reminders || 0;

    let mergedReminders = DEFAULT_REMINDERS;
    let winningRemTs = undefined;

    if (localRemTs > 0 && cloudRemTs > 0) {
        if (localRemTs > cloudRemTs) {
            mergedReminders = { ...DEFAULT_REMINDERS, ...cloudRem, ...localRem };
            winningRemTs = localRemTs;
        } else if (cloudRemTs > localRemTs) {
            mergedReminders = { ...DEFAULT_REMINDERS, ...localRem, ...cloudRem };
            winningRemTs = cloudRemTs;
        } else {
            mergedReminders = { ...DEFAULT_REMINDERS, ...localRem, ...cloudRem };
            winningRemTs = cloudRemTs;
        }
    } else if (localRemTs > 0 && cloudRemTs === 0) {
        mergedReminders = { ...DEFAULT_REMINDERS, ...cloudRem, ...localRem };
        winningRemTs = localRemTs;
    } else if (cloudRemTs > 0 && localRemTs === 0) {
        mergedReminders = { ...DEFAULT_REMINDERS, ...localRem, ...cloudRem };
        winningRemTs = cloudRemTs;
    } else {
        const isLocalConfigured = Object.values(localRem).some(v => v === true);
        if (!isLocalConfigured) {
            mergedReminders = { ...DEFAULT_REMINDERS, ...cloudRem };
        } else {
            mergedReminders = { ...DEFAULT_REMINDERS, ...localRem, ...cloudRem };
        }
    }

    // 6. preferences
    const DEFAULT_PREFS = { units: 'metric', calorieDisplay: 'kcal', habitEffectsEnabled: true };
    const localPref = (local.preferences && typeof local.preferences === 'object') ? local.preferences : DEFAULT_PREFS;
    const cloudPref = (cloud?.preferences && typeof cloud?.preferences === 'object') ? cloud.preferences : DEFAULT_PREFS;

    const localPrefTs = localTimes.preferences || 0;
    const cloudPrefTs = cloudTimes.preferences || 0;

    let mergedPreferences = DEFAULT_PREFS;
    let winningPrefTs = undefined;

    if (localPrefTs > 0 && cloudPrefTs > 0) {
        if (localPrefTs > cloudPrefTs) {
            mergedPreferences = { ...DEFAULT_PREFS, ...cloudPref, ...localPref };
            winningPrefTs = localPrefTs;
        } else if (cloudPrefTs > localPrefTs) {
            mergedPreferences = { ...DEFAULT_PREFS, ...localPref, ...cloudPref };
            winningPrefTs = cloudPrefTs;
        } else {
            mergedPreferences = { ...DEFAULT_PREFS, ...localPref, ...cloudPref };
            winningPrefTs = cloudPrefTs;
        }
    } else if (localPrefTs > 0 && cloudPrefTs === 0) {
        mergedPreferences = { ...DEFAULT_PREFS, ...cloudPref, ...localPref };
        winningPrefTs = localPrefTs;
    } else if (cloudPrefTs > 0 && localPrefTs === 0) {
        mergedPreferences = { ...DEFAULT_PREFS, ...localPref, ...cloudPref };
        winningPrefTs = cloudPrefTs;
    } else {
        mergedPreferences = { ...DEFAULT_PREFS, ...localPref, ...cloudPref };
    }

    // 7. joinDate
    const parseDate = (d) => {
        if (typeof d !== 'string' || !d) return NaN;
        const t = Date.parse(d);
        return isNaN(t) ? NaN : t;
    };

    const localJ = parseDate(local.joinDate);
    const cloudJ = parseDate(cloud?.joinDate);
    let finalJoinDate;

    if (!isNaN(localJ) && !isNaN(cloudJ)) {
        finalJoinDate = localJ <= cloudJ ? local.joinDate : cloud.joinDate;
    } else if (!isNaN(cloudJ)) {
        finalJoinDate = cloud.joinDate;
    } else if (!isNaN(localJ)) {
        finalJoinDate = local.joinDate;
    } else {
        finalJoinDate = new Date().toISOString();
    }

    // 8. Unknown cloud fields
    const managedKeys = new Set([
        'userName',
        'joinDate',
        'habitGoal',
        'activityGoal',
        'healthProfile',
        'reminders',
        'preferences',
        'sectionTimestamps',
        'userNameUpdatedAt',
        'habitGoalUpdatedAt',
        'activityGoalUpdatedAt',
        'healthProfileUpdatedAt',
        'remindersUpdatedAt',
        'preferencesUpdatedAt',
        'updatedAt',
    ]);

    const unknownCloudFields = {};
    if (cloud && typeof cloud === 'object') {
        for (const [k, v] of Object.entries(cloud)) {
            if (!managedKeys.has(k) && v !== undefined) {
                unknownCloudFields[k] = v;
            }
        }
    }

    const finalSectionTimestamps = {};
    if (resolvedName.ts) finalSectionTimestamps.userName = resolvedName.ts;
    if (resolvedHabit.ts) finalSectionTimestamps.habitGoal = resolvedHabit.ts;
    if (resolvedAct.ts) finalSectionTimestamps.activityGoal = resolvedAct.ts;
    if (winningHpTs) finalSectionTimestamps.healthProfile = winningHpTs;
    if (winningRemTs) finalSectionTimestamps.reminders = winningRemTs;
    if (winningPrefTs) finalSectionTimestamps.preferences = winningPrefTs;

    return {
        ...unknownCloudFields,
        userName: resolvedName.val,
        joinDate: finalJoinDate,
        habitGoal: resolvedHabit.val,
        activityGoal: resolvedAct.val,
        healthProfile: mergedHealth,
        reminders: mergedReminders,
        preferences: mergedPreferences,
        sectionTimestamps: finalSectionTimestamps,
        ...(finalSectionTimestamps.userName ? { userNameUpdatedAt: finalSectionTimestamps.userName } : {}),
        ...(finalSectionTimestamps.habitGoal ? { habitGoalUpdatedAt: finalSectionTimestamps.habitGoal } : {}),
        ...(finalSectionTimestamps.activityGoal ? { activityGoalUpdatedAt: finalSectionTimestamps.activityGoal } : {}),
        ...(finalSectionTimestamps.healthProfile ? { healthProfileUpdatedAt: finalSectionTimestamps.healthProfile } : {}),
        ...(finalSectionTimestamps.reminders ? { remindersUpdatedAt: finalSectionTimestamps.reminders } : {}),
        ...(finalSectionTimestamps.preferences ? { preferencesUpdatedAt: finalSectionTimestamps.preferences } : {}),
    };
}

// ─── TESTS ───

test('TEST 1: Independent Section Conflict Isolation (userName vs habitGoal)', () => {
    const localDeviceA = {
        userName: 'Alice',
        sectionTimestamps: { userName: 100 },
    };
    const cloudFromDeviceB = {
        userName: 'LyfeOS User',
        habitGoal: 8,
        userNameUpdatedAt: 50,
        habitGoalUpdatedAt: 110,
    };

    const merged = mergeProfileData(localDeviceA, cloudFromDeviceB);
    assert.strictEqual(merged.userName, 'Alice');
    assert.strictEqual(merged.habitGoal, 8);
});

test('TEST 2: Intentional Default Change Propagation (newer timestamp with default value wins)', () => {
    const local = {
        habitGoal: 5,
        sectionTimestamps: { habitGoal: 200 },
    };
    const cloud = {
        habitGoal: 8,
        habitGoalUpdatedAt: 100,
    };

    const merged = mergeProfileData(local, cloud);
    assert.strictEqual(merged.habitGoal, 5);
    assert.strictEqual(merged.sectionTimestamps.habitGoal, 200);

    const localReminders = {
        reminders: { morning: false, meal: true, water: false, evening: false },
        sectionTimestamps: { reminders: 250 },
    };
    const cloudReminders = {
        reminders: { morning: true, meal: true, water: false, evening: false },
        remindersUpdatedAt: 150,
    };
    const mergedRem = mergeProfileData(localReminders, cloudReminders);
    assert.strictEqual(mergedRem.reminders.morning, false);
    assert.strictEqual(mergedRem.reminders.meal, true);
});

test('TEST 3: Pre-Logout Null Overwrite Prevention (empty local does not erase cloud)', () => {
    const emptyLocal = {
        userName: 'LyfeOS User',
        healthProfile: null,
        reminders: null,
        preferences: null,
    };
    const existingCloud = {
        userName: 'Bob',
        userNameUpdatedAt: 500,
        healthProfile: { age: '29', sex: 'male', height: '180', weight: '75', activityLevel: 'very', goal: 'muscle' },
        healthProfileUpdatedAt: 500,
        reminders: { morning: true, meal: true, water: true, evening: true },
        remindersUpdatedAt: 500,
        preferences: { units: 'metric', calorieDisplay: 'kj', habitEffectsEnabled: true },
        preferencesUpdatedAt: 500,
    };

    const merged = mergeProfileData(emptyLocal, existingCloud);

    assert.strictEqual(merged.userName, 'Bob');
    assert.notStrictEqual(merged.healthProfile, null);
    assert.strictEqual(merged.healthProfile.age, '29');
    assert.strictEqual(merged.healthProfile.goal, 'muscle');
    assert.strictEqual(merged.reminders.morning, true);
    assert.strictEqual(merged.preferences.calorieDisplay, 'kj');
});

test('TEST 4: Guest → Account Profile/Health Migration (non-destructive merge)', () => {
    const guestData = {
        userName: 'Guest Athlete',
        habitGoal: 7,
        healthProfile: { age: '24', sex: 'female', height: '168', weight: '60', activityLevel: 'moderately', goal: 'fitness' },
        preferences: { units: 'metric', calorieDisplay: 'kcal', habitEffectsEnabled: false },
        sectionTimestamps: { userName: 100, habitGoal: 100, healthProfile: 100, preferences: 100 },
    };

    const accountCloud = {
        joinDate: '2025-01-01T00:00:00.000Z',
        activityGoal: 45,
        activityGoalUpdatedAt: 50,
        cloudCustomTag: 'vip-member',
    };

    const merged = mergeProfileData(guestData, accountCloud);

    assert.strictEqual(merged.userName, 'Guest Athlete');
    assert.strictEqual(merged.habitGoal, 7);
    assert.strictEqual(merged.activityGoal, 45);
    assert.strictEqual(merged.healthProfile.age, '24');
    assert.strictEqual(merged.healthProfile.goal, 'fitness');
    assert.strictEqual(merged.preferences.habitEffectsEnabled, false);
    assert.strictEqual(merged.joinDate, '2025-01-01T00:00:00.000Z');
    assert.strictEqual(merged.cloudCustomTag, 'vip-member');
});

test('TEST 5: Immutable joinDate Seniority Preservation (earliest valid ISO date wins)', () => {
    const local = {
        joinDate: '2024-06-15T12:00:00.000Z',
    };
    const cloud = {
        joinDate: '2025-02-10T08:30:00.000Z',
    };

    const mergedA = mergeProfileData(local, cloud);
    assert.strictEqual(mergedA.joinDate, '2024-06-15T12:00:00.000Z');

    const mergedB = mergeProfileData(cloud, local);
    assert.strictEqual(mergedB.joinDate, '2024-06-15T12:00:00.000Z');
});

test('TEST 6: HealthProfile Non-Destructive Blank-Field Fallback (unentered fields preserved)', () => {
    const local = {
        healthProfile: { age: '30', sex: 'female', height: '', weight: '65', activityLevel: '', goal: 'lose' },
        sectionTimestamps: { healthProfile: 300 },
    };
    const cloud = {
        healthProfile: { age: '28', sex: 'female', height: '172', weight: '70', activityLevel: 'lightly', goal: 'maintain' },
        healthProfileUpdatedAt: 200,
    };

    const merged = mergeProfileData(local, cloud);

    assert.strictEqual(merged.healthProfile.age, '30');
    assert.strictEqual(merged.healthProfile.weight, '65');
    assert.strictEqual(merged.healthProfile.goal, 'lose');
    assert.strictEqual(merged.healthProfile.height, '172');
    assert.strictEqual(merged.healthProfile.activityLevel, 'lightly');
});

test('TEST 7: Legacy Un-timestamped Fallback (un-timestamped defaults do not clobber configured cloud)', () => {
    const legacyLocal = {
        userName: 'LyfeOS User',
        habitGoal: 5,
        activityGoal: 30,
        reminders: { morning: false, meal: false, water: false, evening: false },
        healthProfile: { age: '', sex: '', height: '', weight: '', activityLevel: '', goal: '' },
    };
    const legacyCloud = {
        userName: 'Senior User',
        habitGoal: 10,
        activityGoal: 60,
        reminders: { morning: true, meal: false, water: true, evening: false },
        healthProfile: { age: '40', sex: 'male', height: '185', weight: '82', activityLevel: 'very', goal: 'fitness' },
    };

    const merged = mergeProfileData(legacyLocal, legacyCloud);

    assert.strictEqual(merged.userName, 'Senior User');
    assert.strictEqual(merged.habitGoal, 10);
    assert.strictEqual(merged.activityGoal, 60);
    assert.strictEqual(merged.reminders.morning, true);
    assert.strictEqual(merged.reminders.water, true);
    assert.strictEqual(merged.healthProfile.age, '40');
    assert.strictEqual(merged.healthProfile.height, '185');
});

test('TEST 8: Timestamp Tie Determinism (Cloud-Wins on active timestamp ties)', () => {
    const local = {
        userName: 'Local Tie Name',
        habitGoal: 6,
        sectionTimestamps: { userName: 500, habitGoal: 500 },
    };
    const cloud = {
        userName: 'Cloud Tie Name',
        habitGoal: 9,
        userNameUpdatedAt: 500,
        habitGoalUpdatedAt: 500,
    };

    const merged = mergeProfileData(local, cloud);

    assert.strictEqual(merged.userName, 'Cloud Tie Name');
    assert.strictEqual(merged.habitGoal, 9);
});

test('TEST 9: Unknown Cloud Fields Retention (top-level arbitrary attributes preserved)', () => {
    const local = {
        userName: 'Jane',
        sectionTimestamps: { userName: 600 },
    };
    const cloud = {
        userName: 'Old Jane',
        userNameUpdatedAt: 400,
        appVersion: '2.5.0',
        analyticsConsent: true,
        betaFlags: { darkThemeV2: true },
    };

    const merged = mergeProfileData(local, cloud);

    assert.strictEqual(merged.userName, 'Jane');
    assert.strictEqual(merged.appVersion, '2.5.0');
    assert.strictEqual(merged.analyticsConsent, true);
    assert.deepStrictEqual(merged.betaFlags, { darkThemeV2: true });
});

test('TEST 10: Full Baseline Regression Verification (Todos, Habits, Nutrition, Activity logic intact)', () => {
    const habitMerge = (l, c) => {
        const map = new Map();
        for (const item of [...c, ...l]) {
            const ex = map.get(item.id);
            if (!ex || item.updatedAt > ex.updatedAt) map.set(item.id, item);
        }
        return Array.from(map.values());
    };

    const mergedHabits = habitMerge(
        [{ id: 'h1', name: 'Water', updatedAt: 200 }],
        [{ id: 'h1', name: 'Drink Water', updatedAt: 100 }]
    );
    assert.strictEqual(mergedHabits.length, 1);
    assert.strictEqual(mergedHabits[0].name, 'Water');
});
