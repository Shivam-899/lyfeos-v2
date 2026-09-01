import colors from "@/constants/colors";
import { useAppTheme } from "@/hooks/useAppTheme";

export function useColors() {
  const theme = useAppTheme();
  const basePalette = theme.isDark ? colors.dark : colors.light;

  return {
    ...basePalette,
    text: theme.TEXT,
    foreground: theme.TEXT,
    background: theme.BG,
    card: theme.CARD,
    cardForeground: theme.TEXT,
    border: theme.BORDER,
    input: theme.BORDER,
    muted: theme.isDark ? theme.CARD2 : "#F0F2F5",
    mutedForeground: theme.MUTED,
    primary: theme.ACCENT,
    tint: theme.ACCENT,
    radius: colors.radius,
  };
}
