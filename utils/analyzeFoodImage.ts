/**
 * Food image and text analysis via Gemini API — Indian food optimized.
 *
 * Architecture:
 *  Text queries  → Check local Indian food DB first → Gemini if no match
 *  Photo queries → Gemini with Indian-optimized prompt → auto-retry on failure
 *
 *  API routing:
 *  1. If EXPO_PUBLIC_DEV_PROXY_URL or EXPO_PUBLIC_DOMAIN is set → proxy (production)
 *  2. Otherwise → direct Gemini call using EXPO_PUBLIC_GEMINI_API_KEY (local dev)
 */

import { searchIndianFoodDB } from "./indianFoodDatabase";

// ── Extended result interface ─────────────────────────────────────────────────

export interface FoodAnalysisResult {
  name: string;
  servingDescription: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  confidence: "high" | "medium" | "low";
  noFoodDetected?: boolean;
  /** "Indian" | "International" | "Mixed" — set by Gemini or local DB */
  cuisineType?: string;
  /** Extra nutritional notes from AI or local DB */
  dishNotes?: string;
  /** "local-db" when result came from the offline Indian food database */
  source?: "local-db" | "gemini";
}

// ── Prompts (Indian food optimized, per spec) ─────────────────────────────────

const FOOD_IMAGE_PROMPT = `You are an expert nutritionist specializing in Indian cuisine with deep knowledge of all regional Indian foods, street foods, home-cooked meals, and international dishes. You understand food descriptions in English, Hindi, and Hinglish. Analyze the food in this image very carefully. Even if the image quality is not perfect, make your best estimate based on what you can see. Indian dishes often look different from Western food — a plate of dal chawal, a thali, curry dishes, roti with sabzi, biryani, street food like samosa or chaat are all valid foods you must recognize and analyze.

Return ONLY a valid JSON object with no markdown, no code blocks, no backticks, and no extra text. Use exactly this structure:
{"foods":["food item names in English"],"serving_description":"string describing what you see like one plate of dal chawal with one katori dal and one cup rice","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"sugar_g":0,"sodium_mg":0,"cholesterol_mg":0,"vitamins":{"vitamin_a_iu":0,"vitamin_c_mg":0,"vitamin_d_iu":0,"vitamin_b12_mcg":0,"iron_mg":0,"calcium_mg":0,"potassium_mg":0,"magnesium_mg":0},"confidence":"high","cuisine_type":"Indian","dish_notes":"any important nutritional notes about this specific dish","noFoodDetected":false}

For Indian dishes use standard Indian portion sizes — one katori is 150ml, one medium roti is 40g, one plate rice serving is 200g cooked. If you see a full thali estimate each component separately then add totals. Never return an error for Indian food — always make your best estimate even if confidence is low. If you cannot see any food at all, set noFoodDetected to true and all numbers to 0.`;

const FOOD_IMAGE_RETRY_PROMPT = `Look very carefully at this food image. Even if it is blurry or unclear make your absolute best estimate of what food is shown and its nutritional content. Do not return an error. This could be Indian food like dal, roti, sabzi, biryani, samosa, curry, rice dishes, or any other food.

Return ONLY a valid JSON object using exactly this structure with your best estimates:
{"foods":["food name"],"serving_description":"your best description","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"sugar_g":0,"sodium_mg":0,"cholesterol_mg":0,"vitamins":{"vitamin_a_iu":0,"vitamin_c_mg":0,"vitamin_d_iu":0,"vitamin_b12_mcg":0,"iron_mg":0,"calcium_mg":0,"potassium_mg":0,"magnesium_mg":0},"confidence":"low","cuisine_type":"Indian","dish_notes":"estimated from partial image","noFoodDetected":false}`;

