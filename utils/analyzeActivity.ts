import { getLocalDateString } from "@/utils/date";

const cache = new Map<string, ActivityAnalysis>();
let cacheDate = getLocalDateString();

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
  const today = getLocalDateString();
  if (today !== cacheDate) {
    cache.clear();
    cacheDate = today;
  }
  return `${sport.toLowerCase()}|${duration}|${intensity}|${today}`;
}

function getProxyBase(): string {
  if (process.env.EXPO_PUBLIC_DEV_PROXY_URL) {
    return process.env.EXPO_PUBLIC_DEV_PROXY_URL.replace(/\/$/, "");
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

  const prompt = `You are a professional sports nutritionist and fitness coach.
Activity: ${sport}
Duration: ${duration} minutes
Intensity: ${intensity}
User weight: ${weightKg} kg
User age: ${age} years

Calculate and return ONLY a valid JSON object with no markdown and no explanation:
{
  "calories_burned": <number>,
  "hydration_needed_ml": <number>,
  "hydration_glasses": <number>,
  "protein_needed_g": <number>,
  "carbs_needed_g": <number>,
  "recovery_time_hours": <number>,
  "heart_rate_zone": "fat burn" | "cardio" | "peak",
  "intensity_level": "light" | "moderate" | "intense",
  "health_benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "tips": ["tip 1", "tip 2"],
  "post_activity_meal": "suggested meal",
  "sport_category": "cardio" | "strength" | "flexibility" | "mind-body"
}`;

  let resultText = "";
  const proxyBase = getProxyBase();

  if (proxyBase) {
    try {
      const res = await fetch(`${proxyBase}/api/analyze-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, duration, intensity, weightKg, age }),
      });
      if (res.ok) {
        const data = await res.json();
        // Handle direct JSON, OpenAI choices shape, or Gemini candidates shape
        if (data.choices?.[0]?.message?.content) {
          resultText = data.choices[0].message.content;
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = data.candidates[0].content.parts[0].text;
        } else if (data.calories_burned !== undefined) {
          // Direct JSON object
          cache.set(key, data);
          return data;
        }
      }
    } catch (err) {
      console.warn("Proxy analysis failed, falling back to direct Gemini call:", err);
    }
  }

  if (!resultText) {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("AI Coach analysis is not configured. Please add your Gemini API key.");
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.2,
            responseMimeType: "application/json"
          },
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`Gemini direct error: ${response.status}`);
    }
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    resultText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
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
