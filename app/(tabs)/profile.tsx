import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as StoreReview from "expo-store-review";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { logScreen, logError } from "@/utils/analytics";
import { cancelAllNotifications, scheduleDailyNotifications } from "@/utils/notifications";
import Svg, { Circle } from "react-native-svg";
import { AD_UNIT_IDS } from "@/utils/ads";
import {
  ActivityIndicator,
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
import { clearAllLyfeOSLocalData } from "@/utils/storage";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useCalories } from "@/context/CaloriesContext";
import { useActivity } from "@/context/ActivityContext";
import { useHabits } from "@/context/HabitsContext";
import { HealthProfile, useProfile } from "@/context/ProfileContext";
import { useTodos } from "@/context/TodosContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";
import { ThemeMode } from "@/context/ThemeContext";
import auth from "@react-native-firebase/auth";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";
const PURPLE = "#8B5CF6";

// ── Day labels ────────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Achievements definition ───────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first_step", emoji: "🌱", name: "First Step", desc: "Log your first habit", how: "Complete any habit for the first time" },
  { id: "on_fire", emoji: "🔥", name: "On Fire", desc: "7-day habit streak", how: "Maintain a streak of 7 consecutive days on any habit" },
  { id: "consistent", emoji: "💪", name: "Consistent", desc: "30 habits completed", how: "Complete a total of 30 habits across all time" },
  { id: "nutrition_pro", emoji: "🥗", name: "Nutrition Pro", desc: "Logged meals 7 days", how: "Log at least one meal on 7 different days" },
  { id: "hydrated", emoji: "💧", name: "Hydrated", desc: "Hit water goal 7 days in a row", how: "Meet your daily water goal for 7 consecutive days" },
  { id: "unstoppable", emoji: "🏆", name: "Unstoppable", desc: "30-day habit streak", how: "Maintain a streak of 30 consecutive days on any habit" },
  { id: "all_rounder", emoji: "⭐", name: "All Rounder", desc: "Complete habits + tasks + nutrition in one day", how: "Log habits, a task, and a meal all on the same day" },
  { id: "task_master", emoji: "📋", name: "Task Master", desc: "Complete 10 tasks", how: "Check off 10 tasks in your to-do list" },
  { id: "mover", emoji: "🏃", name: "Mover", desc: "Log 10 activities", how: "Log at least 10 workout or physical activities" },
];

