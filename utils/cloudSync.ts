import firestore from '@react-native-firebase/firestore';
import { logError } from './analytics';
import { getStoredJson, getStoredString, setStoredJson, setStoredString } from './storage';

const getUserDoc = (uid: string) =>
    firestore().collection('users').doc(uid);

// ─── HABITS ───
export const syncHabitsToCloud = async (uid: string, habits: any[], habitLogs?: any[]) => {
    try {
        const payload: any = { habits, updatedAt: firestore.FieldValue.serverTimestamp() };
        if (habitLogs !== undefined) {
            payload.habitLogs = habitLogs;
        }
        await getUserDoc(uid).collection('data').doc('habits').set(payload, { merge: true });
    } catch (e) { logError(e as Error, 'syncHabitsToCloud'); }
};

export const fetchHabitsFromCloud = async (uid: string): Promise<any[] | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('habits').get();
        return doc.exists() ? (doc.data()?.habits ?? []) : [];
    } catch (e) { logError(e as Error, 'fetchHabitsFromCloud'); return null; }
};

export const fetchHabitLogsFromCloud = async (uid: string): Promise<any[] | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('habits').get();
        return doc.exists() ? (doc.data()?.habitLogs ?? []) : [];
    } catch (e) { logError(e as Error, 'fetchHabitLogsFromCloud'); return null; }
};

// ─── TODOS ───
export const syncTodosToCloud = async (uid: string, todos: any[]) => {
    try {
        await getUserDoc(uid).collection('data').doc('todos').set({ todos, updatedAt: firestore.FieldValue.serverTimestamp() });
    } catch (e) { logError(e as Error, 'syncTodosToCloud'); }
};

export const fetchTodosFromCloud = async (uid: string): Promise<any[] | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('todos').get();
        return doc.exists() ? (doc.data()?.todos ?? []) : null;
    } catch (e) { logError(e as Error, 'fetchTodosFromCloud'); return null; }
};

// ─── CALORIES ───
export const syncCaloriesToCloud = async (
    uid: string,
    calories: any,
    dailyGoal?: any,
    goalsConfigured?: boolean
) => {
    try {
        const payload: any = { calories, updatedAt: firestore.FieldValue.serverTimestamp() };
        if (dailyGoal !== undefined) payload.dailyGoal = dailyGoal;
        if (goalsConfigured !== undefined) payload.goalsConfigured = goalsConfigured;
        await getUserDoc(uid).collection('data').doc('calories').set(payload, { merge: true });
    } catch (e) { logError(e as Error, 'syncCaloriesToCloud'); }
};

export const fetchCaloriesFromCloud = async (uid: string): Promise<any | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('calories').get();
        if (!doc.exists()) return null;
        const data = doc.data();
        return {
            ...(data?.calories ?? {}),
            dailyGoal: data?.dailyGoal ?? null,
            goalsConfigured: data?.goalsConfigured ?? null,
        };
    } catch (e) { logError(e as Error, 'fetchCaloriesFromCloud'); return null; }
};

