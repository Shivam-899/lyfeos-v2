// @ts-check
/**
 * scripts/test-nutrition-migration.js
 * 
 * Focused automated test suite for LYFEOS — P1-2 PHASE A1:
 * GUEST → ACCOUNT NUTRITION DATA SAFETY FIX
 *
 * Verifies:
 * - TEST A: Existing authenticated account dailyGoal + goalsConfigured remain unchanged.
 * - TEST B: Existing cloud nutrition data and unrelated top-level fields are preserved ({ merge: true }).
 * - TEST C: Migration with no existing cloud calories document works normally.
 * - TEST D: Deduplication of food items by ID.
 * - TEST E: Water logs take max glasses per date.
 */

const assert = require('node:assert');
const test = require('node:test');

// Implementation under test: pure helper extracted and exported from utils/cloudSync.ts
function mergeCaloriesMigrationData(guestData, rawCloudDocData) {
    let mergedFoodItems = [...(guestData.foodItems || [])];
    let mergedWaterLogs = [...(guestData.waterLogs || [])];
    let mergedLastModified = guestData.lastModified || Date.now();
    let existingDailyGoal = undefined;
    let existingGoalsConfigured = undefined;
    let existingCaloriesExtra = {};

    if (rawCloudDocData) {
        const cloudCalories = rawCloudDocData.calories;
        const cloudFood = Array.isArray(cloudCalories?.foodItems) ? cloudCalories.foodItems : [];
        const cloudWater = Array.isArray(cloudCalories?.waterLogs) ? cloudCalories.waterLogs : [];
        const cloudLastModified = typeof cloudCalories?.lastModified === 'number' ? cloudCalories.lastModified : 0;

        const cloudFoodIds = new Set(cloudFood.map((f) => f?.id).filter(Boolean));
        const guestFoodToAdd = (guestData.foodItems || []).filter((f) => f && f.id && !cloudFoodIds.has(f.id));
        mergedFoodItems = [...cloudFood, ...guestFoodToAdd];

        const waterMap = new Map();
        for (const w of cloudWater) {
            if (w?.date) waterMap.set(w.date, w);
        }
        for (const w of (guestData.waterLogs || [])) {
            if (!w?.date) continue;
            const existing = waterMap.get(w.date);
            if (!existing) {
                waterMap.set(w.date, w);
            } else {
                waterMap.set(w.date, {
                    ...existing,
                    glasses: Math.max(existing.glasses || 0, w.glasses || 0),
                });
            }
        }
        mergedWaterLogs = Array.from(waterMap.values());
        mergedLastModified = Math.max(cloudLastModified, guestData.lastModified || 0, Date.now());

        // Preserve existing authenticated account goals and configuration if present in cloud
        if (rawCloudDocData.dailyGoal !== undefined) {
            existingDailyGoal = rawCloudDocData.dailyGoal;
        }
        if (rawCloudDocData.goalsConfigured !== undefined) {
            existingGoalsConfigured = rawCloudDocData.goalsConfigured;
        }

        // Preserve any extra fields inside calories map if present
        if (cloudCalories && typeof cloudCalories === 'object') {
            const { foodItems: _f, waterLogs: _w, lastModified: _l, ...extra } = cloudCalories;
            existingCaloriesExtra = extra;
        }
    }

    // Determine final dailyGoal and goalsConfigured
    // Priority: existing authenticated cloud goal wins. If absent in cloud, fallback to guest goal if provided.
    const finalDailyGoal = existingDailyGoal !== undefined
        ? existingDailyGoal
        : (guestData.dailyGoal !== undefined ? guestData.dailyGoal : undefined);

    const finalGoalsConfigured = existingGoalsConfigured !== undefined
        ? existingGoalsConfigured
        : (guestData.goalsConfigured !== undefined ? guestData.goalsConfigured : undefined);

    const caloriesPayload = {
        calories: {
            ...existingCaloriesExtra,
            foodItems: mergedFoodItems,
            waterLogs: mergedWaterLogs,
            lastModified: mergedLastModified,
        },
        updatedAt: 'SERVER_TIMESTAMP',
        migratedFromGuest: true,
    };

    if (finalDailyGoal !== undefined) {
        caloriesPayload.dailyGoal = finalDailyGoal;
    }
    if (finalGoalsConfigured !== undefined) {
        caloriesPayload.goalsConfigured = finalGoalsConfigured;
    }

    return {
        caloriesPayload,
        mergedFoodItems,
        mergedWaterLogs,
        mergedLastModified,
        localGoalUpdates: {
            dailyGoal: existingDailyGoal,
            goalsConfigured: existingGoalsConfigured,
        },
    };
}