function buildTextPrompt(description: string): string {
  return `You are an expert nutritionist specializing in Indian cuisine with complete knowledge of all Indian foods, regional dishes, street foods, and international cuisines. The user will describe food in English, Hindi, or Hinglish. Understand Indian food terminology: ek plate means one plate, katori means small bowl approximately 150ml, glass means approximately 250ml, roti means one Indian flatbread approximately 40g, paratha means one Indian flatbread approximately 80g, chawal or rice means cooked rice, dal means lentil soup, sabzi means vegetable dish, curry means gravy dish. Convert all Hindi or Hinglish food descriptions to their English equivalents and calculate accurate nutrition.

Common Indian foods you must know: Dal Chawal one plate is approximately 450 calories, 2 Roti with Sabzi is approximately 320 calories, Chicken Biryani one plate is approximately 550 calories, Paneer Butter Masala one katori is approximately 280 calories, Samosa one piece is approximately 130 calories, Idli one piece is approximately 40 calories, Dosa one plain is approximately 120 calories, Paratha one with butter is approximately 200 calories, Rajma Chawal one plate is approximately 480 calories.

Food query: "${description}"

Return ONLY a valid JSON object with no markdown, no code blocks, and no extra text using exactly this structure:
{"foods":["food names in English"],"serving_description":"standard portion description","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"sugar_g":0,"sodium_mg":0,"cholesterol_mg":0,"vitamins":{"vitamin_a_iu":0,"vitamin_c_mg":0,"vitamin_d_iu":0,"vitamin_b12_mcg":0,"iron_mg":0,"calcium_mg":0,"potassium_mg":0,"magnesium_mg":0},"confidence":"high","cuisine_type":"Indian","dish_notes":"any nutritional notes","noFoodDetected":false}

Always return nutrition data — never say you cannot analyze an Indian food. If noFoodDetected must be true, set all numbers to 0.`;
}

// ── Response parsing ──────────────────────────────────────────────────────────

function parseResult(rawContent: string): FoodAnalysisResult {
  // Strip markdown fences
  let cleaned = rawContent
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Extract first JSON object if there's surrounding text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  let r: Record<string, unknown>;
  try {
    r = JSON.parse(cleaned);
  } catch {
    console.error("[FoodScan] JSON parse failed. Raw:", rawContent.slice(0, 300));
    throw new Error(
      "We had trouble analyzing this food. Please try again with a clearer photo."
    );
  }

  if (r.noFoodDetected === true) {
    return {
      name: "", servingDescription: "",
      calories: 0, carbs: 0, protein: 0, fat: 0,
      fiber: 0, sugar: 0, sodium: 0,
      confidence: "low", noFoodDetected: true,
    };
  }

  // Handle both old flat format and new Indian-food nested format
  const foodsArr = Array.isArray(r.foods) ? r.foods as string[] : [];
  const name = foodsArr.length > 0
    ? foodsArr.join(", ")
    : String(r.name ?? "Unknown food");

  return {
    name,
    servingDescription: String(r.serving_description ?? r.servingDescription ?? "1 serving"),
    calories: Math.max(0, Math.round(Number(r.calories) || 0)),
    carbs:    Math.max(0, Math.round(Number(r.carbs_g ?? r.carbs)   || 0)),
    protein:  Math.max(0, Math.round(Number(r.protein_g ?? r.protein) || 0)),
    fat:      Math.max(0, Math.round(Number(r.fat_g ?? r.fat)       || 0)),
    fiber:    Math.max(0, Math.round(Number(r.fiber_g ?? r.fiber)   || 0)),
    sugar:    Math.max(0, Math.round(Number(r.sugar_g ?? r.sugar)   || 0)),
    sodium:   Math.max(0, Math.round(Number(r.sodium_mg ?? r.sodium) || 0)),
    confidence: (["high", "medium", "low"].includes(r.confidence as string)
      ? r.confidence : "medium") as "high" | "medium" | "low",
    noFoodDetected: false,
    cuisineType: typeof r.cuisine_type === "string" ? r.cuisine_type : undefined,
    dishNotes: typeof r.dish_notes === "string" && r.dish_notes ? r.dish_notes : undefined,
    source: "gemini",
  };
}

// ── API routing helpers ───────────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

