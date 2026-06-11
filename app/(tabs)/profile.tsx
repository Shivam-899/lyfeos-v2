import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCalories } from "@/context/CaloriesContext";
import { useHabits } from "@/context/HabitsContext";
import { HealthProfile, useProfile } from "@/context/ProfileContext";
import { useTodos } from "@/context/TodosContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";
import { ThemeMode } from "@/context/ThemeContext";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";

// ── Day labels ────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Achievements definition ───────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first_step",   emoji: "🌱", name: "First Step",    desc: "Log your first habit",                     how: "Complete any habit for the first time" },
  { id: "on_fire",      emoji: "🔥", name: "On Fire",       desc: "7-day habit streak",                       how: "Maintain a streak of 7 consecutive days on any habit" },
  { id: "consistent",   emoji: "💪", name: "Consistent",    desc: "30 habits completed",                      how: "Complete a total of 30 habits across all time" },
  { id: "nutrition_pro",emoji: "🥗", name: "Nutrition Pro", desc: "Logged meals 7 days",                      how: "Log at least one meal on 7 different days" },
  { id: "hydrated",     emoji: "💧", name: "Hydrated",      desc: "Hit water goal 7 days in a row",           how: "Meet your daily water goal for 7 consecutive days" },
  { id: "unstoppable",  emoji: "🏆", name: "Unstoppable",   desc: "30-day habit streak",                      how: "Maintain a streak of 30 consecutive days on any habit" },
  { id: "all_rounder",  emoji: "⭐", name: "All Rounder",   desc: "Complete habits + tasks + nutrition in one day", how: "Log habits, a task, and a meal all on the same day" },
  { id: "mover",        emoji: "🏃", name: "Mover",         desc: "Log 10 activities",                        how: "Coming soon — activity logging is on the way!" },
];

// ── Goal presets (Mifflin-St Jeor BMR) ───────────────────────────────────────
function calcGoals(hp: HealthProfile): { calories: number; carbs: number; protein: number; fat: number } | null {
  const age = parseInt(hp.age);
  const h   = parseInt(hp.height);
  const w   = parseInt(hp.weight);
  if (!age || !h || !w || !hp.sex || !hp.activityLevel || !hp.goal) return null;

  const bmr = hp.sex === "male"
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161;

  const mult = { sedentary: 1.2, lightly: 1.375, moderately: 1.55, very: 1.725 }[hp.activityLevel] ?? 1.375;
  const adj  = { lose: -500, maintain: 0, muscle: +300, fitness: 0 }[hp.goal] ?? 0;
  const cal  = Math.round(bmr * mult + adj);

  const proteinPct = hp.goal === "muscle" ? 0.30 : 0.25;
  const carbsPct   = hp.goal === "lose"   ? 0.40 : 0.50;
  const fatPct     = 1 - proteinPct - carbsPct;

  return {
    calories: cal,
    carbs:    Math.round((cal * carbsPct) / 4),
    protein:  Math.round((cal * proteinPct) / 4),
    fat:      Math.round((cal * fatPct) / 9),
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function formatJoinDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch { return ""; }
}

function isoDate(d: Date) { return getLocalDateString(d); }

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return isoDate(d);
  });
}

