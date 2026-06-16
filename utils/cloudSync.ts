import firestore from '@react-native-firebase/firestore';
import { logError } from './analytics';

const getUserDoc = (uid: string) =>
    firestore().collection('users').doc(uid);

// ─── HABITS ───
export const syncHabitsToCloud = async (uid: string, habits: any[]) => {
    try {
        await getUserDoc(uid).collection('data').doc('habits').set({ habits, updatedAt: firestore.FieldValue.serverTimestamp() });
    } catch (e) { logError(e as Error, 'syncHabitsToCloud'); }
};

export const fetchHabitsFromCloud = async (uid: string): Promise<any[] | null> => {
    try {
        const doc = await getUserDoc(uid).collection('data').doc('habits').get();
        return doc.exists ? doc.data()?.habits ?? null : null;
    } catch (e) { logError(e as Error, 'fetchHabitsFromCloud'); return null; }
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
        return doc.exists ? doc.data()?.todos ?? null : null;
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
        return doc.exists ? doc.data()?.calories ?? null : null;
    } catch (e) { logError(e as Error, 'fetchCaloriesFromCloud'); return null; }
};

// ─── GUEST MIGRATION ───
export const migrateGuestDataToAccount = async (
    uid: string,
    habits: any[],
    todos: any[],
    calories: any
) => {
    try {
        const batch = firestore().batch();
        const userRef = getUserDoc(uid);

        batch.set(userRef.collection('data').doc('habits'), {
            habits,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });
        batch.set(userRef.collection('data').doc('todos'), {
            todos,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });
        batch.set(userRef.collection('data').doc('calories'), {
            calories,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            migratedFromGuest: true,
        });

        await batch.commit();
        return true;
    } catch (e) {
        logError(e as Error, 'migrateGuestDataToAccount');
        return false;
    }
};
