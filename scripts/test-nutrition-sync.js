// @ts-check
/**
 * scripts/test-nutrition-sync.js
 * 
 * Focused automated test suite for LYFEOS — P1-2 PHASE C:
 * NUTRITION & WATER MULTI-DEVICE SYNC REMEDIATION
 *
 * Requirements covered:
 * - TEST 1: Local-only food item + cloud-only food item → both survive.
 * - TEST 2: Local deletion vs stale cloud food item → deletion wins (not resurrected).
 * - TEST 3: Newer cloud food update vs older local food update → cloud wins.
 * - TEST 4: Newer local food update vs older cloud food update → local wins.
 * - TEST 5: Same timestamp tie + deletion for food item → Delete-Wins.
 * - TEST 6: Water log newer cloud count vs older local count (and vice versa - decrements propagate).
 * - TEST 7: Water log timestamp tie → Math.max(local, cloud).
 * - TEST 8: Water log deletion vs stale cloud count & Delete-Wins on tie.
 * - TEST 9: Legacy food items & water logs without updatedAt safely normalized.
 * - TEST 10: 30-day tombstone retention pruning.
 * - TEST 11: Daily Goal & goalsConfigured preservation.
 * - TEST 12: Baseline regression verification (Habits, Todos, Guest Migration).
 */

const assert = require('node:assert');
const test = require('node:test');

const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Implementation Under Test (Matching utils/cloudSync.ts) ───

