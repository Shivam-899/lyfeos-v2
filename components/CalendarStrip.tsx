import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useHabits } from "@/context/HabitsContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDatesForMonth(year: number, month: number) {
  const last = new Date(year, month + 1, 0);
  const dates: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) dates.push(new Date(year, month, d));
  return dates;
}

function localToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  earliestCreatedAt?: string; // ISO string of earliest habit createdAt
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Calendar Modal — monthly grid with back navigation
// ─────────────────────────────────────────────────────────────────────────────
function FullCalendarModal({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  minDate,
}: {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  minDate: Date;
}) {
  const theme = useAppTheme();
  const { CARD, TEXT, SUBTEXT, ACCENT, MUTED, BORDER, BG } = theme;
  const { habits, getHabitLog } = useHabits();

  const today = localToday();
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const dates = getDatesForMonth(viewYear, viewMonth);
  // Offset so week starts on Sunday
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const canGoBack = () => {
    const firstOfView = new Date(viewYear, viewMonth, 1);
    const firstOfMin = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    return firstOfView > firstOfMin;
  };

  const canGoForward = () => {
    const firstOfView = new Date(viewYear, viewMonth, 1);
    const firstOfToday = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstOfView < firstOfToday;
  };

  const goPrev = () => {
    if (!canGoBack()) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (!canGoForward()) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const getCompletion = (d: Date): "full" | "partial" | "none" | "empty" => {
    const dateStr = getLocalDateString(d);
    const wd = d.getDay();
    const dayHabits = habits.filter((h) => h.weekDays.includes(wd));
    if (dayHabits.length === 0) return "empty";
    const done = dayHabits.filter((h) => getHabitLog(h.id, dateStr)?.completed).length;
    if (done === 0) return "none";
    if (done === dayHabits.length) return "full";
    return "partial";
  };

  const dotColor: Record<string, string> = {
    full: "#22C55E",
    partial: "#FF6B35",
    none: MUTED,
    empty: "transparent",
  };

  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() &&
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear();

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isFuture = (d: Date) => d > today;

  const handleSelect = (d: Date) => {
    if (isFuture(d)) return;
    onSelectDate(new Date(d));
    onClose();
  };

  // Build grid cells: leading blanks + dates
  const cells: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...dates,
  ];
  // Pad to full rows of 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={[cs.modalBox, { backgroundColor: CARD }]}>
            {/* Header */}
            <View style={cs.modalHeader}>
              <TouchableOpacity
                onPress={goPrev}
                style={[cs.navBtn, !canGoBack() && { opacity: 0.25 }]}
                disabled={!canGoBack()}
              >
                <Ionicons name="chevron-back" size={20} color={ACCENT} />
              </TouchableOpacity>
              <Text style={[cs.modalMonthTitle, { color: TEXT }]}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                onPress={goNext}
                style={[cs.navBtn, !canGoForward() && { opacity: 0.25 }]}
                disabled={!canGoForward()}
              >
                <Ionicons name="chevron-forward" size={20} color={ACCENT} />
              </TouchableOpacity>
            </View>

            {/* Week day headers */}
            <View style={cs.weekHeaders}>
              {WEEK_HEADERS.map((d) => (
                <Text key={d} style={[cs.weekHeader, { color: MUTED }]}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={cs.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`blank-${i}`} style={cs.gridCell} />;
                const completion = getCompletion(d);
                const selected = isSelected(d);
                const today2 = isToday(d);
                const future = isFuture(d);
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={[
                      cs.gridCell,
                      selected && { backgroundColor: ACCENT, borderRadius: 12 },
                      today2 && !selected && { borderWidth: 1.5, borderColor: ACCENT, borderRadius: 12 },
                      future && { opacity: 0.3 },
                    ]}
                    onPress={() => handleSelect(d)}
                    activeOpacity={future ? 1 : 0.75}
                  >
                    <Text style={[
                      cs.gridDay,
                      { color: selected ? "#fff" : today2 ? ACCENT : future ? MUTED : TEXT },
                      today2 && !selected && { fontWeight: "800" as const },
                    ]}>
                      {d.getDate()}
                    </Text>
                    <View style={[cs.gridDot, { backgroundColor: selected ? "rgba(255,255,255,0.7)" : dotColor[completion] }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Today button */}
            <TouchableOpacity
              style={[cs.todayBtnFull, { backgroundColor: ACCENT }]}
              onPress={() => { onSelectDate(new Date()); onClose(); }}
            >
              <Text style={cs.todayBtnFullText}>Go to Today</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CalendarStrip component
// ─────────────────────────────────────────────────────────────────────────────
export function CalendarStrip({ selectedDate, onSelectDate, earliestCreatedAt }: Props) {
  const theme = useAppTheme();
  const { CARD, TEXT, SUBTEXT, ACCENT, MUTED } = theme;
  const { habits, getHabitLog } = useHabits();
  const [calendarVisible, setCalendarVisible] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const dates = getDatesForMonth(year, month);
  const listRef = useRef<FlatList>(null);

  // Compute min date for calendar back navigation:
  // Limit to earliest habit creation, OR 3 months back for new users (no habits yet)
  const minDate = React.useMemo(() => {
    const threeMonthsBack = new Date(today);
    threeMonthsBack.setMonth(threeMonthsBack.getMonth() - 3);
    if (earliestCreatedAt) {
      const earliest = new Date(earliestCreatedAt);
      earliest.setHours(0, 0, 0, 0);
      // Return whichever is earlier
      return earliest < threeMonthsBack ? earliest : threeMonthsBack;
    }
    return threeMonthsBack;
  }, [earliestCreatedAt]);

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };
  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth();

  /** Returns 'full' | 'partial' | 'none' | 'empty' for a given day */
  const getCompletion = (d: Date): "full" | "partial" | "none" | "empty" => {
    const dateStr = getLocalDateString(d);
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

  const dotColor = { full: "#22C55E", partial: "#FF6B35", none: MUTED, empty: "transparent" };

  return (
    <View style={[styles.container, { backgroundColor: CARD }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.monthTitleRow}
          onPress={() => setCalendarVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.monthText, { color: TEXT }]}>
            {MONTHS[month]} {year}
          </Text>
          <Ionicons name="calendar-outline" size={16} color={ACCENT} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} style={[styles.todayBtn, { backgroundColor: ACCENT + "20" }]}>
          <Text style={[styles.todayText, { color: ACCENT }]}>Today</Text>
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
                selected && { backgroundColor: ACCENT },
                todayDate && !selected && { borderWidth: 2, borderColor: ACCENT },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.dayLabel,
                { color: selected ? "#fff" : SUBTEXT },
              ]}>
                {DAYS[d.getDay()].slice(0, 3)}
              </Text>
              <Text style={[
                styles.dayNum,
                { color: selected ? "#fff" : todayDate ? ACCENT : TEXT },
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

      <FullCalendarModal
        visible={calendarVisible}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onClose={() => setCalendarVisible(false)}
        minDate={minDate}
      />
    </View>
  );
}

// ─── Strip styles ─────────────────────────────────────────────────────────────
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
  monthTitleRow: {
    flexDirection: "row",
    alignItems: "center",
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

// ─── Calendar modal styles ────────────────────────────────────────────────────
const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: 340,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  modalMonthTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  weekHeaders: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekHeader: {
    width: 40,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600" as const,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridCell: {
    width: "14.28%" as any,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    gap: 2,
  },
  gridDay: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  todayBtnFull: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  todayBtnFullText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700" as const,
  },
});
