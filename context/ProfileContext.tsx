import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getStoredJson, getStoredString, setStoredJson, setStoredString } from "@/utils/storage";
import {
  fetchProfileFromCloud,
  syncProfileToCloud,
  mergeProfileData,
  ProfileSyncData,
  ProfileSectionTimestamps,
} from "@/utils/cloudSync";
import { logError } from "@/utils/analytics";
import { requestScheduleRefresh } from "@/utils/notifications";
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
const KEY_META     = "@lyfeos_profile_meta_v1";

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
      const [name, join, hg, ag, health, remind, prefs, meta] = await Promise.all([
        getStoredString(KEY_NAME),
        getStoredString(KEY_JOIN),
        getStoredString(KEY_HABIT_G),
        getStoredString(KEY_ACT_G),
        getStoredJson<HealthProfile>(KEY_HEALTH, DEFAULT_HEALTH),
        getStoredJson<Reminders>(KEY_REMIND, DEFAULT_REMIND),
        getStoredJson<Partial<Preferences>>(KEY_PREFS, {}),
        getStoredJson<{ sectionTimestamps?: ProfileSectionTimestamps }>(KEY_META, {}),
      ]);
      setUserNameState(name || "LyfeOS User");
      // Bug 15 fix: always generate+save joinDate on first launch; never leave it as empty
      let currentJoin = join;
      if (currentJoin) {
        setJoinDate(currentJoin);
      } else {
        currentJoin = new Date().toISOString();
        setJoinDate(currentJoin);
        await setStoredString(KEY_JOIN, currentJoin);
      }
      setHabitGoalState(hg ? parseInt(hg) || 5 : 5);
      setActivityGoalState(ag ? parseInt(ag) || 30 : 30);
      setHealthProfileState(health);
      setRemindersState(remind);
      // Merge stored prefs with defaults to handle new fields (habitEffectsEnabled)
      setPreferencesState({ ...DEFAULT_PREFS, ...prefs });

      // ── Cloud restore on login for authenticated non-guest users ──────
      if (user && !user.isAnonymous) {
        try {
          const cloudProfile = await fetchProfileFromCloud(user.uid);
          if (cloudProfile) {
            const localProfile: ProfileSyncData = {
              userName: name || "LyfeOS User",
              joinDate: currentJoin,
              habitGoal: hg ? parseInt(hg) || 5 : 5,
              activityGoal: ag ? parseInt(ag) || 30 : 30,
              healthProfile: health,
              reminders: remind,
              preferences: { ...DEFAULT_PREFS, ...prefs },
              sectionTimestamps: meta?.sectionTimestamps || {},
            };
            const merged = mergeProfileData(localProfile, cloudProfile);

            setUserNameState(merged.userName);
            setJoinDate(merged.joinDate);
            setHabitGoalState(merged.habitGoal);
            setActivityGoalState(merged.activityGoal);
            setHealthProfileState(merged.healthProfile);
            setRemindersState(merged.reminders);
            setPreferencesState(merged.preferences);

            await Promise.all([
              setStoredString(KEY_NAME, merged.userName),
              setStoredString(KEY_JOIN, merged.joinDate),
              setStoredString(KEY_HABIT_G, String(merged.habitGoal)),
              setStoredString(KEY_ACT_G, String(merged.activityGoal)),
              setStoredJson(KEY_HEALTH, merged.healthProfile),
              setStoredJson(KEY_REMIND, merged.reminders),
              setStoredJson(KEY_PREFS, merged.preferences),
              setStoredJson(KEY_META, { sectionTimestamps: merged.sectionTimestamps }),
            ]);

            // Synchronize notification schedule with restored cloud preferences
            await requestScheduleRefresh({
              reason: "cloud_profile_restored",
              userId: user.uid,
              reminders: merged.reminders,
            });
          }
        } catch (e) {
          logError(e as Error, "fetchProfileFromCloud_onMount");
        }
      }
      setIsProfileLoaded(true);
    })();
  }, [user]);

  const updateSectionTimestamp = async (section: keyof ProfileSectionTimestamps, ts: number) => {
    try {
      const meta = await getStoredJson<{ sectionTimestamps?: ProfileSectionTimestamps }>(KEY_META, {});
      const nextTimestamps = { ...(meta?.sectionTimestamps || {}), [section]: ts };
      await setStoredJson(KEY_META, { sectionTimestamps: nextTimestamps });
    } catch (e) {
      logError(e as Error, "updateSectionTimestamp");
    }
  };

  const setUserName = useCallback(async (name: string) => {
    const now = Date.now();
    setUserNameState(name);
    await Promise.all([
      setStoredString(KEY_NAME, name),
      updateSectionTimestamp("userName", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        userName: name,
        userNameUpdatedAt: now,
      }).catch((e) => logError(e, "sync_userName"));
    }
  }, []);

  const setHabitGoal = useCallback(async (v: number) => {
    const now = Date.now();
    setHabitGoalState(v);
    await Promise.all([
      setStoredString(KEY_HABIT_G, String(v)),
      updateSectionTimestamp("habitGoal", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        habitGoal: v,
        habitGoalUpdatedAt: now,
      }).catch((e) => logError(e, "sync_habitGoal"));
    }
  }, []);

  const setActivityGoal = useCallback(async (v: number) => {
    const now = Date.now();
    setActivityGoalState(v);
    await Promise.all([
      setStoredString(KEY_ACT_G, String(v)),
      updateSectionTimestamp("activityGoal", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        activityGoal: v,
        activityGoalUpdatedAt: now,
      }).catch((e) => logError(e, "sync_actGoal"));
    }
  }, []);

  const setHealthProfile = useCallback(async (p: HealthProfile) => {
    const now = Date.now();
    setHealthProfileState(p);
    await Promise.all([
      setStoredJson(KEY_HEALTH, p),
      updateSectionTimestamp("healthProfile", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        healthProfile: p,
        healthProfileUpdatedAt: now,
      }).catch((e) => logError(e, "sync_healthProfile"));
    }
  }, []);

  const setReminders = useCallback(async (r: Reminders) => {
    const now = Date.now();
    setRemindersState(r);
    await Promise.all([
      setStoredJson(KEY_REMIND, r),
      updateSectionTimestamp("reminders", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        reminders: r,
        remindersUpdatedAt: now,
      }).catch((e) => logError(e, "sync_reminders"));
    }
  }, []);

  const setPreferences = useCallback(async (p: Preferences) => {
    const now = Date.now();
    setPreferencesState(p);
    await Promise.all([
      setStoredJson(KEY_PREFS, p),
      updateSectionTimestamp("preferences", now),
    ]);
    const currentUser = userRef.current;
    if (currentUser && !currentUser.isAnonymous) {
      syncProfileToCloud(currentUser.uid, {
        preferences: p,
        preferencesUpdatedAt: now,
      }).catch((e) => logError(e, "sync_prefs"));
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
