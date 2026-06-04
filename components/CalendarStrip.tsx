import React, { useCallback, useRef } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useHabits } from "@/context/HabitsContext";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDatesForMonth(year: number, month: number) {
  const last = new Date(year, month + 1, 0);
  const dates: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) dates.push(new Date(year, month, d));
  return dates;
}

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarStrip({ selectedDate, onSelectDate }: Props) {
  const colors = useColors();
  const { habits, getHabitLog } = useHabits();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const dates = getDatesForMonth(year, month);
  const listRef = useRef<FlatList>(null);

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };
  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth();

  /** Returns 'full' | 'partial' | 'none' | 'empty' for a given day */
  const getCompletion = (d: Date): "full" | "partial" | "none" | "empty" => {
    const dateStr = d.toISOString().split("T")[0];
    const wd = d.getDay();
    const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
    if (dayHabits.length === 0) return "empty";
    const done = dayHabits.filter((h) => getHabitLog(h.id, dateStr)?.completed).length;
    if (done === 0) return "none";
    if (done === dayHabits.length) return "full";
    return "partial";
  };

  const scrollToSelected = useCallback(() => {
    const idx = dates.findIndex((d) => isSelected(d));
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
    }
  }, [dates, selectedDate]);

  const goToToday = () => {
    onSelectDate(new Date());
    const todayIdx = dates.findIndex((d) => isToday(d));
    if (todayIdx >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: todayIdx, viewPosition: 0.5, animated: true });
    }
  };

  const dotColor = { full: "#22C55E", partial: "#FF6B35", none: "#444", empty: "transparent" };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.monthText, { color: colors.foreground }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={goToToday} style={[styles.todayBtn, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.todayText, { color: colors.primary }]}>Today</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={dates}
        keyExtractor={(d) => d.toISOString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        initialScrollIndex={Math.max(0, selectedDate.getDate() - 3)}
        getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item: d }) => {
          const selected = isSelected(d);
          const todayDate = isToday(d);
          const completion = getCompletion(d);
          const dot = dotColor[completion];
          return (
            <TouchableOpacity
              onPress={() => onSelectDate(new Date(d))}
              style={[
                styles.dayCell,
                selected && { backgroundColor: colors.primary },
                todayDate && !selected && { borderWidth: 2, borderColor: colors.primary },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.dayLabel,
                { color: selected ? "#fff" : colors.mutedForeground },
              ]}>
                {DAYS[d.getDay()].slice(0, 3)}
              </Text>
              <Text style={[
                styles.dayNum,
                { color: selected ? "#fff" : todayDate ? colors.primary : colors.foreground },
                todayDate && !selected && { fontWeight: "800" as const },
              ]}>
                {d.getDate()}
              </Text>
              {/* Completion dot */}
              <View style={[styles.dot, { backgroundColor: dot }]} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  monthText: { fontSize: 18, fontWeight: "700" as const },
  todayBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 },
  todayText: { fontSize: 13, fontWeight: "600" as const },
  listContent: { paddingHorizontal: 12, gap: 4 },
  dayCell: {
    width: 48,
    height: 70,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    paddingBottom: 4,
    gap: 2,
  },
  dayLabel: { fontSize: 10, fontWeight: "500" as const, textTransform: "uppercase" as const },
  dayNum: { fontSize: 18, fontWeight: "700" as const },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