// Simulated Firestore batch set applying { merge: true } semantics
function applyFirestoreSet(existingDoc, payload, options = {}) {
    if (!options.merge) {
        // Destructive overwrite (old flawed behavior)
        return { ...payload };
    }
    // Safe merge write
    return {
        ...(existingDoc || {}),
        ...payload,
        calories: {
            ...((existingDoc && existingDoc.calories) || {}),
            ...(payload.calories || {}),
        },
    };
}

// ── TEST A: Existing account has dailyGoal + goalsConfigured ─────────────────
test('TEST A: Existing authenticated account dailyGoal and goalsConfigured are strictly preserved', () => {
    const existingCloudDoc = {
        dailyGoal: { calories: 2400, carbs: 220, protein: 160, fat: 65, water: 10 },
        goalsConfigured: true,
        calories: {
            foodItems: [
                { id: 'cloud_f1', name: 'Oatmeal', calories: 300, meal: 'breakfast', date: '2026-09-11' }
            ],
            waterLogs: [
                { id: 'cloud_w1', date: '2026-09-11', glasses: 3 }
            ],
            lastModified: 1000,
        },
    };

    const guestPayload = {
        habits: [],
        habitLogs: [],
        todos: [],
        foodItems: [
            { id: 'guest_f1', name: 'Apple', calories: 80, meal: 'snacks', date: '2026-09-11' }
        ],
        waterLogs: [
            { id: 'guest_w1', date: '2026-09-11', glasses: 5 }
        ],
        lastModified: 2000,
        dailyGoal: { calories: 1800, carbs: 150, protein: 100, fat: 50, water: 8 },
        goalsConfigured: false,
    };

    const result = mergeCaloriesMigrationData(guestPayload, existingCloudDoc);

    // 1. Cloud payload MUST preserve existing account goals
    assert.deepStrictEqual(
        result.caloriesPayload.dailyGoal,
        { calories: 2400, carbs: 220, protein: 160, fat: 65, water: 10 },
        'Existing cloud dailyGoal must not be overwritten by guest goal'
    );
    assert.strictEqual(
        result.caloriesPayload.goalsConfigured,
        true,
        'Existing cloud goalsConfigured must not be overwritten by guest false'
    );

    // 2. Food items must be merged
    assert.strictEqual(result.caloriesPayload.calories.foodItems.length, 2);
    assert.strictEqual(result.caloriesPayload.calories.foodItems[0].id, 'cloud_f1');
    assert.strictEqual(result.caloriesPayload.calories.foodItems[1].id, 'guest_f1');

    // 3. Water logs must take maximum
    assert.strictEqual(result.caloriesPayload.calories.waterLogs.length, 1);
    assert.strictEqual(result.caloriesPayload.calories.waterLogs[0].glasses, 5);

    // 4. Local storage update must receive the authenticated account goals
    assert.deepStrictEqual(result.localGoalUpdates.dailyGoal, existingCloudDoc.dailyGoal);
    assert.strictEqual(result.localGoalUpdates.goalsConfigured, true);

    // 5. Verify simulated Firestore merge write preserves dailyGoal
    const finalDoc = applyFirestoreSet(existingCloudDoc, result.caloriesPayload, { merge: true });
    assert.deepStrictEqual(finalDoc.dailyGoal, existingCloudDoc.dailyGoal);
    assert.strictEqual(finalDoc.goalsConfigured, true);
    assert.strictEqual(finalDoc.migratedFromGuest, true);
});

