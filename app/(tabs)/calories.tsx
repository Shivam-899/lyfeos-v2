import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { logScreen } from "@/utils/analytics";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "../../utils/ads";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { DailyGoal, MealType, useCalories } from "@/context/CaloriesContext";
import { useActivity } from "@/context/ActivityContext";
import { useProfile } from "@/context/ProfileContext";
import { FoodAnalysisResult, analyzeFoodImage, analyzeFoodText } from "@/utils/analyzeFoodImage";
import { INDIAN_FOOD_QUICK_CHIPS } from "@/utils/indianFoodDatabase";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";
import { getLocalDateString } from "@/utils/date";


// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";
const TEAL = "#14B8A6";
const INDIAN_SAFFRON = "#FF9933";
const MACRO_CARB = "#3B82F6";   // Blue
const MACRO_PROTEIN = "#FF6B35";   // Orange (ACCENT)
const MACRO_FAT = "#EAB308";   // Gold
const VIT_ORANGE = "#F97316";   // Vitamin 20–50%
const VIT_GREY = "#D1D5DB";   // Vitamin <20%

// ── Meals config ──────────────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string; icon: string; emptyText: string; targetPct: number }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline", emptyText: "Start your day right — log your breakfast 🌅", targetPct: 0.25 },
  { key: "lunch", label: "Lunch", icon: "restaurant-outline", emptyText: "Lunchtime! What did you eat? 🥗", targetPct: 0.35 },
  { key: "dinner", label: "Dinner", icon: "moon-outline", emptyText: "Dinner time — log your last meal 🍽️", targetPct: 0.30 },
  { key: "snacks", label: "Snacks", icon: "nutrition-outline", emptyText: "Any snacks today? Log them here 🍎", targetPct: 0.10 },
];

function getDefaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 20) return "dinner";
  return "snacks";
}

function ringColor(pct: number): string {
  if (pct >= 0.8) return "#22C55E";
  if (pct >= 0.5) return "#EAB308";
  return "#FF6B35";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Returns true if a food result should show Indian portion guidance */
function isIndianFood(result: FoodAnalysisResult): boolean {
  if (result.cuisineType === "Indian") return true;
  const name = result.name.toLowerCase();
  const indianKeywords = [
    "dal", "daal", "roti", "chapati", "paratha", "biryani", "paneer", "sabzi",
    "curry", "samosa", "idli", "dosa", "poha", "upma", "chole", "rajma",
    "khichdi", "pulao", "tikka", "naan", "kadhi", "thali", "chaat",
  ];
  return indianKeywords.some((k) => name.includes(k));
}

// ── Confidence percentage mapping ─────────────────────────────────────────────
function confidencePct(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") return "94%";
  if (confidence === "medium") return "82%";
  return "65%";
}

// ── BMR Calculator (Mifflin-St Jeor) ─────────────────────────────────────────
function calculateBMR(age: number, sex: string, heightCm: number, weightKg: number): number {
  if (sex === "female") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly: 1.375,
  moderately: 1.55,
  very: 1.725,
  "": 1.4,
};

function calculateTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.4));
}



// ── Protein suggestions ────────────────────────────────────────────────────────
const PROTEIN_SUGGESTIONS = [
  { name: "Paneer", emoji: "🧀", protein: 18, per: "100g", query: "Paneer Sabzi" },
  { name: "Chicken Tikka", emoji: "🍗", protein: 28, per: "150g", query: "Chicken Tikka" },
  { name: "Eggs (2)", emoji: "🥚", protein: 12, per: "2 eggs", query: "egg bhurji" },
  { name: "Dal Chawal", emoji: "🍚", protein: 15, per: "1 plate", query: "Dal Chawal" },
  { name: "Milk", emoji: "🥛", protein: 8, per: "250ml", query: "milk" },
  { name: "Greek Yogurt", emoji: "🍶", protein: 10, per: "100g", query: "yogurt" },
  { name: "Soy Milk", emoji: "🌱", protein: 7, per: "250ml", query: "soy milk" },
  { name: "Peanut Butter", emoji: "🥜", protein: 8, per: "2 tbsp", query: "peanut butter" },
];

// ── Goals Presets (redesigned) ─────────────────────────────────────────────────
const GOAL_PRESETS: { emoji: string; label: string; desc: string; goal: DailyGoal }[] = [
  { emoji: "🔥", label: "Fat Loss", desc: "1500 kcal · High protein · Moderate carbs", goal: { calories: 1500, carbs: 150, protein: 130, fat: 50, water: 8 } },
  { emoji: "⚖️", label: "Maintain Weight", desc: "2000 kcal · Balanced macros", goal: { calories: 2000, carbs: 250, protein: 150, fat: 65, water: 8 } },
  { emoji: "💪", label: "Build Muscle", desc: "2500 kcal · High protein · High carbs", goal: { calories: 2500, carbs: 300, protein: 180, fat: 80, water: 9 } },
];

