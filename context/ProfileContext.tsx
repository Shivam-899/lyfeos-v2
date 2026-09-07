import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getStoredJson, getStoredString, setStoredJson, setStoredString } from "@/utils/storage";
import { fetchProfileFromCloud, syncProfileToCloud } from "@/utils/cloudSync";
import { logError } from "@/utils/analytics";
import { useAuth } from "./AuthContext";

export interface HealthProfile {
  age: string;
  sex: "male" | "female" | "other" | "";
  height: string;
  weight: string;
  activityLevel: "sedentary" | "lightly" | "moderately" | "very" | "";
  goal: "lose" | "maintain" | "muscle" | "fitness" | "";
}

export interface Reminders {
  morning: boolean;
  meal: boolean;
  water: boolean;
  evening: boolean;
}

export interface Preferences {
  units: "metric" | "imperial";
  calorieDisplay: "kcal" | "kj";
  habitEffectsEnabled: boolean; // Completion sound & celebration animation
}

interface ProfileContextType {
  userName: string;
  setUserName: (name: string) => void;
  joinDate: string;
  isProfileLoaded: boolean;
  habitGoal: number;
  setHabitGoal: (v: number) => void;
  activityGoal: number;
  setActivityGoal: (v: number) => void;
  healthProfile: HealthProfile;
  setHealthProfile: (p: HealthProfile) => void;
  reminders: Reminders;
  setReminders: (r: Reminders) => void;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const KEY_NAME     = "@lyfeos_profile_name_v1";
const KEY_JOIN     = "@lyfeos_profile_join_v1";
const KEY_HABIT_G  = "@lyfeos_profile_habitgoal_v1";
const KEY_ACT_G    = "@lyfeos_profile_actgoal_v1";
const KEY_HEALTH   = "@lyfeos_profile_health_v1";
const KEY_REMIND   = "@lyfeos_profile_reminders_v1";
const KEY_PREFS    = "@lyfeos_profile_prefs_v1";

const DEFAULT_HEALTH: HealthProfile = { age: "", sex: "", height: "", weight: "", activityLevel: "", goal: "" };
const DEFAULT_REMIND: Reminders = { morning: false, meal: false, water: false, evening: false };
const DEFAULT_PREFS: Preferences = { units: "metric", calorieDisplay: "kcal", habitEffectsEnabled: true };

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [userName, setUserNameState] = useState("LyfeOS User");
  // Bug 15 fix: default to empty string, set from storage or generate+save in effect
  const [joinDate, setJoinDate] = useState("");
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [habitGoal, setHabitGoalState] = useState(5);
  const [activityGoal, setActivityGoalState] = useState(30);
  const [healthProfile, setHealthProfileState] = useState<HealthProfile>(DEFAULT_HEALTH);
  const [reminders, setRemindersState] = useState<Reminders>(DEFAULT_REMIND);
  const [preferences, setPreferencesState] = useState<Preferences>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      const [name, join, hg, ag, health, remind, prefs] = await Promise.all([
        getStoredString(KEY_NAME),
        getStoredString(KEY_JOIN),
        getStoredString(KEY_HABIT_G),
        getStoredString(KEY_ACT_G),
        getStoredJson<HealthProfile>(KEY_HEALTH, DEFAULT_HEALTH),
        getStoredJson<Reminders>(KEY_REMIND, DEFAULT_REMIND),
        getStoredJson<Partial<Preferences>>(KEY_PREFS, {}),
      ]);
      setUserNameState(name || "LyfeOS User");
      // Bug 15 fix: always generate+save joinDate on first launch; never leave it as empty
      if (join) {
        setJoinDate(join);
      } else {
        const now = new Date().toISOString();
        setJoinDate(now);
        await setStoredString(KEY_JOIN, now);
      }
      setHabitGoalState(hg ? parseInt(hg) || 5 : 5);
      setActivityGoalState(ag ? parseInt(ag) || 30 : 30);
      setHealthProfileState(health);
      setRemindersState(remind);
      // Merge stored prefs with defaults to handle new fields (habitEffectsEnabled)
      setPreferencesState({ ...DEFAULT_PREFS, ...prefs });
      setIsProfileLoaded(true);

