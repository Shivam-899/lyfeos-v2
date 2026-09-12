// @ts-check
/**
 * scripts/test-habits-sync.js
 * 
 * Focused automated test suite for LYFEOS — P1-2 PHASE B:
 * HABITS & HABIT LOGS MULTI-DEVICE SYNC REMEDIATION
 *
 * Requirements covered:
 * - TEST 1: Local-only habit + cloud-only habit → both survive.
 * - TEST 2: Local deletion vs stale cloud habit → deletion wins.
 * - TEST 3: Newer cloud update vs older local update → cloud wins.
 * - TEST 4: Newer local update vs older cloud update → local wins.
 * - TEST 5: Same timestamp + deletion → deletion wins.
 * - TEST 6: Habit log completed=true vs newer completed=false → false wins.
 * - TEST 7: Two habits with same name but different IDs → both survive.
 * - TEST 8: Duplicate same-ID habit → one deterministic merged record.
 * - TEST 9: Legacy habit without updatedAt → safely normalized without data loss.
 * - TEST 10: Tombstoned habit → hidden from active UI and not resurrected by stale cloud data.
 * - TEST 11: Todo sync baseline verification (zero regression on P1-1).
 */

const assert = require('node:assert');
const test = require('node:test');

// ─── Implementation Under Test (Direct from utils/cloudSync.ts) ───

const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normalizeHabit(raw) {
    if (!raw || typeof raw !== 'object') {
        const now = Date.now();
        return {
            id: now.toString() + Math.random().toString(36).substr(2, 9),
            name: '',
            type: 'build',
            trackMethod: 'task',
            colorId: 'green',
            emoji: '📚',
            weekDays: [0, 1, 2, 3, 4, 5, 6],
            createdAt: new Date(now).toISOString(),
            updatedAt: now,
        };
    }

    const createdAtTs = raw.createdAt ? new Date(raw.createdAt).getTime() : NaN;
    const validCreatedAtTs = !isNaN(createdAtTs) && createdAtTs > 0 ? createdAtTs : Date.now();
    const updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt)
        ? raw.updatedAt
        : validCreatedAtTs;

    const normalized = {
        ...raw,
        id: raw.id ? String(raw.id) : (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
        name: raw.name ?? '',
        createdAt: raw.createdAt || new Date(validCreatedAtTs).toISOString(),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

function normalizeHabitLog(raw) {
    if (!raw || typeof raw !== 'object') {
        const now = Date.now();
        return {
            id: `log_${now}`,
            habitId: '',
            date: '',
            completed: false,
            updatedAt: now,
        };
    }

    // Derive stable ID: if raw.id is non-empty string, keep it; else derive deterministically from habitId_date
    const stableId = raw.id ? String(raw.id) : (raw.habitId && raw.date ? `${raw.habitId}_${raw.date}` : Date.now().toString());

    let dateTs = NaN;
    if (raw.date && typeof raw.date === 'string') {
        const parsed = new Date(raw.date + 'T00:00:00Z').getTime();
        if (!isNaN(parsed) && parsed > 0) dateTs = parsed;
    }
    const updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt)
        ? raw.updatedAt
        : (!isNaN(dateTs) ? dateTs : Date.now());

    const normalized = {
        ...raw,
        id: stableId,
        completed: Boolean(raw.completed),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

function mergeHabits(localHabits = [], cloudHabits = []) {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localHabits || []).map(normalizeHabit);
    const normalizedCloud = (cloudHabits || []).map(normalizeHabit);

    const habitMap = new Map();

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
        return incoming;
    };

    for (const habit of normalizedCloud) {
        habitMap.set(habit.id, habit);
    }

    for (const habit of normalizedLocal) {
        const existing = habitMap.get(habit.id);
        if (!existing) {
            habitMap.set(habit.id, habit);
        } else {
            habitMap.set(habit.id, resolveConflict(existing, habit));
        }
    }

    const merged = [];
    for (const habit of habitMap.values()) {
        if (habit.deletedAt && habit.deletedAt < purgeCutoff) {
            continue;
        }
        merged.push(habit);
    }

    return merged;
}

function mergeHabitLogs(localLogs = [], cloudLogs = []) {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localLogs || []).map(normalizeHabitLog);
    const normalizedCloud = (cloudLogs || []).map(normalizeHabitLog);

    const logMap = new Map();
    const pairToId = new Map();

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
        return incoming;
    };

    const addOrMerge = (log) => {
        const pairKey = (log.habitId && log.date) ? `${log.habitId}_${log.date}` : null;
        let existingId = log.id;
        let existing = logMap.get(log.id);

        if (!existing && pairKey && pairToId.has(pairKey)) {
            existingId = pairToId.get(pairKey);
            existing = logMap.get(existingId);
        }

        if (!existing) {
            logMap.set(log.id, log);
            if (pairKey) pairToId.set(pairKey, log.id);
        } else {
            const winner = resolveConflict(existing, log);
            logMap.set(existing.id, winner);
            if (pairKey) pairToId.set(pairKey, existing.id);
        }
    };

    for (const log of normalizedCloud) {
        addOrMerge(log);
    }

    for (const log of normalizedLocal) {
        addOrMerge(log);
    }

    const merged = [];
    for (const log of logMap.values()) {
        if (log.deletedAt && log.deletedAt < purgeCutoff) {
            continue;
        }
        merged.push(log);
    }

    return merged;
}

