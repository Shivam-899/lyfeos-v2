const cache = new Map<string, ActivityAnalysis>();
const CACHE_DATE_KEY = "@lyfeos_ai_cache_date_v1";
let cacheDate = new Date().toISOString().split("T")[0];

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
}

function cacheKey(sport: string, duration: number, intensity: string) {
  const today = new Date().toISOString().split("T")[0];
  if (today !== cacheDate) { cache.clear(); cacheDate = today; }
  return `${sport.toLowerCase()}|${duration}|${intensity}|${today}`;
}

function getProxyBase(): string {
  if (process.env.EXPO_PUBLIC_DEV_PROXY_URL) {
    return process.env.EXPO_PUBLIC_DEV_PROXY_URL;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export async function analyzeActivity(
  sport: string,
  duration: number,
  intensity: "light" | "moderate" | "intense",
  weightKg = 70,
  age = 25,
): Promise<ActivityAnalysis> {
  const key = cacheKey(sport, duration, intensity);
  if (cache.has(key)) return cache.get(key)!;

  const res = await fetch(`${getProxyBase()}/api/analyze-activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sport, duration, intensity, weightKg, age }),
  });

  if (!res.ok) throw new Error(`Activity analysis error: ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  const result: ActivityAnalysis = JSON.parse(jsonMatch[0]);
  cache.set(key, result);
  return result;
}

export function calculateSteps(steps: number, weightKg = 70, heightCm = 170) {
  const strideLengthM = (heightCm * 0.415) / 100;
  const distanceKm    = (steps * strideLengthM) / 1000;
  const caloriesBurned = Math.round(steps * 0.04 * (weightKg / 70));
  const activeMinutes  = Math.round(steps / 100);
  const goalPct        = Math.min(Math.round((steps / 10_000) * 100), 100);
  return { distanceKm: parseFloat(distanceKm.toFixed(2)), caloriesBurned, activeMinutes, goalPct };
}

// ── Weekly insight via server proxy ──────────────────────────────────────────
export async function generateWeeklyInsight(activitySummary: string): Promise<string> {
  const res = await fetch(`${getProxyBase()}/api/weekly-insight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activitySummary }),
  });

  if (!res.ok) throw new Error("Weekly insight error");
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