// ─── PROFILE ───
export const syncProfileToCloud = async (uid: string, profile: any) => {
    try {
        await getUserDoc(uid).collection('data').doc('profile').set({
            ...profile,
            updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (e) { logError(e as Error, 'syncProfileToCloud'); }
};

export const fetchProfileFromCloud = async (uid: string): Promise<any | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('profile').get();
        return doc.exists() ? doc.data() ?? null : null;
    } catch (e) { logError(e as Error, 'fetchProfileFromCloud'); return null; }
};

// ─── ACTIVITY ───
export const syncActivityToCloud = async (uid: string, activity: any) => {
    try {
        await getUserDoc(uid).collection('data').doc('activity').set({
            ...activity,
            updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch (e) { logError(e as Error, 'syncActivityToCloud'); }
};

export const fetchActivityFromCloud = async (uid: string): Promise<any | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('activity').get();
        return doc.exists() ? doc.data() ?? null : null;
    } catch (e) { logError(e as Error, 'fetchActivityFromCloud'); return null; }
};

// ─── PRE-LOGOUT MANDATORY CLOUD SYNC ───
/**
 * Reads all user-specific data from AsyncStorage and synchronously batches it to Firestore.
 * Crucial: Throws immediately on failure (e.g. offline, timeout, network error)
 * so that caller does NOT clear local data or complete logout.
 */
export const syncAllUserDataBeforeLogout = async (uid: string): Promise<void> => {
    if (!uid) {
        throw new Error('Valid UID required for sync before logout');
    }

    const [
        habits,
        habitLogs,
        todos,
        foodItems,
        waterLogs,
        foodMeta,
        dailyGoal,
        goalsConfiguredStr,
        profileName,
        joinDate,
        habitGoalStr,
        actGoalStr,
        healthProfile,
        reminders,
        prefs,
        profileMeta,
        activityLogs,
        stepsLogs,
        coachInsight,
    ] = await Promise.all([
        getStoredJson<any[]>('@lyfeos_habits_v2', []),
        getStoredJson<any[]>('@lyfeos_habit_logs_v2', []),
        getStoredJson<any[]>('@lyfeos_todos_v2', []),
        getStoredJson<any[]>('@lyfeos_food_v2', []),
        getStoredJson<any[]>('@lyfeos_water_v2', []),
        getStoredJson<{ lastModified?: number }>('@lyfeos_food_meta_v1', { lastModified: 0 }),
        getStoredJson<any>('@lyfeos_goal_v2', null),
        getStoredString('@lyfeos_goals_configured_v1'),
        getStoredString('@lyfeos_profile_name_v1'),
        getStoredString('@lyfeos_profile_join_v1'),
        getStoredString('@lyfeos_profile_habitgoal_v1'),
        getStoredString('@lyfeos_profile_actgoal_v1'),
        getStoredJson<any>('@lyfeos_profile_health_v1', null),
        getStoredJson<any>('@lyfeos_profile_reminders_v1', null),
        getStoredJson<any>('@lyfeos_profile_prefs_v1', null),
        getStoredJson<any>('@lyfeos_profile_meta_v1', {}),
        getStoredJson<any[]>('@lyfeos_activity_logs_v1', []),
        getStoredJson<any[]>('@lyfeos_steps_v1', []),
        getStoredJson<any>('@lyfeos_coach_insight_v1', null),
    ]);

    const batch = firestore().batch();
    const userDocRef = getUserDoc(uid);
    const dataColRef = userDocRef.collection('data');

    // 1. Habits & Logs (Conflict-aware bidirectional merge before logout batch commit)
    const [cloudHabits, cloudHabitLogs] = await Promise.all([
        fetchHabitsFromCloud(uid),
        fetchHabitLogsFromCloud(uid),
    ]);
    const finalHabits = mergeHabits(habits, cloudHabits || []);
    const finalHabitLogs = mergeHabitLogs(habitLogs, cloudHabitLogs || []);
    await Promise.all([
        setStoredJson('@lyfeos_habits_v2', finalHabits),
        setStoredJson('@lyfeos_habit_logs_v2', finalHabitLogs),
    ]);
    batch.set(dataColRef.doc('habits'), {
        habits: finalHabits,
        habitLogs: finalHabitLogs,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Todos (Conflict-aware merge with cloud before pre-logout batch commit)
    // If the document does not exist yet, doc.exists() returns [] (valid). If fetch fails due to network/auth error, it returns null.
    // In that case, we must abort logout rather than overwriting cloud data with stale local state.
    const cloudTodos = await fetchTodosFromCloud(uid);
    if (cloudTodos === null) {
        throw new Error("Pre-logout sync failed: unable to fetch cloud todos for conflict resolution.");
    }
    const finalTodos = mergeTodos(todos, cloudTodos);
    await setStoredJson('@lyfeos_todos_v2', finalTodos);
    batch.set(dataColRef.doc('todos'), {
        todos: finalTodos,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 3. Calories, Water, Goals (Conflict-aware bidirectional merge before pre-logout batch commit)
    const cloudCalories = await fetchCaloriesFromCloud(uid);
    const cloudFoodItems: any[] = Array.isArray(cloudCalories?.foodItems) ? cloudCalories.foodItems : [];
    const cloudWaterLogs: any[] = Array.isArray(cloudCalories?.waterLogs) ? cloudCalories.waterLogs : [];

    const finalFoodItems = mergeFoodItems(foodItems, cloudFoodItems);
    const finalWaterLogs = mergeWaterLogs(waterLogs, cloudWaterLogs);

    const mergedLastModified = Math.max(
        foodMeta.lastModified || 0,
        typeof cloudCalories?.lastModified === 'number' ? cloudCalories.lastModified : 0,
        ...finalFoodItems.map((f: any) => f.updatedAt || 0),
        ...finalWaterLogs.map((w: any) => w.updatedAt || 0),
        Date.now()
    );

    await Promise.all([
        setStoredJson('@lyfeos_food_v2', finalFoodItems),
        setStoredJson('@lyfeos_water_v2', finalWaterLogs),
        setStoredJson('@lyfeos_food_meta_v1', { lastModified: mergedLastModified }),
    ]);

    const caloriesPayload: any = {
        foodItems: finalFoodItems,
        waterLogs: finalWaterLogs,
        lastModified: mergedLastModified,
    };
    const caloriesDocPayload: any = {
        calories: caloriesPayload,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (dailyGoal) caloriesDocPayload.dailyGoal = dailyGoal;
    else if (cloudCalories?.dailyGoal) caloriesDocPayload.dailyGoal = cloudCalories.dailyGoal;

    if (goalsConfiguredStr !== null) caloriesDocPayload.goalsConfigured = goalsConfiguredStr === 'true';
    else if (cloudCalories?.goalsConfigured !== null && cloudCalories?.goalsConfigured !== undefined) {
        caloriesDocPayload.goalsConfigured = cloudCalories.goalsConfigured;
    }
    batch.set(dataColRef.doc('calories'), caloriesDocPayload, { merge: true });

    // 4. Profile & Health (Conflict-aware bidirectional merge before pre-logout batch commit)
    const cloudProfile = await fetchProfileFromCloud(uid);
    const localProfileData: ProfileSyncData = {
        userName: profileName || undefined,
        joinDate: joinDate || undefined,
        habitGoal: habitGoalStr ? parseInt(habitGoalStr, 10) || 5 : undefined,
        activityGoal: actGoalStr ? parseInt(actGoalStr, 10) || 30 : undefined,
        healthProfile: healthProfile || undefined,
        reminders: reminders || undefined,
        preferences: prefs || undefined,
        sectionTimestamps: profileMeta?.sectionTimestamps || {},
    };
    const mergedProfile = mergeProfileData(localProfileData, cloudProfile);

    await Promise.all([
        setStoredString('@lyfeos_profile_name_v1', mergedProfile.userName),
        setStoredString('@lyfeos_profile_join_v1', mergedProfile.joinDate),
        setStoredString('@lyfeos_profile_habitgoal_v1', String(mergedProfile.habitGoal)),
        setStoredString('@lyfeos_profile_actgoal_v1', String(mergedProfile.activityGoal)),
        setStoredJson('@lyfeos_profile_health_v1', mergedProfile.healthProfile),
        setStoredJson('@lyfeos_profile_reminders_v1', mergedProfile.reminders),
        setStoredJson('@lyfeos_profile_prefs_v1', mergedProfile.preferences),
        setStoredJson('@lyfeos_profile_meta_v1', { sectionTimestamps: mergedProfile.sectionTimestamps }),
    ]);

    const profileDocPayload: any = {
        ...mergedProfile,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(dataColRef.doc('profile'), profileDocPayload, { merge: true });

    // 5. Activity & Steps (Conflict-aware bidirectional merge before logout batch commit)
    const cloudActivity = await fetchActivityFromCloud(uid);
    const cloudActivityLogs: any[] = Array.isArray(cloudActivity?.activityLogs) ? cloudActivity.activityLogs : [];
    const cloudStepsLogs: any[] = Array.isArray(cloudActivity?.stepsLogs) ? cloudActivity.stepsLogs : [];

    const finalActivityLogs = mergeActivityLogs(activityLogs, cloudActivityLogs);
    const finalStepsLogs = mergeStepsLogs(stepsLogs, cloudStepsLogs);

    await Promise.all([
        setStoredJson('@lyfeos_activity_logs_v1', finalActivityLogs),
        setStoredJson('@lyfeos_steps_v1', finalStepsLogs),
    ]);

    const activityDocPayload: any = {
        activityLogs: finalActivityLogs,
        stepsLogs: finalStepsLogs,
        coachInsight: coachInsight || cloudActivity?.coachInsight || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(dataColRef.doc('activity'), activityDocPayload, { merge: true });

    // Commit atomic batch — will reject and throw if network/auth fails
    await batch.commit();
};

// ─── HABIT & LOG MERGE / NORMALIZATION HELPERS ───
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function normalizeHabit(raw: any): any {
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

    const normalized: any = {
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

export function normalizeHabitLog(raw: any): any {
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

    const normalized: any = {
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

export const mergeHabits = (localHabits: any[] = [], cloudHabits: any[] = []): any[] => {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localHabits || []).map(normalizeHabit);
    const normalizedCloud = (cloudHabits || []).map(normalizeHabit);

    const habitMap = new Map<string, any>();

    const resolveConflict = (existing: any, incoming: any): any => {
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

    const merged: any[] = [];
    for (const habit of habitMap.values()) {
        if (habit.deletedAt && habit.deletedAt < purgeCutoff) {
            continue;
        }
        merged.push(habit);
    }

    return merged;
};

export const mergeHabitLogs = (localLogs: any[] = [], cloudLogs: any[] = []): any[] => {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localLogs || []).map(normalizeHabitLog);
    const normalizedCloud = (cloudLogs || []).map(normalizeHabitLog);

    const logMap = new Map<string, any>();
    const pairToId = new Map<string, string>();

    const resolveConflict = (existing: any, incoming: any): any => {
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

    const addOrMerge = (log: any) => {
        const pairKey = (log.habitId && log.date) ? `${log.habitId}_${log.date}` : null;
        let existingId: string | undefined = log.id;
        let existing = logMap.get(log.id);

        if (!existing && pairKey && pairToId.has(pairKey)) {
            existingId = pairToId.get(pairKey)!;
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

    const merged: any[] = [];
    for (const log of logMap.values()) {
        if (log.deletedAt && log.deletedAt < purgeCutoff) {
            continue;
        }
        merged.push(log);
    }

    return merged;
};

// ─── TODO MERGE & NORMALIZATION HELPERS ───

export function normalizeTodo(raw: any): any {
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

    const normalized: any = {
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

export const mergeTodos = (localTodos: any[] = [], cloudTodos: any[] = []): any[] => {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localTodos || []).map(normalizeTodo);
    const normalizedCloud = (cloudTodos || []).map(normalizeTodo);

    const todoMap = new Map<string, any>();

    // Helper to resolve conflict between two versions of the same Todo ID
    const resolveConflict = (existing: any, incoming: any): any => {
        if (incoming.updatedAt > existing.updatedAt) {
            return incoming;
        }
        if (existing.updatedAt > incoming.updatedAt) {
            return existing;
        }
        // updatedAt ties: DELETE WINS
        if (incoming.deletedAt && !existing.deletedAt) {
            return incoming;
        }
        if (existing.deletedAt && !incoming.deletedAt) {
            return existing;
        }
        // Both active or both deleted with identical timestamp: cloud takes deterministic precedence
        return incoming;
    };

    for (const item of normalizedCloud) {
        if (!item?.id) continue;
        // Purge tombstones older than 30 days
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        todoMap.set(item.id, item);
    }

    for (const item of normalizedLocal) {
        if (!item?.id) continue;
        // Purge tombstones older than 30 days
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        const existing = todoMap.get(item.id);
        if (!existing) {
            todoMap.set(item.id, item);
        } else {
            todoMap.set(item.id, resolveConflict(existing, item));
        }
    }

    const allItems = Array.from(todoMap.values());

    // ── Recurring task deduplication ──────────────────────────────────────────
    // If two uncompleted recurring items have the same seriesId or title+dueDate+repeat,
    // they represent the same future recurrence generated independently on multiple devices.
    const activeRecurring = allItems.filter(
        (t) => !t.deletedAt && !t.completed && t.repeat && t.repeat !== 'none' && t.dueDate
    );

    if (activeRecurring.length > 1) {
        const seenRecurring = new Map<string, any>();
        for (const item of activeRecurring) {
            const seriesKey = item.seriesId
                ? `${item.seriesId}_${item.dueDate}`
                : `${(item.title || '').trim().toLowerCase()}_${item.dueDate}_${item.repeat}`;

            const existing = seenRecurring.get(seriesKey);
            if (!existing) {
                seenRecurring.set(seriesKey, item);
            } else {
                if (item.updatedAt > existing.updatedAt) {
                    existing.deletedAt = now;
                    existing.updatedAt = now;
                    seenRecurring.set(seriesKey, item);
                } else {
                    item.deletedAt = now;
                    item.updatedAt = now;
                }
            }
        }
    }

    // ── Order Normalization ───────────────────────────────────────────────────
    // Active items retain relative order, sorted by order ascending and tie-broken by createdAt and id
    const activeItems = allItems.filter((t) => !t.deletedAt);
    const tombstones = allItems.filter((t) => t.deletedAt);

    activeItems.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        const cA = a.createdAt || '';
        const cB = b.createdAt || '';
        if (cA !== cB) return cA.localeCompare(cB);
        return (a.id || '').localeCompare(b.id || '');
    });

    const reorderedActive = activeItems.map((t, idx) => ({
        ...t,
        order: idx,
    }));

    return [...reorderedActive, ...tombstones];
};

// ─── NUTRITION & WATER (FOOD ITEMS & WATER LOGS) ───

export interface SyncFoodItem {
    id: string;
    name: string;
    calories: number;
    meal: string;
    date: string;
    updatedAt: number;
    deletedAt?: number;
    [key: string]: any;
}

export interface SyncWaterLog {
    id: string;
    date: string;
    glasses: number;
    updatedAt: number;
    deletedAt?: number;
    [key: string]: any;
}

export const normalizeFoodItem = (raw: any, fallbackUpdatedAt = 0): SyncFoodItem | null => {
    if (!raw || typeof raw !== 'object' || !raw.id || typeof raw.id !== 'string') {
        return null;
    }

    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : (typeof fallbackUpdatedAt === 'number' && Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0);

    const normalized: SyncFoodItem = {
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
};

export const normalizeWaterLog = (raw: any, fallbackUpdatedAt = 0): SyncWaterLog | null => {
    if (!raw || typeof raw !== 'object' || !raw.date || typeof raw.date !== 'string') {
        return null;
    }

    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : (typeof fallbackUpdatedAt === 'number' && Number.isFinite(fallbackUpdatedAt) ? fallbackUpdatedAt : 0);

    const normalized: SyncWaterLog = {
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
};

export const mergeFoodItems = (localItems: any[] = [], cloudItems: any[] = []): SyncFoodItem[] => {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localItems || [])
        .map((f) => normalizeFoodItem(f))
        .filter((f): f is SyncFoodItem => f !== null);

    const normalizedCloud = (cloudItems || [])
        .map((f) => normalizeFoodItem(f))
        .filter((f): f is SyncFoodItem => f !== null);

    const foodMap = new Map<string, SyncFoodItem>();

    const resolveConflict = (existing: SyncFoodItem, incoming: SyncFoodItem): SyncFoodItem => {
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

    const allItems: SyncFoodItem[] = [];
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

    // Deterministic ordering: date desc, then meal, then id
    activeItems.sort((a, b) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        const mealDiff = (a.meal || '').localeCompare(b.meal || '');
        if (mealDiff !== 0) return mealDiff;
        return (a.id || '').localeCompare(b.id || '');
    });

    return [...activeItems, ...tombstones];
};

export const mergeWaterLogs = (localLogs: any[] = [], cloudLogs: any[] = []): SyncWaterLog[] => {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localLogs || [])
        .map((w) => normalizeWaterLog(w))
        .filter((w): w is SyncWaterLog => w !== null);

    const normalizedCloud = (cloudLogs || [])
        .map((w) => normalizeWaterLog(w))
        .filter((w): w is SyncWaterLog => w !== null);

    const waterMap = new Map<string, SyncWaterLog>();

    const resolveConflict = (existing: SyncWaterLog, incoming: SyncWaterLog): SyncWaterLog => {
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
        const merged: SyncWaterLog = {
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

    const allLogs: SyncWaterLog[] = [];
    for (const log of waterMap.values()) {
        if (log.deletedAt) {
            if (log.deletedAt >= purgeCutoff) {
                allLogs.push(log);
            }
        } else {
            allLogs.push(log);
        }
    }

    // Sort deterministically by date descending
    allLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return allLogs;
};

// ─── ACTIVITY & STEPS (WORKOUTS & STEPS LOGS) ───

export interface SyncActivityLog {
    id: string;
    date: string;          // "YYYY-MM-DD"
    sport: string;
    emoji: string;
    duration: number;      // minutes
    intensity: "light" | "moderate" | "intense";
    caloriesBurned: number;
    hydrationNeededMl: number;
    hydrationGlasses: number;
    proteinNeededG: number;
    carbsNeededG: number;
    recoveryTimeHours: number;
    heartRateZone: string;
    healthBenefits: string[];
    tips: string[];
    postActivityMeal: string;
    sportCategory: string;
    steps?: number;
    updatedAt: number;
    deletedAt?: number;
}

export interface SyncStepsLog {
    date: string;          // "YYYY-MM-DD"
    steps: number;
    distanceKm: number;
    caloriesBurned: number;
    activeMinutes: number;
    updatedAt: number;
    deletedAt?: number;
}

export function normalizeActivityLog(raw: any): any {
    if (!raw || typeof raw !== 'object') {
        const now = Date.now();
        return {
            id: now.toString() + Math.random().toString(36).slice(2, 7),
            date: new Date(now).toISOString().split('T')[0],
            sport: 'Workout',
            emoji: '🏃',
            duration: 30,
            intensity: 'moderate',
            caloriesBurned: 150,
            hydrationNeededMl: 300,
            hydrationGlasses: 1,
            proteinNeededG: 10,
            carbsNeededG: 20,
            recoveryTimeHours: 12,
            heartRateZone: 'Fat Burn',
            healthBenefits: [],
            tips: [],
            postActivityMeal: '',
            sportCategory: 'General',
            updatedAt: now,
        };
    }

    const now = Date.now();
    let updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt)
        ? raw.updatedAt
        : NaN;

    if (isNaN(updatedAt)) {
        if (raw.date && typeof raw.date === 'string') {
            const parsed = new Date(raw.date + 'T00:00:00').getTime();
            updatedAt = !isNaN(parsed) && parsed > 0 ? parsed : now;
        } else {
            updatedAt = now;
        }
    }

    const normalized: any = {
        ...raw,
        id: raw.id ? String(raw.id) : (Date.now().toString() + Math.random().toString(36).slice(2, 7)),
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

export function normalizeStepsLog(raw: any): any {
    if (!raw || typeof raw !== 'object') {
        const now = Date.now();
        return {
            date: new Date(now).toISOString().split('T')[0],
            steps: 0,
            distanceKm: 0,
            caloriesBurned: 0,
            activeMinutes: 0,
            updatedAt: now,
        };
    }

    const now = Date.now();
    let updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt)
        ? raw.updatedAt
        : NaN;

    if (isNaN(updatedAt)) {
        if (raw.date && typeof raw.date === 'string') {
            const parsed = new Date(raw.date + 'T00:00:00').getTime();
            updatedAt = !isNaN(parsed) && parsed > 0 ? parsed : now;
        } else {
            updatedAt = now;
        }
    }

    const normalized: any = {
        ...raw,
        date: raw.date ? String(raw.date) : new Date(now).toISOString().split('T')[0],
        steps: typeof raw.steps === 'number' && !isNaN(raw.steps) ? raw.steps : 0,
        distanceKm: typeof raw.distanceKm === 'number' && !isNaN(raw.distanceKm) ? raw.distanceKm : 0,
        caloriesBurned: typeof raw.caloriesBurned === 'number' && !isNaN(raw.caloriesBurned) ? raw.caloriesBurned : 0,
        activeMinutes: typeof raw.activeMinutes === 'number' && !isNaN(raw.activeMinutes) ? raw.activeMinutes : 0,
        updatedAt,
    };

    if (typeof raw.deletedAt === 'number' && !Number.isNaN(raw.deletedAt)) {
        normalized.deletedAt = raw.deletedAt;
    } else {
        delete normalized.deletedAt;
    }

    return normalized;
}

export function mergeActivityLogs(localLogs: any[] = [], cloudLogs: any[] = []): any[] {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localLogs || []).map(normalizeActivityLog);
    const normalizedCloud = (cloudLogs || []).map(normalizeActivityLog);

    const logMap = new Map<string, any>();

    const resolveConflict = (cloudItem: any, localItem: any): any => {
        if (localItem.updatedAt > cloudItem.updatedAt) {
            return localItem;
        }
        if (cloudItem.updatedAt > localItem.updatedAt) {
            return cloudItem;
        }
        // updatedAt ties: DELETE WINS
        if (localItem.deletedAt && !cloudItem.deletedAt) {
            return localItem;
        }
        if (cloudItem.deletedAt && !localItem.deletedAt) {
            return cloudItem;
        }
        // Both active or both deleted with identical timestamp: cloud takes deterministic precedence
        return cloudItem;
    };

    for (const item of normalizedCloud) {
        if (!item?.id) continue;
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        const existing = logMap.get(item.id);
        if (!existing) {
            logMap.set(item.id, item);
        } else {
            logMap.set(item.id, item.updatedAt >= existing.updatedAt ? item : existing);
        }
    }

    for (const item of normalizedLocal) {
        if (!item?.id) continue;
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        const existing = logMap.get(item.id);
        if (!existing) {
            logMap.set(item.id, item);
        } else {
            logMap.set(item.id, resolveConflict(existing, item));
        }
    }

    const allLogs: any[] = [];
    for (const l of logMap.values()) {
        if (l.deletedAt && l.deletedAt < purgeCutoff) continue;
        allLogs.push(l);
    }

    // Sort deterministically by date descending, then id
    allLogs.sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        return (b.id || '').localeCompare(a.id || '');
    });

    return allLogs;
}

export function mergeStepsLogs(localSteps: any[] = [], cloudSteps: any[] = []): any[] {
    const now = Date.now();
    const purgeCutoff = now - TOMBSTONE_RETENTION_MS;

    const normalizedLocal = (localSteps || []).map(normalizeStepsLog);
    const normalizedCloud = (cloudSteps || []).map(normalizeStepsLog);

    const stepsMap = new Map<string, any>();

    const resolveConflict = (cloudItem: any, localItem: any): any => {
        if (localItem.updatedAt > cloudItem.updatedAt) {
            return localItem;
        }
        if (cloudItem.updatedAt > localItem.updatedAt) {
            return cloudItem;
        }
        // Timestamp ties:
        // If either record is deleted: Delete-Wins
        if (localItem.deletedAt && !cloudItem.deletedAt) {
            return localItem;
        }
        if (cloudItem.deletedAt && !localItem.deletedAt) {
            return cloudItem;
        }
        // If updatedAt is equal, both are active, and values differ: Cloud-Wins deterministically
        return cloudItem;
    };

    for (const item of normalizedCloud) {
        if (!item?.date) continue;
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        const existing = stepsMap.get(item.date);
        if (!existing) {
            stepsMap.set(item.date, item);
        } else {
            stepsMap.set(item.date, item.updatedAt >= existing.updatedAt ? item : existing);
        }
    }

    for (const item of normalizedLocal) {
        if (!item?.date) continue;
        if (item.deletedAt && item.deletedAt < purgeCutoff) continue;
        const existing = stepsMap.get(item.date);
        if (!existing) {
            stepsMap.set(item.date, item);
        } else {
            stepsMap.set(item.date, resolveConflict(existing, item));
        }
    }

    const allSteps: any[] = [];
    for (const s of stepsMap.values()) {
        if (s.deletedAt && s.deletedAt < purgeCutoff) continue;
        allSteps.push(s);
    }

    // Sort deterministically by date descending
    allSteps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return allSteps;
}

// ─── PROFILE MERGE & CONFLICT RESOLUTION ───
export interface ProfileSectionTimestamps {
    userName?: number;
    habitGoal?: number;
    activityGoal?: number;
    healthProfile?: number;
    reminders?: number;
    preferences?: number;
}

export interface ProfileSyncData {
    userName?: string;
    joinDate?: string;
    habitGoal?: number;
    activityGoal?: number;
    healthProfile?: any;
    reminders?: any;
    preferences?: any;
    sectionTimestamps?: ProfileSectionTimestamps;
    userNameUpdatedAt?: number;
    habitGoalUpdatedAt?: number;
    activityGoalUpdatedAt?: number;
    healthProfileUpdatedAt?: number;
    remindersUpdatedAt?: number;
    preferencesUpdatedAt?: number;
    [key: string]: any;
}

export interface MergedProfileResult {
    userName: string;
    joinDate: string;
    habitGoal: number;
    activityGoal: number;
    healthProfile: any;
    reminders: any;
    preferences: any;
    sectionTimestamps: ProfileSectionTimestamps;
    userNameUpdatedAt?: number;
    habitGoalUpdatedAt?: number;
    activityGoalUpdatedAt?: number;
    healthProfileUpdatedAt?: number;
    remindersUpdatedAt?: number;
    preferencesUpdatedAt?: number;
    [key: string]: any;
}

export const mergeProfileData = (
    local: ProfileSyncData,
    cloud: ProfileSyncData | null
): MergedProfileResult => {
    const localTimes: ProfileSectionTimestamps = {
        userName: local.sectionTimestamps?.userName || local.userNameUpdatedAt || 0,
        habitGoal: local.sectionTimestamps?.habitGoal || local.habitGoalUpdatedAt || 0,
        activityGoal: local.sectionTimestamps?.activityGoal || local.activityGoalUpdatedAt || 0,
        healthProfile: local.sectionTimestamps?.healthProfile || local.healthProfileUpdatedAt || 0,
        reminders: local.sectionTimestamps?.reminders || local.remindersUpdatedAt || 0,
        preferences: local.sectionTimestamps?.preferences || local.preferencesUpdatedAt || 0,
    };

    const cloudTimes: ProfileSectionTimestamps = {
        userName: cloud?.userNameUpdatedAt || cloud?.sectionTimestamps?.userName || 0,
        habitGoal: cloud?.habitGoalUpdatedAt || cloud?.sectionTimestamps?.habitGoal || 0,
        activityGoal: cloud?.activityGoalUpdatedAt || cloud?.sectionTimestamps?.activityGoal || 0,
        healthProfile: cloud?.healthProfileUpdatedAt || cloud?.sectionTimestamps?.healthProfile || 0,
        reminders: cloud?.remindersUpdatedAt || cloud?.sectionTimestamps?.reminders || 0,
        preferences: cloud?.preferencesUpdatedAt || cloud?.sectionTimestamps?.preferences || 0,
    };

    // Helper for resolving scalar fields with section timestamps
    const resolveScalar = <T>(
        localVal: T | undefined,
        cloudVal: T | undefined,
        localTs: number,
        cloudTs: number,
        defaultVal: T
    ): { val: T; ts?: number } => {
        const lVal = localVal !== undefined && localVal !== null ? localVal : defaultVal;
        const cVal = cloudVal !== undefined && cloudVal !== null ? cloudVal : defaultVal;

        // 1. Both timestamped (intentional changes)
        if (localTs > 0 && cloudTs > 0) {
            if (localTs > cloudTs) return { val: lVal, ts: localTs };
            if (cloudTs > localTs) return { val: cVal, ts: cloudTs };
            // Timestamp tie on active records: Cloud-Wins deterministically
            return { val: cVal, ts: cloudTs };
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

    let baseHp: any = DEFAULT_HEALTH;
    let fallbackHp: any = DEFAULT_HEALTH;
    let winningHpTs: number | undefined = undefined;

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
            // Timestamp tie: Cloud-Wins
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
        // Neither timestamped: cloud base, fallback to local
        baseHp = cloudHp;
        fallbackHp = localHp;
    }

    // Merge health fields: base wins, but preserve non-empty from fallback if base is blank ("" or unset)
    const mergedHealth: any = { ...DEFAULT_HEALTH };
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
    // Preserve custom extra health properties
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

    let mergedReminders: any = DEFAULT_REMINDERS;
    let winningRemTs: number | undefined = undefined;

    if (localRemTs > 0 && cloudRemTs > 0) {
        if (localRemTs > cloudRemTs) {
            mergedReminders = { ...DEFAULT_REMINDERS, ...cloudRem, ...localRem };
            winningRemTs = localRemTs;
        } else if (cloudRemTs > localRemTs) {
            mergedReminders = { ...DEFAULT_REMINDERS, ...localRem, ...cloudRem };
            winningRemTs = cloudRemTs;
        } else {
            // Timestamp tie: Cloud-Wins
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
        // Legacy: if local is all-false defaults, preserve cloud reminders
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

    let mergedPreferences: any = DEFAULT_PREFS;
    let winningPrefTs: number | undefined = undefined;

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
        // Legacy: merge explicit cloud over defaults
        mergedPreferences = { ...DEFAULT_PREFS, ...localPref, ...cloudPref };
    }

    // 7. joinDate (immutable account creation date -> earliest valid ISO date wins)
    const parseDate = (d: any): number => {
        if (typeof d !== 'string' || !d) return NaN;
        const t = Date.parse(d);
        return isNaN(t) ? NaN : t;
    };

    const localJ = parseDate(local.joinDate);
    const cloudJ = parseDate(cloud?.joinDate);
    let finalJoinDate: string;

    if (!isNaN(localJ) && !isNaN(cloudJ)) {
        finalJoinDate = localJ <= cloudJ
            ? (local.joinDate || cloud?.joinDate || new Date().toISOString())
            : (cloud?.joinDate || local.joinDate || new Date().toISOString());
    } else if (!isNaN(cloudJ) && cloud?.joinDate) {
        finalJoinDate = cloud.joinDate;
    } else if (!isNaN(localJ) && local.joinDate) {
        finalJoinDate = local.joinDate;
    } else {
        finalJoinDate = new Date().toISOString();
    }

    // 8. Preserve unknown top-level cloud fields
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

    const unknownCloudFields: Record<string, any> = {};
    if (cloud && typeof cloud === 'object') {
        for (const [k, v] of Object.entries(cloud)) {
            if (!managedKeys.has(k) && v !== undefined) {
                unknownCloudFields[k] = v;
            }
        }
    }

    const finalSectionTimestamps: ProfileSectionTimestamps = {};
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
};

// ─── GUEST MIGRATION ───
export interface GuestMigrationPayload {
    habits: any[];
    habitLogs: any[];
    todos: any[];
    foodItems: any[];
    waterLogs: any[];
    lastModified: number;
    dailyGoal?: any;
    goalsConfigured?: boolean;
    activityLogs?: any[];
    stepsLogs?: any[];
    profile?: ProfileSyncData;
}

export interface MergedCaloriesMigrationResult {
    caloriesPayload: any;
    mergedFoodItems: any[];
    mergedWaterLogs: any[];
    mergedLastModified: number;
    localGoalUpdates: {
        dailyGoal?: any;
        goalsConfigured?: boolean;
    };
}

export const mergeCaloriesMigrationData = (
    guestData: GuestMigrationPayload,
    rawCloudDocData: any | null
): MergedCaloriesMigrationResult => {
    let mergedFoodItems = [...(guestData.foodItems || [])];
    let mergedWaterLogs = [...(guestData.waterLogs || [])];
    let mergedLastModified = guestData.lastModified || Date.now();
    let existingDailyGoal: any = undefined;
    let existingGoalsConfigured: boolean | undefined = undefined;
    let existingCaloriesExtra: Record<string, any> = {};

    if (rawCloudDocData) {
        const cloudCalories = rawCloudDocData.calories;
        const cloudFood: any[] = Array.isArray(cloudCalories?.foodItems) ? cloudCalories.foodItems : [];
        const cloudWater: any[] = Array.isArray(cloudCalories?.waterLogs) ? cloudCalories.waterLogs : [];
        const cloudLastModified: number = typeof cloudCalories?.lastModified === 'number' ? cloudCalories.lastModified : 0;

        const cloudFoodIds = new Set(cloudFood.map((f: any) => f?.id).filter(Boolean));
        const guestFoodToAdd = (guestData.foodItems || []).filter((f: any) => f && f.id && !cloudFoodIds.has(f.id));
        mergedFoodItems = [...cloudFood, ...guestFoodToAdd];

        const waterMap = new Map<string, any>();
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

    const caloriesPayload: any = {
        calories: {
            ...existingCaloriesExtra,
            foodItems: mergedFoodItems,
            waterLogs: mergedWaterLogs,
            lastModified: mergedLastModified,
        },
        updatedAt: firestore.FieldValue.serverTimestamp(),
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
};

export const migrateGuestDataToAccount = async (
    uid: string,
    guestData: GuestMigrationPayload
): Promise<boolean> => {
    try {
        const userRef = getUserDoc(uid);
        const habitsRef = userRef.collection('data').doc('habits');
        const todosRef = userRef.collection('data').doc('todos');
        const caloriesRef = userRef.collection('data').doc('calories');
        const activityRef = userRef.collection('data').doc('activity');
        const profileRef = userRef.collection('data').doc('profile');

        // Fetch existing cloud data in parallel for deterministic merge
        const [habitsDoc, todosDoc, caloriesDoc, activityDoc, profileDoc] = await Promise.all([
            habitsRef.get(),
            todosRef.get(),
            caloriesRef.get(),
            activityRef.get(),
            profileRef.get(),
        ]);

        // 1. Merge Habits & Habit Logs
        let mergedHabits = [...guestData.habits];
        let mergedHabitLogs = [...guestData.habitLogs];

        if (habitsDoc.exists()) {
            const cloudData = habitsDoc.data();
            const cloudHabits: any[] = Array.isArray(cloudData?.habits) ? cloudData.habits : [];
            const cloudHabitLogs: any[] = Array.isArray(cloudData?.habitLogs) ? cloudData.habitLogs : [];

            mergedHabits = mergeHabits(guestData.habits, cloudHabits);
            mergedHabitLogs = mergeHabitLogs(guestData.habitLogs, cloudHabitLogs);
        }

        // 2. Merge Todos (Existing P1-1 implementation preserved exactly as-is)
        let mergedTodos = [...guestData.todos];

        if (todosDoc.exists()) {
            const cloudData = todosDoc.data();
            const cloudTodos: any[] = Array.isArray(cloudData?.todos) ? cloudData.todos : [];
            mergedTodos = mergeTodos(guestData.todos, cloudTodos);
        }

        // 3. Merge Calories, Water Logs & Nutrition Goals (P1-2 Phase A1 Safe Non-Destructive Merge)
        const {
            caloriesPayload,
            mergedFoodItems,
            mergedWaterLogs,
            mergedLastModified,
            localGoalUpdates,
        } = mergeCaloriesMigrationData(
            guestData,
            caloriesDoc.exists() ? caloriesDoc.data() : null
        );

        // 4. Merge Activity & Steps Logs (Non-destructive merge)
        let mergedActivityLogs = [...(guestData.activityLogs || [])];
        let mergedStepsLogs = [...(guestData.stepsLogs || [])];
        let cloudCoachInsight: any = null;

        if (activityDoc.exists()) {
            const cloudActivityData = activityDoc.data();
            const cloudActivityList: any[] = Array.isArray(cloudActivityData?.activityLogs) ? cloudActivityData.activityLogs : [];
            const cloudStepsList: any[] = Array.isArray(cloudActivityData?.stepsLogs) ? cloudActivityData.stepsLogs : [];
            cloudCoachInsight = cloudActivityData?.coachInsight || null;

            mergedActivityLogs = mergeActivityLogs(guestData.activityLogs || [], cloudActivityList);
            mergedStepsLogs = mergeStepsLogs(guestData.stepsLogs || [], cloudStepsList);
        } else {
            mergedActivityLogs = (guestData.activityLogs || []).map(normalizeActivityLog);
            mergedStepsLogs = (guestData.stepsLogs || []).map(normalizeStepsLog);
        }

        // 5. Merge Profile & Health (Non-destructive merge preserving existing account data)
        let mergedProfile: MergedProfileResult | null = null;
        if (guestData.profile) {
            const cloudProfileData: ProfileSyncData | null = profileDoc.exists() ? (profileDoc.data() as ProfileSyncData) : null;
            mergedProfile = mergeProfileData(guestData.profile, cloudProfileData);
        }

        // 6. Atomic batch write to Firestore
        const batch = firestore().batch();

        batch.set(habitsRef, {
            habits: mergedHabits,
            habitLogs: mergedHabitLogs,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });

        batch.set(todosRef, {
            todos: mergedTodos,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });

        // Safe merge write preserving existing account goals and arbitrary top-level fields
        batch.set(caloriesRef, caloriesPayload, { merge: true });

        const activityPayload: any = {
            activityLogs: mergedActivityLogs,
            stepsLogs: mergedStepsLogs,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        };
        if (cloudCoachInsight) {
            activityPayload.coachInsight = cloudCoachInsight;
        }
        batch.set(activityRef, activityPayload, { merge: true });

        if (mergedProfile) {
            batch.set(profileRef, {
                ...mergedProfile,
                updatedAt: firestore.FieldValue.serverTimestamp(),
                migratedFromGuest: true,
            }, { merge: true });
        }

        await batch.commit();

        // 7. Update local storage with the merged data so current device state is immediately synchronized
        const localUpdates: Promise<any>[] = [
            setStoredJson('@lyfeos_habits_v2', mergedHabits),
            setStoredJson('@lyfeos_habit_logs_v2', mergedHabitLogs),
            setStoredJson('@lyfeos_todos_v2', mergedTodos),
            setStoredJson('@lyfeos_food_v2', mergedFoodItems),
            setStoredJson('@lyfeos_water_v2', mergedWaterLogs),
            setStoredJson('@lyfeos_food_meta_v1', { lastModified: mergedLastModified }),
        ];

        if (guestData.activityLogs !== undefined) {
            localUpdates.push(setStoredJson('@lyfeos_activity_logs_v1', mergedActivityLogs));
        }
        if (guestData.stepsLogs !== undefined) {
            localUpdates.push(setStoredJson('@lyfeos_steps_v1', mergedStepsLogs));
        }

        if (mergedProfile) {
            localUpdates.push(
                setStoredString('@lyfeos_profile_name_v1', mergedProfile.userName),
                setStoredString('@lyfeos_profile_join_v1', mergedProfile.joinDate),
                setStoredString('@lyfeos_profile_habitgoal_v1', String(mergedProfile.habitGoal)),
                setStoredString('@lyfeos_profile_actgoal_v1', String(mergedProfile.activityGoal)),
                setStoredJson('@lyfeos_profile_health_v1', mergedProfile.healthProfile),
                setStoredJson('@lyfeos_profile_reminders_v1', mergedProfile.reminders),
                setStoredJson('@lyfeos_profile_prefs_v1', mergedProfile.preferences),
                setStoredJson('@lyfeos_profile_meta_v1', { sectionTimestamps: mergedProfile.sectionTimestamps })
            );
        }

        // If authenticated account had goals, sync them to local storage
        if (localGoalUpdates.dailyGoal !== undefined) {
            localUpdates.push(setStoredJson('@lyfeos_goal_v2', localGoalUpdates.dailyGoal));
        }
        if (localGoalUpdates.goalsConfigured !== undefined) {
            localUpdates.push(setStoredString('@lyfeos_goals_configured_v1', String(localGoalUpdates.goalsConfigured)));
        }

        await Promise.all(localUpdates);

        return true;
    } catch (e) {
        logError(e as Error, 'migrateGuestDataToAccount');
        return false;
    }
};

// ─── DELETE USER CLOUD DATA ───
/**
 * Permanently deletes all user-owned data from Firestore:
 * - All documents under `users/{uid}/data/*` (habits, todos, calories, consent, etc.)
 * - The parent `users/{uid}` document
 * Throws an error if any deletion step fails so caller does NOT delete the auth user.
 */
export const deleteUserCloudData = async (uid: string): Promise<boolean> => {
    try {
        if (!uid) {
            throw new Error('deleteUserCloudData: Valid UID required');
        }

        const userDocRef = getUserDoc(uid);
        const dataColRef = userDocRef.collection('data');

        // 1. Fetch any and all documents currently under users/{uid}/data
        const dataSnapshot = await dataColRef.get();
        const batch = firestore().batch();

        // Queue all existing documents in subcollection for deletion
        dataSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Also explicitly queue known document IDs to guarantee cleanup
        const knownDocNames = ['habits', 'todos', 'calories', 'consent', 'profile', 'activity'];
        for (const docName of knownDocNames) {
            batch.delete(dataColRef.doc(docName));
        }

        // Delete parent users/{uid} document
        batch.delete(userDocRef);

        // Commit the batch
        await batch.commit();

        // Verify that deletion succeeded
        const verifySnapshot = await dataColRef.get();
        if (!verifySnapshot.empty) {
            throw new Error(`Cloud deletion verification failed: ${verifySnapshot.size} document(s) still exist under users/${uid}/data`);
        }

        return true;
    } catch (e) {
        logError(e as Error, 'deleteUserCloudData');
        throw e;
    }
};