// ── Goal presets (Mifflin-St Jeor BMR) ───────────────────────────────────────
function calcGoals(hp: HealthProfile): { calories: number; carbs: number; protein: number; fat: number } | null {
  const age = parseInt(hp.age);
  let h = parseInt(hp.height);
  if (hp.height.includes("'")) {
    const parts = hp.height.split("'");
    const ft = parseInt(parts[0]) || 0;
    const in_ = parseInt(parts[1]) || 0;
    h = Math.round((ft * 12 + in_) * 2.54);
  }
  let w = parseFloat(hp.weight);
  if (hp.weight.includes("lb")) {
    w = w * 0.453592;
  }
  if (!age || !h || !w || !hp.sex || !hp.activityLevel || !hp.goal) return null;

  const bmr = hp.sex === "male"
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161;

  const mult = { sedentary: 1.2, lightly: 1.375, moderately: 1.55, very: 1.725 }[hp.activityLevel] ?? 1.375;
  const adj = { lose: -500, maintain: 0, muscle: +300, fitness: 0 }[hp.goal] ?? 0;
  const cal = Math.round(bmr * mult + adj);

  const proteinPct = hp.goal === "muscle" ? 0.30 : 0.25;
  const carbsPct = hp.goal === "lose" ? 0.40 : 0.50;
  const fatPct = 1 - proteinPct - carbsPct;

  return {
    calories: cal,
    carbs: Math.round((cal * carbsPct) / 4),
    protein: Math.round((cal * proteinPct) / 4),
    fat: Math.round((cal * fatPct) / 9),
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
  statsGrid: { flexDirection: "row", gap: 8 },
  statCell: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", gap: 4, width: 96 },
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
// SMALL RING COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function SmallRing({
  size = 28,
  progress,
  color,
}: {
  size?: number;
  progress: number;
  color: string;
}) {
  const { BORDER } = useAppTheme();
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size, opacity: progress > 0 ? 1 : 0.4 }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

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
function SettingRow({ icon, iconColor, iconBg, label, sub, right, onPress, last }: {
  icon: string; iconColor?: string; iconBg?: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const theme = useAppTheme();
  const st = makeSt(theme);
  const Wrap = onPress ? TouchableOpacity : View;
  const resolvedColor = iconColor || theme.ACCENT;
  const resolvedBg = iconBg || (resolvedColor + "25");
  return (
    <Wrap style={[st.settingRow, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[st.settingIcon, { backgroundColor: resolvedBg }]}>
        <Ionicons name={icon as any} size={16} color={resolvedColor} />
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
  const {
    user,
    isGuest,
    signOut,
    migrationDone,
    clearMigrationDone,
    deleteAccountAndData,
    deleteGuestData,
  } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { BG, CARD, CARD2, BORDER, MUTED, GREEN, BLUE, YELLOW, RED, TEXT: WHITE, mode, setMode } = theme;
  const styles = makeStyles(theme);
  const st = makeSt(theme);
  const { habits, habitLogs, getStreak, getCompletionRate, clearTodayHabitLogs } = useHabits();
  const { todos } = useTodos();
  const { foodItems, waterLogs, dailyGoal, setDailyGoal, clearTodayData } = useCalories();
  const { getDailyActivityMinutes, activityLogs } = useActivity();
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

  // ── Migration success banner ───────────────────────────────────────────────
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  // ── Account & Data Deletion State ──────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState("Deleting your account…");

  useEffect(() => {
    if (migrationDone && user && !isGuest) {
      setMigrationSuccess(true);
      clearMigrationDone();
      const timer = setTimeout(() => setMigrationSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [migrationDone, user, isGuest]);

  // ── Notifications enabled state (persisted) ────────────────────────────────
  const NOTIF_ENABLED_KEY = "notificationsEnabled";
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Screen tracking + load notification preference on mount
  useEffect(() => {
    logScreen("Profile");
    AsyncStorage.getItem(NOTIF_ENABLED_KEY)
      .then((val) => {
        if (val !== null) setNotificationsEnabled(val === "true");
      })
      .catch(() => { });
  }, []);

  // Handler for the master notifications toggle
  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(enabled));
      if (enabled) {
        // Fix #3: pass current sub-toggle state so only the enabled
        // notification types are scheduled
        await scheduleDailyNotifications(reminders);
      } else {
        await cancelAllNotifications();
      }
    } catch (e) {
      logError(e as Error, "handleNotificationsToggle");
    }
  };

  // Fix #3: Handler for individual reminder sub-toggles.
  // Persists the change and immediately re-schedules so it takes effect
  // without requiring a master-toggle cycle or app restart.
  const handleReminderToggle = async (key: keyof typeof reminders, value: boolean) => {
    const updated = { ...reminders, [key]: value };
    await setReminders(updated);
    if (notificationsEnabled) {
      await scheduleDailyNotifications(updated);
    }
  };

  // ─── Computed stats ──────────────────────────────────────────────────────
  const today = getLocalDateString();

  const completedHabitLogs = habitLogs.filter(l => l.completed);
  const totalHabitsDone = completedHabitLogs.length;
  const totalTasksDone = todos.filter(t => t.completed).length;
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
  const daysWithMeals = weekCalories.filter(c => c > 0);
  const avgWeekCals = daysWithMeals.length > 0 ? Math.round(daysWithMeals.reduce((s, c) => s + c, 0) / daysWithMeals.length) : 0;
  const isOnlyToday = daysWithMeals.length === 1 && foodItems.some(f => f.date === today);
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
  if (bestStreak >= 7 || currentStreak >= 7) unlockedSet.add("on_fire");
  if (totalHabitsDone >= 30) unlockedSet.add("consistent");
  if (new Set(foodItems.map(f => f.date)).size >= 7) unlockedSet.add("nutrition_pro");
  if (bestStreak >= 30) unlockedSet.add("unstoppable");
  if (totalTasksDone >= 10) unlockedSet.add("task_master");
  if (activityLogs.length >= 10) unlockedSet.add("mover");

  // Hydrated: 7 consecutive days where glasses >= goal
  const sortedWaterDates = [...new Set(waterLogs.filter(w => w.glasses >= dailyGoal.water).map(w => w.date))].sort();
  let waterStreak = 0, maxWaterStreak = 0;
  for (let i = 0; i < sortedWaterDates.length; i++) {
    if (i === 0) { waterStreak = 1; } else {
      const prev = new Date(sortedWaterDates[i - 1] + "T00:00:00");
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
      return;
    }
    Alert.alert("Change Photo", "Choose a source", [
      {
        text: "Camera", onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access to take a profile photo."); return; }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) setAvatarUri(r.assets[0].uri);
        }
      },
      {
        text: "Photo Library", onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to change your profile picture."); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) setAvatarUri(r.assets[0].uri);
        }
      },
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
    } catch { }
  };

  const handleClearToday = () => {
    Alert.alert("Clear Today's Data", "This will remove all food logs and habit completions for today. This cannot be undone.", [
      {
        text: "Clear Today", style: "destructive", onPress: () => {
          clearTodayData(today);
          clearTodayHabitLogs(today);
          Alert.alert("Done", "Today's logs cleared successfully.");
        }
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/login" as any);
    } catch (e: any) {
      logError(e, "profile_sign_out");
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      "⚠️ Reset All Data",
      "This will permanently delete ALL your local habits, tasks, nutrition logs, and settings on this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I understand, delete local data",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Last warning",
              "Are you absolutely sure? All local data on this device will be lost.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Local Data",
                  style: "destructive",
                  onPress: async () => {
                    await clearAllLyfeOSLocalData();
                    Alert.alert("Done", "All local data has been cleared on this device.");
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performDeletion = async (password?: string) => {
    setIsDeleting(true);
    setDeletingMessage("Verifying credentials & deleting your account…");
    try {
      await deleteAccountAndData(password);
      setShowPasswordModal(false);
      setReauthPassword("");
      setIsDeleting(false);
      router.replace("/login" as any);
      setTimeout(() => {
        Alert.alert(
          "Account Deleted",
          "Your LyfeOS account and associated data have been deleted successfully."
        );
      }, 400);
    } catch (err: any) {
      setIsDeleting(false);
      logError(err, "deleteAccountAndData");

      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPasswordError("Incorrect password. Please try again.");
        return;
      }

      if (err.code === "auth/requires-recent-login") {
        setShowPasswordModal(true);
        setPasswordError("Recent authentication is required. Please enter your password.");
        return;
      }

      // Check if Google sign-in was cancelled by user
      if (
        err.code === "12501" ||
        err.message?.toLowerCase().includes("cancel") ||
        err.message?.toLowerCase().includes("user canceled")
      ) {
        Alert.alert(
          "Verification Cancelled",
          "Google re-authentication was cancelled. Your account and cloud data have not been deleted."
        );
        return;
      }

      // Check if error came from Firestore cloud deletion
      if (
        err.message?.includes("deleteUserCloudData") ||
        err.message?.includes("Cloud deletion verification failed")
      ) {
        Alert.alert(
          "Deletion Incomplete",
          "We couldn't complete cloud data deletion. Your account has not been deleted. Please check your internet connection and try again.\n\nSupport: onlineworld4k@gmail.com"
        );
        return;
      }

      Alert.alert(
        "Deletion Failed",
        "We couldn't complete account deletion. Your account has not been deleted. Please try again.\n\nIf the issue persists, contact support at onlineworld4k@gmail.com."
      );
    }
  };

  const handleDeleteAccountFlow = () => {
    if (isGuest || !user) {
      Alert.alert(
        "Guest Account Data",
        "You are currently using LyfeOS as a guest. Guest sessions are stored locally on this device and do not have a registered cloud account or cloud data.\n\nWould you like to permanently delete your local guest data?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Local Data",
            style: "destructive",
            onPress: async () => {
              setIsDeleting(true);
              setDeletingMessage("Deleting guest data…");
              try {
                await deleteGuestData();
                setIsDeleting(false);
                router.replace("/login" as any);
                setTimeout(() => {
                  Alert.alert(
                    "Data Deleted",
                    "Your local guest data has been cleared successfully."
                  );
                }, 400);
              } catch (e: any) {
                setIsDeleting(false);
                logError(e, "deleteGuestData");
                Alert.alert("Error", "Failed to delete guest data. Please try again.");
              }
            },
          },
        ]
      );
      return;
    }

    // Registered user: Confirmation 1
    Alert.alert(
      "Delete Account & Data?",
      "This will permanently delete your LyfeOS account and cloud data. This action cannot be undone.\n\nThis includes cloud-synchronized:\n• Habits and habit logs\n• To-dos\n• Food/nutrition logs\n• Water logs\n• Legal consent record\n• Other LyfeOS cloud data associated with this account\n\nLocal data on this device will also be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            // Confirmation 2
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and associated cloud data will be permanently deleted. You will not be able to recover this data.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Permanently",
                  style: "destructive",
                  onPress: () => {
                    const providerId = user?.providerData?.[0]?.providerId;
                    const isEmailUser =
                      providerId === "password" ||
                      user?.providerData?.some((p) => p.providerId === "password");

                    if (isEmailUser) {
                      // Prompt for password FIRST before touching any data
                      setPasswordError("");
                      setReauthPassword("");
                      setShowPasswordModal(true);
                    } else {
                      // Google user: prompts Google Sign-in re-auth FIRST before deleting
                      performDeletion();
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.lyfeos.app&showAllReviews=true";

  const handleRateApp = async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      } else {
        await WebBrowser.openBrowserAsync(PLAY_STORE_URL);
      }
    } catch {
      // Fallback: attempt to open Play Store listing; silently fail if that also fails
      try {
        await WebBrowser.openBrowserAsync(PLAY_STORE_URL);
      } catch { }
    }
  };

  const toggleWeightUnit = () => {
    const isLb = hp.weight.includes("lb");
    const val = parseFloat(hp.weight) || 0;
    if (val === 0) {
      setHp({ ...hp, weight: isLb ? "" : " lb" });
      return;
    }
    if (isLb) {
      setHp({ ...hp, weight: `${Math.round(val * 0.453592)} kg` });
    } else {
      setHp({ ...hp, weight: `${Math.round(val * 2.20462)} lb` });
    }
  };

  const toggleHeightUnit = () => {
    const isFt = hp.height.includes("'") || hp.height.includes("ft");
    if (isFt) {
      const parts = hp.height.split("'");
      const ft = parseInt(parts[0]) || 0;
      const in_ = parseInt(parts[1]) || 0;
      const cm = Math.round((ft * 12 + in_) * 2.54);
      setHp({ ...hp, height: cm ? `${cm} cm` : "" });
    } else {
      const cm = parseInt(hp.height) || 0;
      if (cm === 0) { setHp({ ...hp, height: "" }); return; }
      const totalInches = Math.round(cm / 2.54);
      const ft = Math.floor(totalInches / 12);
      const in_ = totalInches % 12;
      setHp({ ...hp, height: `${ft}'${in_}` });
    }
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

  const hpHeight = hpAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 500] });
  const weekChartHeight = weekAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] });

  const initials = (editMode ? editedName : userName).trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "VF";

  const todayCalories = foodItems.filter(f => f.date === today).reduce((s, f) => s + f.calories, 0);
  const todayWater = waterLogs.find(w => w.date === today)?.glasses || 0;
  const todayHabitsDone = habitLogs.filter(l => l.date === today && l.completed).length;

  const GOAL_ROWS = [
    { field: "calories" as GoalField, icon: "flame", iconBg: "#FF6B3530", color: ACCENT, label: "Calorie Goal", value: dailyGoal.calories, unit: "kcal", progressVal: todayCalories, progressStr: `${todayCalories} / ${dailyGoal.calories} consumed` },
    { field: "water" as GoalField, icon: "water", iconBg: "#3B82F630", color: BLUE, label: "Water Goal", value: dailyGoal.water, unit: "glasses", progressVal: todayWater, progressStr: `${todayWater}/${dailyGoal.water} glasses` },
    { field: "habits" as GoalField, icon: "checkmark-circle", iconBg: "#22C55E30", color: GREEN, label: "Daily Habits Goal", value: habitGoal, unit: "habits/day", progressVal: todayHabitsDone, progressStr: `${todayHabitsDone}/${habitGoal} completed` },
    { field: "activity" as GoalField, icon: "timer-outline", iconBg: "#EAB30830", color: YELLOW, label: "Activity Goal", value: activityGoal || 30, unit: "min/day", progressVal: getDailyActivityMinutes(today), progressStr: `${getDailyActivityMinutes(today)}/${activityGoal || 30} min` },
  ];

  const STAT_CARDS = [
    { icon: "trophy", iconColor: YELLOW, label: "Best", value: bestStreak, suffix: "days" },
    { icon: "checkmark-done-circle", iconColor: GREEN, label: "Habits Done", value: totalHabitsDone, suffix: "total" },
    { icon: "list", iconColor: BLUE, label: "Tasks Done", value: totalTasksDone, suffix: "total" },
    { icon: "restaurant", iconColor: ACCENT, label: "Meals", value: totalMealsLogged, suffix: "total" },
    { icon: "time", iconColor: "#8B5CF6", label: "Days", value: daysTracked, suffix: "days" },
    { icon: "flame", iconColor: ACCENT, label: "Streak", value: currentStreak, suffix: "days" },
  ];

  // active goal field value helper
  const goalFieldValue = () => {
    if (editingGoal === "calories") return String(dailyGoal.calories);
    if (editingGoal === "water") return String(dailyGoal.water);
    if (editingGoal === "habits") return String(habitGoal);
    if (editingGoal === "activity") return String(activityGoal);
    return "";
  };
  const goalFieldLabel = GOAL_ROWS.find(r => r.field === editingGoal)?.label ?? "";
  const goalFieldUnit = GOAL_ROWS.find(r => r.field === editingGoal)?.unit ?? "";

  const hpFieldsFilled = [hp.age, hp.sex, hp.height, hp.weight, hp.activityLevel, hp.goal].filter(Boolean).length;
  const healthFilled = hpFieldsFilled >= 4;

  const streakData = (() => {
    if (currentStreak === 0) return { text: "🌱 Start your streak", bg: MUTED + "22", border: MUTED + "40", color: MUTED };
    if (currentStreak < 7) return { text: `🔥 ${currentStreak} Day Streak`, bg: ACCENT + "22", border: ACCENT + "40", color: ACCENT };
    if (currentStreak < 30) return { text: `🔥 ${currentStreak} Day Streak`, bg: YELLOW + "22", border: YELLOW + "40", color: YELLOW };
    if (currentStreak < 100) return { text: `🔥 ${currentStreak} Day Streak`, bg: "#06B6D422", border: "#06B6D440", color: "#06B6D4" };
    return { text: `🔥 ${currentStreak} Day Streak`, bg: "#A855F722", border: "#A855F740", color: "#A855F7" };
  })();

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8, paddingBottom: insets.bottom + 136 }]}
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

          <View style={[styles.streakPill, { backgroundColor: streakData.bg, borderColor: streakData.border }]}>
            <Text style={[styles.streakPillText, { color: streakData.color }]}>{streakData.text}</Text>
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
            <TouchableOpacity key={row.field} style={[styles.goalRow, i === GOAL_ROWS.length - 1 && { borderBottomWidth: 0 }]} onPress={() => setEditingGoal(row.field)}>
              <View style={[styles.goalRowIcon, { backgroundColor: row.iconBg }]}>
                <Ionicons name={row.icon as any} size={16} color={row.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalRowLabel}>{row.label}</Text>
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 2, fontWeight: "500" }}>{row.progressStr}</Text>
              </View>
              <SmallRing size={26} progress={row.progressVal / row.value} color={row.color} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.goalRowValue}>{row.value}<Text style={styles.goalRowUnit}> {row.unit}</Text></Text>
              </View>
              <Ionicons name="pencil" size={13} color={MUTED} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ))}
        </SectionCard>

        {/* ── Your Journey ─────────────────────────────────────────── */}
        <SectionCard title="Your Journey" icon="stats-chart">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsGrid}>
            {STAT_CARDS.map(card => (
              <View key={card.label} style={[styles.statCell, { backgroundColor: CARD2 }]}>
                <Ionicons name={card.icon as any} size={18} color={card.iconColor} />
                <Text style={[styles.statValue, { color: WHITE }]}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </ScrollView>
        </SectionCard>

        {/* ── Weekly Report ─────────────────────────────────────────── */}
        <SectionCard title="This Week's Report" icon="calendar">
          <View style={styles.weekRow}>
            <WeekItem icon="flame-outline" color={ACCENT} label={isOnlyToday ? "Today's Calories" : "Avg Daily Calories"} value={`${avgWeekCals} kcal`} sub={`Goal: ${dailyGoal.calories}`} />
            <WeekItem icon="checkmark-circle-outline" color={GREEN} label="Habits Completion" value={`${weekHabitPct}%`} />
          </View>
          <View style={styles.weekRow}>
            <WeekItem icon="star-outline" color={YELLOW} label="Most Consistent" value={mostConsistentHabit?.name ?? "—"} />
            <WeekItem icon="sunny-outline" color={BLUE} label="Most Active Day" value={mostActiveDay} />
          </View>

          <TouchableOpacity style={styles.weekExpandBtn} onPress={toggleWeek}>
            <Text style={styles.weekExpandText}>{weekExpanded ? "Hide Chart" : "View Full Chart"}</Text>
            <Ionicons name={weekExpanded ? "chevron-up" : "chevron-down"} size={14} color={ACCENT} />
          </TouchableOpacity>

          <Animated.View style={{ height: weekChartHeight, overflow: "hidden" }}>
            {maxCompletion === 0 ? (
              <View style={{ height: 130, paddingTop: 20, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13, color: MUTED, fontWeight: "600", marginBottom: 4 }}>No weekly data yet</Text>
                <Text style={{ fontSize: 11, color: MUTED, textAlign: "center", paddingHorizontal: 20 }}>Complete habits, tasks, and meals this week to unlock insights.</Text>
              </View>
            ) : (
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
            )}
          </Animated.View>
        </SectionCard>

        {/* ── Achievements ──────────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: CARD }]}>
          <View style={st.cardHeader}>
            <Ionicons name="trophy" size={18} color={YELLOW} />
            <Text style={st.cardTitle}>Achievements</Text>
            <Text style={styles.achieveCount}>{unlockedSet.size === 0 ? "Start earning badges 🌱" : `${unlockedSet.size}/${ACHIEVEMENTS.length} badges unlocked`}</Text>
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
          {/* Master Daily Reminders toggle */}
          <SettingRow icon="notifications" iconColor={ACCENT} iconBg={ACCENT + "25"} label="Daily Reminders"
            sub={notificationsEnabled ? "Reminders are active" : "All reminders paused"}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: notificationsEnabled ? GREEN : MUTED }}>
                  {notificationsEnabled ? "ON" : "OFF"}
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: BORDER, true: ACCENT }}
                  thumbColor="#ffffff"
                />
              </View>
            }
          />
          {[
            { key: "morning" as keyof typeof reminders, icon: "sunny", iconColor: YELLOW, iconBg: YELLOW + "25", label: "Morning Reminder", sub: "Daily habit check-in · 8:00 AM" },
            { key: "meal" as keyof typeof reminders, icon: "restaurant", iconColor: ACCENT, iconBg: ACCENT + "25", label: "Meal Reminder", sub: "Log your meals on time" },
            { key: "water" as keyof typeof reminders, icon: "water", iconColor: BLUE, iconBg: BLUE + "25", label: "Water Reminder", sub: "Stay hydrated every 2 hours" },
            { key: "evening" as keyof typeof reminders, icon: "moon", iconColor: PURPLE, iconBg: PURPLE + "25", label: "Evening Check-in", sub: "End-of-day summary · 9:00 PM" },
          ].map((row, i, arr) => (
            <SettingRow key={row.key} icon={row.icon} iconColor={row.iconColor} iconBg={row.iconBg} label={row.label} sub={row.sub} last={i === arr.length - 1}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: reminders[row.key] ? GREEN : MUTED }}>{reminders[row.key] ? "ON" : "OFF"}</Text>
                  <Switch value={reminders[row.key]} onValueChange={v => handleReminderToggle(row.key, v)}
                    trackColor={{ false: BORDER, true: ACCENT }} thumbColor="#ffffff" />
                </View>
              }
            />
          ))}
        </SectionCard>

        {/* ── Preferences ───────────────────────────────────────────── */}
        <SectionCard title="Preferences" icon="options">
          <SettingRow icon="moon" iconColor={PURPLE} iconBg={PURPLE + "25"} label="Appearance"
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
          <SettingRow icon="resize" iconColor={BLUE} iconBg={BLUE + "25"} label="Units"
            sub={preferences.units === "metric" ? "Metric (kg, cm, ml)" : "Imperial (lbs, ft, oz)"}
            onPress={() => setPreferences({ ...preferences, units: preferences.units === "metric" ? "imperial" : "metric" })}
            right={<Text style={[styles.prefNote, { color: ACCENT }]}>{preferences.units === "metric" ? "Metric" : "Imperial"}</Text>} />
          <SettingRow icon="barbell" iconColor={GREEN} iconBg={GREEN + "25"} label="Calorie Display"
            sub={preferences.calorieDisplay === "kcal" ? "Kilocalories (kcal)" : "Kilojoules (kJ)"}
            onPress={() => setPreferences({ ...preferences, calorieDisplay: preferences.calorieDisplay === "kcal" ? "kj" : "kcal" })}
            right={<Text style={[styles.prefNote, { color: ACCENT }]}>{preferences.calorieDisplay.toUpperCase()}</Text>} />
          <SettingRow icon="sparkles" iconColor={ACCENT} iconBg={ACCENT + "25"} label="Habit Completion Effects"
            sub="Sound & animation when a habit is completed"
            right={
              <Switch
                value={preferences.habitEffectsEnabled}
                onValueChange={(v) => setPreferences({ ...preferences, habitEffectsEnabled: v })}
                trackColor={{ false: BORDER, true: ACCENT }}
                thumbColor="#ffffff"
              />
            } />
          <SettingRow
            icon="star"
            iconColor={YELLOW}
            iconBg={YELLOW + "25"}
            label="Rate LyfeOS"
            sub="Enjoying LyfeOS? Your feedback helps us improve."
            onPress={handleRateApp}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />}
            last
          />
        </SectionCard>

        {/* ── Health Profile ────────────────────────────────────────── */}
        <View style={[st.card, { backgroundColor: CARD }]}>
          <TouchableOpacity style={st.cardHeader} onPress={toggleHp}>
            <Ionicons name="body" size={18} color={ACCENT} />
            <Text style={st.cardTitle}>Health Profile</Text>
            {healthFilled && <Text style={{ fontSize: 12, color: GREEN, fontWeight: "600", marginRight: 8 }}>Complete ✅</Text>}
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
              <HpRow
                label="Height"
                value={hp.height.replace(/cm/g, "").trim()}
                onChangeText={v => setHp(p => ({ ...p, height: (p.height.includes("'") || p.height.includes("ft")) ? v : `${v} cm` }))}
                keyboardType={(hp.height.includes("'") || hp.height.includes("ft")) ? "default" : "number-pad"}
                unit={(hp.height.includes("'") || hp.height.includes("ft")) ? "ft/in" : "cm"}
                onToggleUnit={toggleHeightUnit}
              />
              <HpRow
                label="Weight"
                value={hp.weight.replace(/lb|kg/g, "").trim()}
                onChangeText={v => setHp(p => ({ ...p, weight: p.weight.includes("lb") ? `${v} lb` : `${v} kg` }))}
                keyboardType="decimal-pad"
                unit={hp.weight.includes("lb") ? "lb" : "kg"}
                onToggleUnit={toggleWeightUnit}
              />

              <Text style={styles.hpSelectLabel}>Biological Sex</Text>
              <View style={styles.chipRow}>
                {(["male", "female", "other"] as const).map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, hp.sex === s && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setHp(p => ({ ...p, sex: s }))}>
                    <Text style={[styles.chipText, hp.sex === s && { color: "#fff" }]}>{s === "other" ? "Prefer not to say" : s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hpSelectLabel}>Activity Level</Text>
              <View style={styles.chipRow}>
                {([["sedentary", "Sedentary"], ["lightly", "Lightly Active"], ["moderately", "Moderately Active"], ["very", "Very Active"]] as const).map(([k, lbl]) => (
                  <TouchableOpacity key={k} style={[styles.chip, hp.activityLevel === k && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setHp(p => ({ ...p, activityLevel: k }))}>
                    <Text style={[styles.chipText, hp.activityLevel === k && { color: "#fff" }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hpSelectLabel}>Goal</Text>
              <View style={styles.chipRow}>
                {([["lose", "Lose Weight"], ["maintain", "Maintain"], ["muscle", "Build Muscle"], ["fitness", "Improve Fitness"]] as const).map(([k, lbl]) => (
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

        {/* ── Account Settings ──────────────────────────────────────── */}
        <SectionCard title="Account" icon="person-circle-outline">
          {isGuest || !user ? (
            <View style={{ padding: 16, backgroundColor: ACCENT + "15", borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: ACCENT + "30" }}>
              <Text style={{ color: WHITE, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>Sign in to save your data</Text>
              <Text style={{ color: MUTED, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>Your progress syncs when you create an account</Text>
              <TouchableOpacity onPress={() => router.replace("/login" as any)} style={{ backgroundColor: ACCENT, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: WHITE, fontWeight: "700", fontSize: 15 }}>Sign In / Create Account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <SettingRow icon="mail-outline" iconColor={BLUE} iconBg={BLUE + "25"} label={user.displayName || "User"} sub={user.email || ""} />
              {/* Change Password — only for email/password sign-in, not Google or Guest */}
              {user?.providerData?.[0]?.providerId === 'password' && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Change Password',
                      `We'll send a password reset link to:\n${user.email}`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Send Link',
                          onPress: async () => {
                            try {
                              if (user.email) {
                                await auth().sendPasswordResetEmail(user.email);
                                Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
                              }
                            } catch (e: any) {
                              Alert.alert('Error', 'Failed to send reset email. Please try again.');
                              logError(e, 'change_password');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginTop: 2 }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FF6B3525', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="key-outline" size={18} color="#FF6B35" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600' }}>Change Password</Text>
                    <Text style={{ color: MUTED, fontSize: 12, marginTop: 1 }}>Send a reset link to your email</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={MUTED} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSignOut} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12, marginTop: 4 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: RED + "25", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="log-out-outline" size={18} color={RED} />
                </View>
                <Text style={{ color: RED, fontSize: 15, fontWeight: "600" }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        {/* ── Data & Privacy ────────────────────────────────────────── */}
        <SectionCard title="Data & Privacy" icon="shield-checkmark">
          <SettingRow icon="share-outline" iconColor={BLUE} iconBg={BLUE + "25"} label="Export My Data" sub="Download a summary of all your data" onPress={handleExportData}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />} />
          <SettingRow icon="today-outline" iconColor={YELLOW} iconBg={YELLOW + "25"} label="Clear Today's Data" sub="Remove today's logs only" onPress={handleClearToday}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />} last />
        </SectionCard>

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        <SectionCard title="Danger Zone" icon="warning-outline">
          <SettingRow
            icon="warning-outline"
            iconColor={YELLOW}
            iconBg={YELLOW + "25"}
            label="Reset All Data"
            sub="Clears local LyfeOS data on this device"
            onPress={handleResetAll}
            right={<Ionicons name="chevron-forward" size={16} color={MUTED} />}
          />
          <SettingRow
            icon="trash-outline"
            iconColor={RED}
            iconBg={RED + "25"}
            label="Delete Account & Data"
            sub="Permanently deletes your LyfeOS account and associated cloud data"
            onPress={handleDeleteAccountFlow}
            right={<Ionicons name="chevron-forward" size={16} color={RED} />}
            last
          />
        </SectionCard>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>🌿 LyfeOS</Text>
          <Text style={styles.footerVersion}>Version {Constants.expoConfig?.version || "1.0.0"}</Text>
          <Text style={styles.footerTagline}>Made with ❤️ for your wellbeing</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync("https://sites.google.com/view/lyfe-os-privacy-policy/home")}><Text style={styles.footerLink}>Privacy Policy</Text></TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync("https://sites.google.com/view/lyfeos-terms/home")}><Text style={styles.footerLink}>Terms of Service</Text></TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* ── Migration Success Banner ────────────────────────────────── */}
      {migrationSuccess && (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + 90,
            left: 16,
            right: 16,
            backgroundColor: GREEN,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 1,
            borderColor: GREEN + "80",
          }}
        >
          <Text style={{ fontSize: 18 }}>✅</Text>
          <Text
            style={{
              flex: 1,
              color: "#fff",
              fontSize: 14,
              fontWeight: "700",
              fontFamily: "Inter",
              lineHeight: 20,
            }}
          >
            Your guest data has been saved to your account!
          </Text>
        </View>
      )}

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

      {/* ── Re-Authentication Password Modal ───────────────────────── */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setShowPasswordModal(false);
            setReauthPassword("");
            setPasswordError("");
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: CARD,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: BORDER,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: RED + "25",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="key-outline" size={20} color={RED} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: WHITE, flex: 1 }}>
                Confirm Deletion
              </Text>
            </View>

            <Text style={{ fontSize: 13, color: MUTED, lineHeight: 18, marginBottom: 16 }}>
              For your security, please enter your current password to verify ownership before permanently deleting your account and cloud data.
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: CARD2,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: passwordError ? RED : BORDER,
                paddingHorizontal: 14,
                marginBottom: 6,
              }}
            >
              <TextInput
                secureTextEntry={!showPasswordText}
                placeholder="Enter your current password"
                placeholderTextColor={MUTED}
                value={reauthPassword}
                onChangeText={(t) => {
                  setReauthPassword(t);
                  setPasswordError("");
                }}
                autoCapitalize="none"
                editable={!isDeleting}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: WHITE,
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPasswordText(!showPasswordText)}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={showPasswordText ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={MUTED}
                />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <Text style={{ color: RED, fontSize: 12, marginBottom: 14, marginLeft: 2 }}>
                {passwordError}
              </Text>
            ) : (
              <View style={{ height: 14 }} />
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordModal(false);
                  setReauthPassword("");
                  setPasswordError("");
                }}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: CARD2,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              >
                <Text style={{ color: WHITE, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!reauthPassword.trim()) {
                    setPasswordError("Please enter your password.");
                    return;
                  }
                  performDeletion(reauthPassword);
                }}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: RED,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                    Delete Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Deletion Loading Overlay ───────────────────────────────── */}
      <Modal visible={isDeleting && !showPasswordModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.75)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: CARD,
              borderRadius: 20,
              padding: 28,
              alignItems: "center",
              borderWidth: 1,
              borderColor: BORDER,
              width: "100%",
              maxWidth: 320,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <ActivityIndicator size="large" color={ACCENT} style={{ marginBottom: 16 }} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: WHITE,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {deletingMessage}
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 }}>
              Please do not close or leave the app.
            </Text>
          </View>
        </View>
      </Modal>
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
  onToggleUnit?: () => void;
}

// ── Health profile row ────────────────────────────────────────────────────────
function HpRow({ label, value, onChangeText, keyboardType, unit, onToggleUnit }: HpRowProps) {
  const theme = useAppTheme();
  const { MUTED } = theme;
  const styles = makeStyles(theme);
  return (
    <View style={styles.hpRow}>
      <Text style={styles.hpRowLabel}>{label}</Text>
      <View style={styles.hpRowRight}>
        <TextInput style={styles.hpInput} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder="—" placeholderTextColor={MUTED} maxLength={6} />
        {onToggleUnit ? (
          <TouchableOpacity onPress={onToggleUnit} style={{ paddingHorizontal: 6, paddingVertical: 4, backgroundColor: theme.BORDER, borderRadius: 6, width: 44, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: theme.TEXT, fontWeight: "600" }}>{unit}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hpRowUnit}>{unit}</Text>
        )}
      </View>
    </View>
  );
}
