import { searchIndianFoodDB } from "./indianFoodDatabase";
import { FoodAnalysisResult } from "./analyzeFoodImage";

// Cache for query results
const searchCache = new Map<string, FoodAnalysisResult>();

// In-flight promises to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<FoodAnalysisResult>>();

/**
 * Parses a numeric value from a USDA nutrient object and standardizes it to the expected unit.
 */
function parseUsdNutrientValue(
  nutrients: any[],
  regex: RegExp,
  ids: number[],
  scale: number
): number | undefined {
  let match = nutrients.find((n) => ids.includes(n.nutrientId));
  if (!match) {
    match = nutrients.find((n) => regex.test(n.nutrientName));
  }
  if (match && match.value !== undefined && match.value !== null) {
    const val = Number(match.value);
    if (!isNaN(val)) {
      const valuePer100g = val;
      let calculated = valuePer100g * scale;

      // Handle unit conversions to match target units:
      // Target units:
      // Calories: kcal, Protein/Carbs/Fat/Fiber/Sugar: g, Sodium/Potassium/Calcium/Iron/Magnesium/Zinc/Vit C: mg
      // Vit A/Vit D/Vit B12: mcg
      const unit = (match.unitName || "").toLowerCase();
      if (regex.source.includes("vitamin a") || regex.source.includes("vitamin d")) {
        // Convert IU to mcg: Vitamin A (1 IU = 0.3 mcg RAE), Vitamin D (1 IU = 0.025 mcg)
        if (unit.includes("iu") || unit.includes("u")) {
          const conversionFactor = regex.source.includes("vitamin a") ? 0.3 : 0.025;
          calculated = calculated * conversionFactor;
        }
      }

      return calculated;
    }
  }
  return undefined;
}

/**
 * Searches the USDA FoodData Central API for a query and parses the result.
 */
async function searchUSDA(query: string, apiKey: string): Promise<FoodAnalysisResult | null> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    apiKey
  )}&query=${encodeURIComponent(query)}&pageSize=1`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.warn(`[NutritionSearch] USDA search returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.foods || data.foods.length === 0) {
      return null;
    }

    const food = data.foods[0];
    const nutrients = food.foodNutrients || [];

    // Parse serving size: default to 100g if not specified
    const servingSize = Number(food.servingSize) || 100;
    const servingUnit = food.servingSizeUnit || "g";
    const scale = servingSize / 100;

    const result: FoodAnalysisResult = {
      name: food.description || query,
      servingDescription: `${servingSize} ${servingUnit}`,
      calories: Math.round(
        parseUsdNutrientValue(nutrients, /energy/i, [1008, 1062, 2047, 2048], scale) ?? 0
      ),
      carbs: Math.round(
        parseUsdNutrientValue(nutrients, /carbohydrate/i, [1005], scale) ?? 0
      ),
      protein: Math.round(
        parseUsdNutrientValue(nutrients, /protein/i, [1003], scale) ?? 0
      ),
      fat: Math.round(
        parseUsdNutrientValue(nutrients, /total lipid|fat/i, [1004], scale) ?? 0
      ),
      fiber: Math.round(
        parseUsdNutrientValue(nutrients, /fiber|fibre/i, [1079], scale) ?? 0
      ),
      sugar: Math.round(
        parseUsdNutrientValue(nutrients, /sugars, total/i, [2000], scale) ?? 0
      ),
      sodium: Math.round(
        parseUsdNutrientValue(nutrients, /sodium/i, [1093], scale) ?? 0
      ),
      confidence: "high",
      noFoodDetected: false,
      cuisineType: "International",
      source: "usda", // Display as USDA Database in UI

      // Micro-nutrients
      potassium: parseUsdNutrientValue(nutrients, /potassium/i, [1092], scale),
      calcium: parseUsdNutrientValue(nutrients, /calcium/i, [1087], scale),
      iron: parseUsdNutrientValue(nutrients, /iron/i, [1089], scale),
      magnesium: parseUsdNutrientValue(nutrients, /magnesium/i, [1090], scale),
      zinc: parseUsdNutrientValue(nutrients, /zinc/i, [1095], scale),
      vitaminA: parseUsdNutrientValue(nutrients, /vitamin a/i, [1104, 1106], scale),
      vitaminC: parseUsdNutrientValue(nutrients, /vitamin c|ascorbic/i, [1162], scale),
      vitaminD: parseUsdNutrientValue(nutrients, /vitamin d/i, [1110, 1114], scale),
      vitaminB12: parseUsdNutrientValue(nutrients, /vitamin b-12|vitamin b12|cobalamin/i, [1178], scale),
    };

    return result;
  } catch (error) {
    console.error("[NutritionSearch] USDA search failed:", error);
    return null;
  }
}

/**
 * Parses a numeric value from an Open Food Facts nutriment object and standardizes units.
 */
function parseOffNutrientValue(
  nutriments: any,
  key: string,
  scale: number,
  multiplier: number = 1
): number | undefined {
  const val = nutriments[`${key}_100g`] ?? nutriments[key];
  if (val !== undefined && val !== null) {
    const num = Number(val);
    if (!isNaN(num)) {
      return num * scale * multiplier;
    }
  }
  return undefined;
}