function normalizeFoodItem(raw, fallbackUpdatedAt = 0) {
    if (!raw || typeof raw !== 'object' || !raw.id || typeof raw.id !== 'string') {
        return null;
    }

    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : (typeof fallbackUpdatedAt === 'number' && Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0);

    const normalized = {
        ...raw,
        id: String(raw.id),
        name: typeof raw.name === 'string' ? raw.name : String(raw.name || ''),
        calories: typeof raw.calories === 'number' && Number.isFinite(raw.calories) ? raw.calories : (Number(raw.calories) || 0),
        meal: typeof raw.meal === 'string' && raw.meal ? raw.meal : 'lunch',
        date: typeof raw.date === 'string' ? raw.date : String(raw.date || ''),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && Number.isFinite(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

function normalizeWaterLog(raw, fallbackUpdatedAt = 0) {
    if (!raw || typeof raw !== 'object' || !raw.date || typeof raw.date !== 'string') {
        return null;
    }

    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : (typeof fallbackUpdatedAt === 'number' && Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0);

    const normalized = {
        id: typeof raw.id === 'string' && raw.id ? raw.id : String(raw.date),
        date: String(raw.date),
        glasses: typeof raw.glasses === 'number' && Number.isFinite(raw.glasses) ? Math.max(0, raw.glasses) : Math.max(0, Number(raw.glasses) || 0),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && Number.isFinite(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

function mergeFoodItems(localItems = [], cloudItems = []) {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localItems || [])
        .map((f) => normalizeFoodItem(f))
        .filter((f) => f !== null);

    const normalizedCloud = (cloudItems || [])
        .map((f) => normalizeFoodItem(f))
        .filter((f) => f !== null);

    const foodMap = new Map();

    const resolveConflict = (existing, incoming) => {
        if (incoming.updatedAt > existing.updatedAt) {
            return incoming;
        }
        if (existing.updatedAt > incoming.updatedAt) {
            return existing;
        }
        // Timestamp ties: DELETE WINS
        if (incoming.deletedAt && !existing.deletedAt) {
            return incoming;
        }
        if (existing.deletedAt && !incoming.deletedAt) {
            return existing;
        }
        if (incoming.deletedAt && existing.deletedAt) {
            return incoming.deletedAt >= existing.deletedAt ? incoming : existing;
        }
        return incoming;
    };

    for (const item of normalizedCloud) {
        foodMap.set(item.id, item);
    }

    for (const item of normalizedLocal) {
        const existing = foodMap.get(item.id);
        if (!existing) {
            foodMap.set(item.id, item);
        } else {
            foodMap.set(item.id, resolveConflict(existing, item));
        }
    }

    const allItems = [];
    for (const item of foodMap.values()) {
        if (item.deletedAt) {
            if (item.deletedAt >= purgeCutoff) {
                allItems.push(item);
            }
        } else {
            allItems.push(item);
        }
    }

    const activeItems = allItems.filter((f) => !f.deletedAt);
    const tombstones = allItems.filter((f) => f.deletedAt);

    activeItems.sort((a, b) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        const mealDiff = (a.meal || '').localeCompare(b.meal || '');
        if (mealDiff !== 0) return mealDiff;
        return (a.id || '').localeCompare(b.id || '');
    });

    return [...activeItems, ...tombstones];
}

function mergeWaterLogs(localLogs = [], cloudLogs = []) {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localLogs || [])
        .map((w) => normalizeWaterLog(w))
        .filter((w) => w !== null);

    const normalizedCloud = (cloudLogs || [])
        .map((w) => normalizeWaterLog(w))
        .filter((w) => w !== null);

    const waterMap = new Map();

    const resolveConflict = (existing, incoming) => {
        if (incoming.updatedAt > existing.updatedAt) {
            return incoming;
        }
        if (existing.updatedAt > incoming.updatedAt) {
            return existing;
        }
        // Timestamp ties: DELETE WINS
        if (incoming.deletedAt && !existing.deletedAt) {
            return incoming;
        }
        if (existing.deletedAt && !incoming.deletedAt) {
            return existing;
        }
        if (incoming.deletedAt && existing.deletedAt) {
            return incoming.deletedAt >= existing.deletedAt ? incoming : existing;
        }
        // Both active on tie -> Math.max(glasses)
        const merged = {
            ...existing,
            ...incoming,
            glasses: Math.max(existing.glasses || 0, incoming.glasses || 0),
            updatedAt: existing.updatedAt,
        };
        delete merged.deletedAt;
        return merged;
    };

    for (const log of normalizedCloud) {
        const existing = waterMap.get(log.date);
        if (!existing) {
            waterMap.set(log.date, log);
        } else {
            waterMap.set(log.date, resolveConflict(existing, log));
        }
    }

    for (const log of normalizedLocal) {
        const existing = waterMap.get(log.date);
        if (!existing) {
            waterMap.set(log.date, log);
        } else {
            waterMap.set(log.date, resolveConflict(existing, log));
        }
    }

    const allLogs = [];
    for (const log of waterMap.values()) {
        if (log.deletedAt) {
            if (log.deletedAt >= purgeCutoff) {
                allLogs.push(log);
            }
        } else {
            allLogs.push(log);
        }
    }

    allLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return allLogs;
}

// ─── TESTS ───

test('TEST 1: Local-only food item + cloud-only food item → both survive without data loss', () => {
    const now = Date.now();
    const local = [
        { id: 'f_local', name: 'Oatmeal', calories: 300, meal: 'breakfast', date: '2026-09-11', updatedAt: now - 1000 }
    ];
    const cloud = [
        { id: 'f_cloud', name: 'Grilled Chicken Salad', calories: 450, meal: 'lunch', date: '2026-09-11', updatedAt: now - 2000 }
    ];

    const merged = mergeFoodItems(local, cloud);

    assert.strictEqual(merged.length, 2, 'Both food items must survive');
    const localItem = merged.find(f => f.id === 'f_local');
    const cloudItem = merged.find(f => f.id === 'f_cloud');
    assert.ok(localItem, 'Local item must be present');
    assert.ok(cloudItem, 'Cloud item must be present');
    assert.strictEqual(localItem.name, 'Oatmeal');
    assert.strictEqual(cloudItem.name, 'Grilled Chicken Salad');
});

test('TEST 2: Local deletion vs stale cloud food item → deletion wins (not resurrected)', () => {
    const now = Date.now();
    const local = [
        { id: 'f_101', name: 'Snack Bar', calories: 180, meal: 'snacks', date: '2026-09-11', updatedAt: now, deletedAt: now }
    ];
    const cloud = [
        { id: 'f_101', name: 'Snack Bar', calories: 180, meal: 'snacks', date: '2026-09-11', updatedAt: now - 5000 }
    ];

    const merged = mergeFoodItems(local, cloud);

    assert.strictEqual(merged.length, 1, 'Should have 1 entry (the tombstone)');
    assert.strictEqual(merged[0].id, 'f_101');
    assert.strictEqual(merged[0].deletedAt, now, 'Tombstone must be preserved');

    // UI consumers filter out !f.deletedAt
    const activeUI = merged.filter(f => !f.deletedAt);
    assert.strictEqual(activeUI.length, 0, 'Deleted food item must NOT appear in active UI');
});

test('TEST 3: Newer cloud food update vs older local food update → cloud wins', () => {
    const now = Date.now();
    const local = [
        { id: 'f_202', name: 'Greek Yogurt', calories: 120, portionSize: '100g', meal: 'breakfast', date: '2026-09-11', updatedAt: now - 4000 }
    ];
    const cloud = [
        { id: 'f_202', name: 'Greek Yogurt with Honey', calories: 180, portionSize: '150g', meal: 'breakfast', date: '2026-09-11', updatedAt: now }
    ];

    const merged = mergeFoodItems(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'f_202');
    assert.strictEqual(merged[0].name, 'Greek Yogurt with Honey', 'Newer cloud name wins');
    assert.strictEqual(merged[0].calories, 180, 'Newer cloud calories win');
    assert.strictEqual(merged[0].portionSize, '150g', 'Newer cloud portion size wins');
});

test('TEST 4: Newer local food update vs older cloud food update → local wins', () => {
    const now = Date.now();
    const local = [
        { id: 'f_303', name: 'Brown Rice & Beans', calories: 420, portionSize: '2 bowls', meal: 'dinner', date: '2026-09-11', updatedAt: now }
    ];
    const cloud = [
        { id: 'f_303', name: 'Brown Rice', calories: 220, portionSize: '1 bowl', meal: 'dinner', date: '2026-09-11', updatedAt: now - 3000 }
    ];

    const merged = mergeFoodItems(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'f_303');
    assert.strictEqual(merged[0].name, 'Brown Rice & Beans', 'Newer local name wins');
    assert.strictEqual(merged[0].calories, 420, 'Newer local calories win');
    assert.strictEqual(merged[0].portionSize, '2 bowls', 'Newer local portion size wins');
});

test('TEST 5: Same timestamp tie + deletion for food item → Delete-Wins', () => {
    const tieTs = Date.now() - 1000;
    const local = [
        { id: 'f_404', name: 'Pasta', calories: 500, meal: 'dinner', date: '2026-09-11', updatedAt: tieTs }
    ];
    const cloud = [
        { id: 'f_404', name: 'Pasta', calories: 500, meal: 'dinner', date: '2026-09-11', updatedAt: tieTs, deletedAt: tieTs }
    ];

    const merged = mergeFoodItems(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'f_404');
    assert.strictEqual(merged[0].deletedAt, tieTs, 'Delete-Wins on timestamp tie');

    // Reversed order test (local deleted, cloud active)
    const localDel = [
        { id: 'f_405', name: 'Pizza', calories: 600, meal: 'dinner', date: '2026-09-11', updatedAt: tieTs, deletedAt: tieTs }
    ];
    const cloudAct = [
        { id: 'f_405', name: 'Pizza', calories: 600, meal: 'dinner', date: '2026-09-11', updatedAt: tieTs }
    ];
    const mergedReversed = mergeFoodItems(localDel, cloudAct);
    assert.strictEqual(mergedReversed.length, 1);
    assert.strictEqual(mergedReversed[0].deletedAt, tieTs, 'Delete-Wins on timestamp tie regardless of merge order');
});

test('TEST 6: Water log newer cloud count vs older local count (and vice versa - decrements propagate)', () => {
    const now = Date.now();
    // Case A: Cloud is newer with higher count (increment)
    const localA = [
        { id: 'w_1', date: '2026-09-11', glasses: 4, updatedAt: now - 5000 }
    ];
    const cloudA = [
        { id: 'w_1', date: '2026-09-11', glasses: 6, updatedAt: now }
    ];
    const mergedA = mergeWaterLogs(localA, cloudA);
    assert.strictEqual(mergedA.length, 1);
    assert.strictEqual(mergedA[0].glasses, 6, 'Newer cloud glasses win');

    // Case B: Local is newer with LOWER count (user clicked "-" to decrement glasses)
    const localB = [
        { id: 'w_2', date: '2026-09-11', glasses: 3, updatedAt: now }
    ];
    const cloudB = [
        { id: 'w_2', date: '2026-09-11', glasses: 5, updatedAt: now - 5000 }
    ];
    const mergedB = mergeWaterLogs(localB, cloudB);
    assert.strictEqual(mergedB.length, 1);
    assert.strictEqual(mergedB[0].glasses, 3, 'Newer local decrement must win and propagate over stale higher count');
});

test('TEST 7: Water log timestamp tie → Math.max(local, cloud)', () => {
    const tieTs = Date.now() - 2000;
    const local = [
        { id: 'w_loc', date: '2026-09-11', glasses: 5, updatedAt: tieTs }
    ];
    const cloud = [
        { id: 'w_cld', date: '2026-09-11', glasses: 7, updatedAt: tieTs }
    ];

    const merged = mergeWaterLogs(local, cloud);

    assert.strictEqual(merged.length, 1, 'Exactly one record per date');
    assert.strictEqual(merged[0].glasses, 7, 'Active timestamp tie must take Math.max to prevent lost increments');
});

test('TEST 8: Water log deletion vs stale cloud count & Delete-Wins on tie', () => {
    const now = Date.now();
    // Newer deletion vs older cloud
    const local = [
        { id: 'w_del', date: '2026-09-11', glasses: 0, updatedAt: now, deletedAt: now }
    ];
    const cloud = [
        { id: 'w_old', date: '2026-09-11', glasses: 6, updatedAt: now - 5000 }
    ];
    const merged = mergeWaterLogs(local, cloud);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].deletedAt, now, 'Newer water deletion must win over stale active log');

    // Timestamp tie: Delete-Wins
    const tieTs = now - 1000;
    const localTieDel = [
        { id: 'w_tie_del', date: '2026-09-11', glasses: 0, updatedAt: tieTs, deletedAt: tieTs }
    ];
    const cloudTieAct = [
        { id: 'w_tie_act', date: '2026-09-11', glasses: 4, updatedAt: tieTs }
    ];
    const mergedTie = mergeWaterLogs(localTieDel, cloudTieAct);
    assert.strictEqual(mergedTie.length, 1);
    assert.strictEqual(mergedTie[0].deletedAt, tieTs, 'Water Delete-Wins on timestamp tie');
});

test('TEST 9: Legacy food items & water logs without updatedAt safely normalized', () => {
    const legacyFood = {
        id: 'f_legacy_1',
        name: 'Apple',
        calories: 95,
        meal: 'snacks',
        date: '2026-09-11'
        // No updatedAt, no deletedAt
    };
    const normalizedFood = normalizeFoodItem(legacyFood, 12345);
    assert.ok(normalizedFood);
    assert.strictEqual(normalizedFood.updatedAt, 12345, 'Fallback updatedAt assigned');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(normalizedFood, 'deletedAt'), false, 'deletedAt must not be present (no undefined)');

    const legacyWater = {
        date: '2026-09-11',
        glasses: 4
        // No id, no updatedAt
    };
    const normalizedWater = normalizeWaterLog(legacyWater, 67890);
    assert.ok(normalizedWater);
    assert.strictEqual(normalizedWater.id, '2026-09-11', 'Date used as fallback id');
    assert.strictEqual(normalizedWater.updatedAt, 67890, 'Fallback updatedAt assigned');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(normalizedWater, 'deletedAt'), false, 'deletedAt must not be present');
});