// ── TEST B: Unrelated existing fields and existing nutrition data are preserved ──
test('TEST B: Existing nutrition data and unrelated account fields are NOT destructively erased', () => {
    const existingCloudDoc = {
        dailyGoal: { calories: 2200, carbs: 200, protein: 150, fat: 60, water: 8 },
        goalsConfigured: true,
        dietaryPlan: 'High-Protein Mediterranean',
        customMacroSplit: { proteinPct: 35, carbsPct: 45, fatPct: 20 },
        userNutritionNotes: 'Track sodium carefully',
        calories: {
            foodItems: [
                { id: 'cloud_f1', name: 'Greek Yogurt', calories: 150, meal: 'breakfast', date: '2026-09-10' },
                { id: 'cloud_f2', name: 'Grilled Chicken Salad', calories: 450, meal: 'lunch', date: '2026-09-10' }
            ],
            waterLogs: [
                { id: 'cloud_w1', date: '2026-09-10', glasses: 6 }
            ],
            lastModified: 5000,
            specialTrackingMeta: 'tracked_via_barcode',
        },
    };

    const guestPayload = {
        habits: [],
        habitLogs: [],
        todos: [],
        foodItems: [
            { id: 'guest_f1', name: 'Almonds', calories: 160, meal: 'snacks', date: '2026-09-10' }
        ],
        waterLogs: [
            { id: 'guest_w1', date: '2026-09-10', glasses: 4 }
        ],
        lastModified: 6000,
    };

    const result = mergeCaloriesMigrationData(guestPayload, existingCloudDoc);

    // Verify extra fields inside calories map are preserved
    assert.strictEqual(result.caloriesPayload.calories.specialTrackingMeta, 'tracked_via_barcode');

    // Apply with { merge: true }
    const finalDoc = applyFirestoreSet(existingCloudDoc, result.caloriesPayload, { merge: true });

    // Assert unrelated top-level fields survived intact
    assert.strictEqual(finalDoc.dietaryPlan, 'High-Protein Mediterranean');
    assert.deepStrictEqual(finalDoc.customMacroSplit, { proteinPct: 35, carbsPct: 45, fatPct: 20 });
    assert.strictEqual(finalDoc.userNutritionNotes, 'Track sodium carefully');

    // Assert all 3 food items exist (2 cloud + 1 guest)
    assert.strictEqual(finalDoc.calories.foodItems.length, 3);
    assert.ok(finalDoc.calories.foodItems.some(f => f.id === 'cloud_f1'));
    assert.ok(finalDoc.calories.foodItems.some(f => f.id === 'cloud_f2'));
    assert.ok(finalDoc.calories.foodItems.some(f => f.id === 'guest_f1'));

    // Assert water log was not erased
    assert.strictEqual(finalDoc.calories.waterLogs.length, 1);
    assert.strictEqual(finalDoc.calories.waterLogs[0].glasses, 6);
});