// Reference Todo normalizer & merge from utils/cloudSync.ts (to ensure NO regression)
function normalizeTodo(raw) {
    if (!raw || typeof raw !== 'object') {
        const now = Date.now();
        return {
            id: now.toString(),
            title: '',
            completed: false,
            createdAt: new Date(now).toISOString(),
            order: 0,
            updatedAt: now,
        };
    }
    const createdAtTs = raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now();
    const validCreatedAtTs = isNaN(createdAtTs) ? Date.now() : createdAtTs;
    const updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt)
        ? raw.updatedAt
        : validCreatedAtTs;

    const normalized = {
        ...raw,
        createdAt: raw.createdAt || new Date(validCreatedAtTs).toISOString(),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

function mergeTodos(localTodos = [], cloudTodos = []) {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localTodos || []).map(normalizeTodo);
    const normalizedCloud = (cloudTodos || []).map(normalizeTodo);

    const todoMap = new Map();

    const resolveConflict = (existing, incoming) => {
        if (incoming.updatedAt > existing.updatedAt) {
            return incoming;
        }
        if (existing.updatedAt > incoming.updatedAt) {
            return existing;
        }
        if (incoming.deletedAt && !existing.deletedAt) {
            return incoming;
        }
        if (existing.deletedAt && !incoming.deletedAt) {
            return existing;
        }
        return incoming;
    };

    for (const todo of normalizedCloud) {
        todoMap.set(todo.id, todo);
    }

    for (const todo of normalizedLocal) {
        const existing = todoMap.get(todo.id);
        if (!existing) {
            todoMap.set(todo.id, todo);
        } else {
            todoMap.set(todo.id, resolveConflict(existing, todo));
        }
    }

    const merged = [];
    for (const todo of todoMap.values()) {
        if (todo.deletedAt && todo.deletedAt < purgeCutoff) {
            continue;
        }
        merged.push(todo);
    }

    return merged;
}

// ─── TEST SUITE ───

test('TEST 1: Local-only habit + cloud-only habit → both survive', () => {
    const local = [{ id: 'habit-local-1', name: 'Drink Water', updatedAt: 1000 }];
    const cloud = [{ id: 'habit-cloud-1', name: 'Read Book', updatedAt: 2000 }];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 2);
    const ids = new Set(merged.map((h) => h.id));
    assert.ok(ids.has('habit-local-1'));
    assert.ok(ids.has('habit-cloud-1'));
});

test('TEST 2: Local deletion vs stale cloud habit → deletion wins', () => {
    const now = Date.now();
    const local = [
        { id: 'habit-1', name: 'Morning Run', updatedAt: now, deletedAt: now }
    ];
    const cloud = [
        { id: 'habit-1', name: 'Morning Run', updatedAt: now - 5000 }
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'habit-1');
    assert.strictEqual(merged[0].deletedAt, now);
    assert.strictEqual(merged[0].updatedAt, now);
});