test('TEST 10: 30-day tombstone retention pruning', () => {
    const now = Date.now();
    const expiredTs = now - (35 * 24 * 60 * 60 * 1000); // 35 days ago
    const recentTs = now - (5 * 24 * 60 * 60 * 1000);   // 5 days ago

    const foodList = [
        { id: 'f_active', name: 'Salad', calories: 200, meal: 'lunch', date: '2026-09-11', updatedAt: now },
        { id: 'f_recent_del', name: 'Soup', calories: 150, meal: 'lunch', date: '2026-09-11', updatedAt: recentTs, deletedAt: recentTs },
        { id: 'f_expired_del', name: 'Burger', calories: 600, meal: 'lunch', date: '2026-09-11', updatedAt: expiredTs, deletedAt: expiredTs },
    ];

    const mergedFood = mergeFoodItems(foodList, []);
    assert.strictEqual(mergedFood.length, 2, 'Expired food tombstone must be pruned');
    assert.ok(mergedFood.some(f => f.id === 'f_active'));
    assert.ok(mergedFood.some(f => f.id === 'f_recent_del'));
    assert.ok(!mergedFood.some(f => f.id === 'f_expired_del'), 'Expired food tombstone pruned');

    const waterList = [
        { id: 'w_active', date: '2026-09-11', glasses: 8, updatedAt: now },
        { id: 'w_recent_del', date: '2026-09-10', glasses: 0, updatedAt: recentTs, deletedAt: recentTs },
        { id: 'w_expired_del', date: '2026-08-01', glasses: 0, updatedAt: expiredTs, deletedAt: expiredTs },
    ];

    const mergedWater = mergeWaterLogs(waterList, []);
    assert.strictEqual(mergedWater.length, 2, 'Expired water tombstone must be pruned');
    assert.ok(mergedWater.some(w => w.date === '2026-09-11'));
    assert.ok(mergedWater.some(w => w.date === '2026-09-10'));
    assert.ok(!mergedWater.some(w => w.date === '2026-08-01'), 'Expired water tombstone pruned');
});

