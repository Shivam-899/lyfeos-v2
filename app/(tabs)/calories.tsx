import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { DailyGoal, MealType, useCalories } from "@/context/CaloriesContext";
import { useActivity } from "@/context/ActivityContext";
import { FoodAnalysisResult, analyzeFoodImage, analyzeFoodText } from "@/utils/analyzeFoodImage";
import { INDIAN_FOOD_QUICK_CHIPS } from "@/utils/indianFoodDatabase";
import { AppTheme, useAppTheme } from "@/hooks/useAppTheme";

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT = "#FF6B35";
const TEAL = "#14B8A6";
const INDIAN_SAFFRON = "#FF9933";

// ── Meals config ──────────────────────────────────────────────────────────────
const MEALS: { key: MealType; label: string; icon: string; emptyText: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline",      emptyText: "Start your day right — log your breakfast 🌅" },
  { key: "lunch",     label: "Lunch",     icon: "restaurant-outline", emptyText: "Lunchtime! What did you eat? 🥗" },
  { key: "dinner",    label: "Dinner",    icon: "moon-outline",       emptyText: "Dinner time — log your last meal 🍽️" },
  { key: "snacks",    label: "Snacks",    icon: "nutrition-outline",  emptyText: "Any snacks today? Log them here 🍎" },
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

// ── Goals Presets ─────────────────────────────────────────────────────────────
const GOAL_PRESETS: { label: string; desc: string; goal: DailyGoal }[] = [
  { label: "Weight Loss", desc: "1500 kcal · Balanced macros", goal: { calories: 1500, carbs: 150, protein: 130, fat: 50, water: 8 } },
  { label: "Maintenance", desc: "2000 kcal · Standard split",  goal: { calories: 2000, carbs: 250, protein: 150, fat: 65, water: 8 } },
  { label: "Muscle Gain", desc: "2500 kcal · High protein",    goal: { calories: 2500, carbs: 300, protein: 180, fat: 80, water: 9 } },
];

// ── Goals Setup Sheet ─────────────────────────────────────────────────────────
function GoalsSetupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);
  const { setDailyGoal } = useCalories();
  const [selected, setSelected] = useState(1);
  const [custom, setCustom] = useState({ calories: "2000", carbs: "250", protein: "150", fat: "65", water: "8" });

  const handleSave = () => {
    const g = GOAL_PRESETS[selected]?.goal ?? {
      calories: parseInt(custom.calories) || 2000,
      carbs: parseInt(custom.carbs) || 250,
      protein: parseInt(custom.protein) || 150,
      fat: parseInt(custom.fat) || 65,
      water: parseInt(custom.water) || 8,
    };
    setDailyGoal(g);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>Set Your Goals</Text>
              <Text style={s.sheetSub}>Choose a preset or customize your daily targets</Text>

              {GOAL_PRESETS.map((p, i) => (
                <TouchableOpacity key={i} style={[s.presetBtn, selected === i && { borderColor: ACCENT, backgroundColor: ACCENT + "15" }]} onPress={() => setSelected(i)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.presetLabel, selected === i && { color: ACCENT }]}>{p.label}</Text>
                    <Text style={s.presetDesc}>{p.desc}</Text>
                  </View>
                  {selected === i && <Ionicons name="checkmark-circle" size={22} color={ACCENT} />}
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={[s.saveGoalBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
                <Text style={s.saveGoalBtnText}>Save Goals</Text>
              </TouchableOpacity>
            </View>
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
  const { MUTED, GREEN, YELLOW, BLUE } = theme;
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
  const cal     = Math.round(result.calories * p);
  const carbs   = Math.round(result.carbs * p);
  const protein = Math.round(result.protein * p);
  const fat     = Math.round(result.fat * p);
  const fiber   = Math.round(result.fiber * p);
  const sugar   = Math.round(result.sugar * p);
  const sodium  = Math.round(result.sodium * p);

  const PORTIONS = [0.5, 1, 1.5, 2];
  const showIndianGuidance = isIndianFood(result);
  const isLocalDB = result.source === "local-db";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 20 }]}>
              <View style={s.handle} />
              <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={s.resultHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.resultDetected}>{isLocalDB ? "🇮🇳 Indian DB" : "AI Detected"}</Text>
                  </View>
                  <View style={[s.confidencePill, { backgroundColor: result.confidence === "high" ? GREEN + "22" : result.confidence === "medium" ? YELLOW + "22" : "#EF444422" }]}>
                    <Text style={[s.confidenceText, { color: result.confidence === "high" ? GREEN : result.confidence === "medium" ? YELLOW : "#EF4444" }]}>{result.confidence} confidence</Text>
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

                {/* Macros grid */}
                <View style={s.macroGrid}>
                  <MacroCell label="Calories" value={cal}     unit="kcal" color={ACCENT} big />
                  <MacroCell label="Carbs"    value={carbs}   unit="g"    color={BLUE} />
                  <MacroCell label="Protein"  value={protein} unit="g"    color={ACCENT} />
                  <MacroCell label="Fat"      value={fat}     unit="g"    color={YELLOW} />
                  <MacroCell label="Fiber"    value={fiber}   unit="g"    color={GREEN} />
                  <MacroCell label="Sugar"    value={sugar}   unit="g"    color="#EC4899" />
                  <MacroCell label="Sodium"   value={sodium}  unit="mg"   color={MUTED} />
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
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

function MacroCell({ label, value, unit, color, big }: { label: string; value: number; unit: string; color: string; big?: boolean }) {
  const theme = useAppTheme();
  const { MUTED } = theme;
  const s = makeS(theme);
  return (
    <View style={[s.macroCell, big && s.macroCellBig]}>
      <Text style={[s.macroCellValue, { color, fontSize: big ? 26 : 18 }]}>{value}<Text style={[s.macroCellUnit, { color: MUTED }]}> {unit}</Text></Text>
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
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
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Text Search Sheet (with Indian quick chips) ───────────────────────────────
function TextSearchSheet({
  visible,
  onClose,
  onResult,
}: {
  visible: boolean;
  onClose: () => void;
  onResult: (r: FoodAnalysisResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const s = makeS(theme);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!visible) setText("");
  }, [visible]);

  const handleSearch = async (query?: string) => {
    const q = (query ?? text).trim();
    if (!q) return;
    setLoading(true);
    try {
      const result = await analyzeFoodText(q);
      if (result.noFoodDetected) {
        Alert.alert(
          "No food found",
          "Couldn't estimate nutrition for that. Try being more specific, like '2 boiled eggs', 'ek plate dal chawal', or '1 samosa'."
        );
        return;
      }
      onClose();
      setTimeout(() => onResult(result), 250);
    } catch (err: any) {
      Alert.alert("Search failed", err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChipPress = (chip: typeof INDIAN_FOOD_QUICK_CHIPS[0]) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText(chip.query);
    handleSearch(chip.query);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ justifyContent: "flex-end" }}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[s.sheet, { backgroundColor: theme.CARD, paddingBottom: insets.bottom + 24 }]}>
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
                <Text style={s.addLogBtnText}>{loading ? "Analyzing..." : "Analyze with AI"}</Text>
              </TouchableOpacity>

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
                      onPress={() => handleChipPress(chip)}
                      disabled={loading}
                    >
                      <Text style={s.indianChipEmoji}>{chip.emoji}</Text>
                      <Text style={s.indianChipLabel}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CaloriesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { BG, CARD, CARD2, BORDER, MUTED, GREEN, BLUE, YELLOW, RED, TEXT } = theme;
  const styles = makeStyles(theme);
  const s = makeS(theme);
  const { foodItems, dailyGoal, goalsConfigured, getDayStats, getWaterForDate, logWater, addFoodItem, deleteFoodItem } = useCalories();
  const { postActivityBanner, setPostActivityBanner } = useActivity();

  const today = new Date().toISOString().split("T")[0];
  const stats = getDayStats(today);
  const water = getWaterForDate(today);

  const [activeMeal, setActiveMeal] = useState<MealType>(getDefaultMeal());
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FoodAnalysisResult | null>(null);
  const [showFoodResult, setShowFoodResult] = useState(false);
  const [showTextSearch, setShowTextSearch] = useState(false);
  const [showGoalsSetup, setShowGoalsSetup] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [microsExpanded, setMicrosExpanded] = useState(false);
  const microsAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const calPct = Math.min(stats.calories / dailyGoal.calories, 1);
  const remaining = Math.max(0, dailyGoal.calories - stats.calories);
  const ringCol = ringColor(calPct);
  const mealItems = stats.items.filter((i) => i.meal === activeMeal);
  const mealCals = (meal: MealType) => stats.items.filter((i) => i.meal === meal).reduce((s, i) => s + i.calories, 0);

  const getInsight = () => {
    const proteinNeeded = dailyGoal.protein - stats.protein;
    const fatDone = stats.fat >= dailyGoal.fat;
    if (stats.calories === 0) return "Start logging meals to track your progress 🍽️";
    if (proteinNeeded > 20) return `You're ${proteinNeeded}g short on protein today 💪`;
    if (fatDone && stats.fat < dailyGoal.fat * 1.1) return "Great job hitting your fat goal! 🥑";
    if (stats.calories >= dailyGoal.calories * 0.95) return "You've nearly hit your calorie goal today ✅";
    return `${remaining} kcal remaining — keep it up!`;
  };

  const toggleMicros = () => {
    const toValue = microsExpanded ? 0 : 1;
    Animated.timing(microsAnim, { toValue, duration: 250, useNativeDriver: false }).start();
    setMicrosExpanded(!microsExpanded);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  // Web fallback: convert URI to base64
  const uriToBase64 = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Photo scan with retry UI
  const pickAndAnalyze = async (source: "camera" | "gallery") => {
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") { Alert.alert("Camera needed", "Please allow camera access in your device settings to scan food photos."); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true, allowsEditing: true });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Photos needed", "Please allow photo library access to pick food images."); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: true, allowsEditing: true });
    }

    if (result.canceled || !result.assets?.[0]) return;

    let base64 = result.assets[0].base64 ?? null;
    if (!base64 && result.assets[0].uri) {
      try {
        base64 = await uriToBase64(result.assets[0].uri);
      } catch {
        Alert.alert("Scan failed", "Could not read the selected image. Please try again.");
        return;
      }
    }

    if (!base64) { Alert.alert("Scan failed", "No image data received. Please try again."); return; }
    setScanning(true);

    try {
      const analysis = await analyzeFoodImage(base64);
      if (analysis.noFoodDetected) {
        Alert.alert(
          "No food detected",
          "We couldn't identify any food in that photo. Try a clearer image or describe what you ate using the text search."
        );
        return;
      }
      setScanResult(analysis);
      setShowFoodResult(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg === "__SHOW_RETRY_UI__") {
        // Show 3-option retry UI
        Alert.alert(
          "Trouble identifying food",
          "We had trouble identifying this food automatically. What would you like to do?",
          [
            { text: "📷 Try Again",    onPress: () => setTimeout(() => handleScanPress(), 300) },
            { text: "✏️ Describe It",  onPress: () => setShowTextSearch(true) },
            { text: "📝 Add Manually", onPress: () => setShowManualEntry(true) },
          ]
        );
      } else {
        Alert.alert("Scan failed", msg || "Couldn't analyze the photo. Please try again.");
      }
    } finally {
      setScanning(false);
    }
  };

  const handleScanPress = () => {
    if (Platform.OS === "web") {
      pickAndAnalyze("gallery");
      return;
    }
    Alert.alert("Scan Food Photo", "Choose a source", [
      { text: "Camera",        onPress: () => pickAndAnalyze("camera") },
      { text: "Photo Library", onPress: () => pickAndAnalyze("gallery") },
      { text: "Cancel",        style: "cancel" },
    ]);
  };

  const handleAddToLog = (meal: MealType, result: FoodAnalysisResult, portion: number) => {
    addFoodItem({
      name: result.name,
      calories: Math.round(result.calories * portion),
      carbs:    Math.round(result.carbs * portion),
      protein:  Math.round(result.protein * portion),
      fat:      Math.round(result.fat * portion),
      fiber:    Math.round(result.fiber * portion),
      sugar:    Math.round(result.sugar * portion),
      sodium:   Math.round(result.sodium * portion),
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
      carbs:    result.carbs,
      protein:  result.protein,
      fat:      result.fat,
      fiber:    result.fiber,
      sugar:    result.sugar,
      sodium:   result.sodium,
      portionSize: result.servingDescription,
      meal,
      date: today,
    });
  };

  const microsHeight = microsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] });
  const totalMealsLogged = MEALS.filter((m) => mealCals(m.key) > 0).length;

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100, paddingTop: topPad + 8 }]}
        keyboardShouldPersistTaps="handled"
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
              {remaining === 0 ? "🎉 Goal reached today!" : `${remaining} kcal away from your goal`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateLabel}>{formatDate(today)}</Text>
            <TouchableOpacity onPress={() => setShowGoalsSetup(true)} style={styles.goalsBtn}>
              <Ionicons name="settings-outline" size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Goals setup card (new users) ─────────────────────────── */}
        {!goalsConfigured && (
          <TouchableOpacity style={styles.goalsSetupCard} onPress={() => setShowGoalsSetup(true)}>
            <View style={styles.goalsSetupLeft}>
              <Text style={styles.goalsSetupTitle}>Set your nutrition goals</Text>
              <Text style={styles.goalsSetupSub}>Personalize your daily calorie and macro targets</Text>
            </View>
            <View style={[styles.goalsSetupBtn, { backgroundColor: ACCENT }]}>
              <Text style={styles.goalsSetupBtnText}>Set Goals</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Calorie Ring Hero Card ────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: CARD }]}>
          <View style={styles.heroLeft}>
            <CircularProgress size={130} progress={calPct} color={ringCol} strokeWidth={11} backgroundColor="#FF6B3566">
              <View style={styles.ringInner}>
                <Text style={[styles.ringCals, { color: ringCol }]}>{stats.calories}</Text>
                <Text style={styles.ringUnit}>kcal</Text>
              </View>
            </CircularProgress>
            <Text style={styles.ringGoal}>of {dailyGoal.calories} kcal goal</Text>
          </View>
          <View style={styles.heroRight}>
            {[
              { label: "Eaten",     value: stats.calories, color: ACCENT,    icon: "flame-outline" },
              { label: "Remaining", value: remaining,       color: "#9CA3AF", icon: "arrow-down-circle-outline" },
            ].map(({ label, value, color, icon }) => {
              const goalMet = stats.calories >= dailyGoal.calories;
              const isRemainingCard = label === "Remaining";
              const cardBg = isRemainingCard
                ? (goalMet ? "#22C55E18" : "#2A2A2A")
                : (color + "18");
              const cardBorder = isRemainingCard
                ? (goalMet ? "#22C55E40" : "#333333")
                : (color + "40");
              const valueColor = isRemainingCard
                ? (goalMet ? "#22C55E" : "#FFFFFF")
                : color;
              const labelColor = isRemainingCard
                ? (goalMet ? "#22C55E" : "#9CA3AF")
                : MUTED;
              const iconColor = isRemainingCard
                ? (goalMet ? "#22C55E" : "#9CA3AF")
                : color;
              return (
                <View key={label} style={[styles.statPill, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Ionicons name={icon as any} size={14} color={iconColor} />
                  <View>
                    <Text style={[styles.statPillValue, { color: valueColor }]}>{value}</Text>
                    <Text style={[styles.statPillLabel, { color: labelColor }]}>{label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Macros Card ───────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: CARD }]}>
          <Text style={styles.cardTitle}>Macros</Text>
          <HorizMacroBar label="Carbs"   value={stats.carbs}   goal={dailyGoal.carbs}   color={BLUE} />
          <HorizMacroBar label="Protein" value={stats.protein} goal={dailyGoal.protein} color={ACCENT} />
          <HorizMacroBar label="Fat"     value={stats.fat}     goal={dailyGoal.fat}     color={YELLOW} />

          <TouchableOpacity style={styles.microsToggle} onPress={toggleMicros}>
            <Text style={styles.microsToggleText}>Vitamins & Minerals</Text>
            <Ionicons name={microsExpanded ? "chevron-up" : "chevron-down"} size={16} color={MUTED} />
          </TouchableOpacity>
          <Animated.View style={{ height: microsHeight, overflow: "hidden" }}>
            <View style={styles.microsGrid}>
              {[
                { label: "Fiber",  value: stats.fiber,  unit: "g",  goal: 28 },
                { label: "Sugar",  value: stats.sugar,  unit: "g",  goal: 50 },
                { label: "Sodium", value: stats.sodium, unit: "mg", goal: 2300 },
              ].map(({ label, value, unit, goal }) => {
                const pct = Math.min(value / goal, 1);
                const col = pct >= 1 ? GREEN : pct >= 0.5 ? YELLOW : MUTED;
                return (
                  <View key={label} style={[styles.microPill, { borderColor: col + "40" }]}>
                    <Text style={[styles.microPillValue, { color: col }]}>{value}<Text style={styles.microPillUnit}>{unit}</Text></Text>
                    <Text style={styles.microPillLabel}>{label}</Text>
                    <Text style={styles.microPillGoal}>/{goal}{unit}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>

        {/* ── Water Tracker ─────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.waterHeader}>
            <Text style={styles.cardTitle}>Water</Text>
            <Text style={styles.waterCount}>{water}/{dailyGoal.water} glasses</Text>
          </View>
          <View style={styles.dropletRow}>
            {Array.from({ length: dailyGoal.water }, (_, i) => (
              <TouchableOpacity key={i} onPress={() => { logWater(today, i < water ? -1 : 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name={i < water ? "water" : "water-outline"} size={28} color={i < water ? BLUE : BORDER} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.waterCtrlRow}>
            <Text style={styles.waterRemaining}>
              {water >= dailyGoal.water ? "🎉 Hydration goal met!" : `${dailyGoal.water - water} more glass${dailyGoal.water - water !== 1 ? "es" : ""} to go`}
            </Text>
            <View style={styles.waterBtns}>
              <TouchableOpacity style={[styles.waterBtn, { backgroundColor: BLUE + "22" }, water <= 0 && { opacity: 0.4 }]} disabled={water <= 0} onPress={() => { logWater(today, -1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="remove" size={18} color={BLUE} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.waterBtn, { backgroundColor: BLUE }]} onPress={() => { logWater(today, 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Meal Tabs ─────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mealTabsRow}>
          {MEALS.map((m) => {
            const cals = mealCals(m.key);
            const active = activeMeal === m.key;
            return (
              <TouchableOpacity key={m.key} style={[styles.mealTab, active && { backgroundColor: ACCENT }]} onPress={() => setActiveMeal(m.key)}>
                <Ionicons name={m.icon as any} size={14} color={active ? "#fff" : MUTED} />
                <Text style={[styles.mealTabText, active && { color: "#fff" }]}>{m.label}</Text>
                {cals > 0 && <View style={[styles.mealCalBadge, { backgroundColor: active ? "#ffffff33" : ACCENT + "22" }]}>
                  <Text style={[styles.mealCalBadgeText, { color: active ? "#fff" : ACCENT }]}>{cals}</Text>
                </View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Meal Section ──────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: CARD }]}>
          <View style={styles.mealSectionHeader}>
            <Text style={styles.mealSectionTitle}>{MEALS.find((m) => m.key === activeMeal)?.label}</Text>
            <View style={styles.mealHeaderBtns}>
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: TEAL }]} onPress={handleScanPress}>
                <Ionicons name="camera-outline" size={15} color="#fff" />
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: ACCENT + "22", borderColor: ACCENT + "44" }]} onPress={() => setShowTextSearch(true)}>
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
                <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: ACCENT }]} onPress={() => setShowTextSearch(true)}>
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
              <Text style={[styles.summaryValue, { color: "#F0F0F0" }]}>{totalMealsLogged}</Text>
              <Text style={styles.summaryLabel}>Meals logged</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: ACCENT }]}>{remaining}</Text>
              <Text style={styles.summaryLabel}>kcal remaining</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: BLUE }]}>{water}/{dailyGoal.water}</Text>
              <Text style={styles.summaryLabel}>Water glasses</Text>
            </View>
          </View>
          <View style={[styles.insightBanner, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
            <Ionicons name="bulb-outline" size={14} color={ACCENT} />
            <Text style={[styles.insightText, { color: ACCENT }]}>{getInsight()}</Text>
          </View>
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
      />
      <ManualEntrySheet
        visible={showManualEntry}
        defaultMeal={activeMeal}
        onClose={() => setShowManualEntry(false)}
        onSave={handleManualSave}
      />
      <GoalsSetupSheet visible={showGoalsSetup} onClose={() => setShowGoalsSetup(false)} />
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
  overlay:           { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:             { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, maxHeight: "92%" },
  handle:            { width: 40, height: 4, backgroundColor: t.BORDER, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle:        { fontSize: 21, fontWeight: "700" as const, color: t.TEXT, marginBottom: 6 },
  sheetSub:          { fontSize: 13, color: t.MUTED, marginBottom: 20 },
  presetBtn:         { flexDirection: "row", alignItems: "center", backgroundColor: t.CARD, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: t.BORDER },
  presetLabel:       { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 3 },
  presetDesc:        { fontSize: 12, color: t.MUTED },
  saveGoalBtn:       { paddingVertical: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveGoalBtnText:   { color: "#fff", fontSize: 16, fontWeight: "700" as const },

  // Food result sheet
  resultHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  resultDetected:    { fontSize: 12, color: t.MUTED, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  confidencePill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  confidenceText:    { fontSize: 11, fontWeight: "700" as const },
  resultNameInput:   { fontSize: 18, fontWeight: "700" as const, color: t.TEXT, borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: 6, marginBottom: 6 },
  resultServing:     { fontSize: 12, color: t.MUTED, marginBottom: 10 },
  fieldLabel:        { fontSize: 11, fontWeight: "700" as const, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 },

  // Local DB banner
  localDBBanner:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: TEAL + "18", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: TEAL + "30" },
  localDBBannerText: { fontSize: 11, fontWeight: "600" as const, flex: 1, lineHeight: 15 },

  // Indian tip banner
  indianTipBanner:   { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: INDIAN_SAFFRON + "15", borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: INDIAN_SAFFRON + "30" },
  indianTipIcon:     { fontSize: 16, marginTop: 1 },
  indianTipText:     { fontSize: 11, color: t.TEXT, flex: 1, lineHeight: 16, fontWeight: "500" as const },

  // Portion
  portionRow:        { flexDirection: "row", gap: 8, marginBottom: 12 },
  portionBtn:        { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  portionBtnText:    { fontSize: 14, fontWeight: "700" as const, color: t.MUTED },

  // Macros
  macroGrid:         { flexDirection: "row", flexWrap: "wrap" as const, gap: 8, marginBottom: 20 },
  macroCell:         { backgroundColor: t.CARD, borderRadius: 12, padding: 10, minWidth: "29%", flex: 1 },
  macroCellBig:      { width: "100%", flex: undefined, backgroundColor: "#FF6B3515", borderWidth: 1, borderColor: ACCENT + "30" },
  macroCellValue:    { fontWeight: "700" as const },
  macroCellUnit:     { fontSize: 11, fontWeight: "400" as const },
  macroCellLabel:    { fontSize: 11, color: t.MUTED, marginTop: 2 },

  // Meal selector
  mealSelectChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.CARD, borderWidth: 1, borderColor: t.BORDER },
  mealSelectChipText:{ fontSize: 13, fontWeight: "600" as const, color: t.MUTED },

  // Add log btn
  addLogBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, marginVertical: 16 },
  addLogBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" as const },

  // Result actions
  resultActions:     { flexDirection: "row", gap: 16, justifyContent: "center", paddingBottom: 8 },
  resultActionBtn:   { flexDirection: "row", alignItems: "center", gap: 4 },
  resultActionText:  { fontSize: 13, color: t.MUTED },

  // Text search
  searchInput:       { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: t.TEXT, marginBottom: 16, minHeight: 70, textAlignVertical: "top" as const },

  // Indian food chips
  indianChipsSection:{ marginTop: 4 },
  indianChipsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  indianChipsTitle:  { fontSize: 14, fontWeight: "700" as const, color: t.TEXT },
  indianChipsSub:    { fontSize: 11, color: t.MUTED },
  indianChipsRow:    { gap: 8, paddingBottom: 4 },
  indianChip:        { alignItems: "center", backgroundColor: INDIAN_SAFFRON + "18", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: INDIAN_SAFFRON + "30", minWidth: 80 },
  indianChipEmoji:   { fontSize: 20, marginBottom: 4 },
  indianChipLabel:   { fontSize: 10, fontWeight: "700" as const, color: t.TEXT, textAlign: "center" as const },

  // Manual entry
  manualInput:       { backgroundColor: t.CARD2, borderWidth: 1, borderColor: t.BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: t.TEXT, marginBottom: 16 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: 14 },

  activityBanner:        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#22C55E18", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#22C55E33", marginBottom: 10 },
  activityBannerTitle:   { fontSize: 13, fontWeight: "700" as const, color: t.TEXT, marginBottom: 2 },
  activityBannerSub:     { fontSize: 11, color: t.SUBTEXT },
  activityBannerBtn:     { backgroundColor: "#22C55E", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  activityBannerBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#fff" },

  headerRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  screenTitle:  { fontSize: 30, fontWeight: "800" as const, color: t.TEXT, letterSpacing: -0.5 },
  remainingLine:{ fontSize: 12, color: t.MUTED, marginTop: 3, fontWeight: "500" as const },
  headerRight:  { alignItems: "flex-end", gap: 6 },
  dateLabel:    { fontSize: 13, color: t.MUTED, fontWeight: "600" as const },
  goalsBtn:     { padding: 6 },

  goalsSetupCard:    { backgroundColor: ACCENT + "18", borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: ACCENT + "40" },
  goalsSetupLeft:    { flex: 1 },
  goalsSetupTitle:   { fontSize: 15, fontWeight: "700" as const, color: t.TEXT, marginBottom: 3 },
  goalsSetupSub:     { fontSize: 12, color: t.MUTED },
  goalsSetupBtn:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  goalsSetupBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" as const },

  heroCard:   { borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.BORDER },
  heroLeft:   { flex: 1, alignItems: "center" },
  ringInner:  { alignItems: "center" },
  ringCals:   { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.5 },
  ringUnit:   { fontSize: 11, color: t.MUTED, fontWeight: "500" as const },
  ringGoal:   { fontSize: 11, color: t.MUTED, marginTop: 8 },
  heroRight:  { gap: 10 },
  statPill:   { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 10, borderWidth: 1, minWidth: 110 },
  statPillValue: { fontSize: 17, fontWeight: "800" as const, letterSpacing: -0.5 },
  statPillLabel: { fontSize: 10, color: t.MUTED, fontWeight: "600" as const },

  card:      { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: t.BORDER },
  cardTitle: { fontSize: 16, fontWeight: "700" as const, color: t.TEXT, marginBottom: 14 },

  horizMacroRow:   { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  horizMacroLabel: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED, width: 52 },
  horizMacroTrack: { flex: 1, height: 7, backgroundColor: t.BORDER, borderRadius: 4, overflow: "hidden" },
  horizMacroFill:  { height: 7, borderRadius: 4 },
  horizMacroValue: { fontSize: 13, fontWeight: "700" as const, textAlign: "right", minWidth: 70 },
  horizMacroGoal:  { fontSize: 11, color: t.MUTED, fontWeight: "400" as const },

  microsToggle:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: t.BORDER, marginTop: 4 },
  microsToggleText: { fontSize: 13, fontWeight: "600" as const, color: t.MUTED },
  microsGrid:       { flexDirection: "row", gap: 8, paddingTop: 12 },
  microPill:        { flex: 1, backgroundColor: t.CARD2, borderRadius: 12, padding: 10, borderWidth: 1, alignItems: "center" },
  microPillValue:   { fontSize: 15, fontWeight: "700" as const },
  microPillUnit:    { fontSize: 10, fontWeight: "400" as const },
  microPillLabel:   { fontSize: 10, color: t.MUTED, marginTop: 2, fontWeight: "600" as const },
  microPillGoal:    { fontSize: 9, color: t.MUTED, marginTop: 1 },

  waterHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  waterCount:     { fontSize: 13, color: t.BLUE, fontWeight: "700" as const },
  dropletRow:     { flexDirection: "row", gap: 4, marginBottom: 14, flexWrap: "wrap" as const },
  waterCtrlRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waterRemaining: { fontSize: 12, color: t.MUTED, flex: 1, fontWeight: "500" as const },
  waterBtns:      { flexDirection: "row", gap: 8 },
  waterBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  mealTabsRow:      { gap: 8, marginBottom: 10 },
  mealTab:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: t.CARD, gap: 5, borderWidth: 1, borderColor: t.BORDER },
  mealTabText:      { fontSize: 12, fontWeight: "600" as const, color: t.MUTED },
  mealCalBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  mealCalBadgeText: { fontSize: 10, fontWeight: "700" as const },

  mealSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  mealSectionTitle:  { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
  mealHeaderBtns:    { flexDirection: "row", gap: 8, alignItems: "center" },
  scanBtn:           { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  scanBtnText:       { color: "#fff", fontSize: 12, fontWeight: "700" as const },
  iconBtn:           { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  mealEmpty:         { alignItems: "center", paddingVertical: 24, gap: 16 },
  mealEmptyText:     { fontSize: 13, color: t.MUTED, textAlign: "center", fontWeight: "500" as const },
  mealEmptyBtns:     { flexDirection: "row", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" as const },
  emptyActionBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  emptyActionBtnText:{ color: "#fff", fontSize: 12, fontWeight: "700" as const },

  foodRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8 },
  foodRowBody: { flex: 1 },
  foodName:    { fontSize: 14, fontWeight: "600" as const, color: t.TEXT, marginBottom: 3 },
  foodMeta:    { fontSize: 11, color: t.MUTED },
  foodRowRight:{ flexDirection: "row", alignItems: "baseline", gap: 2 },
  foodCals:    { fontSize: 16, fontWeight: "700" as const },
  foodCalsUnit:{ fontSize: 10, color: t.MUTED },
  mealTotal:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  mealTotalLabel: { fontSize: 13, color: t.MUTED, fontWeight: "600" as const },
  mealTotalCals:  { fontSize: 16, fontWeight: "800" as const },

  summaryCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.BORDER },
  summaryRow:  { flexDirection: "row", marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue:{ fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.5 },
  summaryLabel:{ fontSize: 10, color: t.MUTED, fontWeight: "600" as const, marginTop: 2 },
  insightBanner:{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  insightText: { flex: 1, fontSize: 12, fontWeight: "600" as const, lineHeight: 17 },

  scanningOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", zIndex: 100 },
  scanningBox:     { borderRadius: 24, padding: 36, alignItems: "center", gap: 14, minWidth: 240, borderWidth: 1, borderColor: t.BORDER },
  scanningTitle:   { fontSize: 16, fontWeight: "700" as const, color: t.TEXT },
  scanningSubText: { fontSize: 13, color: t.MUTED, textAlign: "center" },
});
