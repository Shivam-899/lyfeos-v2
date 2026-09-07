import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logEvent, logError, setAnalyticsUser } from "@/utils/analytics";
import { migrateGuestDataToAccount, deleteUserCloudData, syncAllUserDataBeforeLogout } from "@/utils/cloudSync";
import { getStoredJson, clearAllLyfeOSLocalData } from "@/utils/storage";
import { cancelAllNotifications } from "@/utils/notifications";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isInitializing: boolean; // Kept for backward compatibility with existing layout routing
  isGuest: boolean;
  isSigningOut: boolean;
  migrationDone: boolean;
  clearMigrationDone: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  reauthenticateWithEmail: (password: string) => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
  deleteAccountAndData: (passwordForReauth?: string) => Promise<void>;
  deleteGuestData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationDone, setMigrationDone] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: "66808080139-r6t78lrsqsoabug2jlrltb1bbevt2003.apps.googleusercontent.com",
    });

    // Auth state listener:
    const subscriber = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return subscriber; // unsubscribe on unmount
  }, []);

  // ── Guest migration helper ─────────────────────────────────────────────────
  const handleGuestMigration = async (newUid: string, wasAnonymous: boolean) => {
    // Only migrate if the prior session was a genuine anonymous/guest session
    if (!wasAnonymous) {
      return;
    }

    try {
      // Read current local data using authoritative versioned keys
      const [localHabits, localHabitLogs, localTodos, localFood, localWater, localMeta] = await Promise.all([
        getStoredJson<any[]>("@lyfeos_habits_v2", []),
        getStoredJson<any[]>("@lyfeos_habit_logs_v2", []),
        getStoredJson<any[]>("@lyfeos_todos_v2", []),
        getStoredJson<any[]>("@lyfeos_food_v2", []),
        getStoredJson<any[]>("@lyfeos_water_v2", []),
        getStoredJson<{ lastModified?: number }>("@lyfeos_food_meta_v1", { lastModified: 0 }),
      ]);

      const hasData =
        localHabits.length > 0 ||
        localHabitLogs.length > 0 ||
        localTodos.length > 0 ||
        localFood.length > 0 ||
        localWater.length > 0;

      // Only migrate if there's actual guest data
      if (hasData) {
        const success = await migrateGuestDataToAccount(newUid, {
          habits: localHabits,
          habitLogs: localHabitLogs,
          todos: localTodos,
          foodItems: localFood,
          waterLogs: localWater,
          lastModified: localMeta.lastModified || Date.now(),
        });
        if (success) {
          setMigrationDone(true);
        }
      }
    } catch (e) {
      logError(e as Error, "handleGuestMigration");
    }
  };

  const clearMigrationDone = () => setMigrationDone(false);

  const signInWithGoogle = async () => {
    try {
      const wasAnonymous = auth().currentUser?.isAnonymous === true;
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;

      if (!idToken) {
        throw new Error("No ID token found");
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const result = await auth().signInWithCredential(googleCredential);
      await handleGuestMigration(result.user.uid, wasAnonymous);
      await logEvent("login", { method: "google" });
    } catch (e) {
      logError(e as Error, "signInWithGoogle");
      throw e;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const wasAnonymous = auth().currentUser?.isAnonymous === true;
      const result = await auth().signInWithEmailAndPassword(email, password);
      await handleGuestMigration(result.user.uid, wasAnonymous);
      await logEvent("login", { method: "email" });
    } catch (e) {
      logError(e as Error, "signInWithEmail");
      throw e;
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      const wasAnonymous = auth().currentUser?.isAnonymous === true;
      const result = await auth().createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.updateProfile({ displayName: name });
        // Update local user state immediately to reflect the new display name
        setUser({ ...result.user, displayName: name } as FirebaseAuthTypes.User);
      }
      await handleGuestMigration(result.user.uid, wasAnonymous);
      await logEvent("sign_up", { method: "email" });
    } catch (e) {
      logError(e as Error, "signUpWithEmail");
      throw e;
    }
  };

  const signInAsGuest = async () => {
    try {
      await auth().signInAnonymously();
      await logEvent("login", { method: "guest" });
    } catch (e) {
      logError(e as Error, "signInAsGuest");
      throw e;
    }
  };

  const signOut = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      return;
    }

    if (currentUser.isAnonymous) {
      await deleteGuestData();
      return;
    }

    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      // ── STEP 1: MANDATORY CLOUD BACKUP BEFORE LOGOUT ──────────────────────
      // Await full backup of personal data. If this fails (offline/network/error),
      // we throw immediately and abort logout so local data is NEVER lost.
      await syncAllUserDataBeforeLogout(currentUser.uid);

      // ── STEP 2: CLEAR LOCAL PERSONAL DATA & CANCEL NOTIFICATIONS ───────────
      // Only runs if cloud backup was 100% successful.
      await cancelAllNotifications();
      await clearAllLyfeOSLocalData();

      // ── STEP 3: RESET ANALYTICS IDENTITY ──────────────────────────────────
      try {
        await setAnalyticsUser("");
      } catch {}

      // ── STEP 4: SIGN OUT FROM AUTH PROVIDERS ──────────────────────────────
      await auth().signOut();
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut().catch(() => {});
      }

      setUser(null);
    } catch (e) {
      logError(e as Error, "signOut");
      throw e;
    } finally {
      setIsSigningOut(false);
    }
  };

  const reauthenticateWithEmail = async (password: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error("No authenticated email user found to re-authenticate.");
    }
    const credential = auth.EmailAuthProvider.credential(currentUser.email, password);
    await currentUser.reauthenticateWithCredential(credential);
  };

  const reauthenticateWithGoogle = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found to re-authenticate.");
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { data } = await GoogleSignin.signIn();
    const idToken = data?.idToken;
    if (!idToken) {
      throw new Error("Google re-authentication failed: No ID token returned.");
    }
    const credential = auth.GoogleAuthProvider.credential(idToken);
    await currentUser.reauthenticateWithCredential(credential);
  };

  const deleteAccountAndData = async (passwordForReauth?: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found.");
    }

    if (currentUser.isAnonymous) {
      // Guest users should be routed to deleteGuestData
      return deleteGuestData();
    }

    const uid = currentUser.uid;
    const providerId = currentUser.providerData[0]?.providerId;

    // ── STEP 1: RE-AUTHENTICATION FIRST ─────────────────────────────────────
    // Re-authenticate BEFORE touching any Firestore data or local data.
    // If re-authentication fails or is cancelled, NOTHING is deleted.
    if (providerId === "password" || providerId === auth.EmailAuthProvider.PROVIDER_ID) {
      if (!passwordForReauth) {
        const err: any = new Error("Password required for re-authentication.");
        err.code = "auth/requires-recent-login";
        throw err;
      }
      await reauthenticateWithEmail(passwordForReauth);
    } else if (providerId === "google.com" || providerId === auth.GoogleAuthProvider.PROVIDER_ID) {
      await reauthenticateWithGoogle();
    }

    // ── STEP 2: DESTRUCTIVE FIRESTORE DELETION ──────────────────────────────
    // Only executed after re-authentication has completely succeeded.
    // If Firestore deletion fails, throw immediately so auth account is NOT deleted.
    await deleteUserCloudData(uid);

    // ── STEP 3: FIREBASE AUTHENTICATION DELETION ─────────────────────────────
    // Delete the verified, freshly re-authenticated Firebase Auth user.
    await currentUser.delete();

    // ── STEP 4: LOCAL DATA CLEANUP ──────────────────────────────────────────
    // Clear all LyfeOS AsyncStorage keys and scheduled notifications.
    await cancelAllNotifications();
    await clearAllLyfeOSLocalData();

    // Reset analytics and tracking identifiers
    try {
      await setAnalyticsUser("");
    } catch {}

    // Sign out from Google Client if signed in
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut().catch(() => {});
    }

    // ── STEP 5: RESET IN-MEMORY AUTH STATE ───────────────────────────────────
    setUser(null);
  };

  const deleteGuestData = async () => {
    const currentUser = auth().currentUser;

    // 1. Delete anonymous Firebase Auth session if it exists
    if (currentUser && currentUser.isAnonymous) {
      try {
        await currentUser.delete();
      } catch {
        await auth().signOut().catch(() => {});
      }
    } else {
      await auth().signOut().catch(() => {});
    }

    // 2. Clear all local notifications and LyfeOS storage keys
    await cancelAllNotifications();
    await clearAllLyfeOSLocalData();

    // 3. Reset analytics identity
    try {
      await setAnalyticsUser("");
    } catch {}

    // 4. Reset auth state
    setUser(null);
  };

  const isGuest = user?.isAnonymous ?? false;

  // Removed blocking loading view to allow Expo Router to mount
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isInitializing: loading,
        isGuest,
        isSigningOut,
        migrationDone,
        clearMigrationDone,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInAsGuest,
        signOut,
        reauthenticateWithEmail,
        reauthenticateWithGoogle,
        deleteAccountAndData,
        deleteGuestData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