      // ── Cloud restore on login for authenticated non-guest users ──────
      if (user && !user.isAnonymous) {
        try {
          const cloudProfile = await fetchProfileFromCloud(user.uid);
          if (cloudProfile) {
            if (cloudProfile.userName && (!name || name === "LyfeOS User")) {
              setUserNameState(cloudProfile.userName);
              await setStoredString(KEY_NAME, cloudProfile.userName);
            }
            if (cloudProfile.joinDate) {
              setJoinDate(cloudProfile.joinDate);
              await setStoredString(KEY_JOIN, cloudProfile.joinDate);
            }
            if (cloudProfile.habitGoal !== undefined && !hg) {
              setHabitGoalState(cloudProfile.habitGoal);
              await setStoredString(KEY_HABIT_G, String(cloudProfile.habitGoal));
            }
            if (cloudProfile.activityGoal !== undefined && !ag) {
              setActivityGoalState(cloudProfile.activityGoal);
              await setStoredString(KEY_ACT_G, String(cloudProfile.activityGoal));
            }
            // If local health profile is default/empty, restore from cloud
            const isLocalHealthEmpty = !health.age && !health.weight && !health.height && !health.activityLevel;
            if (cloudProfile.healthProfile && isLocalHealthEmpty) {
              setHealthProfileState(cloudProfile.healthProfile);
              await setStoredJson(KEY_HEALTH, cloudProfile.healthProfile);
            }
            // If local reminders are default, restore from cloud
            const isLocalRemindEmpty = !remind.morning && !remind.meal && !remind.water && !remind.evening;
            if (cloudProfile.reminders && isLocalRemindEmpty) {
              setRemindersState(cloudProfile.reminders);
              await setStoredJson(KEY_REMIND, cloudProfile.reminders);
            }
            // Restore preferences if present
            if (cloudProfile.preferences) {
              const merged = { ...DEFAULT_PREFS, ...prefs, ...cloudProfile.preferences };
              setPreferencesState(merged);
              await setStoredJson(KEY_PREFS, merged);
            }
          }
        } catch (e) {
          logError(e as Error, "fetchProfileFromCloud_onMount");
        }
      }
    })();
  }, [user]);

  const setUserName = useCallback(async (name: string) => {
    setUserNameState(name);
    await setStoredString(KEY_NAME, name);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { userName: name }).catch((e) => logError(e, "sync_userName"));
    }
  }, []);

  const setHabitGoal = useCallback(async (v: number) => {
    setHabitGoalState(v);
    await setStoredString(KEY_HABIT_G, String(v));
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { habitGoal: v }).catch((e) => logError(e, "sync_habitGoal"));
    }
  }, []);

  const setActivityGoal = useCallback(async (v: number) => {
    setActivityGoalState(v);
    await setStoredString(KEY_ACT_G, String(v));
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { activityGoal: v }).catch((e) => logError(e, "sync_actGoal"));
    }
  }, []);

  const setHealthProfile = useCallback(async (p: HealthProfile) => {
    setHealthProfileState(p);
    await setStoredJson(KEY_HEALTH, p);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { healthProfile: p }).catch((e) => logError(e, "sync_healthProfile"));
    }
  }, []);

  const setReminders = useCallback(async (r: Reminders) => {
    setRemindersState(r);
    await setStoredJson(KEY_REMIND, r);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { reminders: r }).catch((e) => logError(e, "sync_reminders"));
    }
  }, []);

  const setPreferences = useCallback(async (p: Preferences) => {
    setPreferencesState(p);
    await setStoredJson(KEY_PREFS, p);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, { preferences: p }).catch((e) => logError(e, "sync_prefs"));
    }
  }, []);

  return (
    <ProfileContext.Provider value={{
      userName, setUserName, joinDate, isProfileLoaded,
      habitGoal, setHabitGoal,
      activityGoal, setActivityGoal,
      healthProfile, setHealthProfile,
      reminders, setReminders,
      preferences, setPreferences,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
