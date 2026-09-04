import firestore from '@react-native-firebase/firestore';
import { logError } from './analytics';
import { setStoredJson } from './storage';

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
        return doc.exists() ? doc.data()?.todos ?? null : null;
    } catch (e) { logError(e as Error, 'fetchTodosFromCloud'); return null; }
};

// ─── CALORIES ───
export const syncCaloriesToCloud = async (uid: string, calories: any) => {
    try {
        await getUserDoc(uid).collection('data').doc('calories').set({ calories, updatedAt: firestore.FieldValue.serverTimestamp() });
    } catch (e) { logError(e as Error, 'syncCaloriesToCloud'); }
};

export const fetchCaloriesFromCloud = async (uid: string): Promise<any | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('calories').get();
        return doc.exists() ? doc.data()?.calories ?? null : null;
    } catch (e) { logError(e as Error, 'fetchCaloriesFromCloud'); return null; }
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

            const cloudTodoIds = new Set(cloudTodos.map((t: any) => t.id));
            const guestTodosToAdd = guestData.todos.filter((t: any) => !cloudTodoIds.has(t.id));
            const combinedTodos = [...cloudTodos, ...guestTodosToAdd];
            mergedTodos = combinedTodos.map((t: any, idx: number) => ({ ...t, order: idx }));
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
        const knownDocNames = ['habits', 'todos', 'calories', 'consent'];
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

