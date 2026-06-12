import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Priority, RepeatType, Todo, useTodos } from "@/context/TodosContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";

// Change 2: Low → Grey (#94A3B8), Green reserved for Completed state
const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#EF4444",   // 🔴 Red
  high:   "#F97316",   // 🟠 Orange
  medium: "#EAB308",   // 🟡 Yellow
  low:    "#94A3B8",   // ⚪ Grey
};
const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};
// Change 2: Low emoji → ⚪
const PRIORITY_EMOJIS: Record<Priority, string> = {
  urgent: "🔴", high: "🟠", medium: "🟡", low: "⚪",
};
const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
const REPEAT_OPTIONS: RepeatType[] = ["none", "daily", "weekly", "monthly"];

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => getLocalDateString();
const tomorrowStr = () => {
  const d = new Date(); d.setDate(d.getDate() + 1); return getLocalDateString(d);
};
function formatDueLabel(dueDate?: string, dueTime?: string) {
  if (!dueDate) return null;
  const ts = todayStr(), tm = tomorrowStr();
  let label = dueDate === ts ? "Today" : dueDate === tm ? "Tomorrow" : dueDate;
  if (dueTime) label += ` · ${dueTime}`;
  return label;
}
function isOverdue(todo: Todo) {
  return !todo.completed && !!todo.dueDate && todo.dueDate < todayStr();
}
function isThisWeek(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return d >= start && d <= end;
}
function isThisMonth(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function getMotivationalCopy() {
  const h = new Date().getHours();
  if (h < 12) return "Morning is the best time to plan your day ☀️";
  if (h < 17) return "Afternoon grind 💪";
  return "Evening wrap-up 🌙";
}

// Rotating productivity tips for the footer
const PRODUCTIVITY_TIPS = [
  "Small wins every day create big results.",
  "Focus on what matters most — the rest can wait.",
  "Done is better than perfect. Keep moving.",
  "One task at a time. That's how mountains move.",
  "Prioritize ruthlessly. Your time is your most valuable resource.",
  "Break big tasks into small steps — momentum builds quickly.",
  "The secret to productivity is starting.",
];

// ── Section list types ────────────────────────────────────────────────────────
type ViewMode = "today" | "week" | "month";
type PriorityFilter = Priority | "all";
type ListItem =
  | { _type: "section"; title: string; isOverdue?: boolean; isCompleted?: boolean; id: string }
  | { _type: "todo"; todo: Todo; id: string };

function buildItems(todos: Todo[], view: ViewMode, pf: PriorityFilter): ListItem[] {
  const ts = todayStr(), tm = tomorrowStr();
  const filtered = pf === "all" ? todos : todos.filter(t => t.priority === pf);
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const items: ListItem[] = [];

  const overdue = filtered.filter(t => !t.completed && t.dueDate && t.dueDate < ts);
  if (overdue.length) {
    items.push({ _type: "section", title: "Overdue 🔴", isOverdue: true, id: "s-overdue" });
    overdue.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
  }

  if (view === "today") {
    const active = filtered.filter(t => !t.completed && (t.dueDate === ts || !t.dueDate));
    // Change 6: "🎉 Completed Today" instead of "Completed ✓"
    const done = filtered.filter(t => t.completed && (!t.dueDate || t.dueDate === ts));
    if (active.length) {
      items.push({ _type: "section", title: "Today", id: "s-today" });
      active.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
    }
    if (done.length) {
      items.push({ _type: "section", title: `🎉 Completed Today · ${done.length}`, isCompleted: true, id: "s-done" });
      done.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
    }
  } else if (view === "week") {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
      const dStr = getLocalDateString(d);
      const dayTodos = filtered.filter(t => !t.completed && t.dueDate === dStr);
      if (dayTodos.length) {
        const lbl = dStr === ts ? `Today · ${dayNames[d.getDay()]}` : dStr === tm ? `Tomorrow · ${dayNames[d.getDay()]}` : `${dayNames[d.getDay()]} · ${monthNames[d.getMonth()]} ${d.getDate()}`;
        items.push({ _type: "section", title: lbl, id: `s-${dStr}` });
        dayTodos.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
      }
    }
    const noDue = filtered.filter(t => !t.completed && !t.dueDate);
    if (noDue.length) {
      items.push({ _type: "section", title: "No Due Date", id: "s-nodue" });
      noDue.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
    }
  } else {
    const now = new Date();
    for (let week = 0; week < 5; week++) {
      const start = new Date(now.getFullYear(), now.getMonth(), week * 7 + 1);
      const end = new Date(now.getFullYear(), now.getMonth(), week * 7 + 7);
      const weekTodos = filtered.filter(t => {
        if (!t.dueDate || t.completed) return false;
        const d = new Date(t.dueDate + "T12:00:00");
        return d >= start && d <= end && isThisMonth(t.dueDate);
      });
      if (weekTodos.length) {
        items.push({ _type: "section", title: `Week ${week + 1} · ${monthNames[now.getMonth()]}`, id: `s-w${week}` });
        weekTodos.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
      }
    }
    const noDue = filtered.filter(t => !t.completed && !t.dueDate);
    if (noDue.length) {
      items.push({ _type: "section", title: "No Due Date", id: "s-nodue" });
      noDue.forEach(t => items.push({ _type: "todo", todo: t, id: t.id }));
    }
  }

  return items;
}