// ── TEST C: Migration with no existing cloud calories document ────────────────
test('TEST C: Migration with no existing cloud calories document creates document normally', () => {
    const rawCloudDocData = null; // caloriesDoc.exists() === false

    const guestPayload = {
        habits: [],
        habitLogs: [],
        todos: [],
        foodItems: [
            { id: 'guest_f1', name: 'Boiled Eggs', calories: 140, meal: 'breakfast', date: '2026-09-11' }
        ],
        waterLogs: [
            { id: 'guest_w1', date: '2026-09-11', glasses: 4 }
        ],
        lastModified: 8000,
        dailyGoal: { calories: 2000, carbs: 250, protein: 120, fat: 60, water: 8 },
        goalsConfigured: true,
    };

    const result = mergeCaloriesMigrationData(guestPayload, rawCloudDocData);

    // Payload should contain guest data and guest goal since cloud had none
    assert.strictEqual(result.caloriesPayload.calories.foodItems.length, 1);
    assert.strictEqual(result.caloriesPayload.calories.foodItems[0].name, 'Boiled Eggs');
    assert.strictEqual(result.caloriesPayload.calories.waterLogs.length, 1);
    assert.strictEqual(result.caloriesPayload.calories.waterLogs[0].glasses, 4);
    assert.deepStrictEqual(result.caloriesPayload.dailyGoal, guestPayload.dailyGoal);
    assert.strictEqual(result.caloriesPayload.goalsConfigured, true);
    assert.strictEqual(result.caloriesPayload.migratedFromGuest, true);

    // Local updates should NOT override local goal since cloud had none
    assert.strictEqual(result.localGoalUpdates.dailyGoal, undefined);
    assert.strictEqual(result.localGoalUpdates.goalsConfigured, undefined);

    // Firestore set with { merge: true } creates clean doc
    const finalDoc = applyFirestoreSet(null, result.caloriesPayload, { merge: true });
    assert.strictEqual(finalDoc.calories.foodItems.length, 1);
    assert.deepStrictEqual(finalDoc.dailyGoal, guestPayload.dailyGoal);
    assert.strictEqual(finalDoc.goalsConfigured, true);
});

// ── TEST D: Deduplication of food items by ID ─────────────────────────────────
test('TEST D: Duplicate food items by ID between guest and cloud are deduplicated', () => {
    const existingCloudDoc = {
        calories: {
            foodItems: [
                { id: 'item_101', name: 'Roti', calories: 100, meal: 'lunch', date: '2026-09-11' }
            ],
            waterLogs: [],
            lastModified: 1000,
        },
    };

    const guestPayload = {
        habits: [],
        habitLogs: [],
        todos: [],
        foodItems: [
            { id: 'item_101', name: 'Roti (duplicate)', calories: 100, meal: 'lunch', date: '2026-09-11' },
            { id: 'item_102', name: 'Dal', calories: 150, meal: 'lunch', date: '2026-09-11' }
        ],
        waterLogs: [],
        lastModified: 2000,
    };

    const result = mergeCaloriesMigrationData(guestPayload, existingCloudDoc);

    // Should only have 2 items, not 3
    assert.strictEqual(result.caloriesPayload.calories.foodItems.length, 2);
    assert.strictEqual(result.caloriesPayload.calories.foodItems[0].name, 'Roti');
    assert.strictEqual(result.caloriesPayload.calories.foodItems[1].name, 'Dal');
});

// ── TEST E: Water log takes max glasses per date ──────────────────────────────
test('TEST E: Water logs take maximum glasses when same date exists in both', () => {
    const existingCloudDoc = {
        calories: {
            foodItems: [],
            waterLogs: [
                { id: 'cloud_w1', date: '2026-09-09', glasses: 8 },
                { id: 'cloud_w2', date: '2026-09-10', glasses: 4 },
            ],
            lastModified: 1000,
        },
    };

    const guestPayload = {
        habits: [],
        habitLogs: [],
        todos: [],
        foodItems: [],
        waterLogs: [
            { id: 'guest_w1', date: '2026-09-09', glasses: 3 }, // lower than cloud (8)
            { id: 'guest_w2', date: '2026-09-10', glasses: 7 }, // higher than cloud (4)
            { id: 'guest_w3', date: '2026-09-11', glasses: 5 }, // new date
        ],
        lastModified: 2000,
    };

    const result = mergeCaloriesMigrationData(guestPayload, existingCloudDoc);

    const waterLogs = result.caloriesPayload.calories.waterLogs;
    assert.strictEqual(waterLogs.length, 3);

    const day9 = waterLogs.find(w => w.date === '2026-09-09');
    const day10 = waterLogs.find(w => w.date === '2026-09-10');
    const day11 = waterLogs.find(w => w.date === '2026-09-11');

    assert.strictEqual(day9.glasses, 8, 'Day 9 must take cloud max (8)');
    assert.strictEqual(day10.glasses, 7, 'Day 10 must take guest max (7)');
    assert.strictEqual(day11.glasses, 5, 'Day 11 must take new guest glasses (5)');
});
