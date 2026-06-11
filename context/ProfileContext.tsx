import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  const [userName, setUserNameState] = useState("LyfeOS User");
  // Bug 15 fix: default to empty string, set from storage or generate+save in effect
  const [joinDate, setJoinDate] = useState("");
  const [habitGoal, setHabitGoalState] = useState(5);
  const [activityGoal, setActivityGoalState] = useState(30);
  const [healthProfile, setHealthProfileState] = useState<HealthProfile>(DEFAULT_HEALTH);
  const [reminders, setRemindersState] = useState<Reminders>(DEFAULT_REMIND);
  const [preferences, setPreferencesState] = useState<Preferences>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const [name, join, hg, ag, health, remind, prefs] = await Promise.all([
          AsyncStorage.getItem(KEY_NAME),
          AsyncStorage.getItem(KEY_JOIN),
          AsyncStorage.getItem(KEY_HABIT_G),
          AsyncStorage.getItem(KEY_ACT_G),
          AsyncStorage.getItem(KEY_HEALTH),
          AsyncStorage.getItem(KEY_REMIND),
          AsyncStorage.getItem(KEY_PREFS),
        ]);
        if (name) setUserNameState(name);
        // Bug 15 fix: always generate+save joinDate on first launch; never leave it as empty
        if (join) {
          setJoinDate(join);
        } else {
          const now = new Date().toISOString();
          setJoinDate(now);
          await AsyncStorage.setItem(KEY_JOIN, now);
        }
        if (hg) setHabitGoalState(parseInt(hg) || 5);
        if (ag) setActivityGoalState(parseInt(ag) || 30);
        if (health) setHealthProfileState(JSON.parse(health));
        if (remind) setRemindersState(JSON.parse(remind));
        if (prefs) {
          // Merge stored prefs with defaults to handle new fields (habitEffectsEnabled)
          const stored = JSON.parse(prefs);
          setPreferencesState({ ...DEFAULT_PREFS, ...stored });
        }
      } catch {}
    })();
  }, []);

  const setUserName = useCallback(async (name: string) => {
    setUserNameState(name);
    await AsyncStorage.setItem(KEY_NAME, name);
  }, []);

  const setHabitGoal = useCallback(async (v: number) => {
    setHabitGoalState(v);
    await AsyncStorage.setItem(KEY_HABIT_G, String(v));
  }, []);

  const setActivityGoal = useCallback(async (v: number) => {
    setActivityGoalState(v);
    await AsyncStorage.setItem(KEY_ACT_G, String(v));
  }, []);

  const setHealthProfile = useCallback(async (p: HealthProfile) => {
    setHealthProfileState(p);
    await AsyncStorage.setItem(KEY_HEALTH, JSON.stringify(p));
  }, []);

  const setReminders = useCallback(async (r: Reminders) => {
    setRemindersState(r);
    await AsyncStorage.setItem(KEY_REMIND, JSON.stringify(r));
  }, []);

  const setPreferences = useCallback(async (p: Preferences) => {
    setPreferencesState(p);
    await AsyncStorage.setItem(KEY_PREFS, JSON.stringify(p));
  }, []);

  return (
    <ProfileContext.Provider value={{
      userName, setUserName, joinDate,
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