// ── Add/Edit Task Sheet ───────────────────────────────────────────────────────
interface AddTaskSheetProps {
  visible: boolean;
  onClose: () => void;
  editTodo?: Todo | null;
  initialTitle?: string;
}
function AddTaskSheet({ visible, onClose, editTodo, initialTitle }: AddTaskSheetProps) {
  const insets = useSafeAreaInsets();
  const { addTodo, updateTodo } = useTodos();
  const theme = useAppTheme();
  const { MUTED } = theme;
  const sStyles = useMemo(() => makeSStyles(theme), [theme]);
  const isEditing = !!editTodo;

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueDateChip, setDueDateChip] = useState<"today" | "tomorrow" | "custom" | "none">("none");
  const [showTime, setShowTime] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState<RepeatType>("none");
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    if (visible) {
      if (editTodo) {
        setTitle(editTodo.title);
        setDueDate(editTodo.dueDate ?? "");
        setCustomDate(editTodo.dueDate ?? "");
        const ts = todayStr(), tm = tomorrowStr();
        setDueDateChip(editTodo.dueDate === ts ? "today" : editTodo.dueDate === tm ? "tomorrow" : editTodo.dueDate ? "custom" : "none");
        setShowTime(!!editTodo.dueTime);
        setDueTime(editTodo.dueTime ?? "");
        setPriority(editTodo.priority);
        setNotes(editTodo.notes ?? "");
        setRepeat(editTodo.repeat ?? "none");
      } else {
        setTitle(initialTitle ?? "");
        setDueDate("");
        setDueDateChip("none");
        setShowTime(false);
        setDueTime("");
        setPriority("medium");
        setNotes("");
        setRepeat("none");
        setCustomDate("");
      }
    }
  }, [visible, editTodo, initialTitle]);

  const pickChip = (chip: "today" | "tomorrow" | "none") => {
    setDueDateChip(chip);
    if (chip === "today") setDueDate(todayStr());
    else if (chip === "tomorrow") setDueDate(tomorrowStr());
    else setDueDate("");
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const finalDate = dueDateChip === "custom" ? customDate : dueDate;
    const payload = {
      title: title.trim(),
      completed: editTodo?.completed ?? false,
      priority,
      category: editTodo?.category ?? ("Personal" as const),
      dueDate: finalDate || undefined,
      dueTime: showTime && dueTime ? dueTime : undefined,
      notes: notes.trim() || undefined,
      repeat,
    };
    if (isEditing && editTodo) {
      updateTodo(editTodo.id, payload);
    } else {
      addTodo(payload);
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const pColor = PRIORITY_COLORS[priority];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={{ width: "100%", justifyContent: "flex-end", flexShrink: 1 }}>
          <TouchableOpacity activeOpacity={1} style={[sStyles.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={sStyles.handle} />
              <View style={sStyles.sheetHeader}>
                <Text style={sStyles.sheetTitle}>{isEditing ? "Edit Task" : "New Task"}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>
                {/* Title */}
                <TextInput
                  style={sStyles.titleInput}
                  placeholder="What needs to be done?"
                  placeholderTextColor={MUTED}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus={!isEditing}
                  maxLength={120}
                  multiline
                />

                {/* Due date */}
                <Text style={sStyles.label}>Due Date</Text>
                <View style={sStyles.chipRow}>
                  {(["none","today","tomorrow"] as const).map(chip => (
                    <TouchableOpacity key={chip} style={[sStyles.dateChip, dueDateChip === chip && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => pickChip(chip)}>
                      <Text style={[sStyles.dateChipText, dueDateChip === chip && { color: "#fff" }]}>
                        {chip === "none" ? "No Date" : chip === "today" ? "Today" : "Tomorrow"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[sStyles.dateChip, dueDateChip === "custom" && { backgroundColor: ACCENT + "22", borderColor: ACCENT }]} onPress={() => setDueDateChip("custom")}>
                    <Ionicons name="calendar-outline" size={14} color={dueDateChip === "custom" ? ACCENT : MUTED} />
                  </TouchableOpacity>
                </View>
                {dueDateChip === "custom" && (
                  <TextInput
                    style={sStyles.customDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={MUTED}
                    value={customDate}
                    onChangeText={setCustomDate}
                    maxLength={10}
                  />
                )}

                {/* Due time */}
                <View style={sStyles.timeRow}>
                  <Text style={sStyles.label}>Due Time</Text>
                  <TouchableOpacity onPress={() => setShowTime(p => !p)} style={[sStyles.togglePill, showTime && { backgroundColor: ACCENT }]}>
                    <Text style={[sStyles.togglePillText, showTime && { color: "#fff" }]}>{showTime ? "On" : "Off"}</Text>
                  </TouchableOpacity>
                </View>
                {showTime && (
                  <TextInput
                    style={sStyles.customDateInput}
                    placeholder="HH:MM (e.g. 09:30)"
                    placeholderTextColor={MUTED}
                    value={dueTime}
                    onChangeText={setDueTime}
                    maxLength={5}
                  />
                )}

                {/* Priority */}
                <Text style={sStyles.label}>Priority</Text>
                <View style={sStyles.priorityRow}>
                  {PRIORITIES.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[sStyles.priorityChip, { borderColor: PRIORITY_COLORS[p] + "60", backgroundColor: priority === p ? PRIORITY_COLORS[p] : PRIORITY_COLORS[p] + "18" }]}
                      onPress={() => setPriority(p)}
                    >
                      <Text style={sStyles.priorityEmoji}>{PRIORITY_EMOJIS[p]}</Text>
                      <Text style={[sStyles.priorityChipText, { color: priority === p ? "#fff" : PRIORITY_COLORS[p] }]}>{PRIORITY_LABELS[p]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Repeat */}
                <Text style={sStyles.label}>Repeat</Text>
                <View style={sStyles.chipRow}>
                  {REPEAT_OPTIONS.map(r => (
                    <TouchableOpacity key={r} style={[sStyles.dateChip, repeat === r && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setRepeat(r)}>
                      <Text style={[sStyles.dateChipText, repeat === r && { color: "#fff" }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes */}
                <Text style={sStyles.label}>Notes (optional)</Text>
                <TextInput
                  style={sStyles.notesInput}
                  placeholder="Add notes..."
                  placeholderTextColor={MUTED}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />

                {/* Save */}
                <TouchableOpacity
                  style={[sStyles.saveBtn, { backgroundColor: ACCENT, opacity: title.trim() ? 1 : 0.4 }]}
                  onPress={handleSave}
                  disabled={!title.trim()}
                >
                  <Text style={sStyles.saveBtnText}>{isEditing ? "Save Changes" : "Add Task"}</Text>
                </TouchableOpacity>
            </KeyboardAwareScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
interface TaskCardProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDuplicate: (todo: Todo) => void;
  onChangePriority: (todo: Todo) => void;
}
function TaskCard({ todo, onToggle, onDelete, onEdit, onDuplicate, onChangePriority }: TaskCardProps) {
  const theme = useAppTheme();
  const { CARD, MUTED, RED, GREEN } = theme;
  const tStyles = useMemo(() => makeTStyles(theme), [theme]);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pColor = PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS.medium;
  const overdue = isOverdue(todo);
  const dueLabel = formatDueLabel(todo.dueDate, todo.dueTime);

  // Change 2: Completed state uses GREEN regardless of priority
  const checkboxColor = todo.completed ? GREEN : pColor;

  const handleToggle = () => {
    if (!todo.completed) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 320, useNativeDriver: false }),
      ]).start();
    }
    onToggle(todo.id);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLongPress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      onEdit(todo);
    } else {
      Alert.alert(todo.title, undefined, [
        { text: "✏️ Edit Task", onPress: () => onEdit(todo) },
        { text: "📋 Duplicate Task", onPress: () => onDuplicate(todo) },
        { text: "🗑️ Delete Task", style: "destructive", onPress: () => onDelete(todo.id) },
        { text: "❌ Cancel", style: "cancel" },
      ]);
    }
  };

  const bgAnim = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [CARD, "#22C55E18"] });

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <TouchableOpacity 
        style={{ backgroundColor: RED, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 20, marginBottom: 9, borderRadius: 14 }} 
        onPress={() => onDelete(todo.id)}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Animated.View style={[tStyles.card, { backgroundColor: bgAnim, opacity: todo.completed ? 0.55 : 1 }]}>
        {/* Change 2: Accent bar — priority color on left edge */}
        <View style={[tStyles.accentBar, { backgroundColor: todo.completed ? GREEN : pColor }]} />
        <TouchableOpacity style={tStyles.row} onPress={handleToggle} onLongPress={handleLongPress} activeOpacity={0.85} delayLongPress={400}>
          {/* Checkbox */}
          <TouchableOpacity
            onPress={handleToggle}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[tStyles.checkbox, { borderColor: checkboxColor, backgroundColor: todo.completed ? GREEN : "transparent" }]}
          >
            {todo.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>

          {/* Content */}
          <View style={tStyles.content}>
            <Text style={[tStyles.title, todo.completed && tStyles.titleDone]} numberOfLines={2}>{todo.title}</Text>
            <View style={tStyles.meta}>
              {dueLabel && (
                <View style={tStyles.metaChip}>
                  <Ionicons name="calendar-outline" size={10} color={overdue ? RED : MUTED} />
                  <Text style={[tStyles.metaText, overdue && { color: RED }]}>{dueLabel}</Text>
                </View>
              )}
              {todo.repeat && todo.repeat !== "none" && (
                <View style={tStyles.metaChip}>
                  <Ionicons name="repeat" size={10} color={MUTED} />
                  <Text style={tStyles.metaText}>{todo.repeat}</Text>
                </View>
              )}
              <View style={[tStyles.priorityDot, { backgroundColor: todo.completed ? GREEN : pColor }]} />
            </View>
          </View>

          {/* Priority pill */}
          <View style={[tStyles.priorityPill, { backgroundColor: (todo.completed ? GREEN : pColor) + "20", borderColor: (todo.completed ? GREEN : pColor) + "50" }]}>
            <Text style={[tStyles.priorityPillText, { color: todo.completed ? GREEN : pColor }]}>
              {todo.completed ? "Done" : PRIORITY_LABELS[todo.priority]}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
}


// ── Celebration Overlay ───────────────────────────────────────────────────────
function CelebrationOverlay({ visible }: { visible: boolean }) {
  const theme = useAppTheme();
  const cStyles = useMemo(() => makeCStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[cStyles.overlay, { opacity }]} pointerEvents="none">
      <Text style={cStyles.emoji}>🎯</Text>
      <Text style={cStyles.title}>All done!</Text>
      <Text style={cStyles.sub}>Crushed it today!</Text>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TodosScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, MUTED, BORDER, RED, GREEN, TEXT: WHITE } = theme;
  const styles = makeStyles(theme);
  const sStyles = makeSStyles(theme);
  const { todos, addTodo, toggleTodo, deleteTodo, updateTodo } = useTodos();

  const [view, setView] = useState<ViewMode>("today");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [changePriorityTodo, setChangePriorityTodo] = useState<Todo | null>(null);

  // Change 7: FAB scale animation
  const fabScale = useRef(new Animated.Value(1)).current;
  const handleFabPressIn = () => {
    Animated.spring(fabScale, { toValue: 0.91, useNativeDriver: true, speed: 28, bounciness: 4 }).start();
  };
  const handleFabPressOut = () => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };
  const handleFabPress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditTodo(null);
    setShowAddSheet(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const ts = todayStr();

  // Stats
  const totalCount = todos.length;
  const doneCount = todos.filter(t => t.completed).length;
  const urgentCount = todos.filter(t => !t.completed && t.priority === "urgent").length;
  const highCount = todos.filter(t => !t.completed && t.priority === "high").length;
  const mediumCount = todos.filter(t => !t.completed && t.priority === "medium").length;
  const lowCount = todos.filter(t => !t.completed && t.priority === "low").length;
  const urgentHighCount = urgentCount + highCount; // for legacy "Urgent" stat card
  const dueTodayCount = todos.filter(t => !t.completed && t.dueDate === ts).length;

  // Today's progress bar
  const todayTotal = todos.filter(t => t.dueDate === ts || !t.dueDate).length;
  const todayDone = todos.filter(t => t.completed && (t.dueDate === ts || !t.dueDate)).length;
  const todayPct = todayTotal > 0 ? todayDone / todayTotal : 0;
  const allTodayDone = todayTotal > 0 && todayDone === todayTotal;

  // Overdue tasks
  const overdueTodos = todos.filter(t => !t.completed && t.dueDate && t.dueDate < ts);

  // Celebration
  const prevAllDone = useRef(false);
  useEffect(() => {
    if (allTodayDone && !prevAllDone.current && todayTotal > 0) {
      setShowCelebration(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => setShowCelebration(false), 2300);
      return () => clearTimeout(t);
    }
    prevAllDone.current = allTodayDone;
  }, [allTodayDone, todayTotal]);

  const listItems = buildItems(todos, view, priorityFilter);
  const noTodos = todos.length === 0;
  const noItems = listItems.length === 0;

  const handleDelete = (id: string) => {
    if (Platform.OS === "web") { deleteTodo(id); return; }
    Alert.alert("Delete Task", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTodo(id) },
    ]);
  };

  const handleDuplicate = (todo: Todo) => {
    addTodo({ title: `${todo.title} (copy)`, completed: false, priority: todo.priority, category: todo.category, dueDate: todo.dueDate, dueTime: todo.dueTime, notes: todo.notes, repeat: todo.repeat });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleChangePriority = (todo: Todo) => {
    if (Platform.OS === "web") { setChangePriorityTodo(todo); return; }
    Alert.alert("Change Priority", undefined,
      [...PRIORITIES.map(p => ({ text: `${PRIORITY_EMOJIS[p]} ${PRIORITY_LABELS[p]}`, onPress: () => updateTodo(todo.id, { priority: p }) })), { text: "Cancel", style: "cancel" as const }]
    );
  };

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) { setShowAddSheet(true); return; }
    addTodo({ title: quickTitle.trim(), completed: false, priority: "medium", category: "Personal", dueDate: ts });
    setQuickTitle("");
    Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Change 3: Professional quick suggestions
  const QUICK_SUGGESTIONS = [
    { emoji: "📞", label: "Client Call" },
    { emoji: "💊", label: "Take Medication" },
    { emoji: "🛒", label: "Grocery Run" },
  ];

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item._type === "section") {
      // Change 6: Completed section gets green border
      const isCompleted = item.isCompleted === true;
      const borderColor = item.isOverdue ? RED : isCompleted ? GREEN : ACCENT;
      return (
        <View style={[styles.sectionHeader, { borderLeftColor: borderColor }]}>
          <Text style={[styles.sectionTitle, item.isOverdue && { color: RED }, isCompleted && { color: GREEN }]}>
            {item.title}
          </Text>
        </View>
      );
    }
    return (
      <TaskCard
        todo={item.todo}
        onToggle={toggleTodo}
        onDelete={handleDelete}
        onEdit={t => { setEditTodo(t); setShowAddSheet(true); }}
        onDuplicate={handleDuplicate}
        onChangePriority={handleChangePriority}
      />
    );
  };

  // Change 8: Priority counts for filter chips
  const PRIORITY_COUNTS: Record<Priority, number> = {
    urgent: urgentCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount,
  };

  // Change 5: Stats — motivational when no tasks
  const STATS = [
    { label: "Total", value: totalCount, icon: "📋", color: "#A3A3A3" },
    { label: "Done", value: doneCount, icon: "✅", color: GREEN },
    { label: "Urgent", value: urgentHighCount, icon: "🔴", color: RED },
    { label: "Due Today", value: dueTodayCount, icon: "⏳", color: ACCENT },
  ];

  const STAT_FILTERS: Record<string, PriorityFilter | "all"> = { Total: "all", Done: "all", Urgent: "urgent", "Due Today": "all" };

  // Bottom padding accounts for the quick add bar (~64px) + tab bar + insets
  const bottomPadding = (Platform.OS === "web" ? 100 : insets.bottom + 60) + 64;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: BG }]}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenTitle}>Focus</Text>
            <Text style={styles.motiveCopy}>{getMotivationalCopy()}</Text>
          </View>
          {/* Change 7: FAB with scale animation + haptic */}
          <Animated.View style={{ transform: [{ scale: fabScale }] }}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleFabPress}
              onPressIn={handleFabPressIn}
              onPressOut={handleFabPressOut}
              activeOpacity={1}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Progress bar */}
        {todayTotal > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: `${todayPct * 100}%`, backgroundColor: allTodayDone ? GREEN : ACCENT }]} />
            </View>
            <Text style={[styles.progressLabel, allTodayDone && { color: GREEN }]}>
              {allTodayDone ? "✅ All tasks done!" : `${todayDone} of ${todayTotal} done today`}
            </Text>
          </View>
        )}

        {/* Change 5: Stats row — motivational when no tasks */}
        {totalCount === 0 ? (
          <View style={styles.zeroStatsCard}>
            <Text style={styles.zeroStatsEmoji}>🌱</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.zeroStatsTitle, { color: theme.TEXT }]}>Start your first task today</Text>
              <Text style={[styles.zeroStatsSub, { color: MUTED }]}>Tap ＋ above or use Quick Add below</Text>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
            {STATS.map(s => (
              <TouchableOpacity key={s.label} style={styles.statCard} onPress={() => setPriorityFilter(STAT_FILTERS[s.label] as PriorityFilter)}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* View toggle */}
        <View style={styles.viewToggleRow}>
          {(["today","week","month"] as ViewMode[]).map(v => (
            <TouchableOpacity key={v} style={[styles.viewToggle, view === v && styles.viewToggleActive]} onPress={() => setView(v)}>
              <Text style={[styles.viewToggleText, view === v && styles.viewToggleTextActive]}>
                {v === "today" ? "Today" : v === "week" ? "This Week" : "This Month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Change 8: Priority filter chips with counts */}
        <View style={{ position: "relative" }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            <TouchableOpacity style={[styles.chip, priorityFilter === "all" && styles.chipActive]} onPress={() => setPriorityFilter("all")}>
              <Text style={[styles.chipText, priorityFilter === "all" && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {PRIORITIES.map(p => {
              const count = PRIORITY_COUNTS[p];
              const isActive = priorityFilter === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, isActive && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]}
                  onPress={() => setPriorityFilter(p)}
                >
                  <Text style={[styles.chipText, isActive && { color: "#fff" }]}>
                    {PRIORITY_EMOJIS[p]} {PRIORITY_LABELS[p]}{count > 0 ? ` (${count})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <LinearGradient
            colors={["transparent", BG]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: "absolute", right: 0, top: 0, bottom: 4, width: 32 }}
            pointerEvents="none"
          />
        </View>

        {/* Overdue banner */}
        {overdueTodos.length > 0 && (
          <View style={styles.overdueBanner}>
            <Ionicons name="warning" size={14} color={RED} />
            <Text style={styles.overdueBannerText}>
              ⚠️ {overdueTodos.length} task{overdueTodos.length > 1 ? "s" : ""} overdue — handle them first
            </Text>
          </View>
        )}
      </View>

      {/* ── Task List ─────────────────────────────────────────────────── */}
      {noTodos ? (
        /* Brand new user empty state */
        <ScrollView contentContainerStyle={[styles.emptyFull, { paddingBottom: bottomPadding }]}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>Nothing to focus on yet</Text>
          <Text style={styles.emptyDesc}>Add your first task and start getting things done.</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={() => { setEditTodo(null); setShowAddSheet(true); }}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyAddBtnText}>＋ Add First Task</Text>
          </TouchableOpacity>
          <Text style={styles.emptySuggestLabel}>Quick suggestions</Text>
          <View style={styles.suggestionChips}>
            {QUICK_SUGGESTIONS.map(s => (
              <TouchableOpacity key={s.label} style={styles.suggestionChip} onPress={() => addTodo({ title: `${s.emoji} ${s.label}`, completed: false, priority: "medium", category: "Personal" })}>
                <Text style={styles.suggestionChipText}>{s.emoji} {s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : noItems ? (
        /* View-specific empty state */
        <ScrollView contentContainerStyle={[styles.emptyFull, { paddingBottom: bottomPadding }]}>
          <Text style={styles.emptyEmoji}>{view === "today" ? "🎉" : view === "week" ? "📅" : "📆"}</Text>
          <Text style={styles.emptyTitle}>
            {view === "today" ? "Nothing due today" : view === "week" ? "Your week is clear" : "Nothing this month"}
          </Text>
          <Text style={styles.emptyDesc}>
            {view === "today" ? "Enjoy your day or plan ahead" : "Start planning ahead"}
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => { setEditTodo(null); setShowAddSheet(true); }}>
              <Text style={styles.emptyAddBtnText}>Add Task</Text>
            </TouchableOpacity>
            {view === "today" && (
              <TouchableOpacity style={styles.emptyOutlineBtn} onPress={() => setView("week")}>
                <Text style={styles.emptyOutlineBtnText}>View This Week</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        /* FlatList for Tasks */
        <FlatList
          data={listItems}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Quick Add Bar ─────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.quickBarContainer, { bottom: Platform.OS === "web" ? 90 : insets.bottom + 54 }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <View style={styles.quickBar}>
          <TouchableOpacity onPress={() => { setEditTodo(null); setShowAddSheet(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="add-circle-outline" size={18} color={MUTED} />
          </TouchableOpacity>
          <TextInput
            style={[styles.quickBarText, { color: WHITE }]}
            placeholder="Add a quick task..."
            placeholderTextColor={MUTED}
            value={quickTitle}
            onChangeText={setQuickTitle}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
            editable={true}
          />
          <TouchableOpacity style={styles.quickBarSend} onPress={handleQuickAdd}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AddTaskSheet
        visible={showAddSheet}
        onClose={() => { setShowAddSheet(false); setEditTodo(null); }}
        editTodo={editTodo}
        initialTitle={quickTitle}
      />

      {/* Change priority web modal */}
      {changePriorityTodo && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setChangePriorityTodo(null)}>
          <TouchableOpacity style={sStyles.overlay} activeOpacity={1} onPress={() => setChangePriorityTodo(null)}>
            <View style={styles.priorityModal}>
              <Text style={styles.priorityModalTitle}>Change Priority</Text>
              {PRIORITIES.map(p => (
                <TouchableOpacity key={p} style={[styles.priorityModalOption, { borderColor: PRIORITY_COLORS[p] + "44" }]} onPress={() => { updateTodo(changePriorityTodo.id, { priority: p }); setChangePriorityTodo(null); }}>
                  <Text style={styles.priorityModalOptionText}>{PRIORITY_EMOJIS[p]} {PRIORITY_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <CelebrationOverlay visible={showCelebration} />
    </View>
  );
}

// ── Task card styles ──────────────────────────────────────────────────────────
const makeTStyles = (t: AppTheme) => StyleSheet.create({
  card: { borderRadius: 14, marginBottom: 9, borderWidth: 1, borderColor: t.BORDER, overflow: "hidden" },
  accentBar: { height: 3, width: "100%" },
  row: { flexDirection: "row", alignItems: "center", padding: 13, gap: 10 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600" as const, color: t.TEXT, marginBottom: 5, lineHeight: 19 },
  titleDone: { textDecorationLine: "line-through" as const, color: t.MUTED },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 10, color: t.MUTED, fontWeight: "500" as const },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  priorityPillText: { fontSize: 10, fontWeight: "700" as const },
});

// ── Add sheet styles ──────────────────────────────────────────────────────────
const makeSStyles = (t: AppTheme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, maxHeight: "92%" },
  handle: { width: 40, height: 4, backgroundColor: t.BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "700" as const, color: t.TEXT },
  titleInput: { fontSize: 18, fontWeight: "600" as const, color: t.TEXT, borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: 10, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" as const },
  dateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.BORDER, borderWidth: 1, borderColor: t.BORDER, alignItems: "center", justifyContent: "center" },
  dateChipText: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const },
  customDateInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: t.TEXT, marginBottom: 16 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  togglePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: t.BORDER },
  togglePillText: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" as const },
  priorityChip: { flex: 1, minWidth: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  priorityEmoji: { fontSize: 13 },
  priorityChipText: { fontSize: 12, fontWeight: "700" as const },
  notesInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: t.TEXT, textAlignVertical: "top" as const, marginBottom: 24, minHeight: 80 },
  saveBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center", marginBottom: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
});

// ── Celebration styles ────────────────────────────────────────────────────────
const makeCStyles = (t: AppTheme) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  emoji: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: "800" as const, color: t.TEXT, marginBottom: 8 },
  sub: { fontSize: 16, color: t.MUTED },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  screenTitle: { fontSize: 28, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  motiveCopy: { fontSize: 12, color: t.MUTED, marginTop: 3, fontWeight: "500" as const },
  // Change 7: FAB styles (unchanged visually, animation handled in Animated.View wrapper)
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center",
    shadowColor: ACCENT, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  // Progress
  progressWrap: { marginBottom: 14 },
  progressTrack: { height: 5, backgroundColor: t.BORDER, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 5, borderRadius: 3, minWidth: 4 },
  progressLabel: { fontSize: 11, color: t.MUTED, fontWeight: "600" as const },

  // Change 5: Zero-state stats card
  zeroStatsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  zeroStatsEmoji: { fontSize: 28 },
  zeroStatsTitle: { fontSize: 14, fontWeight: "700" as const, marginBottom: 2 },
  zeroStatsSub: { fontSize: 12, fontWeight: "500" as const },

  // Stats
  statsRow: { gap: 10, paddingRight: 4, marginBottom: 12 },
  statCard: { backgroundColor: t.CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", gap: 2, borderWidth: 1, borderColor: t.BORDER, minWidth: 72 },
  statIcon: { fontSize: 16 },
  statValue: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const },

  // View toggle
  viewToggleRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  viewToggle: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: "center", backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  viewToggleActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  viewToggleText: { fontSize: 12, fontWeight: "700" as const, color: t.MUTED },
  viewToggleTextActive: { color: "#fff" },

  // Priority chips
  filterChips: { gap: 8, paddingBottom: 4, paddingRight: 40 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  chipTextActive: { color: "#fff" },

  // Overdue banner
  overdueBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.RED + "18",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, borderWidth: 1, borderColor: t.RED + "40",
  },
  overdueBannerText: { fontSize: 12, color: t.RED, fontWeight: "600" as const, flex: 1 },

  // List
  list: { paddingHorizontal: 14, paddingTop: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, marginTop: 6, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: ACCENT },
  sectionTitle: { fontSize: 13, fontWeight: "700" as const, color: t.SUBTEXT, textTransform: "uppercase" as const, letterSpacing: 0.5 },

  // Empty states
  emptyFull: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 54, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800" as const, color: t.TEXT, textAlign: "center", marginBottom: 10 },
  emptyDesc: { fontSize: 14, color: t.MUTED, textAlign: "center", lineHeight: 21, marginBottom: 28 },
  emptyActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  emptyAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ACCENT,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  emptyAddBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
  emptyOutlineBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: ACCENT },
  emptyOutlineBtnText: { fontSize: 15, fontWeight: "700" as const, color: ACCENT },
  emptySuggestLabel: { fontSize: 13, color: t.MUTED, marginBottom: 12, marginTop: 28, fontWeight: "600" as const },
  suggestionChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" },
  suggestionChip: { backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  suggestionChipText: { fontSize: 13, color: t.TEXT, fontWeight: "600" as const },

  // Quick add bar
  quickBarContainer: {
    position: "absolute", left: 12, right: 12,
  },
  quickBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.CARD, borderRadius: 20, borderWidth: 1, borderColor: t.BORDER,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: -2 }, elevation: 8,
  },
  quickBarInput: { flex: 1, flexDirection: "row", alignItems: "center" },
  quickBarText: { flex: 1, fontSize: 14, color: t.MUTED, fontWeight: "500" as const },
  quickBarSend: { width: 38, height: 38, borderRadius: 19, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },

  // Priority change modal (web)
  priorityModal: { backgroundColor: t.CARD, margin: 40, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: t.BORDER },
  priorityModalTitle: { fontSize: 17, fontWeight: "700" as const, color: t.TEXT, textAlign: "center", marginBottom: 16 },
  priorityModalOption: { paddingVertical: 14, borderBottomWidth: 1, borderColor: t.BORDER },
  priorityModalOptionText: { fontSize: 15, fontWeight: "600" as const, color: t.TEXT, textAlign: "center" },
});