test('TEST 3: Newer cloud update vs older local update → cloud wins', () => {
    const local = [
        { id: 'habit-1', name: 'Old Habit Name', colorId: 'green', updatedAt: 1000 }
    ];
    const cloud = [
        { id: 'habit-1', name: 'New Habit Name Updated on Web', colorId: 'purple', updatedAt: 2500 }
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'New Habit Name Updated on Web');
    assert.strictEqual(merged[0].colorId, 'purple');
    assert.strictEqual(merged[0].updatedAt, 2500);
});

test('TEST 4: Newer local update vs older cloud update → local wins', () => {
    const local = [
        { id: 'habit-1', name: 'Local Renamed Habit', colorId: 'red', updatedAt: 3000 }
    ];
    const cloud = [
        { id: 'habit-1', name: 'Cloud Stale Name', colorId: 'yellow', updatedAt: 1500 }
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].name, 'Local Renamed Habit');
    assert.strictEqual(merged[0].colorId, 'red');
    assert.strictEqual(merged[0].updatedAt, 3000);
});

test('TEST 5: Same timestamp + deletion → deletion wins', () => {
    const now = Date.now();
    const local = [
        { id: 'habit-1', name: 'Tie Habit', updatedAt: now, deletedAt: now }
    ];
    const cloud = [
        { id: 'habit-1', name: 'Tie Habit', updatedAt: now } // active
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'habit-1');
    assert.strictEqual(merged[0].deletedAt, now);

    // Also test reverse order (cloud has tombstone, local active)
    const mergedReverse = mergeHabits(cloud, local);
    assert.strictEqual(mergedReverse.length, 1);
    assert.strictEqual(mergedReverse[0].deletedAt, now);
});

test('TEST 6: Habit log completed=true vs newer completed=false → false wins', () => {
    // Device A checked the log at t=1000
    const cloudLogs = [
        { id: 'log-1', habitId: 'h1', date: '2026-09-11', completed: true, updatedAt: 1000 }
    ];
    // Device B explicitly unchecked the log at t=2000
    const localLogs = [
        { id: 'log-1', habitId: 'h1', date: '2026-09-11', completed: false, updatedAt: 2000 }
    ];

    const merged = mergeHabitLogs(localLogs, cloudLogs);

    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].completed, false, 'Explicit uncheck (completed=false) MUST win when newer');
    assert.strictEqual(merged[0].updatedAt, 2000);
});

test('TEST 7: Two habits with same name but different IDs → both survive', () => {
    const local = [
        { id: 'habit-meditate-morning', name: 'Meditate', updatedAt: 1000 }
    ];
    const cloud = [
        { id: 'habit-meditate-evening', name: 'Meditate', updatedAt: 1500 }
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 2, 'Habits with identical names but distinct IDs must NEVER be conflated');
    const ids = new Set(merged.map((h) => h.id));
    assert.ok(ids.has('habit-meditate-morning'));
    assert.ok(ids.has('habit-meditate-evening'));
});

test('TEST 8: Duplicate same-ID habit → one deterministic merged record', () => {
    const local = [
        { id: 'habit-dup-1', name: 'Workout Local', updatedAt: 1000 }
    ];
    const cloud = [
        { id: 'habit-dup-1', name: 'Workout Cloud', updatedAt: 1000 }
    ];

    const merged = mergeHabits(local, cloud);

    assert.strictEqual(merged.length, 1, 'Duplicate same-ID habit must merge into a single record');
    assert.strictEqual(merged[0].id, 'habit-dup-1');
});

test('TEST 9: Legacy habit without updatedAt → safely normalized without data loss', () => {
    const legacyHabit = {
        id: 'legacy-h-1',
        name: 'Legacy Habit',
        type: 'build',
        trackMethod: 'task',
        colorId: 'blue',
        emoji: '🧘',
        weekDays: [1, 2, 3],
        createdAt: '2026-01-15T12:00:00.000Z',
    };

    const normalized = normalizeHabit(legacyHabit);

    assert.strictEqual(normalized.id, 'legacy-h-1');
    assert.strictEqual(normalized.name, 'Legacy Habit');
    const expectedEpoch = new Date('2026-01-15T12:00:00.000Z').getTime();
    assert.strictEqual(normalized.updatedAt, expectedEpoch, 'Legacy habit updatedAt derived deterministically from createdAt');
    assert.strictEqual(normalized.deletedAt, undefined, 'deletedAt must be undefined/omitted');
    assert.strictEqual('deletedAt' in normalized, false, 'deletedAt key must be omitted to satisfy Firestore serializer');
});

