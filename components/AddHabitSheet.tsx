import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HABIT_COLORS,
  HABIT_EMOJIS,
  Habit,
  HabitType,
  TrackMethod,
} from "@/context/HabitsContext";
import { useHabits } from "@/context/HabitsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  editHabit?: Habit;
}

type Step = "type" | "details";

export function AddHabitSheet({ visible, onClose, editHabit }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addHabit, updateHabit } = useHabits();

  const isEditing = !!editHabit;

  const [step, setStep] = useState<Step>(isEditing ? "details" : "type");
  const [habitType, setHabitType] = useState<HabitType>(editHabit?.type ?? "build");
  const [name, setName] = useState(editHabit?.name ?? "");
  const [trackMethod, setTrackMethod] = useState<TrackMethod>(editHabit?.trackMethod ?? "task");
  const [colorId, setColorId] = useState(editHabit?.colorId ?? "green");
  const [emoji, setEmoji] = useState(editHabit?.emoji ?? "📚");
  const [targetAmount, setTargetAmount] = useState(String(editHabit?.targetAmount ?? 5));
  const [targetHr, setTargetHr] = useState(String(Math.floor((editHabit?.targetTimeSeconds ?? 0) / 3600)));
  const [targetMin, setTargetMin] = useState(String(Math.floor(((editHabit?.targetTimeSeconds ?? 0) % 3600) / 60)));
  const [selectedDays, setSelectedDays] = useState<number[]>(editHabit?.weekDays ?? [0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (visible) {
      if (editHabit) {
        setStep("details");
        setHabitType(editHabit.type);
        setName(editHabit.name);
        setTrackMethod(editHabit.trackMethod);
        setColorId(editHabit.colorId);
        setEmoji(editHabit.emoji);
        setTargetAmount(String(editHabit.targetAmount ?? 5));
        setTargetHr(String(Math.floor((editHabit.targetTimeSeconds ?? 0) / 3600)));
        setTargetMin(String(Math.floor(((editHabit.targetTimeSeconds ?? 0) % 3600) / 60)));
        setSelectedDays(editHabit.weekDays);
      } else {
        setStep("type");
        setName("");
        setTrackMethod("task");
        setColorId("green");
        setEmoji("📚");
        setTargetAmount("5");
        setTargetHr("0");
        setTargetMin("0");
        setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      }
    }
  }, [visible, editHabit]);

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

  const handleClose = () => onClose();

  const handleSelectType = (type: HabitType) => {
    setHabitType(type);
    setStep("details");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      type: habitType,
      trackMethod,
      colorId,
      emoji,
      targetAmount: trackMethod === "amount" ? parseInt(targetAmount) || 5 : undefined,
      targetTimeSeconds: trackMethod === "time" ? (parseInt(targetHr) || 0) * 3600 + (parseInt(targetMin) || 0) * 60 : undefined,
      weekDays: selectedDays,
    };
    if (isEditing && editHabit) {
      updateHabit(editHabit.id, data);
    } else {
      addHabit(data);
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  };

  const toggleDay = (dayIdx: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const selectedColor = HABIT_COLORS.find((c) => c.id === colorId) ?? HABIT_COLORS[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
            },
          ]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.handle} />

              {step === "type" ? (
                <>
                  <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                    What type of a habit?
                  </Text>
                  <TouchableOpacity
                    style={[styles.typeBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => handleSelectType("build")}
                  >
                    <View style={[styles.typeIconWrap, { backgroundColor: "#E8F5E9" }]}>
                      <MaterialCommunityIcons name="sprout" size={28} color="#34C759" />
                    </View>
                    <View style={styles.typeTextWrap}>
                      <Text style={[styles.typeName, { color: colors.foreground }]}>Build</Text>
                      <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
                        Build a good habit, like flossing, reading, or exercising
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    onPress={() => handleSelectType("quit")}
                  >
                    <View style={[styles.typeIconWrap, { backgroundColor: "#FEE2E2" }]}>
                      <MaterialCommunityIcons name="fire" size={28} color="#FF4757" />
                    </View>
                    <View style={styles.typeTextWrap}>
                      <Text style={[styles.typeName, { color: colors.foreground }]}>Quit</Text>
                      <Text style={[styles.typeDesc, { color: colors.mutedForeground }]}>
                        Quit a bad habit, like smoking, drinking, or eating junk food
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </>
              ) : (
                <View>
                  <View style={styles.detailHeader}>
                    {!isEditing ? (
                      <TouchableOpacity onPress={() => setStep("type")}>
                        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
                      </TouchableOpacity>
                    ) : <View style={{ width: 24 }} />}
                    <Text style={[styles.sheetTitle, { color: colors.foreground, marginBottom: 0 }]}>
                      {isEditing ? "Edit Habit" : "New Habit"}
                    </Text>
                    <TouchableOpacity onPress={handleClose}>
                      <Ionicons name="close" size={24} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.nameInput, { borderColor: colors.primary, color: colors.foreground }]}
                    placeholder="Your awesome habit"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    maxLength={40}
                  />

                  <Text style={[styles.label, { color: colors.foreground }]}>Track</Text>
                  <View style={styles.segmentedRow}>
                    {(["task", "amount", "time"] as TrackMethod[]).map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.segBtn,
                          {
                            backgroundColor: trackMethod === m ? colors.primary : colors.muted,
                            borderColor: trackMethod === m ? colors.primary : "transparent",
                          },
                        ]}
                        onPress={() => setTrackMethod(m)}
                      >
                        <Ionicons
                          name={m === "task" ? "checkmark-circle" : m === "amount" ? "stats-chart" : "timer"}
                          size={18}
                          color={trackMethod === m ? "#fff" : colors.mutedForeground}
                        />
                        <Text style={[styles.segText, { color: trackMethod === m ? "#fff" : colors.mutedForeground }]}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {trackMethod === "amount" && (
                    <>
                      <Text style={[styles.label, { color: colors.foreground }]}>Target amount</Text>
                      <TextInput
                        style={[styles.smallInput, { borderColor: colors.border, color: colors.foreground }]}
                        keyboardType="number-pad"
                        value={targetAmount}
                        onChangeText={setTargetAmount}
                        placeholder="5"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </>
                  )}

                  {trackMethod === "time" && (
                    <>
                      <Text style={[styles.label, { color: colors.foreground }]}>Target duration</Text>
                      <View style={styles.durationRow}>
                        <View style={styles.durationField}>
                          <TextInput
                            style={[styles.durationInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                            keyboardType="number-pad"
                            value={targetHr}
                            onChangeText={(v) => setTargetHr(v.replace(/[^0-9]/g, ""))}
                            placeholder="00"
                            placeholderTextColor={colors.mutedForeground}
                            maxLength={3}
                            textAlign="center"
                          />
                          <Text style={[styles.durationLabel, { color: colors.mutedForeground }]}>Hr</Text>
                        </View>
                        <Text style={[styles.durationSep, { color: colors.foreground }]}>:</Text>
                        <View style={styles.durationField}>
                          <TextInput
                            style={[styles.durationInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                            keyboardType="number-pad"
                            value={targetMin}
                            onChangeText={(v) => {
                              const n = parseInt(v.replace(/[^0-9]/g, "") || "0");
                              setTargetMin(String(Math.min(n, 59)));
                            }}
                            placeholder="00"
                            placeholderTextColor={colors.mutedForeground}
                            maxLength={2}
                            textAlign="center"
                          />
                          <Text style={[styles.durationLabel, { color: colors.mutedForeground }]}>min</Text>
                        </View>
                      </View>
                    </>
                  )}

                  <Text style={[styles.label, { color: colors.foreground }]}>Color & Emoji</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
                    {HABIT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setColorId(c.id)}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c.icon },
                          colorId === c.id && styles.colorSelected,
                        ]}
                      />
                    ))}
                  </ScrollView>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                    {HABIT_EMOJIS.map((e) => (
                      <TouchableOpacity
                        key={e}
                        onPress={() => setEmoji(e)}
                        style={[
                          styles.emojiBtn,
                          emoji === e && { backgroundColor: selectedColor.bg },
                        ]}
                      >
                        <Text style={styles.emojiText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.label, { color: colors.foreground }]}>Repeat</Text>
                  <View style={styles.daysRow}>
                    {DAY_INDICES.map((dayIdx, i) => (
                      <TouchableOpacity
                        key={dayIdx}
                        onPress={() => toggleDay(dayIdx)}
                        style={[
                          styles.dayBtn,
                          {
                            backgroundColor: selectedDays.includes(dayIdx) ? "#4ECDC4" : colors.muted,
                          },
                        ]}
                      >
                        <Text style={[
                          styles.dayBtnText,
                          { color: selectedDays.includes(dayIdx) ? "#fff" : colors.mutedForeground },
                        ]}>
                          {DAY_LABELS[i]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[styles.repeatInfo, { backgroundColor: colors.muted }]}>
                    <Ionicons name="repeat" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                    <Text style={[styles.repeatText, { color: colors.mutedForeground }]}>
                      {selectedDays.length === 7 ? "Every day" :
                       selectedDays.length === 0 ? "No days selected" :
                       "Every week"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: name.trim() ? 1 : 0.5 }]}
                    onPress={handleSave}
                    disabled={!name.trim()}
                  >
                    <Text style={styles.saveBtnText}>{isEditing ? "Save Changes" : "Add Habit"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  kvContainer: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
    marginBottom: 24,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  typeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  typeTextWrap: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  nameInput: {
    borderBottomWidth: 2,
    fontSize: 20,
    fontWeight: "600" as const,
    paddingVertical: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  segText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  smallInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  durationField: {
    alignItems: "center",
    gap: 4,
  },
  durationInput: {
    width: 80,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: "700" as const,
  },
  durationLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  durationSep: {
    fontSize: 28,
    fontWeight: "700" as const,
    marginTop: -16,
  },
  colorRow: {
    marginBottom: 12,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  emojiRow: {
    marginBottom: 20,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  repeatInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 24,
    marginTop: 6,
  },
  repeatText: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
});
