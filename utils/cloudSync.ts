import firestore from '@react-native-firebase/firestore';
import { logError } from './analytics';
import { getStoredJson, getStoredString, setStoredJson } from './storage';

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
        return doc.exists() ? doc.data()?.habits ?? null : null;
    } catch (e) { logError(e as Error, 'fetchHabitsFromCloud'); return null; }
};

export const fetchHabitLogsFromCloud = async (uid: string): Promise<any[] | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('habits').get();
        return doc.exists() ? doc.data()?.habitLogs ?? null : null;
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
        getStoredJson<any[]>('@lyfeos_activity_logs_v1', []),
        getStoredJson<any[]>('@lyfeos_steps_v1', []),
        getStoredJson<any>('@lyfeos_coach_insight_v1', null),
    ]);

    const batch = firestore().batch();
    const userDocRef = getUserDoc(uid);
    const dataColRef = userDocRef.collection('data');

    // 1. Habits & Logs
    batch.set(dataColRef.doc('habits'), {
        habits,
        habitLogs,
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

    // 3. Calories, Water, Goals
    const caloriesPayload: any = {
        foodItems,
        waterLogs,
        lastModified: foodMeta.lastModified || Date.now(),
    };
    const caloriesDocPayload: any = {
        calories: caloriesPayload,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (dailyGoal) caloriesDocPayload.dailyGoal = dailyGoal;
    if (goalsConfiguredStr !== null) caloriesDocPayload.goalsConfigured = goalsConfiguredStr === 'true';
    batch.set(dataColRef.doc('calories'), caloriesDocPayload, { merge: true });

    // 4. Profile & Health
    const profileDocPayload: any = {
        userName: profileName || 'LyfeOS User',
        joinDate: joinDate || new Date().toISOString(),
        habitGoal: habitGoalStr ? parseInt(habitGoalStr, 10) || 5 : 5,
        activityGoal: actGoalStr ? parseInt(actGoalStr, 10) || 30 : 30,
        healthProfile: healthProfile || null,
        reminders: reminders || null,
        preferences: prefs || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(dataColRef.doc('profile'), profileDocPayload, { merge: true });

    // 5. Activity & Steps
    const activityDocPayload: any = {
        activityLogs,
        stepsLogs,
        coachInsight: coachInsight || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(dataColRef.doc('activity'), activityDocPayload, { merge: true });

    // Commit atomic batch — will reject and throw if network/auth fails
    await batch.commit();
};

// ─── HABIT MERGE HELPERS ───
export const mergeHabits = (localHabits: any[], cloudHabits: any[]): any[] => {
    if (!cloudHabits || cloudHabits.length === 0) return localHabits || [];
    if (!localHabits || localHabits.length === 0) return cloudHabits || [];

    const cloudHabitIds = new Set(cloudHabits.map((h: any) => h.id));
    const cloudHabitNames = new Set(cloudHabits.map((h: any) => (h.name || '').trim().toLowerCase()));

    const localHabitsToAdd = localHabits.filter(
        (h: any) => !cloudHabitIds.has(h.id) && !cloudHabitNames.has((h.name || '').trim().toLowerCase())
    );
    return [...cloudHabits, ...localHabitsToAdd];
};

export const mergeHabitLogs = (localLogs: any[], cloudLogs: any[]): any[] => {
    if (!cloudLogs || cloudLogs.length === 0) return localLogs || [];
    if (!localLogs || localLogs.length === 0) return cloudLogs || [];

    const logMap = new Map<string, any>();
    for (const log of cloudLogs) {
        if (log?.habitId && log?.date) {
            logMap.set(`${log.habitId}_${log.date}`, log);
        }
    }
    for (const log of localLogs) {
        if (!log?.habitId || !log?.date) continue;
        const key = `${log.habitId}_${log.date}`;
        const existing = logMap.get(key);
        if (!existing) {
            logMap.set(key, log);
        } else {
            logMap.set(key, {
                ...existing,
                completed: existing.completed || log.completed,
                amount: Math.max(existing.amount || 0, log.amount || 0) || existing.amount || log.amount,
                timeSeconds: Math.max(existing.timeSeconds || 0, log.timeSeconds || 0) || existing.timeSeconds || log.timeSeconds,
            });
        }
    }
    return Array.from(logMap.values());
};

// ─── TODO MERGE & NORMALIZATION HELPERS ───
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

// ─── GUEST MIGRATION ───
export interface GuestMigrationPayload {
    habits: any[];
    habitLogs: any[];
    todos: any[];
    foodItems: any[];
    waterLogs: any[];
    lastModified: number;
}

export const migrateGuestDataToAccount = async (
    uid: string,
    guestData: GuestMigrationPayload
): Promise<boolean> => {
    try {
        const userRef = getUserDoc(uid);
        const habitsRef = userRef.collection('data').doc('habits');
        const todosRef = userRef.collection('data').doc('todos');
        const caloriesRef = userRef.collection('data').doc('calories');

        // Fetch existing cloud data in parallel for deterministic merge
        const [habitsDoc, todosDoc, caloriesDoc] = await Promise.all([
            habitsRef.get(),
            todosRef.get(),
            caloriesRef.get(),
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

        // 2. Merge Todos
        let mergedTodos = [...guestData.todos];

        if (todosDoc.exists()) {
            const cloudData = todosDoc.data();
            const cloudTodos: any[] = Array.isArray(cloudData?.todos) ? cloudData.todos : [];
            mergedTodos = mergeTodos(guestData.todos, cloudTodos);
        }

        // 3. Merge Calories & Water Logs
        let mergedFoodItems = [...guestData.foodItems];
        let mergedWaterLogs = [...guestData.waterLogs];
        let mergedLastModified = guestData.lastModified || Date.now();

        if (caloriesDoc.exists()) {
            const cloudData = caloriesDoc.data()?.calories;
            const cloudFood: any[] = Array.isArray(cloudData?.foodItems) ? cloudData.foodItems : [];
            const cloudWater: any[] = Array.isArray(cloudData?.waterLogs) ? cloudData.waterLogs : [];
            const cloudLastModified: number = cloudData?.lastModified || 0;

            const cloudFoodIds = new Set(cloudFood.map((f: any) => f.id));
            const guestFoodToAdd = guestData.foodItems.filter((f: any) => !cloudFoodIds.has(f.id));
            mergedFoodItems = [...cloudFood, ...guestFoodToAdd];

            const waterMap = new Map<string, any>();
            for (const w of cloudWater) {
                if (w?.date) waterMap.set(w.date, w);
            }
            for (const w of guestData.waterLogs) {
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
        }

        // 4. Atomic batch write to Firestore
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

        batch.set(caloriesRef, {
            calories: {
                foodItems: mergedFoodItems,
                waterLogs: mergedWaterLogs,
                lastModified: mergedLastModified,
            },
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });

        await batch.commit();

        // 5. Update local storage with the merged data so current device state is immediately synchronized
        await Promise.all([
            setStoredJson('@lyfeos_habits_v2', mergedHabits),
            setStoredJson('@lyfeos_habit_logs_v2', mergedHabitLogs),
            setStoredJson('@lyfeos_todos_v2', mergedTodos),
            setStoredJson('@lyfeos_food_v2', mergedFoodItems),
            setStoredJson('@lyfeos_water_v2', mergedWaterLogs),
            setStoredJson('@lyfeos_food_meta_v1', { lastModified: mergedLastModified }),
        ]);

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