/**
 * Searches the Open Food Facts API for a query and parses the result.
 */
async function searchOpenFoodFacts(query: string): Promise<FoodAnalysisResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/search?q=${encodeURIComponent(
    query
  )}&page_size=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LyfeOS - Android - 1.0.0 - contact@lyfeos.com",
      },
    });

    if (!response.ok) {
      console.warn(`[NutritionSearch] Open Food Facts returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.products || data.products.length === 0) {
      return null;
    }

    const product = data.products[0];
    const nutriments = product.nutriments || {};

    // Parse serving size: default to 100g if not specified
    const servingQuantity = Number(product.serving_quantity) || 100;
    const servingUnit = "g";
    const scale = servingQuantity / 100;

    const result: FoodAnalysisResult = {
      name: product.product_name || product.product_name_en || query,
      servingDescription: product.serving_size || `${servingQuantity} ${servingUnit}`,
      calories: Math.round(
        parseOffNutrientValue(nutriments, "energy-kcal", scale) ?? 0
      ),
      carbs: Math.round(
        parseOffNutrientValue(nutriments, "carbohydrates", scale) ?? 0
      ),
      protein: Math.round(
        parseOffNutrientValue(nutriments, "proteins", scale) ?? 0
      ),
      fat: Math.round(
        parseOffNutrientValue(nutriments, "fat", scale) ?? 0
      ),
      fiber: Math.round(
        parseOffNutrientValue(nutriments, "fiber", scale) ?? 0
      ),
      sugar: Math.round(
        parseOffNutrientValue(nutriments, "sugars", scale) ?? 0
      ),
      sodium: Math.round(
        parseOffNutrientValue(nutriments, "sodium", scale, 1000) ?? 0
      ),
      confidence: "medium",
      noFoodDetected: false,
      cuisineType: "International",
      source: "open-food-facts", // Display as Open Food Facts in UI

      // Micro-nutrients
      potassium: parseOffNutrientValue(nutriments, "potassium", scale, 1000),
      calcium: parseOffNutrientValue(nutriments, "calcium", scale, 1000),
      iron: parseOffNutrientValue(nutriments, "iron", scale, 1000),
      magnesium: parseOffNutrientValue(nutriments, "magnesium", scale, 1000),
      zinc: parseOffNutrientValue(nutriments, "zinc", scale, 1000),
      // OFF stores vitamins in grams per 100g standardly
      vitaminA: parseOffNutrientValue(nutriments, "vitamin-a", scale, 1000000),
      vitaminC: parseOffNutrientValue(nutriments, "vitamin-c", scale, 1000),
      vitaminD: parseOffNutrientValue(nutriments, "vitamin-d", scale, 1000000),
      vitaminB12: parseOffNutrientValue(nutriments, "vitamin-b12", scale, 1000000),
    };

    return result;
  } catch (error) {
    console.error("[NutritionSearch] Open Food Facts search failed:", error);
    return null;
  }
}

/**
 * Main database-driven nutrition lookup function.
 * 1. Checks local Indian Food Database.
 * 2. Checks local query cache.
 * 3. Searches USDA FoodData Central.
 * 4. Searches Open Food Facts (fallback).
 */
export async function performNutritionSearch(query: string): Promise<FoodAnalysisResult> {
  const normalizedQuery = query.trim().toLowerCase();

  // 1. Check local Indian food database first
  const localResult = searchIndianFoodDB(query);
  if (localResult) {
    console.log("[NutritionSearch] Local Indian DB hit for:", query);
    return localResult;
  }

  // 2. Check query cache
  if (searchCache.has(normalizedQuery)) {
    console.log("[NutritionSearch] Cache hit for:", query);
    return searchCache.get(normalizedQuery)!;
  }

  // 3. Prevent duplicate concurrent requests
  if (pendingRequests.has(normalizedQuery)) {
    console.log("[NutritionSearch] Deduplicated request for:", query);
    return pendingRequests.get(normalizedQuery)!;
  }

  const searchPromise = (async () => {
    const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || process.env.USDA_API_KEY || "";
    
    // Primary Source: USDA FoodData Central (only if API Key is configured)
    if (apiKey) {
      const usdaResult = await searchUSDA(query, apiKey);
      if (usdaResult) {
        searchCache.set(normalizedQuery, usdaResult);
        return usdaResult;
      }
    } else {
      console.warn("[NutritionSearch] USDA API key not set. Skipping to Open Food Facts.");
    }

    // Secondary Source: Open Food Facts
    const offResult = await searchOpenFoodFacts(query);
    if (offResult) {
      searchCache.set(normalizedQuery, offResult);
      return offResult;
    }

    // If both failed or returned no results, throw/return empty result
    return {
      name: query,
      servingDescription: "1 serving",
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      confidence: "low" as const,
      noFoodDetected: true,
    };
  })();

  pendingRequests.set(normalizedQuery, searchPromise);

  try {
    const result = await searchPromise;
    return result;
  } finally {
    pendingRequests.delete(normalizedQuery);
  }
}