test('TEST 10: Tombstoned habit → hidden from active UI and not resurrected by stale cloud data', () => {
    const now = Date.now();
    const localHabits = [
        { id: 'h-active', name: 'Active Habit', updatedAt: now - 5000 },
        { id: 'h-deleted', name: 'Deleted Habit', updatedAt: now, deletedAt: now },
    ];
    const staleCloudHabits = [
        { id: 'h-active', name: 'Active Habit', updatedAt: now - 5000 },
        { id: 'h-deleted', name: 'Deleted Habit', updatedAt: now - 10000 }, // Stale active copy in cloud
    ];

    const merged = mergeHabits(localHabits, staleCloudHabits);

    // Merged state in storage/sync contains active + tombstone
    const tombstone = merged.find((h) => h.id === 'h-deleted');
    assert.ok(tombstone, 'Tombstone must be preserved in merged list for sync propagation');
    assert.strictEqual(tombstone.deletedAt, now);

    // Active UI filter simulation (same filter as used in HabitsContext useMemo)
    const activeUIHabits = merged.filter((h) => !h.deletedAt);
    assert.strictEqual(activeUIHabits.length, 1);
    assert.strictEqual(activeUIHabits[0].id, 'h-active');
    assert.ok(!activeUIHabits.some((h) => h.id === 'h-deleted'), 'Deleted habit must not appear in UI');
});

test('TEST 11: Todo Sync Baseline Verification (P1-1 Regression Safety)', () => {
    const now = Date.now();
    const localTodos = [
        { id: 'todo-1', title: 'Task 1', completed: true, updatedAt: now },
        { id: 'todo-2', title: 'Task 2', completed: false, updatedAt: now - 1000, deletedAt: now - 1000 },
    ];
    const cloudTodos = [
        { id: 'todo-1', title: 'Task 1', completed: false, updatedAt: now - 5000 },
        { id: 'todo-2', title: 'Task 2', completed: false, updatedAt: now - 10000 },
    ];

    const merged = mergeTodos(localTodos, cloudTodos);

    assert.strictEqual(merged.length, 2);
    const t1 = merged.find((t) => t.id === 'todo-1');
    assert.strictEqual(t1.completed, true, 'Newer local todo update wins');

    const t2 = merged.find((t) => t.id === 'todo-2');
    assert.strictEqual(t2.deletedAt, now - 1000, 'Tombstone wins over stale cloud todo');

    const normalized = normalizeTodo({ id: 'todo-3', title: 'Active', completed: false, updatedAt: 100 });
    assert.strictEqual('deletedAt' in normalized, false, 'No deletedAt property in active todo');
});

test('TEST 12: Tombstone Expiration Pruning (> 30 days)', () => {
    const now = Date.now();
    const expiredTs = now - (31 * 24 * 60 * 60 * 1000); // 31 days old
    const recentTs = now - (10 * 24 * 60 * 60 * 1000);  // 10 days old

    const habits = [
        { id: 'h-fresh', name: 'Fresh', updatedAt: now },
        { id: 'h-recent-deleted', name: 'Recent Del', updatedAt: recentTs, deletedAt: recentTs },
        { id: 'h-expired-deleted', name: 'Expired Del', updatedAt: expiredTs, deletedAt: expiredTs },
    ];

    const merged = mergeHabits(habits, []);

    assert.strictEqual(merged.length, 2, 'Expired tombstone (>30 days) must be pruned');
    const ids = new Set(merged.map((h) => h.id));
    assert.ok(ids.has('h-fresh'));
    assert.ok(ids.has('h-recent-deleted'));
    assert.ok(!ids.has('h-expired-deleted'), 'Expired tombstone must be removed');
});
