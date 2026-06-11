import { getLocalDateString } from "@/utils/date";

// ─────────────────────────────────────────────────────────────────────────────
// ActivityAnalysis interface — MUST stay identical to original (used by ActivityTracker.tsx)
// ─────────────────────────────────────────────────────────────────────────────
export interface ActivityAnalysis {
  calories_burned: number;
  hydration_needed_ml: number;
  hydration_glasses: number;
  protein_needed_g: number;
  carbs_needed_g: number;
  recovery_time_hours: number;
  heart_rate_zone: string;
  intensity_level: string;
  health_benefits: string[];
  tips: string[];
  post_activity_meal: string;
  sport_category: string;
  summary?: string; // NEW: AI-style summary sentence
}

// ─────────────────────────────────────────────────────────────────────────────
// MET Database — Scientific MET values (ACSM / Compendium of Physical Activities)
// MET ranges per intensity: [light, moderate, intense]
// ─────────────────────────────────────────────────────────────────────────────
interface ActivityMeta {
  met: [number, number, number]; // [light, moderate, intense]
  heartRateZone: [string, string, string];
  sportCategory: string;
  healthBenefits: string[];
  tips: string[];
  postActivityMeal: string;
}

const ACTIVITY_DATABASE: Record<string, ActivityMeta> = {
  // ── Cardio ──────────────────────────────────────────────────────────────────
  "Running": {
    met: [6.0, 9.8, 13.5],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Strengthens cardiovascular system", "Burns high calories", "Improves VO2 max", "Boosts mood via endorphins"],
    tips: ["Warm up for 5 min with brisk walking", "Land midfoot to reduce impact", "Stay hydrated every 15 min", "Cool down and stretch calves"],
    postActivityMeal: "Banana with peanut butter, or a protein smoothie with oats and berries",
  },
  "Walking": {
    met: [2.8, 3.8, 5.0],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Low-impact joint-friendly exercise", "Improves mental clarity", "Boosts metabolism", "Reduces blood pressure"],
    tips: ["Maintain an upright posture", "Swing your arms naturally", "Aim for 10,000 steps daily", "Walk on varied terrain for extra benefits"],
    postActivityMeal: "A light snack like an apple with almond butter or a handful of mixed nuts",
  },
  "Cycling": {
    met: [5.0, 8.0, 12.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Excellent low-impact cardio", "Strengthens quads and glutes", "Improves cardiovascular endurance", "Great for joint health"],
    tips: ["Adjust saddle height to avoid knee strain", "Wear a helmet always", "Stay hydrated frequently", "Use a cadence of 80–100 RPM"],
    postActivityMeal: "Whole grain wrap with grilled chicken and vegetables, or Greek yogurt with granola",
  },
  "Swimming": {
    met: [5.0, 8.3, 11.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Full-body workout", "Zero impact on joints", "Improves lung capacity", "Excellent core strengthener"],
    tips: ["Focus on technique over speed", "Use a kickboard for leg drills", "Breathe rhythmically", "Flip turns save significant time"],
    postActivityMeal: "Grilled salmon with sweet potato and steamed vegetables",
  },
  "Hiking": {
    met: [4.5, 6.5, 8.5],
    heartRateZone: ["fat burn", "cardio", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Strengthens legs and core", "Mental health boost from nature", "Burns significant calories", "Improves balance and coordination"],
    tips: ["Wear proper hiking boots", "Pack water and snacks", "Tell someone your route", "Use trekking poles for steep terrain"],
    postActivityMeal: "Trail mix with nuts and dried fruit during, followed by a protein-rich meal after",
  },
  // ── Sports ──────────────────────────────────────────────────────────────────
  "Badminton": {
    met: [4.5, 6.0, 7.5],
    heartRateZone: ["fat burn", "cardio", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Improves reflexes and hand-eye coordination", "Great calorie burner", "Strengthens arms and shoulders", "Boosts agility"],
    tips: ["Stay on your toes for quick movement", "Use your wrist for smashes, not your whole arm", "Stay hydrated between games", "Warm up rotator cuff before play"],
    postActivityMeal: "Rice or roti with dal and vegetables, or a protein shake with banana",
  },
  "Tennis": {
    met: [5.0, 7.3, 10.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Full body workout", "Improves reaction time", "Strengthens core and legs", "Social sport benefits"],
    tips: ["Follow through on every shot", "Watch the ball until contact", "Bend your knees on groundstrokes", "Rest between intense sets"],
    postActivityMeal: "Pasta with lean protein and olive oil, or a recovery shake within 30 minutes",
  },
  "Football": {
    met: [6.0, 8.5, 11.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Explosive speed and strength development", "Excellent team coordination", "High calorie burn", "Improves cardiovascular fitness"],
    tips: ["Dribble with your head up", "Pass and move constantly", "Work on both feet", "Build stamina with interval running"],
    postActivityMeal: "Chicken rice bowl with vegetables and a glass of chocolate milk for recovery",
  },
  "Basketball": {
    met: [5.0, 7.5, 9.5],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Develops explosive power", "Improves coordination", "High-intensity intervals", "Strengthens core and legs"],
    tips: ["Box out on every rebound", "Keep your eyes up while dribbling", "Practice free throws consistently", "Communicate on defense"],
    postActivityMeal: "Grilled chicken with brown rice and steamed greens, or a protein bar",
  },
  "Cricket": {
    met: [4.0, 5.5, 7.0],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Develops focus and precision", "Builds upper body strength", "Improves hand-eye coordination", "Social fitness"],
    tips: ["Warm up shoulders before bowling/batting", "Stay focused between overs", "Stay hydrated in the field", "Stretch hamstrings after running between wickets"],
    postActivityMeal: "Dal and rice or chapati with sabzi, and a glass of lassi or coconut water",
  },
  "Volleyball": {
    met: [3.5, 5.5, 7.5],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Upper body and core strength", "Improves jumping power", "Team coordination", "Great cardiovascular workout"],
    tips: ["Communicate with teammates on every ball", "Keep platform arms firm for bumps", "Follow through on spikes", "Work on vertical jump for blocking"],
    postActivityMeal: "Protein shake with banana, or rice with eggs and vegetables",
  },
  "Boxing": {
    met: [6.0, 9.0, 12.5],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Exceptional calorie burn", "Core and upper body strength", "Improves coordination and reflexes", "Stress relief"],
    tips: ["Keep your guard up always", "Breathe out on every punch", "Move your feet constantly", "Wrap hands before using bag"],
    postActivityMeal: "Protein-rich meal: eggs, chicken, or legumes with complex carbs",
  },
  "Table Tennis": {
    met: [3.5, 5.0, 6.5],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Sharpens reflexes", "Improves mental agility", "Low impact on joints", "Hand-eye coordination"],
    tips: ["Stay light on your feet", "Watch opponent's racket angle", "Practice topspin consistently", "Keep rallies going to improve stamina"],
    postActivityMeal: "Light meal with complex carbs and protein — rice, dal, or a wrap",
  },
  "Rugby": {
    met: [6.5, 9.5, 13.0],
    heartRateZone: ["cardio", "peak", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Full-body strength and power", "Explosive speed development", "Team coordination", "High intensity intervals"],
    tips: ["Tackle technique is crucial for safety", "Keep low in contact situations", "Build explosive leg strength", "Warm up thoroughly before play"],
    postActivityMeal: "High-protein meal within 45 min: steak, eggs, or cottage cheese with carbs",
  },
  "Rock Climbing": {
    met: [5.0, 7.5, 10.5],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "strength",
    healthBenefits: ["Exceptional grip and forearm strength", "Full body workout", "Mental problem solving", "Core stability"],
    tips: ["Trust your feet, not just your arms", "Keep hips close to the wall", "Rest on straight arms", "Breathe steadily on difficult moves"],
    postActivityMeal: "Protein shake with banana, or yogurt parfait with granola and fruit",
  },
  "Golf": {
    met: [3.0, 4.3, 5.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Low impact walking exercise", "Improves mental focus", "Fresh air and nature", "Core rotation strength"],
    tips: ["Keep your head down through impact", "Walk the course instead of using a cart", "Stay relaxed in your grip", "Hydrate throughout the round"],
    postActivityMeal: "Light lunch with salad and lean protein, or a fruit and nut snack",
  },
  "Gymnastics": {
    met: [3.5, 5.5, 8.0],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "flexibility",
    healthBenefits: ["Exceptional body control", "Flexibility and balance", "Core and upper body strength", "Spatial awareness"],
    tips: ["Always train with a spotter for new skills", "Work on flexibility daily", "Build strength progressively", "Rest adequately between intense sessions"],
    postActivityMeal: "Balanced meal with protein and carbs: eggs with toast or yogurt with fruit",
  },
  "Martial Arts": {
    met: [5.0, 8.0, 11.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "strength",
    healthBenefits: ["Discipline and focus", "Self-defense skills", "Full body conditioning", "Stress management"],
    tips: ["Focus on technique before power", "Breathe in rhythm with movements", "Protect yourself at all times", "Stretch thoroughly after training"],
    postActivityMeal: "Protein and carb recovery meal: rice with chicken or legumes",
  },
  "Skiing": {
    met: [5.0, 7.0, 9.0],
    heartRateZone: ["fat burn", "cardio", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Strengthens legs and core", "Balance and coordination", "Full body cardiovascular workout", "Mental concentration"],
    tips: ["Keep weight forward over skis", "Look ahead not at your skis", "Use poles for rhythm", "Layer clothing for temperature changes"],
    postActivityMeal: "Hot soup with bread, or a high-carb meal to restore glycogen",
  },
  // ── Wellness ────────────────────────────────────────────────────────────────
  "Yoga": {
    met: [2.0, 3.0, 4.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "flexibility",
    healthBenefits: ["Reduces stress and anxiety", "Improves flexibility and posture", "Strengthens core muscles", "Better sleep quality"],
    tips: ["Never force a pose — honor your body", "Breathe into every stretch", "Consistency matters more than intensity", "Try yoga nidra for deep recovery"],
    postActivityMeal: "Light meal: fresh fruit, nuts, or smoothie. Avoid heavy meals immediately after",
  },
  "Meditation": {
    met: [1.3, 1.5, 1.8],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "mind-body",
    healthBenefits: ["Reduces cortisol levels", "Improves mental clarity and focus", "Lowers blood pressure", "Enhances emotional resilience"],
    tips: ["Start with just 5 minutes if new", "Focus on breath, not thoughts", "Use guided apps if needed", "Practice at the same time each day"],
    postActivityMeal: "Herbal tea with a light snack. Avoid caffeine post-meditation for best effect",
  },
  "Stretching": {
    met: [2.0, 2.8, 3.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "flexibility",
    healthBenefits: ["Prevents injury and muscle soreness", "Improves range of motion", "Releases muscle tension", "Better posture"],
    tips: ["Hold each stretch 20–30 seconds", "Never bounce in a stretch", "Breathe deeply throughout", "Stretch daily for cumulative benefits"],
    postActivityMeal: "Hydrate well. A small snack with anti-inflammatory foods like berries or turmeric",
  },
  "Breathing Exercises": {
    met: [1.3, 1.5, 2.0],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "mind-body",
    healthBenefits: ["Reduces anxiety and stress", "Activates parasympathetic system", "Improves lung capacity", "Lowers heart rate"],
    tips: ["Try box breathing: 4 in, 4 hold, 4 out, 4 hold", "Practice in a quiet environment", "Do 5–10 minutes daily", "Use as a pre-sleep ritual"],
    postActivityMeal: "Herbal tea like chamomile or peppermint. Light, easily digestible foods",
  },
  "Rest Day": {
    met: [1.0, 1.0, 1.2],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "mind-body",
    healthBenefits: ["Allows muscle repair and growth", "Prevents overtraining syndrome", "Restores energy stores", "Mental recovery"],
    tips: ["Light walking or gentle yoga is fine", "Focus on sleep quality", "Stay hydrated", "Prepare healthy meals for the week ahead"],
    postActivityMeal: "Balanced whole food meal with lean protein and plenty of vegetables",
  },
  "Ice Bath": {
    met: [1.5, 2.0, 2.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "mind-body",
    healthBenefits: ["Reduces muscle inflammation", "Speeds recovery", "Improves circulation", "Mental toughness"],
    tips: ["Start with cool water, build to cold gradually", "Limit to 10–15 minutes", "Never ice bath alone", "Warm up slowly afterward"],
    postActivityMeal: "Warm herbal tea and a nourishing high-protein meal to restore warmth",
  },
  // ── Lifestyle ───────────────────────────────────────────────────────────────
  "Steps": {
    met: [2.5, 3.5, 4.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Improves cardiovascular health", "Easy daily movement habit", "Burns calories throughout day", "Reduces sedentary time"],
    tips: ["Take the stairs when possible", "Park farther from your destination", "Walk during phone calls", "Use a step tracker to stay motivated"],
    postActivityMeal: "Regular balanced meals throughout the day. Stay hydrated",
  },
  "Dog Walking": {
    met: [2.5, 3.5, 4.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Regular daily movement", "Mental health and stress relief", "Social interaction", "Vitamin D from outdoor time"],
    tips: ["Use the time to practice mindfulness", "Extend walks gradually", "Let the dog set an energetic pace", "Make it social — meet other dog owners"],
    postActivityMeal: "Light balanced meal. Stay hydrated especially in warm weather",
  },
  "Household Chores": {
    met: [2.5, 3.5, 4.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Burns calories while being productive", "Incidental movement throughout day", "Reduces sedentary behavior", "Improves environment"],
    tips: ["Put on energetic music to increase pace", "Do squats while cleaning low areas", "Carry laundry for extra resistance", "Take stairs multiple times"],
    postActivityMeal: "Regular balanced meal. Stay hydrated throughout housework",
  },
  "Shopping": {
    met: [2.0, 2.8, 3.5],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Incidental walking and movement", "Reduces sedentary time", "Light physical activity", "Mental stimulation"],
    tips: ["Walk the entire store before buying", "Carry baskets instead of using a cart", "Park farther away", "Take multiple trips to the car with bags"],
    postActivityMeal: "A healthy meal from your shopping — lean protein with fresh vegetables",
  },
  "Cleaning": {
    met: [3.0, 4.0, 5.0],
    heartRateZone: ["fat burn", "fat burn", "fat burn"],
    sportCategory: "cardio",
    healthBenefits: ["Active movement throughout the day", "Light muscle engagement", "Burns incidental calories", "Mental satisfaction"],
    tips: ["Mop and scrub at a brisk pace for more benefit", "Work systematically to keep moving", "Use it as active recovery between workouts", "Squat to clean low surfaces"],
    postActivityMeal: "Light balanced meal with hydration. Fruit or a protein snack works well",
  },
  "Gardening": {
    met: [3.0, 4.5, 6.0],
    heartRateZone: ["fat burn", "fat burn", "cardio"],
    sportCategory: "cardio",
    healthBenefits: ["Functional strength from digging and lifting", "Stress relief and mental wellness", "Vitamin D from sunlight", "Sense of purpose and achievement"],
    tips: ["Wear sunscreen and a hat outdoors", "Use ergonomic tools to protect joints", "Stretch after extended kneeling", "Stay hydrated especially in heat"],
    postActivityMeal: "Fresh produce from the garden if possible! Light and nutritious meal with vegetables",
  },
  "Other Sport": {
    met: [5.0, 7.5, 10.0],
    heartRateZone: ["fat burn", "cardio", "peak"],
    sportCategory: "cardio",
    healthBenefits: ["Physical activity and fitness", "Skill development", "Social engagement", "Mental and physical wellbeing"],
    tips: ["Warm up before activity", "Stay hydrated throughout", "Cool down and stretch after", "Listen to your body and rest when needed"],
    postActivityMeal: "Balanced recovery meal with protein and carbohydrates within 45 minutes",
  },
};

// Fallback for any activity not in database
const DEFAULT_META: ActivityMeta = {
  met: [4.0, 6.0, 9.0],
  heartRateZone: ["fat burn", "cardio", "peak"],
  sportCategory: "cardio",
  healthBenefits: ["Burns calories and improves fitness", "Cardiovascular health benefits", "Mental wellbeing", "Builds physical strength"],
  tips: ["Warm up before starting", "Stay hydrated", "Listen to your body", "Cool down and stretch after"],
  postActivityMeal: "Balanced meal with protein and complex carbohydrates within 45 minutes of activity",
};

// ─────────────────────────────────────────────────────────────────────────────
// Local MET-based calculation engine
// ─────────────────────────────────────────────────────────────────────────────

const INTENSITY_INDEX = { light: 0, moderate: 1, intense: 2 } as const;

/** Quick synchronous calorie estimate — used for the live preview card */
export function estimateCalories(
  sport: string,
  durationMin: number,
  intensity: "light" | "moderate" | "intense",
  weightKg = 70,
): number {
  const meta = ACTIVITY_DATABASE[sport] ?? DEFAULT_META;
  const met = meta.met[INTENSITY_INDEX[intensity]];
  return Math.round(met * weightKg * (durationMin / 60));
}

/** Generates an AI-style summary sentence */
function buildSummary(sport: string, durationMin: number, intensity: string, calories: number): string {
  const intWord = intensity === "intense" ? "intense" : intensity === "moderate" ? "moderate" : "light";
  const templates = [
    `Great session! You burned approximately ${calories} kcal during your ${durationMin} minute ${intWord} ${sport.toLowerCase()}.`,
    `Excellent work! Your ${durationMin} minute ${intWord} ${sport.toLowerCase()} session burned around ${calories} kcal.`,
    `Well done! A ${durationMin} min ${intWord} ${sport.toLowerCase()} session torches roughly ${calories} kcal — keep it up!`,
  ];
  // Pick template based on calories to vary output
  return templates[Math.floor(calories / 50) % templates.length];
}

/** Main analysis function — keeps async signature for drop-in compatibility */
export async function analyzeActivity(
  sport: string,
  duration: number,
  intensity: "light" | "moderate" | "intense",
  weightKg = 70,
  age = 25,
): Promise<ActivityAnalysis> {
  // Premium AI feel: brief delay (300–1200ms random)
  const delay = 300 + Math.random() * 900;
  await new Promise<void>((resolve) => setTimeout(resolve, delay));

  const meta = ACTIVITY_DATABASE[sport] ?? DEFAULT_META;
  const idx = INTENSITY_INDEX[intensity];
  const met = meta.met[idx];
  const durationHours = duration / 60;

  const calories_burned = Math.round(met * weightKg * durationHours);

  // Hydration: scales with intensity and duration
  const mlPerMin = intensity === "intense" ? 12 : intensity === "moderate" ? 8 : 5;
  const hydration_needed_ml = Math.round(duration * mlPerMin);
  const hydration_glasses = parseFloat((hydration_needed_ml / 240).toFixed(1));

  // Protein: scales with intensity and weight
  const proteinMultiplier = intensity === "intense" ? 0.28 : intensity === "moderate" ? 0.22 : 0.15;
  const protein_needed_g = Math.round(weightKg * proteinMultiplier);

  // Carbs: replenish ~12% of calories burned as carbs
  const carbs_needed_g = Math.round(calories_burned * 0.12);

  // Recovery time
  const recovery_time_hours = intensity === "intense" ? 48 : intensity === "moderate" ? 24 : 12;

  const heart_rate_zone = meta.heartRateZone[idx];
  const intensity_level = intensity;
  const sport_category = meta.sportCategory;

  return {
    calories_burned,
    hydration_needed_ml,
    hydration_glasses,
    protein_needed_g,
    carbs_needed_g,
    recovery_time_hours,
    heart_rate_zone,
    intensity_level,
    health_benefits: meta.healthBenefits,
    tips: meta.tips,
    post_activity_meal: meta.postActivityMeal,
    sport_category,
    summary: buildSummary(sport, duration, intensity, calories_burned),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateSteps — UNCHANGED from original
// ─────────────────────────────────────────────────────────────────────────────
export function calculateSteps(steps: number, weightKg = 70, heightCm = 170) {
  const strideLengthM = (heightCm * 0.415) / 100;
  const distanceKm    = (steps * strideLengthM) / 1000;
  const caloriesBurned = Math.round(steps * 0.04 * (weightKg / 70));
  const activeMinutes  = Math.round(steps / 100);
  const goalPct        = Math.min(Math.round((steps / 10_000) * 100), 100);
  return { distanceKm: parseFloat(distanceKm.toFixed(2)), caloriesBurned, activeMinutes, goalPct };
}