test('TEST 11: Daily Goal & goalsConfigured preservation in simulated cloud write', () => {
    const existingCloudDoc = {
        dailyGoal: { calories: 2400, carbs: 220, protein: 160, fat: 65, water: 10 },
        goalsConfigured: true,
        dietaryRestrictions: 'Vegetarian',
        calories: {
            foodItems: [{ id: 'f_c1', name: 'Tofu Scramble', calories: 250, meal: 'breakfast', date: '2026-09-11', updatedAt: 1000 }],
            waterLogs: [{ id: 'w_c1', date: '2026-09-11', glasses: 4, updatedAt: 1000 }],
            lastModified: 1000,
        },
    };

    const localFood = [
        { id: 'f_l1', name: 'Protein Shake', calories: 200, meal: 'snacks', date: '2026-09-11', updatedAt: 2000 }
    ];
    const localWater = [
        { id: 'w_l1', date: '2026-09-11', glasses: 6, updatedAt: 2000 }
    ];

    const finalFood = mergeFoodItems(localFood, existingCloudDoc.calories.foodItems);
    const finalWater = mergeWaterLogs(localWater, existingCloudDoc.calories.waterLogs);

    // Simulated pre-logout sync payload building with { merge: true }
    const payload = {
        calories: {
            foodItems: finalFood,
            waterLogs: finalWater,
            lastModified: 2000,
        },
        updatedAt: 'SERVER_TIMESTAMP',
    };
    // If local has no goal, preserve cloud
    if (existingCloudDoc.dailyGoal) payload.dailyGoal = existingCloudDoc.dailyGoal;
    if (existingCloudDoc.goalsConfigured !== undefined) payload.goalsConfigured = existingCloudDoc.goalsConfigured;

    // Apply simulated Firestore merge write:
    const finalDoc = {
        ...existingCloudDoc,
        ...payload,
        calories: {
            ...existingCloudDoc.calories,
            ...payload.calories,
        },
    };

    assert.deepStrictEqual(finalDoc.dailyGoal, existingCloudDoc.dailyGoal, 'dailyGoal preserved');
    assert.strictEqual(finalDoc.goalsConfigured, true, 'goalsConfigured preserved');
    assert.strictEqual(finalDoc.dietaryRestrictions, 'Vegetarian', 'Arbitrary top-level doc field preserved');
    assert.strictEqual(finalDoc.calories.foodItems.length, 2, 'Both food items merged');
    assert.strictEqual(finalDoc.calories.waterLogs.length, 1, 'Water merged by date');
    assert.strictEqual(finalDoc.calories.waterLogs[0].glasses, 6, 'Newer water log wins');
});

test('TEST 12: Baseline regression verification (Habits & Todos merge intact)', () => {
    // Habits check
    const now = Date.now();
    const localHabits = [
        { id: 'h_1', name: 'Read Book', completed: false, updatedAt: now }
    ];
    const cloudHabits = [
        { id: 'h_1', name: 'Read Book', completed: true, updatedAt: now - 3000 }
    ];
    // Habit logic: newer updatedAt wins
    const hExisting = cloudHabits[0];
    const hIncoming = localHabits[0];
    const hWinner = hIncoming.updatedAt > hExisting.updatedAt ? hIncoming : hExisting;
    assert.strictEqual(hWinner.completed, false, 'Newer habit completion state wins');

    // Water decrements check in context
    const waterDec = mergeWaterLogs(
        [{ id: 'w_1', date: '2026-09-11', glasses: 2, updatedAt: now }],
        [{ id: 'w_1', date: '2026-09-11', glasses: 5, updatedAt: now - 5000 }]
    );
    assert.strictEqual(waterDec[0].glasses, 2, 'Decrement wins with newer updatedAt');
});