function getProxyBase(): string {
  if (process.env.EXPO_PUBLIC_DEV_PROXY_URL) {
    return process.env.EXPO_PUBLIC_DEV_PROXY_URL.replace(/\/$/, "");
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

function getDirectApiKey(): string {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
}

function isFriendlyAuthError(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

const GEMINI_MODEL = "gemini-2.5-flash";

/** Direct Gemini API call (local dev, no proxy) */
async function callGeminiDirect(parts: GeminiPart[]): Promise<string> {
  const apiKey = getDirectApiKey();
  if (!apiKey) {
    throw new Error(
      "Food scanning is not configured. Please contact support or add your Gemini API key."
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
        }),
      }
    );
  } catch (networkErr) {
    console.error("[FoodScan] Network error:", networkErr);
    throw new Error(
      "Could not connect to the AI service. Please check your internet connection and try again."
    );
  }

  if (!response.ok) {
    const status = response.status;
    const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
    console.error(`[FoodScan] Gemini direct ${status}:`, errBody);
    if (isFriendlyAuthError(status)) {
      throw new Error(
        "Food scanning is not working. This is usually caused by an invalid or missing API key. Please check your Gemini API key or contact support."
      );
    }
    if (status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    throw new Error(errBody.error?.message ?? "AI analysis failed. Please try again.");
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const textParts = data.candidates?.[0]?.content?.parts ?? [];
  return textParts.filter((p) => typeof p.text === "string").map((p) => p.text as string).join("");
}

/** Call Gemini via server proxy, falling back to direct on failure */
async function callGeminiProxy(parts: GeminiPart[]): Promise<string> {
  const proxyBase = getProxyBase();
  if (!proxyBase) {
    console.log("[FoodScan] No proxy configured — using direct Gemini call.");
    return callGeminiDirect(parts);
  }

  let response: Response;
  try {
    response = await fetch(`${proxyBase}/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        payload: {
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
        },
      }),
    });
  } catch {
    const directKey = getDirectApiKey();
    if (directKey) {
      console.warn("[FoodScan] Proxy unreachable — falling back to direct API.");
      return callGeminiDirect(parts);
    }
    throw new Error("Could not connect to the AI service. Please check your internet connection and try again.");
  }

  if (!response.ok) {
    const status = response.status;
    const errBody = (await response.json().catch(() => ({}))) as { error?: string };
    console.error(`[FoodScan] Proxy error ${status}:`, errBody);
    const directKey = getDirectApiKey();
    if ((status === 503 || isFriendlyAuthError(status)) && directKey) {
      console.warn("[FoodScan] Proxy error — falling back to direct API.");
      return callGeminiDirect(parts);
    }
    if (status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    throw new Error(errBody.error ?? "AI analysis failed. Please try again.");
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const textParts = data.candidates?.[0]?.content?.parts ?? [];
  return textParts.filter((p) => typeof p.text === "string").map((p) => p.text as string).join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze a food photo.
 * Tries primary Indian-optimized prompt first, then auto-retries with
 * a fallback prompt on empty or low-confidence results.
 *
 * Throws on hard failure so caller can show the 3-option retry UI.
 */
export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysisResult> {
  const imagePart: GeminiPart = {
    inline_data: { mime_type: "image/jpeg", data: base64Image },
  };

  // ── Attempt 1: primary Indian-food prompt ─────────────────────────────────
  let content: string;
  try {
    content = await callGeminiProxy([{ text: FOOD_IMAGE_PROMPT }, imagePart]);
  } catch (err) {
    // Hard network/auth error — rethrow immediately
    throw err;
  }

  if (content && content.trim()) {
    try {
      const result = parseResult(content);
      // If high/medium confidence, return immediately
      if (!result.noFoodDetected && result.confidence !== "low" && result.calories > 0) {
        return result;
      }
      // Low confidence or zero calories → fall through to retry
    } catch {
      // Parse failed → fall through to retry
    }
  }

  // ── Attempt 2: retry with fallback prompt ─────────────────────────────────
  console.log("[FoodScan] Low confidence or parse failure — retrying with fallback prompt.");
  let retryContent: string;
  try {
    retryContent = await callGeminiProxy([{ text: FOOD_IMAGE_RETRY_PROMPT }, imagePart]);
  } catch {
    // Retry network error — throw a user-friendly error so caller shows 3-option UI
    throw new Error("__SHOW_RETRY_UI__");
  }

  if (!retryContent || !retryContent.trim()) {
    throw new Error("__SHOW_RETRY_UI__");
  }

  try {
    return parseResult(retryContent);
  } catch {
    throw new Error("__SHOW_RETRY_UI__");
  }
}

/**
 * Analyze food from a text description.
 * 1. Checks local Indian food database first (instant, offline)
 * 2. Falls back to Gemini API if no local match
 */
export async function analyzeFoodText(description: string): Promise<FoodAnalysisResult> {
  // ── Step 1: Local Indian food database lookup ─────────────────────────────
  const localResult = searchIndianFoodDB(description);
  if (localResult) {
    console.log("[FoodScan] Local DB hit for:", description);
    return localResult;
  }

  // ── Step 2: Gemini API call ───────────────────────────────────────────────
  const parts: GeminiPart[] = [{ text: buildTextPrompt(description) }];
  const content = await callGeminiProxy(parts);

  if (!content || !content.trim()) {
    throw new Error(
      "We had trouble analyzing this food. Please try again with a different description."
    );
  }

  return parseResult(content);
}
