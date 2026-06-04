import { useMemo } from "react";

import { useTheme } from "@/context/ThemeContext";

export const DARK_TOKENS = {
  BG:      "#0F0F0F",
  CARD:    "#1E1E1E",
  CARD2:   "#252525",
  BORDER:  "#2A2A2A",
  MUTED:   "#6B7280",
  SUBTEXT: "#9CA3AF",
  TEXT:    "#F0F0F0",
  // brand / status — same in both modes
  ACCENT:  "#FF6B35",
  GREEN:   "#22C55E",
  BLUE:    "#3B82F6",
  YELLOW:  "#EAB308",
  RED:     "#EF4444",
  isDark:  true as const,
};

export const LIGHT_TOKENS = {
  BG:      "#F3F4F6",
  CARD:    "#FFFFFF",
  CARD2:   "#F9FAFB",
  BORDER:  "#E5E7EB",
  MUTED:   "#6B7280",
  SUBTEXT: "#9CA3AF",
  TEXT:    "#111827",
  // brand / status — same in both modes
  ACCENT:  "#FF6B35",
  GREEN:   "#16A34A",
  BLUE:    "#2563EB",
  YELLOW:  "#D97706",
  RED:     "#DC2626",
  isDark:  false as const,
};

export type AppTheme = typeof DARK_TOKENS | typeof LIGHT_TOKENS;

export type AppThemeWithMode = AppTheme & {
  mode: import("@/context/ThemeContext").ThemeMode;
  setMode: (m: import("@/context/ThemeContext").ThemeMode) => void;
};

export function useAppTheme(): AppThemeWithMode {
  const { isDark, mode, setMode } = useTheme();
  return useMemo(
    () => ({ ...(isDark ? DARK_TOKENS : LIGHT_TOKENS), mode, setMode }),
    [isDark, mode, setMode]
  );
}
