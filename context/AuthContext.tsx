import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logEvent, logError, setAnalyticsUser, clearAllAnalyticsAndCrashlyticsIdentity } from "@/utils/analytics";
import { migrateGuestDataToAccount, deleteUserCloudData, syncAllUserDataBeforeLogout } from "@/utils/cloudSync";
import {
  getStoredJson,
  getStoredString,
  clearAllLyfeOSLocalData,
  hasMeaningfulGuestData,
  getPendingMigrationCheckpoint,
  setPendingMigrationCheckpoint,
  clearPendingMigrationCheckpoint,
} from "@/utils/storage";
import { cancelAllNotifications } from "@/utils/notifications";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  isInitializing: boolean; // Kept for backward compatibility with existing layout routing
  isGuest: boolean;
  isSigningOut: boolean;
  isPendingMigrationResolution: boolean;
  setPendingMigrationResolution: (pending: boolean) => void;
  discardGuestDataAndProceed: () => Promise<void>;
  mergeGuestDataAndProceed: () => Promise<void>;
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
  const [isPendingMigrationResolution, setIsPendingMigrationResolution] = useState(false);

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: "66808080139-r6t78lrsqsoabug2jlrltb1bbevt2003.apps.googleusercontent.com",
    });

    // Auth state listener:
    const subscriber = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && !firebaseUser.isAnonymous) {
        try {
          const checkpoint = await getPendingMigrationCheckpoint();
          if (checkpoint) {
            if (checkpoint.targetUid === firebaseUser.uid) {
              // Valid pending migration checkpoint for this authenticated user: restore pending resolution
              setIsPendingMigrationResolution(true);
            } else {
              // Stale checkpoint from a different account:
              // Strictly protect against UID mismatch.
              // Invalidate stale checkpoint without touching cloud or local data.
              console.warn(
                `[Auth] Stale migration checkpoint for ${checkpoint.targetUid} does not match current user ${firebaseUser.uid}. Invalidating.`
              );
              await clearPendingMigrationCheckpoint();
              setIsPendingMigrationResolution(false);
            }
          }
        } catch (err) {
          logError(err as Error, "onAuthStateChanged:checkpoint");
        }
      } else if (!firebaseUser) {
        // If no user is authenticated, clear any leftover stale checkpoint
        try {
          const checkpoint = await getPendingMigrationCheckpoint();
          if (checkpoint) {
            await clearPendingMigrationCheckpoint();
          }
        } catch {}
        setIsPendingMigrationResolution(false);
      }
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
      const [
        localHabits,
        localHabitLogs,
        localTodos,
        localFood,
        localWater,
        localMeta,
        localGoal,
        localGoalsConfigured,
        localActivityLogs,
        localStepsLogs,
        localProfileName,
        localProfileJoin,
        localProfileHabitGoal,
        localProfileActGoal,
        localHealth,
        localReminders,
        localPrefs,
        localProfileMeta,
      ] = await Promise.all([
        getStoredJson<any[]>("@lyfeos_habits_v2", []),
        getStoredJson<any[]>("@lyfeos_habit_logs_v2", []),
        getStoredJson<any[]>("@lyfeos_todos_v2", []),
        getStoredJson<any[]>("@lyfeos_food_v2", []),
        getStoredJson<any[]>("@lyfeos_water_v2", []),
        getStoredJson<{ lastModified?: number }>("@lyfeos_food_meta_v1", { lastModified: 0 }),
        getStoredJson<any>("@lyfeos_goal_v2", null),
        getStoredString("@lyfeos_goals_configured_v1"),
        getStoredJson<any[]>("@lyfeos_activity_logs_v1", []),
        getStoredJson<any[]>("@lyfeos_steps_v1", []),
        getStoredString("@lyfeos_profile_name_v1"),
        getStoredString("@lyfeos_profile_join_v1"),
        getStoredString("@lyfeos_profile_habitgoal_v1"),
        getStoredString("@lyfeos_profile_actgoal_v1"),
        getStoredJson<any>("@lyfeos_profile_health_v1", null),
        getStoredJson<any>("@lyfeos_profile_reminders_v1", null),
        getStoredJson<any>("@lyfeos_profile_prefs_v1", null),
        getStoredJson<any>("@lyfeos_profile_meta_v1", {}),
      ]);

      const isHealthCustom = localHealth && Object.values(localHealth).some((v) => v !== "" && v !== undefined && v !== null);
      const isRemindersCustom = localReminders && Object.values(localReminders).some((v) => v === true);
      const isNameCustom = localProfileName && localProfileName !== "LyfeOS User";
      const isHabitGoalCustom = localProfileHabitGoal && localProfileHabitGoal !== "5";
      const isActGoalCustom = localProfileActGoal && localProfileActGoal !== "30";
      const isPrefsCustom = localPrefs && Object.keys(localPrefs).length > 0;
      const hasProfileData = isHealthCustom || isRemindersCustom || isNameCustom || isHabitGoalCustom || isActGoalCustom || isPrefsCustom;

      const hasData =
        localHabits.length > 0 ||
        localHabitLogs.length > 0 ||
        localTodos.length > 0 ||
        localFood.length > 0 ||
        localWater.length > 0 ||
        localActivityLogs.length > 0 ||
        localStepsLogs.length > 0 ||
        localGoalsConfigured === "true" ||
        hasProfileData;

      // Only migrate if there's actual guest data
      if (hasData) {
        const guestPayload: any = {
          habits: localHabits,
          habitLogs: localHabitLogs,
          todos: localTodos,
          foodItems: localFood,
          waterLogs: localWater,
          lastModified: localMeta.lastModified || Date.now(),
          dailyGoal: localGoal ?? undefined,
          goalsConfigured: localGoalsConfigured !== null ? localGoalsConfigured === "true" : undefined,
          activityLogs: localActivityLogs,
          stepsLogs: localStepsLogs,
        };
        if (hasProfileData || localProfileName || localHealth) {
          guestPayload.profile = {
            userName: localProfileName || undefined,
            joinDate: localProfileJoin || undefined,
            habitGoal: localProfileHabitGoal ? parseInt(localProfileHabitGoal, 10) || 5 : undefined,
            activityGoal: localProfileActGoal ? parseInt(localProfileActGoal, 10) || 30 : undefined,
            healthProfile: localHealth || undefined,
            reminders: localReminders || undefined,
            preferences: localPrefs || undefined,
            sectionTimestamps: localProfileMeta?.sectionTimestamps || {},
          };
        }
        const success = await migrateGuestDataToAccount(newUid, guestPayload);
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
      const anonUser = auth().currentUser;
      const isAnon = anonUser?.isAnonymous === true;

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      const idToken = data?.idToken;

      if (!idToken) {
        throw new Error("No ID token found");
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      if (isAnon && anonUser) {
        try {
          // Preferred Phase 2A Path: Attempt to link Google credential to anonymous user.
          // If this is a new Google account, linking succeeds, converting the anonymous UID
          // into the permanent account UID without creating an orphan anonymous account.
          const result = await anonUser.linkWithCredential(googleCredential);
          if (result.user) {
            setUser(result.user);
          }
          // Do NOT call handleGuestMigration: The UID has not changed.
          // Existing local data remains attached to this session.
          await logEvent("sign_up", { method: "google" });
          return;
        } catch (linkError: any) {
          if (linkError.code === "auth/credential-already-in-use" || linkError.code === "auth/email-already-in-use") {
            // Existing Google account login on top of an anonymous session:
            const hasGuestData = await hasMeaningfulGuestData();
            // Authenticate the existing account:
            const result = await auth().signInWithCredential(googleCredential);
            const isNewUser = result.additionalUserInfo?.isNewUser ?? false;

            if (!isNewUser && hasGuestData) {
              // Existing account with meaningful guest data:
              // Record persistent checkpoint before setting pending state (Phase 2B-2)
              await setPendingMigrationCheckpoint({
                version: 1,
                targetUid: result.user.uid,
                createdAt: Date.now(),
                status: "pending",
              });
              setIsPendingMigrationResolution(true);
            } else if (!hasGuestData) {
              await clearAllLyfeOSLocalData();
            }
            // DO NOT call handleGuestMigration() - prevents blind additive merge into existing account.
            await logEvent("login", { method: "google" });
            return;
          }
          logError(linkError as Error, "signInWithGoogle:linkWithCredential");
          throw linkError;
        }
      }

      // Standard Google sign-in path (not anonymous)
      await auth().signInWithCredential(googleCredential);
      await logEvent("login", { method: "google" });
    } catch (e) {
      logError(e as Error, "signInWithGoogle");
      throw e;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const wasAnonymous = auth().currentUser?.isAnonymous === true;
      const hasGuestData = wasAnonymous ? await hasMeaningfulGuestData() : false;
      const result = await auth().signInWithEmailAndPassword(email, password);

      const isNewUser = result.additionalUserInfo?.isNewUser ?? false;

      if (wasAnonymous && !isNewUser && hasGuestData) {
        // Existing account login with meaningful guest data:
        // Record persistent checkpoint before setting pending state (Phase 2B-2)
        await setPendingMigrationCheckpoint({
          version: 1,
          targetUid: result.user.uid,
          createdAt: Date.now(),
          status: "pending",
        });
        setIsPendingMigrationResolution(true);
      } else if (wasAnonymous && !hasGuestData) {
        // Guest session had no meaningful data; clean up empty guest state
        await clearAllLyfeOSLocalData();
      }
      // If wasAnonymous && !hasGuestData, or !wasAnonymous:
      // Normal login proceeds with zero migration.
      await logEvent("login", { method: "email" });
    } catch (e) {
      logError(e as Error, "signInWithEmail");
      throw e;
    }
  };


  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      const anonUser = auth().currentUser;
      const isAnon = anonUser?.isAnonymous === true;

      if (isAnon && anonUser) {
        // Preferred Phase 2A Path: Link email credential to existing anonymous user.
        // Converts the anonymous account into a permanent email account with the SAME UID.
        // Zero orphan anonymous accounts are created, and guest data remains attached to this UID.
        const credential = auth.EmailAuthProvider.credential(email, password);
        const result = await anonUser.linkWithCredential(credential);
        if (result.user) {
          await result.user.updateProfile({ displayName: name });
          // Update local user state immediately to reflect the new display name
          setUser({ ...result.user, displayName: name } as FirebaseAuthTypes.User);
        }
        // Do NOT call handleGuestMigration: The UID has not changed.
        // Existing local data in AsyncStorage is already associated with this UID.
        await logEvent("sign_up", { method: "email" });
        return;
      }

      // Standard registration path (fresh user without prior anonymous session)
      const result = await auth().createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.updateProfile({ displayName: name });
        // Update local user state immediately to reflect the new display name
        setUser({ ...result.user, displayName: name } as FirebaseAuthTypes.User);
      }
      await handleGuestMigration(result.user.uid, false);
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

      // Clear any pending migration checkpoint and reset state
      await clearPendingMigrationCheckpoint().catch(() => {});
      setIsPendingMigrationResolution(false);

      // ── STEP 3: RESET ANALYTICS & OBSERVABILITY IDENTITY ──────────────────
      try {
        await clearAllAnalyticsAndCrashlyticsIdentity();
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
    await clearPendingMigrationCheckpoint().catch(() => {});
    setIsPendingMigrationResolution(false);

    // Reset analytics and tracking identifiers
    try {
      await clearAllAnalyticsAndCrashlyticsIdentity();
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
    await clearPendingMigrationCheckpoint().catch(() => {});
    setIsPendingMigrationResolution(false);

    // 3. Reset analytics identity
    try {
      await clearAllAnalyticsAndCrashlyticsIdentity();
    } catch {}

    // 4. Reset auth state
    setUser(null);
  };

  // ── PHASE 2B-2: DISCARD GUEST DATA & PROCEED ──────────────────────────────
  const discardGuestDataAndProceed = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      throw new Error("No authenticated account found for discard.");
    }
    const checkpoint = await getPendingMigrationCheckpoint();
    if (!checkpoint || checkpoint.targetUid !== currentUser.uid) {
      throw new Error("No valid pending migration checkpoint found for this account.");
    }

    try {
      // 1. Clear local guest data
      const cleared = await clearAllLyfeOSLocalData();
      if (!cleared) {
        throw new Error("Failed to clear local guest data.");
      }

      // 2. Clear guest notifications
      await cancelAllNotifications().catch(() => {});

      // 3. Clear checkpoint and pending state
      await clearPendingMigrationCheckpoint();
      setIsPendingMigrationResolution(false);

      // 4. Update analytics identity to target authenticated user
      try {
        await setAnalyticsUser(currentUser.uid);
      } catch {}
    } catch (e) {
      logError(e as Error, "discardGuestDataAndProceed");
      throw e;
    }
  };

  // ── PHASE 2B-2: MERGE GUEST DATA & PROCEED ────────────────────────────────
  const mergeGuestDataAndProceed = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser || currentUser.isAnonymous) {
      throw new Error("No authenticated account found for merge.");
    }
    const checkpoint = await getPendingMigrationCheckpoint();
    if (!checkpoint || checkpoint.targetUid !== currentUser.uid) {
      throw new Error("No valid pending migration checkpoint found for this account.");
    }

    try {
      // 1. Read current local guest data using authoritative versioned keys
      const [
        localHabits,
        localHabitLogs,
        localTodos,
        localFood,
        localWater,
        localMeta,
        localGoal,
        localGoalsConfigured,
        localActivityLogs,
        localStepsLogs,
        localProfileName,
        localProfileJoin,
        localProfileHabitGoal,
        localProfileActGoal,
        localHealth,
        localReminders,
        localPrefs,
        localProfileMeta,
      ] = await Promise.all([
        getStoredJson<any[]>("@lyfeos_habits_v2", []),
        getStoredJson<any[]>("@lyfeos_habit_logs_v2", []),
        getStoredJson<any[]>("@lyfeos_todos_v2", []),
        getStoredJson<any[]>("@lyfeos_food_v2", []),
        getStoredJson<any[]>("@lyfeos_water_v2", []),
        getStoredJson<{ lastModified?: number }>("@lyfeos_food_meta_v1", { lastModified: 0 }),
        getStoredJson<any>("@lyfeos_goal_v2", null),
        getStoredString("@lyfeos_goals_configured_v1"),
        getStoredJson<any[]>("@lyfeos_activity_logs_v1", []),
        getStoredJson<any[]>("@lyfeos_steps_v1", []),
        getStoredString("@lyfeos_profile_name_v1"),
        getStoredString("@lyfeos_profile_join_v1"),
        getStoredString("@lyfeos_profile_habitgoal_v1"),
        getStoredString("@lyfeos_profile_actgoal_v1"),
        getStoredJson<any>("@lyfeos_profile_health_v1", null),
        getStoredJson<any>("@lyfeos_profile_reminders_v1", null),
        getStoredJson<any>("@lyfeos_profile_prefs_v1", null),
        getStoredJson<any>("@lyfeos_profile_meta_v1", {}),
      ]);

      const guestPayload: any = {
        habits: localHabits,
        habitLogs: localHabitLogs,
        todos: localTodos,
        foodItems: localFood,
        waterLogs: localWater,
        lastModified: localMeta.lastModified || Date.now(),
        dailyGoal: localGoal ?? undefined,
        goalsConfigured: localGoalsConfigured !== null ? localGoalsConfigured === "true" : undefined,
        activityLogs: localActivityLogs,
        stepsLogs: localStepsLogs,
      };

      if (localProfileName || localHealth || localReminders || localPrefs || localProfileHabitGoal || localProfileActGoal) {
        guestPayload.profile = {
          userName: localProfileName || undefined,
          joinDate: localProfileJoin || undefined,
          habitGoal: localProfileHabitGoal ? parseInt(localProfileHabitGoal, 10) || 5 : undefined,
          activityGoal: localProfileActGoal ? parseInt(localProfileActGoal, 10) || 30 : undefined,
          healthProfile: localHealth || undefined,
          reminders: localReminders || undefined,
          preferences: localPrefs || undefined,
          sectionTimestamps: localProfileMeta?.sectionTimestamps || {},
        };
      }

      // 2. Perform non-destructive cloud merge if not already marked cloud_merged
      if (checkpoint.status !== "cloud_merged") {
        const success = await migrateGuestDataToAccount(currentUser.uid, guestPayload);
        if (!success) {
          throw new Error("Failed to merge guest data into cloud account.");
        }
        // Mark checkpoint as cloud_merged in case subsequent steps encounter failure
        await setPendingMigrationCheckpoint({
          ...checkpoint,
          status: "cloud_merged",
        });
      }

      // 3. Clear checkpoint and pending state
      await clearPendingMigrationCheckpoint();
      setIsPendingMigrationResolution(false);
      setMigrationDone(true);

      // 4. Update analytics identity to target authenticated user
      try {
        await setAnalyticsUser(currentUser.uid);
      } catch {}
    } catch (e) {
      logError(e as Error, "mergeGuestDataAndProceed");
      throw e;
    }
  };

  const effectiveUser = isPendingMigrationResolution ? null : user;
  const isGuest = effectiveUser?.isAnonymous ?? false;

  // Removed blocking loading view to allow Expo Router to mount
  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        loading,
        isInitializing: loading,
        isGuest,
        isSigningOut,
        isPendingMigrationResolution,
        setPendingMigrationResolution: setIsPendingMigrationResolution,
        discardGuestDataAndProceed,
        mergeGuestDataAndProceed,
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