// ── Goals Setup Sheet ─────────────────────────────────────────────────────────
function GoalsSetupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);
  const { setDailyGoal } = useCalories();
  const { healthProfile } = useProfile();
  const [selected, setSelected] = useState<number | "custom">(1);

  // Custom fields — pre-filled from profile
  const [customAge, setCustomAge] = useState(healthProfile.age || "");
  const [customSex, setCustomSex] = useState<"male" | "female" | "other">(
    (healthProfile.sex as "male" | "female" | "other") || "male"
  );
  const [customHeight, setCustomHeight] = useState(healthProfile.height || "");
  const [customWeight, setCustomWeight] = useState(healthProfile.weight || "");
  const [customActivity, setCustomActivity] = useState(healthProfile.activityLevel || "moderately");
  const [customGoalType, setCustomGoalType] = useState<"fat_loss" | "maintain" | "muscle">("maintain");

  const [customCals, setCustomCals] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customWater, setCustomWater] = useState("");
  const [autoCalced, setAutoCalced] = useState(false);

  const handleAutoCalculate = () => {
    const age = parseInt(customAge);
    const height = parseFloat(customHeight);
    const weight = parseFloat(customWeight);
    if (!age || !height || !weight) {
      Alert.alert("Missing info", "Please enter age, height, and weight to auto-calculate.");
      return;
    }
    const bmr = calculateBMR(age, customSex, height, weight);
    let tdee = calculateTDEE(bmr, customActivity);
    let targetCals = tdee;
    let protein = Math.round(weight * 1.6);
    let fat = Math.round((targetCals * 0.25) / 9);
    if (customGoalType === "fat_loss") {
      targetCals = Math.max(1200, tdee - 500);
      protein = Math.round(weight * 2.0);
      fat = Math.round((targetCals * 0.25) / 9);
    } else if (customGoalType === "muscle") {
      targetCals = tdee + 300;
      protein = Math.round(weight * 2.2);
      fat = Math.round((targetCals * 0.25) / 9);
    }
    const carbs = Math.round((targetCals - protein * 4 - fat * 9) / 4);
    const water = Math.round((weight * 35) / 250); // glasses (250ml each)

    setCustomCals(String(targetCals));
    setCustomProtein(String(protein));
    setCustomCarbs(String(Math.max(50, carbs)));
    setCustomFat(String(fat));
    setCustomWater(String(Math.max(6, water)));
    setAutoCalced(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = () => {
    let g: DailyGoal;
    if (selected === "custom") {
      g = {
        calories: parseInt(customCals) || 2000,
        carbs: parseInt(customCarbs) || 250,
        protein: parseInt(customProtein) || 150,
        fat: parseInt(customFat) || 65,
        water: parseInt(customWater) || 8,
      };
    } else {
      g = GOAL_PRESETS[selected]?.goal ?? GOAL_PRESETS[1].goal;
    }
    setDailyGoal(g);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const ACTIVITY_OPTIONS = [
    { value: "sedentary", label: "Sedentary" },
    { value: "lightly", label: "Lightly active" },
    { value: "moderately", label: "Moderately active" },
    { value: "very", label: "Very active" },
  ];
  const GOAL_TYPE_OPTIONS = [
    { value: "fat_loss", label: "Fat Loss" },
    { value: "maintain", label: "Maintain" },
    { value: "muscle", label: "Build Muscle" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
              <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={40} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>Set Your Goals</Text>
                <Text style={s.sheetSub}>Choose a preset or set a custom target</Text>

                {/* Presets */}
                {GOAL_PRESETS.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.presetBtn, selected === i && { borderColor: ACCENT, backgroundColor: ACCENT + "15" }]}
                    onPress={() => setSelected(i)}
                  >
                    <Text style={{ fontSize: 22, marginRight: 10 }}>{p.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.presetLabel, selected === i && { color: ACCENT }]}>{p.label}</Text>
                      <Text style={s.presetDesc}>{p.desc}</Text>
                    </View>
                    {selected === i && <Ionicons name="checkmark-circle" size={22} color={ACCENT} />}
                  </TouchableOpacity>
                ))}

                {/* Custom Target Option */}
                <TouchableOpacity
                  style={[s.presetBtn, selected === "custom" && { borderColor: ACCENT, backgroundColor: ACCENT + "15" }]}
                  onPress={() => setSelected("custom")}
                >
                  <Text style={{ fontSize: 22, marginRight: 10 }}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.presetLabel, selected === "custom" && { color: ACCENT }]}>Custom Target</Text>
                    <Text style={s.presetDesc}>Calculate based on your body stats</Text>
                  </View>
                  {selected === "custom" && <Ionicons name="checkmark-circle" size={22} color={ACCENT} />}
                </TouchableOpacity>

                {/* Custom Target Form */}
                {selected === "custom" && (
                  <View style={s.customForm}>
                    {/* Sex selector */}
                    <Text style={s.fieldLabel}>Gender</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                      {(["male", "female", "other"] as const).map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[s.segBtn, customSex === opt && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                          onPress={() => setCustomSex(opt)}
                        >
                          <Text style={[s.segBtnText, customSex === opt && { color: "#fff" }]}>
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Age / Height / Weight row */}
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Age</Text>
                        <TextInput
                          style={s.manualInput}
                          placeholder="e.g. 25"
                          placeholderTextColor={theme.MUTED}
                          value={customAge}
                          onChangeText={setCustomAge}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Height (cm)</Text>
                        <TextInput
                          style={s.manualInput}
                          placeholder="e.g. 170"
                          placeholderTextColor={theme.MUTED}
                          value={customHeight}
                          onChangeText={setCustomHeight}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fieldLabel}>Weight (kg)</Text>
                        <TextInput
                          style={s.manualInput}
                          placeholder="e.g. 70"
                          placeholderTextColor={theme.MUTED}
                          value={customWeight}
                          onChangeText={setCustomWeight}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {/* Activity level */}
                    <Text style={s.fieldLabel}>Activity Level</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
                      {ACTIVITY_OPTIONS.map((a) => (
                        <TouchableOpacity
                          key={a.value}
                          style={[s.segBtn, customActivity === a.value && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                          onPress={() => setCustomActivity(a.value as any)}
                        >
                          <Text style={[s.segBtnText, customActivity === a.value && { color: "#fff" }]}>{a.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {/* Goal type */}
                    <Text style={s.fieldLabel}>Your Goal</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                      {GOAL_TYPE_OPTIONS.map((g) => (
                        <TouchableOpacity
                          key={g.value}
                          style={[s.segBtn, { flex: 1 }, customGoalType === g.value && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                          onPress={() => setCustomGoalType(g.value as any)}
                        >
                          <Text style={[s.segBtnText, { textAlign: "center" }, customGoalType === g.value && { color: "#fff" }]}>{g.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Auto-calculate button */}
                    <TouchableOpacity
                      style={[s.calcBtn, { backgroundColor: TEAL }]}
                      onPress={handleAutoCalculate}
                    >
                      <Ionicons name="calculator-outline" size={16} color="#fff" />
                      <Text style={s.calcBtnText}>Calculate My Targets</Text>
                    </TouchableOpacity>

                    {/* Calculated results or manual override */}
                    {autoCalced && (
                      <View style={s.calcResultBox}>
                        <Text style={[s.fieldLabel, { color: TEAL, marginBottom: 10 }]}>✅ Calculated Targets</Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Calories</Text>
                            <TextInput style={s.manualInput} value={customCals} onChangeText={setCustomCals} keyboardType="numeric" placeholderTextColor={theme.MUTED} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Water (glasses)</Text>
                            <TextInput style={s.manualInput} value={customWater} onChangeText={setCustomWater} keyboardType="numeric" placeholderTextColor={theme.MUTED} />
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Protein (g)</Text>
                            <TextInput style={s.manualInput} value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" placeholderTextColor={theme.MUTED} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Carbs (g)</Text>
                            <TextInput style={s.manualInput} value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" placeholderTextColor={theme.MUTED} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Fat (g)</Text>
                            <TextInput style={s.manualInput} value={customFat} onChangeText={setCustomFat} keyboardType="numeric" placeholderTextColor={theme.MUTED} />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Manual entry without auto-calc */}
                    {!autoCalced && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[s.fieldLabel, { marginBottom: 10 }]}>Or enter manually:</Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Calories</Text>
                            <TextInput style={s.manualInput} placeholder="2000" placeholderTextColor={theme.MUTED} value={customCals} onChangeText={setCustomCals} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Water (glasses)</Text>
                            <TextInput style={s.manualInput} placeholder="8" placeholderTextColor={theme.MUTED} value={customWater} onChangeText={setCustomWater} keyboardType="numeric" />
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Protein (g)</Text>
                            <TextInput style={s.manualInput} placeholder="150" placeholderTextColor={theme.MUTED} value={customProtein} onChangeText={setCustomProtein} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Carbs (g)</Text>
                            <TextInput style={s.manualInput} placeholder="250" placeholderTextColor={theme.MUTED} value={customCarbs} onChangeText={setCustomCarbs} keyboardType="numeric" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.fieldLabel}>Fat (g)</Text>
                            <TextInput style={s.manualInput} placeholder="65" placeholderTextColor={theme.MUTED} value={customFat} onChangeText={setCustomFat} keyboardType="numeric" />
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={[s.saveGoalBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
                  <Text style={s.saveGoalBtnText}>Save Goals</Text>
                </TouchableOpacity>
              </KeyboardAwareScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ── All Nutrients Sheet ──────────────────────────────────────────────────────
function AllNutrientsSheet({ visible, onClose, stats }: { visible: boolean; onClose: () => void; stats: any }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { CARD, MUTED, GREEN, BORDER, TEXT, CARD2 } = theme;
  const s = makeS(theme);
  const [searchQuery, setSearchQuery] = useState("");

  const ALL_NUTRIENTS = [
    { label: "Fiber", value: stats.fiber, unit: "g", goal: 28 },
    { label: "Sugar", value: stats.sugar, unit: "g", goal: 50 },
    { label: "Sodium", value: stats.sodium, unit: "mg", goal: 2300 },
    { label: "Potassium", value: stats.potassium, unit: "mg", goal: 3500 },
    { label: "Calcium", value: stats.calcium, unit: "mg", goal: 1000 },
    { label: "Iron", value: stats.iron, unit: "mg", goal: 18 },
    { label: "Magnesium", value: stats.magnesium, unit: "mg", goal: 400 },
    { label: "Zinc", value: stats.zinc, unit: "mg", goal: 11 },
    { label: "Vitamin A", value: stats.vitaminA, unit: "mcg", goal: 900 },
    { label: "Vitamin C", value: stats.vitaminC, unit: "mg", goal: 90 },
    { label: "Vitamin D", value: stats.vitaminD, unit: "mcg", goal: 20 },
    { label: "Vitamin B12", value: stats.vitaminB12, unit: "mcg", goal: 2.4 },
  ];

  const filteredNutrients = ALL_NUTRIENTS.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()));

  React.useEffect(() => {
    if (!visible) setSearchQuery("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", justifyContent: "flex-end", flexShrink: 1 }}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: CARD, paddingBottom: insets.bottom + 24, height: "85%" }]}>
            <View style={s.handle} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={[s.sheetTitle, { marginBottom: 0 }]}>All Nutrients</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color={MUTED} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: CARD2, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
              <Ionicons name="search" size={20} color={MUTED} />
              <TextInput
                style={{ flex: 1, height: 44, color: TEXT, paddingLeft: 8 }}
                placeholder="Search nutrients..."
                placeholderTextColor={MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color={MUTED} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} keyboardDismissMode="on-drag">
              {filteredNutrients.map(({ label, value, unit, goal }) => {
                const hasData = value !== undefined && value !== null;
                const pct = hasData ? Math.min(value / goal, 1) : 0;
                const col = hasData ? (pct >= 0.5 ? GREEN : pct >= 0.2 ? VIT_ORANGE : "#EF4444") : VIT_GREY;
                const displayVal = hasData ? (value % 1 === 0 ? value : value.toFixed(1)) : "0";

                return (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: BORDER }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: TEXT, fontSize: 16, fontWeight: "600", marginBottom: 8 }}>{label}</Text>
                      <View style={{ height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: "hidden", width: "100%" }}>
                        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: col, borderRadius: 3 }} />
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", marginLeft: 16 }}>
                      <Text style={{ color: col, fontSize: 16, fontWeight: "bold" }}>{displayVal}<Text style={{ fontSize: 14, color: MUTED }}>{unit}</Text></Text>
                      <Text style={{ color: MUTED, fontSize: 12 }}>/ {goal}{unit}</Text>
                    </View>
                  </View>
                );
              })}
              {filteredNutrients.length === 0 && (
                <Text style={{ color: MUTED, textAlign: "center", marginTop: 32 }}>No nutrients found matching "{searchQuery}"</Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Food Result Sheet ─────────────────────────────────────────────────────────
interface FoodResultSheetProps {
  visible: boolean;
  result: FoodAnalysisResult | null;
  defaultMeal: MealType;
  onClose: () => void;
  onAdd: (meal: MealType, result: FoodAnalysisResult, portion: number) => void;
  onRescan: () => void;
}
function FoodResultSheet({ visible, result, defaultMeal, onClose, onAdd, onRescan }: FoodResultSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { MUTED, GREEN, YELLOW } = theme;
  const s = makeS(theme);
  const [portion, setPortion] = useState(1);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [editedName, setEditedName] = useState("");

  React.useEffect(() => {
    if (visible && result) {
      setPortion(1);
      setMeal(defaultMeal);
      setEditedName(result.name);
    }
  }, [visible, result, defaultMeal]);

  if (!result) return null;

  const p = portion;
  const cal = Math.round(result.calories * p);
  const carbs = Math.round(result.carbs * p);
  const protein = Math.round(result.protein * p);
  const fat = Math.round(result.fat * p);
  const fiber = result.fiber !== undefined ? Math.round(result.fiber * p) : undefined;
  const sugar = result.sugar !== undefined ? Math.round(result.sugar * p) : undefined;
  const sodium = result.sodium !== undefined ? Math.round(result.sodium * p) : undefined;

  const PORTIONS = [0.5, 1, 1.5, 2];
  const showIndianGuidance = isIndianFood(result);
  const isLocalDB = result.source === "local-db";

  // Confidence color and percent
  const confPct = confidencePct(result.confidence);
  const confColor = result.confidence === "high" ? GREEN : result.confidence === "medium" ? YELLOW : "#EF4444";
  const confBg = result.confidence === "high" ? GREEN + "22" : result.confidence === "medium" ? YELLOW + "22" : "#EF444422";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 20 }]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.handle} />
              {/* Header */}
              <View style={s.resultHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.resultDetected}>
                    {result.source === "local-db"
                      ? "🇮🇳 Indian DB"
                      : result.source === "usda"
                        ? "USDA Database"
                        : result.source === "open-food-facts"
                          ? "Open Food Facts"
                          : "Database"}
                  </Text>
                </View>
                {/* Confidence with % value */}
                <View style={[s.confidencePill, { backgroundColor: confBg }]}>
                  <Text style={[s.confidenceText, { color: confColor }]}>{confPct} Confidence</Text>
                </View>
              </View>

              <TextInput
                style={s.resultNameInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Food name"
                placeholderTextColor="#444"
                maxLength={80}
              />
              <Text style={s.resultServing}>{result.servingDescription}</Text>

              {/* Local DB note */}
              {isLocalDB && (
                <View style={s.localDBBanner}>
                  <Ionicons name="checkmark-circle" size={13} color={TEAL} />
                  <Text style={[s.localDBBannerText, { color: TEAL }]}>
                    Nutrition based on standard serving size — adjust portion as needed
                  </Text>
                </View>
              )}

              {/* Portion selector */}
              <Text style={s.fieldLabel}>Portion Size</Text>
              <View style={s.portionRow}>
                {PORTIONS.map((pt) => (
                  <TouchableOpacity key={pt} style={[s.portionBtn, portion === pt && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setPortion(pt)}>
                    <Text style={[s.portionBtnText, portion === pt && { color: "#fff" }]}>{pt}x</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Indian portion guidance */}
              {showIndianGuidance && (
                <View style={s.indianTipBanner}>
                  <Text style={s.indianTipIcon}>🍛</Text>
                  <Text style={s.indianTipText}>
                    {result.dishNotes
                      ? result.dishNotes
                      : "Tip: 1 katori ≈ 150ml · 1 medium roti ≈ 40g · 1 cup cooked rice ≈ 200g. Adjust portion if your serving was different."}
                  </Text>
                </View>
              )}

              {/* Macros grid — Calories most prominent, then protein > carbs > fat */}
              <View style={s.macroGrid}>
                <MacroCell label="Calories" value={cal} unit="kcal" color={ACCENT} big />
                <MacroCell label="Protein" value={protein} unit="g" color={MACRO_PROTEIN} />
                <MacroCell label="Carbs" value={carbs} unit="g" color={MACRO_CARB} />
                <MacroCell label="Fat" value={fat} unit="g" color={MACRO_FAT} />
                <MacroCell label="Fiber" value={fiber} unit="g" color={GREEN} />
                <MacroCell label="Sugar" value={sugar} unit="g" color="#EC4899" />
                <MacroCell label="Sodium" value={sodium} unit="mg" color={MUTED} />
              </View>

              {/* Meal selector */}
              <Text style={s.fieldLabel}>Add to Meal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {MEALS.map((m) => (
                  <TouchableOpacity key={m.key} style={[s.mealSelectChip, meal === m.key && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setMeal(m.key)}>
                    <Text style={[s.mealSelectChipText, meal === m.key && { color: "#fff" }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Add button */}
              <TouchableOpacity style={[s.addLogBtn, { backgroundColor: ACCENT }]} onPress={() => onAdd(meal, { ...result, name: editedName }, portion)}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={s.addLogBtnText}>Add to Log</Text>
              </TouchableOpacity>

              <View style={s.resultActions}>
                <TouchableOpacity style={s.resultActionBtn} onPress={onRescan}>
                  <Ionicons name="camera-outline" size={16} color={MUTED} />
                  <Text style={s.resultActionText}>Rescan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.resultActionBtn} onPress={onClose}>
                  <Ionicons name="close-outline" size={16} color={MUTED} />
                  <Text style={s.resultActionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function MacroCell({ label, value, unit, color, big }: { label: string; value: number | string | undefined; unit: string; color: string; big?: boolean }) {
  const theme = useAppTheme();
  const { MUTED } = theme;
  const s = makeS(theme);
  const displayVal = value !== undefined && value !== null ? value : "-";
  return (
    <View style={[s.macroCell, big && s.macroCellBig]}>
      <Text style={[s.macroCellValue, { color, fontSize: big ? 26 : 18 }]}>{displayVal}<Text style={[s.macroCellUnit, { color: MUTED }]}> {unit}</Text></Text>
      <Text style={s.macroCellLabel}>{label}</Text>
    </View>
  );
}

// ── Manual Entry Sheet ────────────────────────────────────────────────────────
interface ManualEntrySheetProps {
  visible: boolean;
  defaultMeal: MealType;
  onClose: () => void;
  onSave: (meal: MealType, result: FoodAnalysisResult) => void;
}
function ManualEntrySheet({ visible, defaultMeal, onClose, onSave }: ManualEntrySheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [meal, setMeal] = useState<MealType>(defaultMeal);

  React.useEffect(() => {
    if (visible) {
      setMeal(defaultMeal);
      setName(""); setCalories(""); setProtein(""); setCarbs(""); setFat("");
    }
  }, [visible, defaultMeal]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert("Required", "Please enter a food name."); return; }
    if (!calories.trim() || isNaN(Number(calories))) { Alert.alert("Required", "Please enter a valid calorie count."); return; }
    const result: FoodAnalysisResult = {
      name: name.trim(),
      servingDescription: "1 serving (manually entered)",
      calories: Math.max(0, Math.round(Number(calories))),
      protein: Math.max(0, Math.round(Number(protein) || 0)),
      carbs: Math.max(0, Math.round(Number(carbs) || 0)),
      fat: Math.max(0, Math.round(Number(fat) || 0)),
      fiber: 0, sugar: 0, sodium: 0,
      confidence: "high",
      noFoodDetected: false,
      source: "local-db",
    };
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(meal, result);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.handle} />
              <Text style={s.sheetTitle}>Add Manually</Text>
              <Text style={s.sheetSub}>Enter nutrition details for homemade or unrecognized food</Text>

              <Text style={s.fieldLabel}>Food Name *</Text>
              <TextInput
                style={s.manualInput}
                placeholder="e.g. Maa ke haath ki dal"
                placeholderTextColor={theme.MUTED}
                value={name}
                onChangeText={setName}
                maxLength={80}
              />

              <Text style={s.fieldLabel}>Calories (kcal) *</Text>
              <TextInput
                style={s.manualInput}
                placeholder="e.g. 350"
                placeholderTextColor={theme.MUTED}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Protein (g)</Text>
                  <TextInput style={s.manualInput} placeholder="0" placeholderTextColor={theme.MUTED} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Carbs (g)</Text>
                  <TextInput style={s.manualInput} placeholder="0" placeholderTextColor={theme.MUTED} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Fat (g)</Text>
                  <TextInput style={s.manualInput} placeholder="0" placeholderTextColor={theme.MUTED} value={fat} onChangeText={setFat} keyboardType="numeric" />
                </View>
              </View>

              <Text style={s.fieldLabel}>Add to Meal</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {MEALS.map((m) => (
                  <TouchableOpacity key={m.key} style={[s.mealSelectChip, meal === m.key && { backgroundColor: ACCENT, borderColor: ACCENT }]} onPress={() => setMeal(m.key)}>
                    <Text style={[s.mealSelectChipText, meal === m.key && { color: "#fff" }]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[s.addLogBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={s.addLogBtnText}>Save to Log</Text>
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Text Search Sheet (with Recent + Frequent + Indian quick chips) ────────────
function TextSearchSheet({
  visible,
  onClose,
  onResult,
  recentFoods,
  frequentFoods,
  prefilledQuery,
}: {
  visible: boolean;
  onClose: () => void;
  onResult: (r: FoodAnalysisResult) => void;
  recentFoods: string[];
  frequentFoods: { name: string; count: number }[];
  prefilledQuery?: string;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setText(prefilledQuery ?? "");
    } else {
      setText("");
    }
  }, [visible, prefilledQuery]);

  const handleSearch = async (query?: string) => {
    const q = (query ?? text).trim();
    if (!q) return;
    setLoading(true);
    try {
      const result = await analyzeFoodText(q);
      if (result.noFoodDetected) {
        Alert.alert(
          "No food found",
          "Couldn't find nutrition for that food item. Try being more specific, like 'Rajma', 'Banana', or 'Oats'."
        );
        return;
      }
      onClose();
      setTimeout(() => onResult(result), 250);
    } catch (err: any) {
      Alert.alert(
        "Search failed",
        err?.message ?? "Something went wrong. Please try again.",
        [
          { text: "Retry", onPress: () => handleSearch(q) },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChipPress = (query: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText(query);
    handleSearch(query);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
            <KeyboardAwareScrollView
              enableOnAndroid={true}
              extraScrollHeight={Platform.OS === "ios" ? 20 : 40}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.handle} />
              <Text style={s.sheetTitle}>Search Food</Text>

              <TextInput
                style={s.searchInput}
                placeholder="Describe what you ate — e.g. 'ek plate dal chawal', '2 roti sabzi'"
                placeholderTextColor={theme.MUTED}
                value={text}
                onChangeText={setText}
                autoFocus
                multiline
                onSubmitEditing={() => handleSearch()}
                returnKeyType="search"
              />

              <TouchableOpacity
                style={[s.addLogBtn, { backgroundColor: TEAL, opacity: text.trim() && !loading ? 1 : 0.5 }]}
                onPress={() => handleSearch()}
                disabled={!text.trim() || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="search" size={18} color="#fff" />}
                <Text style={s.addLogBtnText}>{loading ? "Searching..." : "Search Food"}</Text>
              </TouchableOpacity>

              {/* ── Recent Foods ── */}
              {recentFoods.length > 0 && (
                <View style={s.quickSection}>
                  <Text style={s.quickSectionTitle}>🕐 Recent Foods</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickChipsRow}>
                    {recentFoods.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[s.quickChip, { backgroundColor: theme.CARD2, borderColor: theme.BORDER }]}
                        onPress={() => handleChipPress(name)}
                        disabled={loading}
                      >
                        <Text style={[s.quickChipLabel, { color: theme.TEXT }]} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Frequently Logged ── */}
              {frequentFoods.length > 0 && (
                <View style={s.quickSection}>
                  <Text style={s.quickSectionTitle}>⭐ Frequently Logged</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickChipsRow}>
                    {frequentFoods.map(({ name, count }) => (
                      <TouchableOpacity
                        key={name}
                        style={[s.quickChip, { backgroundColor: ACCENT + "12", borderColor: ACCENT + "30" }]}
                        onPress={() => handleChipPress(name)}
                        disabled={loading}
                      >
                        <Text style={[s.quickChipLabel, { color: ACCENT }]} numberOfLines={1}>{name}</Text>
                        <Text style={{ fontSize: 9, color: ACCENT, opacity: 0.7 }}>×{count}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Popular Indian Foods quick chips ── */}
              <View style={s.indianChipsSection}>
                <View style={s.indianChipsHeader}>
                  <Text style={s.indianChipsTitle}>🇮🇳 Popular Indian Foods</Text>
                  <Text style={s.indianChipsSub}>Tap for instant nutrition</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.indianChipsRow}>
                  {INDIAN_FOOD_QUICK_CHIPS.map((chip) => (
                    <TouchableOpacity
                      key={chip.query}
                      style={[s.indianChip, { opacity: loading ? 0.5 : 1 }]}
                      onPress={() => handleChipPress(chip.query)}
                      disabled={loading}
                    >
                      <Text style={s.indianChipEmoji}>{chip.emoji}</Text>
                      <Text style={s.indianChipLabel}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Protein Suggestions Modal ─────────────────────────────────────────────────
function ProteinSuggestionsModal({
  visible,
  proteinGap,
  onClose,
  onSearch,
}: {
  visible: boolean;
  proteinGap: number;
  onClose: () => void;
  onSearch: (query: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: "100%", height: "100%", justifyContent: "flex-end" }}>
          <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Boost Your Protein 💪</Text>
            <Text style={s.sheetSub}>You need {proteinGap}g more protein today. Try one of these:</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PROTEIN_SUGGESTIONS.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={[s.proteinSuggRow, { borderColor: theme.BORDER }]}
                  onPress={() => { onClose(); setTimeout(() => onSearch(item.query), 200); }}
                >
                  <Text style={{ fontSize: 28, width: 40 }}>{item.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.proteinSuggName, { color: theme.TEXT }]}>{item.name}</Text>
                    <Text style={[s.proteinSuggMeta, { color: theme.MUTED }]}>{item.per}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.proteinSuggValue, { color: MACRO_PROTEIN }]}>{item.protein}g</Text>
                    <Text style={{ fontSize: 9, color: theme.MUTED }}>protein</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={ACCENT} style={{ marginLeft: 10 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CaloriesScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, GREEN, BLUE, YELLOW, RED, TEXT } = theme;
  const styles = makeStyles(theme);
  const s = makeS(theme);
  const { foodItems, dailyGoal, goalsConfigured, getDayStats, getWaterForDate, logWater, addFoodItem, deleteFoodItem } = useCalories();
  const { postActivityBanner, setPostActivityBanner } = useActivity();

  const today = getLocalDateString();

  // Screen tracking (analytics)
  useEffect(() => {
    logScreen("Calories");
  }, []);
  const stats = getDayStats(today);
  const water = getWaterForDate(today);

  const [activeMeal, setActiveMeal] = useState<MealType>(getDefaultMeal());
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FoodAnalysisResult | null>(null);
  const [showFoodResult, setShowFoodResult] = useState(false);
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [showGoalsSetup, setShowGoalsSetup] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showProteinModal, setShowProteinModal] = useState(false);
  const [showAllNutrients, setShowAllNutrients] = useState(false);

  const [textSearchQuery, setTextSearchQuery] = useState<string | undefined>(undefined);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const calPct = Math.min(stats.calories / dailyGoal.calories, 1);
  const remaining = Math.max(0, dailyGoal.calories - stats.calories);
  const exceeded = stats.calories > dailyGoal.calories;
  const ringCol = ringColor(calPct);
  const mealItems = stats.items.filter((i) => i.meal === activeMeal);
  const mealCals = (meal: MealType) => stats.items.filter((i) => i.meal === meal).reduce((s, i) => s + i.calories, 0);

  const remainingCardColor = exceeded
    ? RED
    : remaining <= 200
      ? ACCENT
      : GREEN;

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (let i = foodItems.length - 1; i >= 0 && result.length < 6; i--) {
      const n = foodItems[i].name;
      if (!seen.has(n)) { seen.add(n); result.push(n); }
    }
    return result;
  }, [foodItems]);

  const frequentFoods = useMemo(() => {
    const counts: Record<string, number> = {};
    foodItems.forEach((f) => { counts[f.name] = (counts[f.name] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [foodItems]);

  const proteinGap = dailyGoal.protein - stats.protein;
  const waterRemLiters = Math.max(0, dailyGoal.water - water);
  const waterPct = water / dailyGoal.water;

  const getInsight = (): { text: string; tappable: boolean } => {
    if (stats.calories === 0) {
      return { text: "Log your first meal to start tracking nutrition 🍽️", tappable: false };
    }
    if (proteinGap > 20) {
      return { text: `💪 You're ${proteinGap}g short on protein — tap for suggestions`, tappable: true };
    }
    if (waterPct < 0.5) {
      return { text: `💧 ${waterRemLiters} more glasses to hit your goal`, tappable: false };
    }
    if (exceeded) {
      return { text: `🔥 ${stats.calories - dailyGoal.calories} kcal over your goal today`, tappable: false };
    }
    if (remaining <= 200 && remaining > 0) {
      return { text: `🎯 Almost there — ${remaining} kcal remaining!`, tappable: false };
    }
    if (remaining === 0) {
      return { text: "⚡ Goal reached — great nutrition today!", tappable: false };
    }
    if (stats.protein >= dailyGoal.protein) {
      return { text: "🥩 Excellent protein intake today!", tappable: false };
    }
    return { text: `🔥 ${remaining} kcal remaining — keep it up!`, tappable: false };
  };

  const getTodayInsightLines = (): string[] => {
    const lines: string[] = [];
    if (proteinGap > 20) lines.push(`🥩 Protein is low — ${proteinGap}g to go`);
    if (waterPct < 0.5) lines.push(`💧 Drink ${waterRemLiters} more glasses`);
    if (!exceeded && remaining > 0) lines.push(`🔥 ${remaining} kcal remaining`);
    if (stats.protein >= dailyGoal.protein) lines.push("💪 Great protein today!");
    if (lines.length === 0) lines.push("⚡ Great progress today — keep it up!");
    return lines.slice(0, 2);
  };

  const insight = getInsight();
  const hasLoggedMeals = stats.calories > 0;

  const handleScanPress = () => {
    Alert.alert("Food Scan", "Food Scan is coming soon.");
  };

  const handleAddToLog = (meal: MealType, result: FoodAnalysisResult, portion: number) => {
    addFoodItem({
      name: result.name,
      calories: Math.round(result.calories * portion),
      carbs: Math.round(result.carbs * portion),
      protein: Math.round(result.protein * portion),
      fat: Math.round(result.fat * portion),
      fiber: result.fiber !== undefined ? Math.round(result.fiber * portion) : undefined,
      sugar: result.sugar !== undefined ? Math.round(result.sugar * portion) : undefined,
      sodium: result.sodium !== undefined ? Math.round(result.sodium * portion) : undefined,
      potassium: result.potassium !== undefined ? Math.round(result.potassium * portion) : undefined,
      calcium: result.calcium !== undefined ? Math.round(result.calcium * portion) : undefined,
      iron: result.iron !== undefined ? Math.round(result.iron * portion) : undefined,
      magnesium: result.magnesium !== undefined ? Math.round(result.magnesium * portion) : undefined,
      zinc: result.zinc !== undefined ? Math.round(result.zinc * portion) : undefined,
      vitaminA: result.vitaminA !== undefined ? Math.round(result.vitaminA * portion) : undefined,
      vitaminC: result.vitaminC !== undefined ? Math.round(result.vitaminC * portion) : undefined,
      vitaminD: result.vitaminD !== undefined ? Math.round(result.vitaminD * portion) : undefined,
      vitaminB12: result.vitaminB12 !== undefined ? Math.round(result.vitaminB12 * portion) : undefined,
      portionSize: result.servingDescription,
      meal,
      date: today,
    });
    setShowFoodResult(false);
    setScanResult(null);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleManualSave = (meal: MealType, result: FoodAnalysisResult) => {
    addFoodItem({
      name: result.name,
      calories: result.calories,
      carbs: result.carbs,
      protein: result.protein,
      fat: result.fat,
      fiber: result.fiber !== undefined ? result.fiber : undefined,
      sugar: result.sugar !== undefined ? result.sugar : undefined,
      sodium: result.sodium !== undefined ? result.sodium : undefined,
      portionSize: result.servingDescription,
      meal,
      date: today,
    });
  };

  const totalMealsLogged = MEALS.filter((m) => mealCals(m.key) > 0).length;

  const waterInsight = (): string => {
    if (water === 0) return "💧 Start drinking — log your first glass";
    if (waterPct >= 1) return "💧 Hydration goal completed — great job! 🎉";
    if (waterPct >= 0.75) return `💧 Almost there — ${waterRemLiters} more glasses to go`;
    if (waterPct >= 0.5) return `💧 Keep going! ${waterRemLiters} more glasses to hit your goal`;
    return `💧 ${waterRemLiters} more glasses to hit your goal`;
  };

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100, paddingTop: topPad + 8 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── Post-Activity Banner ────────────────────────────────────── */}
        {postActivityBanner && (() => {
          const hoursOld = (Date.now() - postActivityBanner.loggedAt) / 3_600_000;
          if (hoursOld >= 2) { setPostActivityBanner(null); return null; }
          return (
            <View style={styles.activityBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityBannerTitle}>
                  {postActivityBanner.emoji} Post-{postActivityBanner.sport} Recovery Window
                </Text>
                <Text style={styles.activityBannerSub}>Log your recovery meal now 🍽️</Text>
              </View>
              <TouchableOpacity style={styles.activityBannerBtn}
                onPress={() => { setShowTextSearch(true); setPostActivityBanner(null); }}>
                <Text style={styles.activityBannerBtnText}>Log Meal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPostActivityBanner(null)} style={{ paddingLeft: 8 }}>
                <Ionicons name="close" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.screenTitle}>Fuel</Text>
            <Text style={styles.remainingLine}>
              {exceeded ? `🔴 ${stats.calories - dailyGoal.calories} kcal over goal` : remaining === 0 ? "🎉 Goal reached today!" : `${remaining} kcal away from your goal`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateLabel}>{formatDate(today)}</Text>
            <TouchableOpacity onPress={() => setShowGoalsSetup(true)} style={styles.goalsBtn}>
              <Ionicons name="settings-outline" size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        {!goalsConfigured && !hasLoggedMeals ? (
          <TouchableOpacity style={styles.goalsSetupCard} onPress={() => setShowGoalsSetup(true)}>
            <View style={styles.goalsSetupLeft}>
              <Text style={styles.goalsSetupTitle}>Set your nutrition goals</Text>
              <Text style={styles.goalsSetupSub}>Personalize your daily calorie and macro targets</Text>
            </View>
            <View style={[styles.goalsSetupBtn, { backgroundColor: ACCENT }]}>
              <Text style={styles.goalsSetupBtnText}>Set Goals</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.insightTopCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <Ionicons name="bulb-outline" size={14} color={ACCENT} />
              <Text style={styles.insightTopTitle}>Today's Nutrition Insight</Text>
            </View>
            {getTodayInsightLines().map((line, i) => (
              <Text key={i} style={styles.insightTopLine}>{line}</Text>
            ))}
          </View>
        )}

        <View style={[styles.heroCard, { backgroundColor: CARD }]}>
          <View style={styles.heroLeft}>
            {stats.calories === 0 ? (
              <View style={styles.emptyRingPlaceholder}>
                <Text style={{ fontSize: 36 }}>🍽️</Text>
                <Text style={[styles.emptyRingText, { color: MUTED }]}>No meals yet</Text>
              </View>
            ) : (
              <CircularProgress size={130} progress={calPct} color={ringCol} strokeWidth={11} backgroundColor="#FF6B3566">
                <View style={styles.ringInner}>
                  <Text style={[styles.ringCals, { color: ringCol }]}>{stats.calories}</Text>
                  <Text style={styles.ringUnit}>kcal</Text>
                </View>
              </CircularProgress>
            )}
            <Text style={styles.ringGoal}>of {dailyGoal.calories} kcal goal</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={[styles.statPill, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "40" }]}>
              <Ionicons name="flame-outline" size={14} color={ACCENT} />
              <View>
                <Text style={[styles.statPillValue, { color: ACCENT }]}>{stats.calories}</Text>
                <Text style={[styles.statPillLabel, { color: MUTED }]}>Eaten</Text>
              </View>
            </View>
            <View style={[
              styles.statPill,
              {
                backgroundColor: remainingCardColor + "18",
                borderColor: remainingCardColor + "40",
              }
            ]}>
              <Ionicons name={exceeded ? "warning-outline" : "arrow-down-circle-outline"} size={14} color={remainingCardColor} />
              <View>
                <Text style={[styles.statPillValue, { color: remainingCardColor }]}>
                  {exceeded ? stats.calories - dailyGoal.calories : remaining}
                </Text>
                <Text style={[styles.statPillLabel, { color: remainingCardColor }]}>
                  {exceeded ? "Over" : "Remaining"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: CARD }]}>
          <Text style={styles.cardTitle}>Macros</Text>
          {stats.calories === 0 ? (
            <View style={styles.emptyMacroState}>
              <Text style={{ fontSize: 24 }}>📊</Text>
              <Text style={[styles.emptyStateText, { color: MUTED }]}>Log a meal to see your macro breakdown</Text>
            </View>
          ) : (
            <>
              <HorizMacroBar label="Carbs" value={stats.carbs} goal={dailyGoal.carbs} color={MACRO_CARB} />
              <HorizMacroBar label="Protein" value={stats.protein} goal={dailyGoal.protein} color={MACRO_PROTEIN} />
              <HorizMacroBar label="Fat" value={stats.fat} goal={dailyGoal.fat} color={MACRO_FAT} />
            </>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={styles.cardTitle}>Top Nutrients</Text>
            {stats.calories === 0 ? (
              <View style={styles.emptyMacroState}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>🥗</Text>
                <Text style={[styles.emptyStateText, { color: MUTED, marginBottom: 12 }]}>
                  Log your first meal to start tracking:{"\n"}• Fiber  • Iron  • Calcium{"\n"}• Potassium  • Vitamin D  • Vitamin B12
                </Text>
                <TouchableOpacity style={[styles.logMealBtn, { backgroundColor: ACCENT }]} onPress={() => setShowTextSearch(true)}>
                  <Text style={styles.logMealBtnText}>Log Food</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.vitaminGrid}>
                  {(() => {
                    const allAvailable = [
                      { label: "Fiber", value: stats.fiber, unit: "g", goal: 28 },
                      { label: "Iron", value: stats.iron, unit: "mg", goal: 18 },
                      { label: "Calcium", value: stats.calcium, unit: "mg", goal: 1000 },
                      { label: "Potassium", value: stats.potassium, unit: "mg", goal: 3500 },
                      { label: "Vitamin D", value: stats.vitaminD, unit: "mcg", goal: 20 },
                      { label: "Vitamin B12", value: stats.vitaminB12, unit: "mcg", goal: 2.4 },
                      { label: "Sugar", value: stats.sugar, unit: "g", goal: 50 },
                      { label: "Sodium", value: stats.sodium, unit: "mg", goal: 2300 },
                      { label: "Magnesium", value: stats.magnesium, unit: "mg", goal: 400 },
                      { label: "Zinc", value: stats.zinc, unit: "mg", goal: 11 },
                      { label: "Vitamin A", value: stats.vitaminA, unit: "mcg", goal: 900 },
                      { label: "Vitamin C", value: stats.vitaminC, unit: "mg", goal: 90 },
                    ];

                    const consumed = allAvailable.filter(n => n.value !== undefined && n.value !== null && n.value > 0);
                    const topNutrients = consumed.slice(0, 6);

                    if (topNutrients.length === 0) {
                      return (
                        <Text style={{ color: MUTED, textAlign: "center", width: "100%", marginVertical: 12 }}>
                          No specific nutrients tracked in today's meals yet.
                        </Text>
                      );
                    }

                    return topNutrients.map(({ label, value, unit, goal }) => {
                      const pct = Math.min(value! / goal, 1);
                      const col = pct >= 0.5 ? GREEN : pct >= 0.2 ? VIT_ORANGE : "#EF4444";
                      const displayVal = value! % 1 === 0 ? value! : value!.toFixed(1);

                      return (
                        <View key={label} style={[styles.vitaminCard, { backgroundColor: CARD2, borderColor: col + "50" }]}>
                          <View style={[styles.vitaminDot, { backgroundColor: col }]} />
                          <Text style={[styles.vitaminValue, { color: col }]}>{displayVal}</Text>
                          <Text style={styles.vitaminUnit}>{unit}</Text>
                          <Text style={styles.vitaminLabel} numberOfLines={1}>{label}</Text>
                          <View style={styles.vitaminBarTrack}>
                            <View style={[styles.vitaminBarFill, { width: `${pct * 100}%`, backgroundColor: col }]} />
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
                <TouchableOpacity style={styles.viewAllMicrosBtn} onPress={() => setShowAllNutrients(true)}>
                  <Text style={styles.viewAllMicrosText}>View All Nutrients →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.waterHeader}>
            <View>
              <Text style={[styles.waterCount, { color: BLUE }]}>{water}/{dailyGoal.water} glasses</Text>
            </View>
          </View>
          <View style={styles.dropletRow}>
            {Array.from({ length: Math.min(dailyGoal.water, 12) }, (_, i) => (
              <TouchableOpacity key={i} onPress={() => { logWater(today, i < water ? -1 : 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name={i < water ? "water" : "water-outline"} size={28} color={i < water ? BLUE : BORDER} />
              </TouchableOpacity>
            ))}
            {dailyGoal.water > 12 && (
              <Text style={{ color: MUTED, fontSize: 12, alignSelf: "center" }}>+{dailyGoal.water - 12} more</Text>
            )}
          </View>
          <View style={styles.waterCtrlRow}>
            <View style={styles.waterBtns}>
              <TouchableOpacity
                style={[styles.waterBtn, { backgroundColor: BLUE + "22" }, water <= 0 && { opacity: 0.4 }]}
                disabled={water <= 0}
                onPress={() => { logWater(today, -1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Ionicons name="remove" size={18} color={BLUE} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.waterBtn, { backgroundColor: BLUE }]}
                onPress={() => { logWater(today, 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.waterInsightRow, { backgroundColor: BLUE + "12", borderColor: BLUE + "30" }]}>
            <Text style={[styles.waterInsightText, { color: BLUE }]}>{waterInsight()}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTabsRow}>
          {MEALS.map((m) => {
            const cals = mealCals(m.key);
            const active = activeMeal === m.key;
            const target = Math.round(dailyGoal.calories * m.targetPct);
            const mealPct = target > 0 ? cals / target : 0;
            const statusColor = cals === 0 ? BORDER : mealPct <= 0.9 ? GREEN : mealPct <= 1.0 ? ACCENT : RED;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.mealTab, active && { backgroundColor: ACCENT }]}
                onPress={() => setActiveMeal(m.key)}
              >
                <Ionicons name={m.icon as any} size={14} color={active ? "#fff" : MUTED} />
                <Text style={[styles.mealTabText, active && { color: "#fff" }]}>{m.label}</Text>
                {cals > 0 && (
                  <View style={[styles.mealCalBadge, { backgroundColor: active ? "#ffffff33" : ACCENT + "22" }]}>
                    <Text style={[styles.mealCalBadgeText, { color: active ? "#fff" : ACCENT }]}>{cals}</Text>
                  </View>
                )}
                <View style={[styles.mealTabIndicator, { backgroundColor: statusColor }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.mealSectionHeader}>
            <Text style={styles.mealSectionTitle}>{MEALS.find((m) => m.key === activeMeal)?.label}</Text>
            <View style={styles.mealHeaderBtns}>
              <TouchableOpacity
                style={[styles.scanBtn, { backgroundColor: TEAL }]}
                onPress={handleScanPress}
              >
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: ACCENT + "22", borderColor: ACCENT + "44" }]} onPress={() => { setTextSearchQuery(undefined); setShowTextSearch(true); }}>
                <Ionicons name="search-outline" size={16} color={ACCENT} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: MUTED + "22", borderColor: MUTED + "44" }]} onPress={() => setShowManualEntry(true)}>
                <Ionicons name="create-outline" size={16} color={MUTED} />
              </TouchableOpacity>
            </View>
          </View>

          {mealItems.length === 0 ? (
            <View style={styles.mealEmpty}>
              <Text style={styles.mealEmptyText}>{MEALS.find((m) => m.key === activeMeal)?.emptyText}</Text>
              <View style={styles.mealEmptyBtns}>
                <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: TEAL }]} onPress={handleScanPress}>
                  <Ionicons name="camera-outline" size={14} color="#fff" />
                  <Text style={styles.emptyActionBtnText}>Scan Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: ACCENT }]} onPress={() => { setTextSearchQuery(undefined); setShowTextSearch(true); }}>
                  <Ionicons name="search-outline" size={14} color="#fff" />
                  <Text style={styles.emptyActionBtnText}>Search Food</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: MUTED + "55" }]} onPress={() => setShowManualEntry(true)}>
                  <Ionicons name="create-outline" size={14} color="#fff" />
                  <Text style={styles.emptyActionBtnText}>Add Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {mealItems.map((item, idx) => (
                <View key={item.id} style={[styles.foodRow, { borderBottomColor: BORDER, borderBottomWidth: idx < mealItems.length - 1 ? 1 : 0 }]}>
                  <View style={styles.foodRowBody}>
                    <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.foodMeta}>
                      {item.portionSize ? `${item.portionSize}  ` : ""}
                      {item.carbs !== undefined ? `C:${item.carbs}g ` : ""}
                      {item.protein !== undefined ? `P:${item.protein}g ` : ""}
                      {item.fat !== undefined ? `F:${item.fat}g` : ""}
                    </Text>
                  </View>
                  <View style={styles.foodRowRight}>
                    <Text style={[styles.foodCals, { color: ACCENT }]}>{item.calories}</Text>
                    <Text style={styles.foodCalsUnit}>kcal</Text>
                    <TouchableOpacity onPress={() => deleteFoodItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={[styles.mealTotal, { borderTopColor: BORDER }]}>
                <Text style={styles.mealTotalLabel}>Meal total</Text>
                <Text style={[styles.mealTotalCals, { color: ACCENT }]}>
                  {mealItems.reduce((s, i) => s + i.calories, 0)} kcal
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Daily Summary Footer ──────────────────────────────────── */}
        <View style={[styles.summaryCard, { backgroundColor: CARD }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: TEXT }]}>{totalMealsLogged}</Text>
              <Text style={styles.summaryLabel}>Meals logged</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: remainingCardColor }]}>{exceeded ? `+${stats.calories - dailyGoal.calories}` : remaining}</Text>
              <Text style={styles.summaryLabel}>{exceeded ? "kcal over" : "kcal left"}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: BLUE }]}>{water}</Text>
              <Text style={styles.summaryLabel}>Water today</Text>
            </View>
          </View>
          {/* Change 15: Tappable protein insight */}
          <TouchableOpacity
            activeOpacity={insight.tappable ? 0.7 : 1}
            onPress={() => {
              if (insight.tappable && proteinGap > 20) setShowProteinModal(true);
            }}
            style={[styles.insightBanner, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}
          >
            <Ionicons name="bulb-outline" size={14} color={ACCENT} />
            <Text style={[styles.insightText, { color: ACCENT, flex: 1 }]}>{insight.text}</Text>
            {insight.tappable && <Ionicons name="chevron-forward" size={14} color={ACCENT} />}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Scanning overlay ──────────────────────────────────────── */}
      {scanning && (
        <View style={styles.scanningOverlay}>
          <View style={[styles.scanningBox, { backgroundColor: CARD }]}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={styles.scanningTitle}>Analyzing your food with AI 🤖</Text>
            <Text style={styles.scanningSubText}>Detecting Indian dishes, calories, and nutrients...</Text>
          </View>
        </View>
      )}

      {/* ── Banner Ad ─────────────────────────────────────────────── */}
      {isFocused && (
        <View style={{ width: "100%", alignItems: "center", marginBottom: (Platform.OS === "web" ? 84 : 60 + insets.bottom) + (insets.bottom > 0 ? 0 : 4) }}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => console.log('✅ Banner Ad Loaded Successfully (Calories Tab)')}
            onAdFailedToLoad={(error) => console.log('❌ Banner Ad Failed (Calories Tab):', JSON.stringify(error))}
          />
        </View>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      <FoodResultSheet
        visible={showFoodResult}
        result={scanResult}
        defaultMeal={activeMeal}
        onClose={() => { setShowFoodResult(false); setScanResult(null); }}
        onAdd={handleAddToLog}
        onRescan={() => { setShowFoodResult(false); setScanResult(null); setTimeout(handleScanPress, 300); }}
      />
      <TextSearchSheet
        visible={showTextSearch}
        onClose={() => setShowTextSearch(false)}
        onResult={(r) => { setScanResult(r); setShowFoodResult(true); }}
        recentFoods={recentFoods}
        frequentFoods={frequentFoods}
        prefilledQuery={textSearchQuery}
      />
      <ManualEntrySheet
        visible={showManualEntry}
        defaultMeal={activeMeal}
        onClose={() => setShowManualEntry(false)}
        onSave={handleManualSave}
      />
      <GoalsSetupSheet visible={showGoalsSetup} onClose={() => setShowGoalsSetup(false)} />
      <ProteinSuggestionsModal
        visible={showProteinModal}
        proteinGap={proteinGap}
        onClose={() => setShowProteinModal(false)}
        onSearch={(query) => { setTextSearchQuery(query); setShowTextSearch(true); }}
      />

    </View>
  );
}

// ── Horizontal macro bar ──────────────────────────────────────────────────────
function HorizMacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const pct = Math.min(value / goal, 1);
  return (
    <View style={styles.horizMacroRow}>
      <Text style={styles.horizMacroLabel}>{label}</Text>
      <View style={styles.horizMacroTrack}>
        <View style={[styles.horizMacroFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.horizMacroValue, { color }]}>{value}<Text style={styles.horizMacroGoal}>/{goal}g</Text></Text>
    </View>
  );
}

// ── Shared sheet styles ───────────────────────────────────────────────────────
const makeS = (t: AppTheme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, maxHeight: "92%" },
  handle: { width: 40, height: 4, backgroundColor: t.BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 21, fontWeight: "700" as const, color: t.TEXT, marginBottom: 6 },
  sheetSub: { fontSize: 13, color: t.MUTED, marginBottom: 20 },
  presetBtn: { flexDirection: "row", alignItems: "center", backgroundColor: t.CARD, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: t.BORDER },
  presetLabel: { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 3 },
  presetDesc: { fontSize: 12, color: t.MUTED },
  saveGoalBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveGoalBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },

  // Custom form
  customForm: { backgroundColor: t.CARD2, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  segBtn: { flex: 1, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: t.BORDER, alignItems: "center" },
  segBtnText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  calcBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 14 },
  calcBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" as const },
  calcResultBox: { backgroundColor: TEAL + "10", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: TEAL + "30", marginTop: 4 },

  // Food result sheet
  resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  resultDetected: { fontSize: 12, color: t.MUTED, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  confidencePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  confidenceText: { fontSize: 12, fontWeight: "700" as const },
  resultNameInput: { fontSize: 18, fontWeight: "700" as const, color: t.TEXT, borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: 6, marginBottom: 6 },
  resultServing: { fontSize: 12, color: t.MUTED, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 },

  // Local DB banner
  localDBBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: TEAL + "18", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: TEAL + "30" },
  localDBBannerText: { fontSize: 11, fontWeight: "600" as const, flex: 1, lineHeight: 15 },

  // Indian tip banner
  indianTipBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: INDIAN_SAFFRON + "15", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: INDIAN_SAFFRON + "30" },
  indianTipIcon: { fontSize: 16, marginTop: 1 },
  indianTipText: { fontSize: 11, color: t.TEXT, flex: 1, lineHeight: 16, fontWeight: "500" as const },

  // Portion
  portionRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  portionBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  portionBtnText: { fontSize: 14, fontWeight: "700" as const, color: t.MUTED },

  // Macros
  macroGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginBottom: 20 },
  macroCell: { backgroundColor: t.CARD, borderRadius: 12, padding: 10, minWidth: "29%", flex: 1 },
  macroCellBig: { width: "100%", flex: undefined, backgroundColor: "#FF6B3515", borderWidth: 1, borderColor: ACCENT + "30" },
  macroCellValue: { fontWeight: "700" as const },
  macroCellUnit: { fontSize: 11, fontWeight: "400" as const },
  macroCellLabel: { fontSize: 11, color: t.MUTED, marginTop: 2 },

  // Meal selector
  mealSelectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  mealSelectChipText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },

  // Add log btn
  addLogBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, marginVertical: 16 },
  addLogBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },

  // Result actions
  resultActions: { flexDirection: "row", gap: 16, justifyContent: "center", paddingBottom: 8 },
  resultActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultActionText: { fontSize: 13, color: t.MUTED },

  // Text search
  searchInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: t.TEXT, marginBottom: 16, minHeight: 70, textAlignVertical: "top" as const },

  // Quick chips (recent/frequent)
  quickSection: { marginTop: 12 },
  quickSectionTitle: { fontSize: 13, fontWeight: "700" as const, color: t.TEXT, marginBottom: 8 },
  quickChipsRow: { gap: 8, paddingBottom: 4 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, maxWidth: 160 },
  quickChipLabel: { fontSize: 12, fontWeight: "600" as const },

  // Indian food chips
  indianChipsSection: { marginTop: 12 },
  indianChipsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  indianChipsTitle: { fontSize: 14, fontWeight: "700" as const, color: t.TEXT },
  indianChipsSub: { fontSize: 11, color: t.MUTED },
  indianChipsRow: { gap: 8, paddingBottom: 4 },
  indianChip: { alignItems: "center", backgroundColor: INDIAN_SAFFRON + "18", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: INDIAN_SAFFRON + "30", minWidth: 80 },
  indianChipEmoji: { fontSize: 20, marginBottom: 4 },
  indianChipLabel: { fontSize: 10, fontWeight: "700" as const, color: t.TEXT, textAlign: "center" as const },

  // Manual entry
  manualInput: { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: t.TEXT, marginBottom: 12 },

  // Protein suggestions
  proteinSuggRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  proteinSuggName: { fontSize: 15, fontWeight: "600" as const, marginBottom: 2 },
  proteinSuggMeta: { fontSize: 12 },
  proteinSuggValue: { fontSize: 18, fontWeight: "800" as const },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 14 },

  activityBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#22C55E18", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#22C55E33", marginBottom: 10 },
  activityBannerTitle: { fontSize: 13, fontWeight: "700" as const, color: t.TEXT, marginBottom: 2 },
  activityBannerSub: { fontSize: 11, color: t.SUBTEXT },
  activityBannerBtn: { backgroundColor: "#22C55E", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  activityBannerBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#fff" },

  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  screenTitle: { fontSize: 30, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  remainingLine: { fontSize: 12, color: t.MUTED, marginTop: 3, fontWeight: "500" as const },
  headerRight: { alignItems: "flex-end", gap: 6 },
  dateLabel: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const },
  goalsBtn: { padding: 6 },

  // Change 1: Smart goals banner / insight card
  goalsSetupCard: { backgroundColor: ACCENT + "18", borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: ACCENT + "40" },
  goalsSetupLeft: { flex: 1 },
  goalsSetupTitle: { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 3 },
  goalsSetupSub: { fontSize: 12, color: t.MUTED },
  goalsSetupBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  goalsSetupBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
  insightTopCard: { backgroundColor: t.CARD, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: ACCENT + "30" },
  insightTopTitle: { fontSize: 12, fontWeight: "700" as const, color: ACCENT, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  insightTopLine: { fontSize: 13, color: t.TEXT, fontWeight: "500" as const, marginTop: 4 },

  heroCard: { borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.BORDER },
  heroLeft: { flex: 1, alignItems: "center" },
  ringInner: { alignItems: "center" },
  ringCals: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.5 },
  ringUnit: { fontSize: 11, color: t.MUTED, fontWeight: "500" as const },
  ringGoal: { fontSize: 11, color: t.MUTED, marginTop: 8 },
  heroRight: { gap: 10 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 10, borderWidth: 1, minWidth: 110 },
  statPillValue: { fontSize: 17, fontWeight: "800" as const, letterSpacing: -0.5 },
  statPillLabel: { fontSize: 10, fontWeight: "600" as const },

  // Change 12: Empty states
  emptyRingPlaceholder: { width: 130, height: 130, borderRadius: 65, backgroundColor: t.CARD2, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 2, borderColor: t.BORDER, borderStyle: "dashed" as const },
  emptyRingText: { fontSize: 11, fontWeight: "600" as const, textAlign: "center" as const },
  emptyMacroState: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 4 },
  emptyStateText: { fontSize: 13, fontWeight: "500" as const, flex: 1 },
  logMealBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: "flex-start" as const },
  logMealBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
  viewAllMicrosBtn: { marginTop: 14, paddingVertical: 10, alignItems: "center" as const, borderRadius: 10, backgroundColor: t.CARD2 },
  viewAllMicrosText: { color: t.TEXT, fontSize: 13, fontWeight: "600" as const },

  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, marginBottom: 14 },

  horizMacroRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  horizMacroLabel: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED, width: 52 },
  horizMacroTrack: { flex: 1, height: 7, backgroundColor: t.BORDER, borderRadius: 4, overflow: "hidden" },
  horizMacroFill: { height: 7, borderRadius: 4 },
  horizMacroValue: { fontSize: 13, fontWeight: "700" as const, textAlign: "right", minWidth: 70 },
  horizMacroGoal: { fontSize: 11, color: t.MUTED, fontWeight: "400" as const },

  microsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: t.BORDER, marginTop: 4 },
  microsToggleText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },

  // Change 11: Vitamin/Mineral grid
  vitaminGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, paddingTop: 12, paddingBottom: 4 },
  vitaminCard: { width: "30%", flexGrow: 1, backgroundColor: t.CARD2, borderRadius: 12, padding: 10, borderWidth: 1, alignItems: "center", minWidth: 90 },
  vitaminDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  vitaminValue: { fontSize: 15, fontWeight: "700" as const },
  vitaminUnit: { fontSize: 9, color: t.MUTED, fontWeight: "400" as const, marginTop: -2 },
  vitaminLabel: { fontSize: 10, color: t.MUTED, marginTop: 3, fontWeight: "600" as const, textAlign: "center" as const },
  vitaminBarTrack: { width: "100%", height: 3, backgroundColor: t.BORDER, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  vitaminBarFill: { height: 3, borderRadius: 2 },

  // Water
  waterHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  waterLiters: { fontSize: 11, fontWeight: "600" as const, marginTop: 2 },
  waterCount: { fontSize: 13, fontWeight: "700" as const },

  dropletRow: { flexDirection: "row", gap: 4, marginBottom: 14, flexWrap: "wrap" as const },
  waterCtrlRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  waterBtns: { flexDirection: "row", gap: 8 },
  waterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  waterInsightRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  waterInsightText: { fontSize: 12, fontWeight: "600" as const },

  // Change 5: Meal tabs with status indicator
  mealTabsRow: { gap: 8, marginBottom: 10 },
  mealTab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 14, backgroundColor: t.CARD, gap: 5, borderWidth: 1, borderColor: t.BORDER, overflow: "hidden" as const },
  mealTabText: { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  mealCalBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  mealCalBadgeText: { fontSize: 10, fontWeight: "700" as const },
  mealTabIndicator: { position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 3 },

  mealSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  mealSectionTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
  mealHeaderBtns: { flexDirection: "row", gap: 8, alignItems: "center" },
  // Change 6: Larger scan button
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  scanBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  mealEmpty: { alignItems: "center", paddingVertical: 24, gap: 16 },
  mealEmptyText: { fontSize: 13, color: t.MUTED, textAlign: "center", fontWeight: "500" as const },
  mealEmptyBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" as const },
  emptyActionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  emptyActionBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" as const },

  foodRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8 },
  foodRowBody: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: "600" as const, color: t.TEXT, marginBottom: 3 },
  foodMeta: { fontSize: 11, color: t.MUTED },
  foodRowRight: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  foodCals: { fontSize: 16, fontWeight: "700" as const },
  foodCalsUnit: { fontSize: 10, color: t.MUTED },
  mealTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  mealTotalLabel: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const },
  mealTotalCals: { fontSize: 16, fontWeight: "800" as const },

  summaryCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.BORDER, marginBottom: 12 },
  summaryRow: { flexDirection: "row", marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const, marginTop: 2 },
  insightBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  insightText: { fontSize: 12, fontWeight: "600" as const, lineHeight: 17 },

  scanningOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  scanningBox: { borderRadius: 24, padding: 36, alignItems: "center", gap: 14, minWidth: 240, borderWidth: 1, borderColor: t.BORDER },
  scanningTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
  scanningSubText: { fontSize: 13, color: t.MUTED, textAlign: "center" },
});
