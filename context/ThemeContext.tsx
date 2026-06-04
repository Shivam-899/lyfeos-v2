import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "system" | "dark" | "light";

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const KEY = "@lyfeos_theme_mode_v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      if (val === "system" || val === "dark" || val === "light") {
        setModeState(val as ThemeMode);
      }
    });
  }, []);

  const isDark =
    mode === "system"
      ? systemScheme !== "light"
      : mode === "dark";

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await AsyncStorage.setItem(KEY, m);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