// ── Shared sheet styles ───────────────────────────────────────────────────────
const makeSt = (t: AppTheme) => StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  handle: { width: 40, height: 4, backgroundColor: t.BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, color: t.TEXT, marginBottom: 20 },
  smallSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10 },
  goalInputRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  goalInput: { flex: 1, backgroundColor: t.CARD2, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 28, fontWeight: "700" as const, color: t.TEXT, textAlign: "center" },
  goalUnit: { fontSize: 16, color: t.MUTED, fontWeight: "600" as const },
  sheetSaveBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  sheetSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: t.BORDER },
  settingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 14, fontWeight: "600" as const, color: t.TEXT, marginBottom: 2 },
  settingSub: { fontSize: 11, color: t.MUTED },
  badgeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  badgePopup: { borderRadius: 24, padding: 28, alignItems: "center", minWidth: 280, maxWidth: 320, borderWidth: 1, borderColor: t.BORDER },
  badgePopupEmoji: { fontSize: 52, marginBottom: 10 },
  badgePopupName: { fontSize: 20, fontWeight: "800" as const, color: t.TEXT, marginBottom: 6 },
  badgePopupDesc: { fontSize: 13, color: t.MUTED, textAlign: "center", marginBottom: 16 },
  badgePopupDivider: { width: "100%", height: 1, marginBottom: 16 },
  badgePopupHow: { fontSize: 13, color: t.GREEN, textAlign: "center", marginBottom: 20, fontWeight: "600" as const },
  badgePopupBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14 },
  badgePopupBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, gap: 0 },

  // Identity
  identityCard: { backgroundColor: t.CARD, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: t.BORDER, position: "relative" },
  editModeBtn: { position: "absolute", top: 16, right: 16, padding: 8 },
  avatarWrap: { position: "relative", marginBottom: 14 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: ACCENT, padding: 3 },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  avatarPlaceholder: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 26, fontWeight: "800" as const, color: ACCENT },
  avatarCameraOverlay: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: t.CARD },
  identityName: { fontSize: 22, fontWeight: "800" as const, color: t.TEXT, marginBottom: 4 },
  nameInput: { fontSize: 22, fontWeight: "800" as const, color: ACCENT, borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: 4, marginBottom: 4, minWidth: 160, textAlign: "center" },
  identityJoin: { fontSize: 12, color: t.MUTED, marginBottom: 12, fontWeight: "500" as const },
  streakPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  streakPillText: { fontSize: 13, fontWeight: "700" as const, color: ACCENT },
  editActions: { marginTop: 16, alignItems: "center", gap: 10, width: "100%" },
  saveEditBtn: { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveEditBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
  cancelEditText: { fontSize: 14, color: t.MUTED },

  // Goals
  goalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.BORDER, gap: 10 },
  goalRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  goalRowLabel: { flex: 1, fontSize: 14, fontWeight: "600" as const, color: t.TEXT },
  goalRowValue: { fontSize: 16, fontWeight: "700" as const, color: ACCENT },
  goalRowUnit: { fontSize: 10, fontWeight: "400" as const, color: t.MUTED },

  // Stats grid
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCell: { borderRadius: 14, padding: 12, alignItems: "center", gap: 4, width: "31%", flex: 1 },
  statValue: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: t.MUTED, textAlign: "center", fontWeight: "600" as const },

  // Weekly report
  weekRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  weekItem: { flex: 1, borderRadius: 12, padding: 10, gap: 3 },
  weekItemLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const },
  weekItemValue: { fontSize: 14, fontWeight: "700" as const },
  weekItemSub: { fontSize: 10, color: t.MUTED },
  weekExpandBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.BORDER, marginTop: 4 },
  weekExpandText: { fontSize: 12, fontWeight: "700" as const, color: ACCENT },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130, paddingTop: 20 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barPct: { fontSize: 8, color: t.MUTED, height: 12 },
  barTrack: { flex: 1, width: 18, backgroundColor: t.BORDER, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barDay: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const },

  // Achievements
  achieveCount: { fontSize: 12, color: t.MUTED },
  badgeCard: { alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1.5, minWidth: 90, position: "relative" },
  badgeEmoji: { fontSize: 32, marginBottom: 6 },
  badgeLocked: { opacity: 0.3 },
  badgeLockOverlay: { position: "absolute", top: 8, right: 8 },
  badgeName: { fontSize: 11, fontWeight: "700" as const, textAlign: "center" },
  badgeUnlockedText: { fontSize: 9, color: t.GREEN, marginTop: 2, fontWeight: "600" as const },
  noAchieveText: { fontSize: 12, color: t.MUTED, textAlign: "center", marginTop: 10 },

  // Prefs
  prefNote: { fontSize: 12, color: t.MUTED },
  themeToggle: { flexDirection: "row", gap: 4, backgroundColor: t.BORDER, borderRadius: 10, padding: 2 },
  themeToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  themeToggleBtnActive: { backgroundColor: t.CARD },
  themeToggleBtnText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  themeToggleBtnTextActive: { color: t.TEXT },

  // Health profile
  privacyBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.CARD2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  privacyText: { fontSize: 10, color: t.MUTED },
  hpPrompt: { flexDirection: "row", alignItems: "center", backgroundColor: ACCENT + "15", borderRadius: 12, padding: 12, gap: 12, borderWidth: 1, borderColor: ACCENT + "30" },
  hpPromptText: { flex: 1, fontSize: 13, color: t.TEXT, fontWeight: "500" as const },
  hpPromptBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  hpPromptBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" as const },
  hpRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.BORDER },
  hpRowLabel: { flex: 1, fontSize: 14, color: t.TEXT, fontWeight: "600" as const },
  hpRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  hpInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, fontWeight: "700" as const, color: t.TEXT, minWidth: 70, textAlign: "center" },
  hpRowUnit: { fontSize: 12, color: t.MUTED, width: 32 },
  hpSelectLabel: { fontSize: 12, color: t.MUTED, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER },
  chipText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  hpPrivacyNote: { fontSize: 11, color: t.MUTED, textAlign: "center", marginTop: 16, lineHeight: 17 },
  hpActions: { flexDirection: "row", gap: 10, marginTop: 16, paddingBottom: 4 },
  hpSaveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  hpSaveBtnText: { fontSize: 14, fontWeight: "700" as const },

  // Footer
  footer: { alignItems: "center", paddingVertical: 28, gap: 6 },
  footerLogo: { fontSize: 20, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  footerVersion: { fontSize: 11, color: t.MUTED },
  footerTagline: { fontSize: 12, color: t.MUTED, marginTop: 2 },
  footerLinks: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 6 },
  footerLink: { fontSize: 11, color: t.MUTED, textDecorationLine: "underline" as const },
  footerDot: { fontSize: 11, color: t.MUTED },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CARD wrapper
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  const { CARD } = theme;
  const st = makeSt(theme);
  return (
    <View style={[st.card, { backgroundColor: CARD }]}>
      <View style={st.cardHeader}>
        {icon && <Ionicons name={icon as any} size={18} color={ACCENT} />}
        <Text style={st.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTING ROW
// ─────────────────────────────────────────────────────────────────────────────
function SettingRow({ icon, iconBg, label, sub, right, onPress, last }: {
  icon: string; iconBg: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const theme = useAppTheme();
  const st = makeSt(theme);
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={[st.settingRow, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[st.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={16} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.settingLabel}>{label}</Text>
        {sub ? <Text style={st.settingSub}>{sub}</Text> : null}
      </View>
      {right}
    </Wrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL EDIT SHEET
// ─────────────────────────────────────────────────────────────────────────────
function GoalEditSheet({ visible, label, unit, value, onSave, onClose }: {
  visible: boolean; label: string; unit: string; value: string;
  onSave: (v: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const st = makeSt(theme);
  const [val, setVal] = useState(value);
  React.useEffect(() => { if (visible) setVal(value); }, [visible, value]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[st.smallSheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
              <View style={st.handle} />
              <Text style={st.sheetTitle}>Set {label}</Text>
              <View style={st.goalInputRow}>
                <TextInput
                  style={st.goalInput}
                  value={val}
                  onChangeText={setVal}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                  maxLength={6}
                />
                <Text style={st.goalUnit}>{unit}</Text>
              </View>
              <TouchableOpacity style={[st.sheetSaveBtn, { backgroundColor: ACCENT }]} onPress={() => { onSave(val); onClose(); }}>
                <Text style={st.sheetSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE POPUP
// ─────────────────────────────────────────────────────────────────────────────
function BadgePopup({ badge, unlocked, onClose }: { badge: typeof ACHIEVEMENTS[0] | null; unlocked: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const { GREEN, BORDER } = theme;
  const st = makeSt(theme);
  if (!badge) return null;
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.badgeOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={[st.badgePopup, { backgroundColor: theme.CARD }]}>
            <Text style={st.badgePopupEmoji}>{badge.emoji}</Text>
            <Text style={st.badgePopupName}>{badge.name}</Text>
            <Text style={st.badgePopupDesc}>{badge.desc}</Text>
            <View style={[st.badgePopupDivider, { backgroundColor: BORDER }]} />
            <Text style={st.badgePopupHow}>{unlocked ? "✅ Achievement unlocked!" : badge.how}</Text>
            <TouchableOpacity style={[st.badgePopupBtn, { backgroundColor: unlocked ? GREEN : ACCENT }]} onPress={onClose}>
              <Text style={st.badgePopupBtnText}>{unlocked ? "Nice!" : "Got it"}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  "use no memo";
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, GREEN, BLUE, YELLOW, RED, TEXT: WHITE, mode, setMode } = theme;
  const styles = makeStyles(theme);
  const st = makeSt(theme);
  const { habits, habitLogs, getStreak, getCompletionRate, clearTodayHabitLogs } = useHabits();
  const { todos } = useTodos();
  const { foodItems, waterLogs, dailyGoal, setDailyGoal, clearTodayData } = useCalories();
  const { userName, setUserName, joinDate, habitGoal, setHabitGoal, activityGoal, setActivityGoal,
          healthProfile, setHealthProfile, reminders, setReminders, preferences, setPreferences } = useProfile();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState(userName);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // ── Goal edit sheet ────────────────────────────────────────────────────────
  type GoalField = "calories" | "water" | "habits" | "activity" | null;
  const [editingGoal, setEditingGoal] = useState<GoalField>(null);

  // ── Badge popup ────────────────────────────────────────────────────────────
  const [activeBadge, setActiveBadge] = useState<typeof ACHIEVEMENTS[0] | null>(null);
  const [activeBadgeUnlocked, setActiveBadgeUnlocked] = useState(false);

  // ── Weekly report expanded ─────────────────────────────────────────────────
  const [weekExpanded, setWeekExpanded] = useState(false);
  const weekAnim = useRef(new Animated.Value(0)).current;

  // ── Health profile edit ────────────────────────────────────────────────────
  const [hp, setHp] = useState<HealthProfile>(healthProfile);
  const [hpExpanded, setHpExpanded] = useState(false);
  const hpAnim = useRef(new Animated.Value(0)).current;

  // ─── Computed stats ──────────────────────────────────────────────────────
  const today = getLocalDateString();

  const completedHabitLogs = habitLogs.filter(l => l.completed);
  const totalHabitsDone = completedHabitLogs.length;
  const totalTasksDone  = todos.filter(t => t.completed).length;
  const totalMealsLogged = foodItems.length;

  const bestStreak = habits.reduce((best, h) => Math.max(best, getStreak(h.id).best), 0);
  const currentStreak = habits.reduce((best, h) => Math.max(best, getStreak(h.id).current), 0);

  const uniqueDates = new Set([
    ...habitLogs.map(l => l.date),
    ...foodItems.map(f => f.date),
    ...waterLogs.map(w => w.date),
  ]);
  const daysTracked = uniqueDates.size;

  // ─── Weekly report data ───────────────────────────────────────────────────
  const days7 = last7Days();
  const weekDayCompletion = days7.map(date => {
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    const habitsForDay = habits.filter(h => h.weekDays.includes(dow));
    if (habitsForDay.length === 0) return { date, pct: 0, label: DAY_LABELS[dow], isToday: date === today };
    const done = habitsForDay.filter(h => {
      const log = habitLogs.find(l => l.habitId === h.id && l.date === date);
      return log?.completed;
    }).length;
    return { date, pct: Math.round((done / habitsForDay.length) * 100), label: DAY_LABELS[dow], isToday: date === today };
  });

  const weekCalories = days7.map(date => foodItems.filter(f => f.date === date).reduce((s, f) => s + f.calories, 0));
  const avgWeekCals = Math.round(weekCalories.reduce((s, c) => s + c, 0) / 7);
  const weekHabitPct = Math.round(weekDayCompletion.reduce((s, d) => s + d.pct, 0) / 7);

  const mostConsistentHabit = habits.length > 0
    ? habits.reduce((best, h) => getCompletionRate(h.id) >= getCompletionRate(best.id) ? h : best, habits[0])
    : null;

  const maxCompletion = Math.max(...weekDayCompletion.map(d => d.pct));
  const mostActiveDayIdx = weekDayCompletion.reduce((bestIdx, d, i, arr) => d.pct >= arr[bestIdx].pct ? i : bestIdx, 0);
  const mostActiveDay = maxCompletion > 0
    ? (weekDayCompletion[mostActiveDayIdx]?.label ?? "-")
    : "-";

  // ─── Achievements unlock logic ────────────────────────────────────────────
  const unlockedSet = new Set<string>();
  if (completedHabitLogs.length > 0) unlockedSet.add("first_step");
  if (currentStreak >= 7)            unlockedSet.add("on_fire");
  if (totalHabitsDone >= 30)         unlockedSet.add("consistent");
  if (new Set(foodItems.map(f => f.date)).size >= 7) unlockedSet.add("nutrition_pro");
  if (bestStreak >= 30)              unlockedSet.add("unstoppable");

  // Hydrated: 7 consecutive days where glasses >= goal
  const sortedWaterDates = [...new Set(waterLogs.filter(w => w.glasses >= dailyGoal.water).map(w => w.date))].sort();
  let waterStreak = 0, maxWaterStreak = 0;
  for (let i = 0; i < sortedWaterDates.length; i++) {
    if (i === 0) { waterStreak = 1; } else {
      const prev = new Date(sortedWaterDates[i-1] + "T00:00:00");
      prev.setDate(prev.getDate() + 1);
      waterStreak = sortedWaterDates[i] === isoDate(prev) ? waterStreak + 1 : 1;
    }
    maxWaterStreak = Math.max(maxWaterStreak, waterStreak);
  }
  if (maxWaterStreak >= 7) unlockedSet.add("hydrated");

  // All Rounder: any date with habits + tasks + food
  const datesWithFood = new Set(foodItems.map(f => f.date));
  const datesWithHabits = new Set(completedHabitLogs.map(l => l.date));
  const datesWithTasks = new Set(todos.filter(t => t.completed && t.dueDate).map(t => t.dueDate!));
  for (const d of datesWithFood) {
    if (datesWithHabits.has(d) && (datesWithTasks.has(d) || todos.some(t => t.completed && t.createdAt.startsWith(d)))) {
      unlockedSet.add("all_rounder");
      break;
    }
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handlePickAvatar = async () => {
    if (Platform.OS === "web") {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true, aspect: [1,1] });
      if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
      return;
    }
    Alert.alert("Change Photo", "Choose a source", [
      { text: "Camera", onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access to take a profile photo."); return; }
        const r = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1,1] });
        if (!r.canceled) setAvatarUri(r.assets[0].uri);
      }},
      { text: "Photo Library", onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to change your profile picture."); return; }
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1,1] });
        if (!r.canceled) setAvatarUri(r.assets[0].uri);
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSaveEdit = () => {
    const trimmed = editedName.trim() || "LyfeOS User";
    setUserName(trimmed);
    setEditMode(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleGoalSave = (field: GoalField, rawVal: string) => {
    const v = parseInt(rawVal) || 0;
    if (field === "calories") setDailyGoal({ ...dailyGoal, calories: v || 2000 });
    else if (field === "water") setDailyGoal({ ...dailyGoal, water: v || 8 });
    else if (field === "habits") setHabitGoal(v || 5);
    else if (field === "activity") setActivityGoal(v || 30);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRecalculate = () => {
    const result = calcGoals(hp);
    if (!result) { Alert.alert("Missing info", "Please fill in your age, sex, height, weight, activity level, and goal first."); return; }
    Alert.alert("Suggested Goals",
      `Calories: ${result.calories} kcal\nCarbs: ${result.carbs}g\nProtein: ${result.protein}g\nFat: ${result.fat}g`,
      [
        { text: "Apply", onPress: () => setDailyGoal({ ...dailyGoal, ...result }) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleExportData = async () => {
    const summary = [
      `=== LyfeOS Data Export ===`,
      `Date: ${new Date().toLocaleDateString()}`,
      `User: ${userName}`,
      `Member since: ${formatJoinDate(joinDate)}`,
      ``,
      `=== Stats ===`,
      `Habits completed: ${totalHabitsDone}`,
      `Tasks completed: ${totalTasksDone}`,
      `Meals logged: ${totalMealsLogged}`,
      `Best streak: ${bestStreak} days`,
      `Days tracked: ${daysTracked}`,
      ``,
      `=== Daily Goals ===`,
      `Calories: ${dailyGoal.calories} kcal`,
      `Water: ${dailyGoal.water} glasses`,
      `Carbs: ${dailyGoal.carbs}g  Protein: ${dailyGoal.protein}g  Fat: ${dailyGoal.fat}g`,
    ].join("\n");

    try {
      if (Platform.OS === "web") {
        Alert.alert("Your Data", summary);
      } else {
        await Share.share({ message: summary, title: "LyfeOS Data Export" });
      }
    } catch {}
  };

  const handleClearToday = () => {
    Alert.alert("Clear Today's Data", "This will remove all food logs and habit completions for today. This cannot be undone.", [
      { text: "Clear Today", style: "destructive", onPress: () => {
        clearTodayData(today);
        clearTodayHabitLogs(today);
        Alert.alert("Done", "Today's logs cleared successfully.");
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleResetAll = () => {
    Alert.alert("⚠️ Reset All Data", "This will permanently delete ALL your habits, tasks, nutrition logs, and settings. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "I understand, delete everything", style: "destructive", onPress: () => {
        Alert.alert("Last warning", "Are you absolutely sure? All data will be lost forever.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete Everything", style: "destructive", onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert("Done", "All data has been cleared. Please restart the app.");
          }},
        ]);
      }},
    ]);
  };

  const toggleWeek = () => {
    const to = weekExpanded ? 0 : 1;
    Animated.timing(weekAnim, { toValue: to, duration: 280, useNativeDriver: false }).start();
    setWeekExpanded(!weekExpanded);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const toggleHp = () => {
    const to = hpExpanded ? 0 : 1;
    Animated.timing(hpAnim, { toValue: to, duration: 280, useNativeDriver: false }).start();
    setHpExpanded(!hpExpanded);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const hpHeight = hpAnim.interpolate({ inputRange: [0,1], outputRange: [0, 500] });
  const weekChartHeight = weekAnim.interpolate({ inputRange: [0,1], outputRange: [0, 160] });

  const initials = (editMode ? editedName : userName).trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) || "VF";

  const GOAL_ROWS = [
    { field: "calories" as GoalField, icon: "flame",       iconBg: "#FF6B3530", label: "Calorie Goal",  value: dailyGoal.calories, unit: "kcal" },
    { field: "water"    as GoalField, icon: "water",       iconBg: "#3B82F630", label: "Water Goal",    value: dailyGoal.water,    unit: "glasses" },
    { field: "habits"   as GoalField, icon: "checkmark-circle", iconBg: "#22C55E30", label: "Daily Habits Goal", value: habitGoal, unit: "habits/day" },
    { field: "activity" as GoalField, icon: "timer-outline", iconBg: "#EAB30830", label: "Activity Goal",  value: activityGoal || 30, unit: "min/day" },
  ];

  const STAT_CARDS = [
    { icon: "trophy",     iconColor: YELLOW, label: "Best Streak",       value: bestStreak,       suffix: "days" },
    { icon: "checkmark-done-circle", iconColor: GREEN, label: "Habits Done", value: totalHabitsDone, suffix: "total" },
    { icon: "list",       iconColor: BLUE,   label: "Tasks Done",        value: totalTasksDone,   suffix: "total" },
    { icon: "restaurant", iconColor: ACCENT, label: "Meals Logged",      value: totalMealsLogged, suffix: "total" },
    { icon: "time",       iconColor: "#8B5CF6", label: "Days Tracked",   value: daysTracked,      suffix: "days" },
    { icon: "flame",      iconColor: ACCENT, label: "Current Streak",    value: currentStreak,    suffix: "days" },
  ];

  // active goal field value helper
  const goalFieldValue = () => {
    if (editingGoal === "calories") return String(dailyGoal.calories);
    if (editingGoal === "water")    return String(dailyGoal.water);
    if (editingGoal === "habits")   return String(habitGoal);
    if (editingGoal === "activity") return String(activityGoal);
    return "";
  };
  const goalFieldLabel = GOAL_ROWS.find(r => r.field === editingGoal)?.label ?? "";
  const goalFieldUnit  = GOAL_ROWS.find(r => r.field === editingGoal)?.unit ?? "";

  const healthFilled = !!(hp.age && hp.sex && hp.height && hp.weight && hp.activityLevel && hp.goal);

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Identity Card ────────────────────────────────────────── */}
        <View style={styles.identityCard}>
          <TouchableOpacity style={styles.editModeBtn} onPress={() => { setEditedName(userName); setEditMode(!editMode); }}>
            <Ionicons name={editMode ? "close" : "pencil"} size={16} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity onPress={editMode ? handlePickAvatar : undefined} style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : <View style={[styles.avatarPlaceholder, { backgroundColor: ACCENT + "33" }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
              }
            </View>
            {editMode && (
              <View style={styles.avatarCameraOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {editMode ? (
            <TextInput
              style={styles.nameInput}
              value={editedName}
              onChangeText={setEditedName}
              autoFocus
              maxLength={40}
              textAlign="center"
            />
          ) : (
            <Text style={styles.identityName}>{userName}</Text>
          )}

          <Text style={styles.identityJoin}>Member since {formatJoinDate(joinDate)}</Text>

          <View style={[styles.streakPill, { backgroundColor: ACCENT + "22", borderColor: ACCENT + "40" }]}>
            <Text style={styles.streakPillText}>🔥 {currentStreak} Day Streak</Text>
          </View>

          {editMode && (
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.saveEditBtn, { backgroundColor: ACCENT }]} onPress={handleSaveEdit}>
                <Text style={styles.saveEditBtnText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditMode(false)}>
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Daily Goals ──────────────────────────────────────────── */}
        <SectionCard title="Daily Goals" icon="flag">
          {GOAL_ROWS.map((row, i) => (
            <TouchableOpacity key={row.field} style={[styles.goalRow, i === GOAL_ROWS.length-1 && { borderBottomWidth: 0 }]} onPress={() => setEditingGoal(row.field)}>
              <View style={[styles.goalRowIcon, { backgroundColor: row.iconBg }]}>
                <Ionicons name={row.icon as any} size={16} color={ACCENT} />
              </View>
              <Text style={styles.goalRowLabel}>{row.label}</Text>
              <Text style={styles.goalRowValue}>{row.value}<Text style={styles.goalRowUnit}> {row.unit}</Text></Text>
              <Ionicons name="pencil" size={13} color={MUTED} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))}
        </SectionCard>

        {/* ── Your Journey ─────────────────────────────────────────── */}
        <SectionCard title="Your Journey" icon="stats-chart">
          <View style={styles.statsGrid}>
            {STAT_CARDS.map(card => (
              <View key={card.label} style={[styles.statCell, { backgroundColor: CARD2 }]}>
                <Ionicons name={card.icon as any} size={18} color={card.iconColor} />
                <Text style={[styles.statValue, { color: WHITE }]}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* ── Weekly Report ─────────────────────────────────────────── */}
        <SectionCard title="This Week's Report" icon="calendar">
          <View style={styles.weekRow}>
            <WeekItem icon="flame-outline"         color={ACCENT}  label="Avg Daily Calories"   value={`${avgWeekCals} kcal`} sub={`Goal: ${dailyGoal.calories}`} />
            <WeekItem icon="checkmark-circle-outline" color={GREEN} label="Habits Completion"   value={`${weekHabitPct}%`} />
          </View>
          <View style={styles.weekRow}>
            <WeekItem icon="star-outline"          color={YELLOW} label="Most Consistent"       value={mostConsistentHabit?.name ?? "—"} />
            <WeekItem icon="sunny-outline"         color={BLUE}   label="Most Active Day"       value={mostActiveDay} />
          </View>

          <TouchableOpacity style={styles.weekExpandBtn} onPress={toggleWeek}>
            <Text style={styles.weekExpandText}>{weekExpanded ? "Hide Chart" : "View Full Chart"}</Text>
            <Ionicons name={weekExpanded ? "chevron-up" : "chevron-down"} size={14} color={ACCENT} />
          </TouchableOpacity>

          <Animated.View style={{ height: weekChartHeight, overflow: "hidden" }}>
            <View style={styles.barChart}>
              {weekDayCompletion.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barPct}>{d.pct > 0 ? `${d.pct}%` : ""}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      height: `${Math.max(d.pct, 2)}%`,
                      backgroundColor: d.isToday ? ACCENT : d.pct === 100 ? GREEN : BLUE,
                    }]} />
                  </View>
                  <Text style={[styles.barDay, d.isToday && { color: ACCENT }]}>{d.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </SectionCard>

        {/* ── Achievements ──────────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: CARD }]}>
          <View style={st.cardHeader}>
            <Ionicons name="trophy" size={18} color={YELLOW} />
            <Text style={st.cardTitle}>Achievements</Text>
            <Text style={styles.achieveCount}>{unlockedSet.size === 0 ? "Start earning badges 🌱" : unlockedSet.size + "/" + ACHIEVEMENTS.length + " unlocked"}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {ACHIEVEMENTS.map(badge => {
              const unlocked = unlockedSet.has(badge.id);
              return (
                <TouchableOpacity key={badge.id} style={[styles.badgeCard, { backgroundColor: CARD2, borderColor: unlocked ? badge.id === "on_fire" ? ACCENT : GREEN : BORDER }]}
                  onPress={() => { setActiveBadge(badge); setActiveBadgeUnlocked(unlocked); }}>
                  <Text style={[styles.badgeEmoji, !unlocked && styles.badgeLocked]}>{badge.emoji}</Text>
                  {!unlocked && (
                    <View style={styles.badgeLockOverlay}>
                      <Ionicons name="lock-closed" size={14} color={MUTED} />
                    </View>
                  )}
                  <Text style={[styles.badgeName, { color: unlocked ? WHITE : MUTED }]}>{badge.name}</Text>
                  {unlocked && <Text style={styles.badgeUnlockedText}>✓ Earned</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {unlockedSet.size === 0 && (
            <Text style={styles.noAchieveText}>Complete your first habit to earn your first badge 🌱</Text>
          )}
        </View>

        {/* ── Reminders ─────────────────────────────────────────────── */}
        <SectionCard title="Reminders" icon="notifications">
          {[
            { key: "morning" as keyof typeof reminders, icon: "sunny",     iconBg: "#EAB30825", label: "Morning Reminder",   sub: "Daily habit check-in · 8:00 AM" },
            { key: "meal"    as keyof typeof reminders, icon: "restaurant", iconBg: "#FF6B3525", label: "Meal Reminder",       sub: "Log your meals on time" },
            { key: "water"   as keyof typeof reminders, icon: "water",      iconBg: "#3B82F625", label: "Water Reminder",      sub: "Stay hydrated every 2 hours" },
            { key: "evening" as keyof typeof reminders, icon: "moon",       iconBg: "#8B5CF625", label: "Evening Check-in",    sub: "End-of-day summary · 9:00 PM" },
          ].map((row, i, arr) => (
            <SettingRow key={row.key} icon={row.icon} iconBg={row.iconBg} label={row.label} sub={row.sub} last={i === arr.length - 1}
              right={
                <Switch value={reminders[row.key]} onValueChange={v => setReminders({ ...reminders, [row.key]: v })}
                  trackColor={{ false: BORDER, true: ACCENT }} thumbColor="#fff" />
              }
            />
          ))}
        </SectionCard>

        {/* ── Preferences ───────────────────────────────────────────── */}
        <SectionCard title="Preferences" icon="options">
          <SettingRow icon="moon" iconBg="#8B5CF625" label="Appearance"
            sub={mode === "system" ? "Follows system setting" : mode === "dark" ? "Dark mode on" : "Light mode on"}
            right={
              <View style={styles.themeToggle}>
                {(["system", "dark", "light"] as ThemeMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.themeToggleBtn, mode === m && styles.themeToggleBtnActive]}
                    onPress={() => setMode(m)}
                  >
                    <Text style={[styles.themeToggleBtnText, mode === m && styles.themeToggleBtnTextActive]}>
                      {m === "system" ? "Auto" : m === "dark" ? "Dark" : "Light"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            } />
          <SettingRow icon="resize" iconBg="#3B82F625" label="Units"
            sub={preferences.units === "metric" ? "Metric (kg, cm, ml)" : "Imperial (lbs, ft, oz)"}
            onPress={() => setPreferences({ ...preferences, units: preferences.units === "metric" ? "imperial" : "metric" })}
            right={<Text style={[styles.prefNote, { color: ACCENT }]}>{preferences.units === "metric" ? "Metric" : "Imperial"}</Text>} />
          <SettingRow icon="barbell" iconBg="#22C55E25" label="Calorie Display"
            sub={preferences.calorieDisplay === "kcal" ? "Kilocalories (kcal)" : "Kilojoules (kJ)"}
            onPress={() => setPreferences({ ...preferences, calorieDisplay: preferences.calorieDisplay === "kcal" ? "kj" : "kcal" })}
            right={<Text style={[styles.prefNote, { color: ACCENT }]}>{preferences.calorieDisplay.toUpperCase()}</Text>} />
          <SettingRow icon="sparkles" iconBg="#FF6B3525" label="Habit Completion Effects"
            sub="Sound & animation when a habit is completed"
            right={
              <Switch
                value={preferences.habitEffectsEnabled}
                onValueChange={(v) => setPreferences({ ...preferences, habitEffectsEnabled: v })}
                trackColor={{ false: BORDER, true: ACCENT }}
                thumbColor="#fff"
              />
            } last />
        </SectionCard>

        {/* ── Health Profile ────────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: CARD }]}>
          <TouchableOpacity style={st.cardHeader} onPress={toggleHp}>
            <Ionicons name="body" size={18} color={ACCENT} />
            <Text style={st.cardTitle}>Health Profile</Text>
            <View style={styles.privacyBadge}>
              <Ionicons name="lock-closed" size={10} color={MUTED} />
              <Text style={styles.privacyText}>Private</Text>
            </View>
            <Ionicons name={hpExpanded ? "chevron-up" : "chevron-down"} size={16} color={MUTED} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          {!healthFilled && !hpExpanded && (
            <TouchableOpacity style={styles.hpPrompt} onPress={toggleHp}>
              <Text style={styles.hpPromptText}>Complete your health profile for personalized goals 💪</Text>
              <View style={[styles.hpPromptBtn, { backgroundColor: ACCENT }]}>
                <Text style={styles.hpPromptBtnText}>Set Up Now</Text>
              </View>
            </TouchableOpacity>
          )}

          <Animated.View style={{ height: hpHeight, overflow: "hidden" }}>
            <View style={{ paddingTop: 8 }}>
              <HpRow label="Age" value={hp.age} onChangeText={v => setHp(p => ({ ...p, age: v }))} keyboardType="number-pad" unit="years" />
              <HpRow label="Height" value={hp.height} onChangeText={v => setHp(p => ({ ...p, height: v }))} keyboardType="number-pad" unit={preferences.units === "metric" ? "cm" : "in"} />
              <HpRow label="Weight" value={hp.weight} onChangeText={v => setHp(p => ({ ...p, weight: v }))} keyboardType="decimal-pad" unit={preferences.units === "metric" ? "kg" : "lbs"} />

              <Text style={styles.hpSelectLabel}>Biological Sex</Text>
              <View style={styles.chipRow}>
                {(["male","female","other"] as const).map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, hp.sex === s && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setHp(p => ({ ...p, sex: s }))}>
                    <Text style={[styles.chipText, hp.sex === s && { color: "#fff" }]}>{s === "other" ? "Prefer not to say" : s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hpSelectLabel}>Activity Level</Text>
              <View style={styles.chipRow}>
                {([["sedentary","Sedentary"],["lightly","Lightly Active"],["moderately","Moderately Active"],["very","Very Active"]] as const).map(([k,lbl]) => (
                  <TouchableOpacity key={k} style={[styles.chip, hp.activityLevel === k && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setHp(p => ({ ...p, activityLevel: k }))}>
                    <Text style={[styles.chipText, hp.activityLevel === k && { color: "#fff" }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hpSelectLabel}>Goal</Text>
              <View style={styles.chipRow}>
                {([["lose","Lose Weight"],["maintain","Maintain"],["muscle","Build Muscle"],["fitness","Improve Fitness"]] as const).map(([k,lbl]) => (
                  <TouchableOpacity key={k} style={[styles.chip, hp.goal === k && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setHp(p => ({ ...p, goal: k }))}>
                    <Text style={[styles.chipText, hp.goal === k && { color: "#fff" }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hpPrivacyNote}>🔒 This information stays private and is only used to calculate your personal goals</Text>

              <View style={styles.hpActions}>
                <TouchableOpacity style={[styles.hpSaveBtn, { backgroundColor: CARD2, borderColor: BORDER }]} onPress={() => { setHealthProfile(hp); if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}>
                  <Text style={[styles.hpSaveBtnText, { color: WHITE }]}>Save Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.hpSaveBtn, { backgroundColor: ACCENT }]} onPress={handleRecalculate}>
                  <Ionicons name="calculator-outline" size={14} color="#fff" />
                  <Text style={[styles.hpSaveBtnText, { color: "#fff" }]}>Recalculate Goals</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── Data & Privacy ────────────────────────────────────────── */}
        <SectionCard title="Data & Privacy" icon="shield-checkmark">
          <SettingRow icon="share-outline"    iconBg="#3B82F625" label="Export My Data"     sub="Download a summary of all your data" onPress={handleExportData}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />} />
          <SettingRow icon="today-outline"    iconBg="#EAB30825" label="Clear Today's Data"  sub="Remove today's logs only" onPress={handleClearToday}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />} />
          <SettingRow icon="warning-outline"  iconBg="#EF444425" label="Reset All Data"      sub="Permanently delete everything" onPress={handleResetAll}
            right={<Ionicons name="chevron-forward" size={16} color="#EF4444" />} last />
        </SectionCard>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>🌿 LyfeOS</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
          <Text style={styles.footerTagline}>Made with ❤️ for your wellbeing</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity><Text style={styles.footerLink}>Privacy Policy</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity><Text style={styles.footerLink}>Terms of Service</Text></TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <GoalEditSheet
        visible={!!editingGoal}
        label={goalFieldLabel}
        unit={goalFieldUnit}
        value={goalFieldValue()}
        onSave={(v) => handleGoalSave(editingGoal, v)}
        onClose={() => setEditingGoal(null)}
      />
      <BadgePopup badge={activeBadge} unlocked={activeBadgeUnlocked} onClose={() => setActiveBadge(null)} />
    </View>
  );
}

// ── Week insight cell ─────────────────────────────────────────────────────────
function WeekItem({ icon, color, label, value, sub }: { icon: string; color: string; label: string; value: string; sub?: string }) {
  const theme = useAppTheme();
  const { CARD2 } = theme;
  const styles = makeStyles(theme);
  return (
    <View style={[styles.weekItem, { backgroundColor: CARD2 }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={styles.weekItemLabel}>{label}</Text>
      <Text style={[styles.weekItemValue, { color }]}>{value}</Text>
      {sub && <Text style={styles.weekItemSub}>{sub}</Text>}
    </View>
  );
}

interface HpRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: import("react-native").KeyboardTypeOptions;
  unit: string;
}

// ── Health profile row ────────────────────────────────────────────────────────
function HpRow({ label, value, onChangeText, keyboardType, unit }: HpRowProps) {
  const theme = useAppTheme();
  const { MUTED } = theme;
  const styles = makeStyles(theme);
  return (
    <View style={styles.hpRow}>
      <Text style={styles.hpRowLabel}>{label}</Text>
      <View style={styles.hpRowRight}>
        <TextInput style={styles.hpInput} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder="—" placeholderTextColor={MUTED} maxLength={6} />
        <Text style={styles.hpRowUnit}>{unit}</Text>
      </View>
    </View>
  );
}
