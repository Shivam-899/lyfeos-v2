import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AddHabitSheet } from "@/components/AddHabitSheet";
import { ConfettiEffect } from "@/components/ConfettiEffect";
import { HABIT_COLORS, type Habit } from "@/context/HabitsContext";
import { useHabits } from "@/context/HabitsContext";
import { useProfile } from "@/context/ProfileContext";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Play completion sound (respects device silent mode automatically via expo-av)
async function playCompletionSound() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/sounds/complete.wav"),
      { shouldPlay: true, volume: 0.7 }
    );
    // Unload sound after it finishes to free memory
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // Silently fail if sound can't play (e.g., permissions, silent mode)
  }
}

interface Props {
  habit: Habit;
  date: string;
  onAllDone?: () => void;
  allHabits?: Habit[];
}

export function HabitTile({ habit, date, onAllDone, allHabits }: Props) {
  const { getHabitLog, logHabit, deleteHabit, getStreak, getCompletionRate } = useHabits();
  const { preferences } = useProfile();
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const log = getHabitLog(habit.id, date);
  const colorInfo = HABIT_COLORS.find((c) => c.id === habit.colorId) ?? HABIT_COLORS[0];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Completion ring animation (success pulse around the checkbox)
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  // Timer active pulse animation
  const timerPulse = useRef(new Animated.Value(1)).current;
  const timerPulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(log?.timeSeconds ?? 0);

  const streak = getStreak(habit.id);
  const completion = getCompletionRate(habit.id);
  const isDone = log?.completed ?? false;

  const logHabitRef = useRef(logHabit);
  logHabitRef.current = logHabit;

  const getHabitLogRef = useRef(getHabitLog);
  getHabitLogRef.current = getHabitLog;

  // Bug 8 fix: reset timer display when date changes
  useEffect(() => {
    const currentLog = getHabitLogRef.current(habit.id, date);
    setTimerSeconds(currentLog?.timeSeconds ?? 0);
    setTimerActive(false);
  }, [date, habit.id]);

  // Bug 5 fix: single effect owns the interval — cleared on every dependency change
  useEffect(() => {
    if (!timerActive) return;
    const target = habit.targetTimeSeconds ?? 0;
    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        const next = prev + 1;
        if (target > 0 && next >= target) {
          clearInterval(id);
          setTimerActive(false);
          logHabitRef.current(habit.id, date, { timeSeconds: target, completed: true });
          triggerCompletion();
          return target;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, habit.targetTimeSeconds, habit.id, date]);

  // Timer active: start/stop pulse animation on the checkbox
  useEffect(() => {
    if (timerActive) {
      timerPulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(timerPulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(timerPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      timerPulseAnim.current.start();
    } else {
      timerPulseAnim.current?.stop();
      timerPulse.setValue(1);
    }
    return () => {
      timerPulseAnim.current?.stop();
    };
  }, [timerActive]);

  // Fire success ring animation + optional sound
  const triggerCompletion = () => {
    setConfettiTrigger((n) => n + 1);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (preferences.habitEffectsEnabled) {
      // Success ring: scale out + fade
      ringScale.setValue(1);
      ringOpacity.setValue(0.8);
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.8, duration: 400, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();

      // Play sound
      if (Platform.OS !== "web") {
        playCompletionSound();
      }
    }
  };

  const handleActionPress = async () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (habit.trackMethod === "task") {
      const newCompleted = !isDone;
      logHabit(habit.id, date, { completed: newCompleted });
      if (newCompleted) {
        triggerCompletion();
        // Check if all habits are now done
        if (onAllDone && allHabits) {
          const allNowDone = allHabits.every((h) => {
            if (h.id === habit.id) return true;
            return !!(getHabitLogRef.current(h.id, date)?.completed);
          });
          if (allNowDone) setTimeout(() => onAllDone(), 300);
        }
      }
    } else if (habit.trackMethod === "amount") {
      const newAmount = (log?.amount ?? 0) + 1;
      const max = habit.targetAmount ?? 10;
      const completed = newAmount >= max;
      logHabit(habit.id, date, { amount: Math.min(newAmount, max), completed });
      if (completed && !log?.completed) triggerCompletion();
    } else if (habit.trackMethod === "time") {
      if (timerActive) {
        // Stopping the timer — the effect cleanup handles clearInterval
        setTimerActive(false);
        const wasCompleted = timerSeconds >= (habit.targetTimeSeconds ?? 3600);
        logHabit(habit.id, date, { timeSeconds: timerSeconds, completed: wasCompleted });
        if (wasCompleted) triggerCompletion();
      } else {
        setTimerActive(true);
      }
    }
  };

  // Manual complete for timer habits: keep current timerSeconds, mark completed: true
  const handleManualComplete = () => {
    if (isDone) return;
    setTimerActive(false);
    logHabit(habit.id, date, { timeSeconds: timerSeconds, completed: true });
    triggerCompletion();
  };

  const handleLongPress = () => {
    if (habit.trackMethod !== "time" || isDone) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      handleManualComplete();
      return;
    }
    Alert.alert(
      "Mark as Complete?",
      `Mark "${habit.name}" as completed for today?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark Complete ✓", onPress: handleManualComplete },
      ]
    );
  };

  const handleDelete = () => {
    if (Platform.OS === "web") { deleteHabit(habit.id); return; }
    Alert.alert(
      "Delete Habit",
      `Delete "${habit.name}"? All progress will be lost.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteHabit(habit.id) },
      ]
    );
  };

  const getStatusText = () => {
    if (habit.trackMethod === "task") return isDone ? "Completed ✓" : "Daily";
    if (habit.trackMethod === "amount") return `${log?.amount ?? 0} / ${habit.targetAmount ?? 10}`;
    if (habit.trackMethod === "time") {
      const cur = timerActive ? timerSeconds : (log?.timeSeconds ?? 0);
      return `${formatTime(cur)} / ${formatTime(habit.targetTimeSeconds ?? 3600)}`;
    }
    return "";
  };

  // Border color system: green=done, orange=active/in-progress, grey=not started
  const isInProgress =
    (habit.trackMethod === "amount" && (log?.amount ?? 0) > 0 && !isDone) ||
    (habit.trackMethod === "time" && timerActive);
  const tileBorderColor = isDone ? "#22C55E" : isInProgress ? "#FF6B35" : theme.BORDER;

  const renderCheckbox = () => {
    const color = isDone ? "#22C55E" : colorInfo.icon;
    const bg = isDone ? "#22C55E" : timerActive ? colorInfo.icon : "transparent";
    if (habit.trackMethod === "task") {
      return (
        <View style={[styles.checkbox, { borderColor: color, backgroundColor: bg }]}>
          {isDone && <Ionicons name="checkmark" size={18} color="#fff" />}
        </View>
      );
    }
    if (habit.trackMethod === "amount") {
      return (
        <View style={[styles.checkbox, { borderColor: color, backgroundColor: isDone ? "#22C55E" : "transparent" }]}>
          {isDone
            ? <Ionicons name="checkmark" size={18} color="#fff" />
            : <Ionicons name="add" size={20} color={colorInfo.icon} />}
        </View>
      );
    }
    if (habit.trackMethod === "time") {
      return (
        <Animated.View style={[styles.checkbox, { borderColor: color, backgroundColor: bg, transform: [{ scale: timerPulse }] }]}>
          {isDone && !timerActive
            ? <Ionicons name="checkmark" size={18} color="#fff" />
            : <Ionicons name={timerActive ? "pause" : "play"} size={16} color={timerActive ? "#fff" : colorInfo.icon} />}
        </Animated.View>
      );
    }
    return null;
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }], opacity: isDone ? 0.65 : 1, borderColor: tileBorderColor }]}>
      {/* Left color accent */}
      <View style={[styles.accentBar, { backgroundColor: colorInfo.icon }]} />

      {/* Main row */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded((p) => !p)}
        onLongPress={handleLongPress}
        delayLongPress={500}
        style={styles.mainRow}
      >
        {/* Emoji circle */}
        <View style={[styles.emojiCircle, { backgroundColor: colorInfo.icon + "22", borderColor: colorInfo.icon + "55" }]}>
          <Text style={styles.emojiText}>{habit.emoji ?? habit.name[0].toUpperCase()}</Text>
        </View>

        {/* Name + subtext */}
        <View style={styles.info}>
          <Text style={[styles.habitName, isDone && styles.doneText]} numberOfLines={1}>
            {habit.name}
          </Text>
          {!!habit.description && (
            <Text style={styles.descText} numberOfLines={2}>{habit.description}</Text>
          )}
          <Text style={styles.subText}>
            {selectedDaysLabel(habit.weekDays)}
            {streak.best > 0 ? `  🔥 Best: ${streak.best}d` : ""}
          </Text>
          {habit.trackMethod !== "task" && (
            <Text style={styles.progressText}>{getStatusText()}</Text>
          )}
        </View>

        {/* Expand chevron */}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={theme.MUTED}
          style={{ marginRight: 8 }}
        />

        {/* Checkbox / action button with success ring */}
        <View style={styles.checkboxWrap}>
          {/* Success ring overlay */}
          <Animated.View
            style={[
              styles.successRing,
              {
                borderColor: "#22C55E",
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
            pointerEvents="none"
          />
          <TouchableOpacity
            onPress={handleActionPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {renderCheckbox()}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expanded panel */}
      {expanded && (
        <View style={styles.expandedPanel}>
          {/* Stats pills */}
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: colorInfo.icon + "18" }]}>
              <Ionicons name="flame" size={12} color={colorInfo.icon} />
              <Text style={[styles.statPillText, { color: colorInfo.icon }]}>{streak.current}d streak</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colorInfo.icon + "18" }]}>
              <Ionicons name="trophy" size={12} color={colorInfo.icon} />
              <Text style={[styles.statPillText, { color: colorInfo.icon }]}>Best {streak.best}d</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colorInfo.icon + "18" }]}>
              <Ionicons name="bar-chart" size={12} color={colorInfo.icon} />
              <Text style={[styles.statPillText, { color: colorInfo.icon }]}>{completion}%</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colorInfo.icon + "15", borderColor: colorInfo.icon + "40" }]}
              onPress={() => { setExpanded(false); setShowEditSheet(true); }}
            >
              <Ionicons name="pencil" size={14} color={colorInfo.icon} />
              <Text style={[styles.actionBtnText, { color: colorInfo.icon }]}>Edit</Text>
            </TouchableOpacity>

            {/* Manual complete for timer habits (when not yet done) */}
            {habit.trackMethod === "time" && !isDone && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#22C55E15", borderColor: "#22C55E40" }]}
                onPress={handleManualComplete}
              >
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                <Text style={[styles.actionBtnText, { color: "#22C55E" }]}>Mark Complete</Text>
              </TouchableOpacity>
            )}

            {habit.trackMethod === "amount" && (log?.amount ?? 0) > 0 && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}
                onPress={() => {
                  const newAmount = Math.max(0, (log?.amount ?? 0) - 1);
                  const max = habit.targetAmount ?? 10;
                  logHabit(habit.id, date, { amount: newAmount, completed: newAmount >= max });
                }}
              >
                <Ionicons name="remove-circle-outline" size={14} color="#F59E0B" />
                <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>Undo +1</Text>
              </TouchableOpacity>
            )}

            {isDone && habit.trackMethod === "task" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}
                onPress={() => logHabit(habit.id, date, { completed: false })}
              >
                <Ionicons name="refresh" size={14} color="#F59E0B" />
                <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>Undo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#FF475715", borderColor: "#FF475740" }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={14} color="#FF4757" />
              <Text style={[styles.actionBtnText, { color: "#FF4757" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AddHabitSheet visible={showEditSheet} onClose={() => setShowEditSheet(false)} editHabit={habit} />
      <ConfettiEffect trigger={confettiTrigger} />
    </Animated.View>
  );
}

function selectedDaysLabel(weekDays: number[]): string {
  if (weekDays.length === 7) return "Daily";
  if (weekDays.length === 0) return "No schedule";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sorted = [...weekDays].sort((a, b) => a - b);
  return sorted.map((d) => names[d]).join(", ");
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrapper: {
    backgroundColor: t.CARD,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    overflow: "hidden",
    flexDirection: "column",
  },
  accentBar: {
    height: 3,
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  emojiCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  emojiText: { fontSize: 20 },
  info: { flex: 1 },
  habitName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: t.TEXT,
    marginBottom: 1,
  },
  doneText: { textDecorationLine: "line-through" as const, color: t.MUTED },
  descText: {
    fontSize: 11,
    color: t.MUTED,
    fontStyle: "italic" as const,
    marginBottom: 2,
    lineHeight: 15,
  },
  subText: { fontSize: 11, color: t.MUTED, fontWeight: "500" as const, marginTop: 1 },
  progressText: { fontSize: 12, color: "#FF6B35", fontWeight: "600" as const, marginTop: 3 },
  checkboxWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  successRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  checkbox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  expandedPanel: {
    borderTopWidth: 1,
    borderTopColor: t.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  statsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statPillText: { fontSize: 11, fontWeight: "600" as const },
  actionsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" as const },
});
