/**
 * Food analysis utility - Database-driven lookup (USDA + Open Food Facts)
 * Replaces old Gemini-based AI analysis.
 */

import { performNutritionSearch } from "./nutritionSearch";

// ── Extended result interface ─────────────────────────────────────────────────

export interface FoodAnalysisResult {
  name: string;
  servingDescription: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  confidence: "high" | "medium" | "low";
  noFoodDetected?: boolean;
  /** "Indian" | "International" | "Mixed" */
  cuisineType?: string;
  /** Extra nutritional notes */
  dishNotes?: string;
  /** "local-db" when result came from local DB or USDA/OFF databases */
  source?: "local-db" | "gemini" | "usda" | "open-food-facts";

  // Micro-nutrients
  potassium?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stubbed photo scan food analysis.
 * Image scanning is disabled/stubbed per specification.
 */
export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysisResult> {
  throw new Error("Food Scan is coming soon.");
}

/**
 * Text description nutrition analysis.
 * Performs database-driven lookup from USDA and Open Food Facts.
 */
export async function analyzeFoodText(description: string): Promise<FoodAnalysisResult> {
  return performNutritionSearch(description);
}
