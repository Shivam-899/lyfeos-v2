/**
 * Local Indian Food Database
 * Instant offline nutrition lookup for 50 common Indian foods.
 * Searched BEFORE making any Gemini API call for text queries.
 *
 * Supports spelling variants:
 *   dal / daal / dhal, roti / chapati / chapatti, chawal / rice / bhaat,
 *   paratha / parantha, chole / chhole / chana, etc.
 */

import { FoodAnalysisResult } from "./analyzeFoodImage";

// ── Database entries ──────────────────────────────────────────────────────────

interface IndianFoodEntry {
  /** Canonical English name shown to user */
  name: string;
  /** All name variants + common misspellings (lowercase) */
  aliases: string[];
  /** Standard portion shown to user */
  servingDescription: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cuisineType: "Indian";
  dishNotes: string;
}

const INDIAN_FOOD_DB: IndianFoodEntry[] = [
  {
    name: "Dal Chawal",
    aliases: ["dal chawal", "daal chawal", "dhal chawal", "dal rice", "daal rice", "dhal rice",
              "dal chaawal", "dal-chawal", "dal + rice", "rice and dal", "dal aur chawal",
              "rice dal", "chawal dal", "dal"],
    servingDescription: "1 plate (1 katori dal ~150ml + 1 cup cooked rice ~200g)",
    calories: 450, protein: 15, carbs: 82, fat: 6, fiber: 8, sugar: 3, sodium: 380,
    cuisineType: "Indian",
    dishNotes: "Classic Indian comfort meal. 1 katori ≈ 150ml. Adjust portion if your serving was larger.",
  },
  {
    name: "Roti (Chapati)",
    aliases: ["roti", "chapati", "chapatti", "chappati", "phulka", "ek roti", "1 roti",
              "plain roti", "whole wheat roti", "gehu ki roti"],
    servingDescription: "1 medium roti (~40g)",
    calories: 100, protein: 3, carbs: 18, fat: 2, fiber: 2, sugar: 0, sodium: 90,
    cuisineType: "Indian",
    dishNotes: "One medium roti ≈ 40g. A typical meal has 2–3 rotis.",
  },
  {
    name: "Paratha",
    aliases: ["paratha", "parantha", "parauntha", "plain paratha", "tawa paratha"],
    servingDescription: "1 paratha with butter (~80g)",
    calories: 200, protein: 4, carbs: 28, fat: 8, fiber: 2, sugar: 0, sodium: 180,
    cuisineType: "Indian",
    dishNotes: "Plain paratha with light butter. Stuffed versions (aloo, paneer) have higher calories.",
  },
  {
    name: "Aloo Paratha",
    aliases: ["aloo paratha", "alu paratha", "potato paratha", "aloo parantha", "stuffed paratha"],
    servingDescription: "1 aloo paratha with butter (~120g)",
    calories: 260, protein: 6, carbs: 38, fat: 10, fiber: 3, sugar: 1, sodium: 220,
    cuisineType: "Indian",
    dishNotes: "Potato-stuffed flatbread. Commonly served with curd and pickle.",
  },
  {
    name: "Chicken Biryani",
    aliases: ["chicken biryani", "biryani", "murgh biryani", "chicken briyani",
              "hyderabadi biryani", "dum biryani", "chicken dum biryani"],
    servingDescription: "1 plate (~350g, 1.5 cups rice + chicken pieces)",
    calories: 550, protein: 32, carbs: 68, fat: 14, fiber: 2, sugar: 2, sodium: 620,
    cuisineType: "Indian",
    dishNotes: "One plate biryani typically has 1.5 cups cooked rice + 100–120g chicken.",
  },
  {
    name: "Rajma Chawal",
    aliases: ["rajma chawal", "rajma rice", "red kidney beans rice", "rajma dal chawal",
              "rajma", "rajma curry with rice"],
    servingDescription: "1 plate (1 katori rajma + 1 cup rice)",
    calories: 480, protein: 18, carbs: 88, fat: 5, fiber: 10, sugar: 3, sodium: 420,
    cuisineType: "Indian",
    dishNotes: "High-fiber, high-protein North Indian staple. Great for muscle building.",
  },
  {
    name: "Paneer Butter Masala",
    aliases: ["paneer butter masala", "paneer makhani", "butter paneer", "paneer makhanwala",
              "paneer masala", "shahi paneer"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 280, protein: 14, carbs: 12, fat: 20, fiber: 2, sugar: 4, sodium: 380,
    cuisineType: "Indian",
    dishNotes: "Rich, creamy paneer dish. Best paired with 2 rotis or 1 cup rice.",
  },
  {
    name: "Palak Paneer",
    aliases: ["palak paneer", "spinach paneer", "palak ki sabzi with paneer", "saag paneer"],
    servingDescription: "1 katori (~150ml)",
    calories: 240, protein: 12, carbs: 10, fat: 18, fiber: 3, sugar: 2, sodium: 320,
    cuisineType: "Indian",
    dishNotes: "Iron-rich dish. Spinach provides iron, folate, and vitamin K.",
  },
  {
    name: "Butter Chicken",
    aliases: ["butter chicken", "murgh makhani", "chicken makhani", "chicken makhanwala",
              "chicken in butter sauce"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 290, protein: 24, carbs: 10, fat: 18, fiber: 1, sugar: 5, sodium: 450,
    cuisineType: "Indian",
    dishNotes: "Mild, creamy tomato-based chicken curry. High in protein.",
  },
  {
    name: "Samosa",
    aliases: ["samosa", "samose", "fried samosa", "aloo samosa", "potato samosa", "samosa 1", "ek samosa"],
    servingDescription: "1 piece (~100g)",
    calories: 130, protein: 3, carbs: 18, fat: 6, fiber: 2, sugar: 1, sodium: 200,
    cuisineType: "Indian",
    dishNotes: "Deep-fried pastry with spiced potato filling. One piece ≈ 130 kcal.",
  },
  {
    name: "Idli",
    aliases: ["idli", "idly", "rice idli", "steam idli", "plain idli", "ek idli", "1 idli"],
    servingDescription: "1 piece (~60g)",
    calories: 40, protein: 2, carbs: 8, fat: 0, fiber: 0, sugar: 0, sodium: 80,
    cuisineType: "Indian",
    dishNotes: "Steamed rice cake. Very light — a typical serving is 3–4 idlis.",
  },
  {
    name: "Plain Dosa",
    aliases: ["dosa", "plain dosa", "sada dosa", "rice dosa", "ek dosa", "1 dosa", "crispy dosa"],
    servingDescription: "1 plain dosa (~80g)",
    calories: 120, protein: 3, carbs: 22, fat: 2, fiber: 1, sugar: 0, sodium: 160,
    cuisineType: "Indian",
    dishNotes: "Crispy fermented rice crepe. Masala dosa has ~180 kcal with filling.",
  },
  {
    name: "Masala Dosa",
    aliases: ["masala dosa", "masala dose", "stuffed dosa", "aloo dosa"],
    servingDescription: "1 masala dosa with potato filling (~180g)",
    calories: 180, protein: 5, carbs: 32, fat: 5, fiber: 2, sugar: 1, sodium: 220,
    cuisineType: "Indian",
    dishNotes: "Crispy dosa filled with spiced potato. Often served with sambar and chutney.",
  },
  {
    name: "Poha",
    aliases: ["poha", "aloo poha", "batata poha", "kanda poha", "flattened rice", "beaten rice", "pohe"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 250, protein: 5, carbs: 48, fat: 4, fiber: 2, sugar: 2, sodium: 250,
    cuisineType: "Indian",
    dishNotes: "Light breakfast dish made from flattened rice. Low in fat, moderate carbs.",
  },
  {
    name: "Upma",
    aliases: ["upma", "upuma", "semolina upma", "rava upma", "sooji upma"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 220, protein: 6, carbs: 38, fat: 5, fiber: 2, sugar: 2, sodium: 300,
    cuisineType: "Indian",
    dishNotes: "Savory semolina porridge. Light and filling South Indian breakfast.",
  },
  {
    name: "Chole (Chana Masala)",
    aliases: ["chole", "chhole", "chana masala", "chole masala", "chickpea curry",
              "kabuli chana", "white chana", "chana"],
    servingDescription: "1 katori (~150ml)",
    calories: 180, protein: 10, carbs: 28, fat: 4, fiber: 7, sugar: 2, sodium: 360,
    cuisineType: "Indian",
    dishNotes: "High in plant protein and fiber. Excellent for weight management.",
  },
  {
    name: "Chole Bhature",
    aliases: ["chole bhature", "chhole bhature", "chole bhatoore", "bhature chole",
              "chole with bhature"],
    servingDescription: "1 serving (1 katori chole + 2 bhature)",
    calories: 480, protein: 14, carbs: 68, fat: 18, fiber: 7, sugar: 3, sodium: 580,
    cuisineType: "Indian",
    dishNotes: "Popular Punjabi dish. Bhature are deep-fried and high in calories.",
  },
  {
    name: "Kadhi Chawal",
    aliases: ["kadhi chawal", "kadhi rice", "dahi kadhi rice", "kadhi pakora rice",
              "kadhi with rice", "punjabi kadhi"],
    servingDescription: "1 plate (1 katori kadhi + 1 cup rice)",
    calories: 380, protein: 10, carbs: 72, fat: 6, fiber: 2, sugar: 4, sodium: 400,
    cuisineType: "Indian",
    dishNotes: "Tangy yogurt-based curry with rice. A complete North Indian meal.",
  },
  {
    name: "Pulao",
    aliases: ["pulao", "pilaf", "veg pulao", "vegetable pulao", "matar pulao", "peas pulao"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 320, protein: 6, carbs: 62, fat: 5, fiber: 2, sugar: 1, sodium: 350,
    cuisineType: "Indian",
    dishNotes: "Mildly spiced rice dish. Lower calorie than biryani.",
  },
  {
    name: "Khichdi",
    aliases: ["khichdi", "khichri", "khichadi", "dal khichdi", "rice khichdi", "moong khichdi"],
    servingDescription: "1 plate (~250g cooked)",
    calories: 280, protein: 10, carbs: 52, fat: 4, fiber: 4, sugar: 1, sodium: 280,
    cuisineType: "Indian",
    dishNotes: "Easy-to-digest one-pot meal of rice and lentils. High in nutrients.",
  },
  {
    name: "Egg Bhurji",
    aliases: ["egg bhurji", "anda bhurji", "scrambled eggs indian", "masala eggs",
              "masala scrambled eggs", "2 egg bhurji", "do ande ka bhurji"],
    servingDescription: "2 eggs scrambled (~120g)",
    calories: 180, protein: 14, carbs: 4, fat: 12, fiber: 1, sugar: 1, sodium: 280,
    cuisineType: "Indian",
    dishNotes: "Spiced scrambled eggs. Excellent high-protein breakfast option.",
  },
  {
    name: "Puri",
    aliases: ["puri", "poori", "fried puri", "plain puri", "ek puri", "1 puri"],
    servingDescription: "1 piece (~50g)",
    calories: 80, protein: 2, carbs: 12, fat: 3, fiber: 1, sugar: 0, sodium: 80,
    cuisineType: "Indian",
    dishNotes: "Deep-fried bread. Often served with bhaji or chole.",
  },
  {
    name: "Halwa",
    aliases: ["halwa", "sooji halwa", "rava halwa", "gajar halwa", "carrot halwa",
              "suji ka halwa", "semolina halwa"],
    servingDescription: "1 katori (~150g)",
    calories: 320, protein: 4, carbs: 48, fat: 14, fiber: 1, sugar: 22, sodium: 80,
    cuisineType: "Indian",
    dishNotes: "Sweet dish high in sugar and ghee. Best enjoyed in small portions.",
  },
  {
    name: "Uttapam",
    aliases: ["uttapam", "utthappam", "uthappam", "rice uttapam", "vegetable uttapam"],
    servingDescription: "1 piece (~120g)",
    calories: 150, protein: 4, carbs: 26, fat: 3, fiber: 1, sugar: 2, sodium: 200,
    cuisineType: "Indian",
    dishNotes: "Thick rice pancake with vegetable toppings. Healthier than dosa.",
  },
  {
    name: "Mutton Curry",
    aliases: ["mutton curry", "gosht", "mutton masala", "lamb curry", "keema",
              "mutton gravy", "gosht curry"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 320, protein: 28, carbs: 8, fat: 20, fiber: 1, sugar: 2, sodium: 480,
    cuisineType: "Indian",
    dishNotes: "High-protein red meat curry. Good source of iron and zinc.",
  },
  {
    name: "Fish Curry",
    aliases: ["fish curry", "machli curry", "machi curry", "fish gravy", "fish masala",
              "machhi ka salan"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 240, protein: 26, carbs: 6, fat: 14, fiber: 1, sugar: 2, sodium: 380,
    cuisineType: "Indian",
    dishNotes: "High in omega-3 fatty acids. Excellent lean protein source.",
  },
  {
    name: "Paneer Sabzi",
    aliases: ["paneer sabzi", "paneer ki sabzi", "paneer bhurji", "paneer stir fry",
              "cottage cheese curry"],
    servingDescription: "1 katori (~150ml)",
    calories: 240, protein: 14, carbs: 8, fat: 18, fiber: 2, sugar: 3, sodium: 300,
    cuisineType: "Indian",
    dishNotes: "Cottage cheese vegetable dish. Rich in calcium and protein.",
  },
  {
    name: "Aloo Sabzi",
    aliases: ["aloo sabzi", "potato sabzi", "aloo ki sabzi", "jeera aloo", "aloo gobi",
              "potato curry", "aloo masala"],
    servingDescription: "1 katori (~150ml)",
    calories: 150, protein: 3, carbs: 28, fat: 4, fiber: 3, sugar: 2, sodium: 200,
    cuisineType: "Indian",
    dishNotes: "Simple potato vegetable dish. Often paired with roti or paratha.",
  },
  {
    name: "Dal Tadka",
    aliases: ["dal tadka", "tadka dal", "yellow dal", "moong dal", "toor dal",
              "daal tadka", "plain dal", "dal fry"],
    servingDescription: "1 katori (~150ml)",
    calories: 140, protein: 8, carbs: 22, fat: 4, fiber: 5, sugar: 2, sodium: 280,
    cuisineType: "Indian",
    dishNotes: "One katori = ~150ml. Dal is high in plant protein and fiber.",
  },
  {
    name: "Sambhar",
    aliases: ["sambhar", "sambar", "lentil vegetable stew", "idli sambar"],
    servingDescription: "1 katori (~150ml)",
    calories: 90, protein: 5, carbs: 14, fat: 2, fiber: 4, sugar: 3, sodium: 320,
    cuisineType: "Indian",
    dishNotes: "Low calorie lentil and vegetable stew. Great source of fiber and vitamins.",
  },
  {
    name: "Vada Pav",
    aliases: ["vada pav", "wada pav", "batata vada pav", "mumbai vada pav"],
    servingDescription: "1 piece (1 pav bun + 1 vada)",
    calories: 280, protein: 6, carbs: 42, fat: 10, fiber: 3, sugar: 4, sodium: 380,
    cuisineType: "Indian",
    dishNotes: "Mumbai street food. Best enjoyed occasionally due to deep-frying.",
  },
  {
    name: "Pav Bhaji",
    aliases: ["pav bhaji", "pao bhaji", "bhaji pav", "mumbai pav bhaji"],
    servingDescription: "1 serving (2 pav buns + bhaji)",
    calories: 420, protein: 10, carbs: 64, fat: 14, fiber: 5, sugar: 6, sodium: 640,
    cuisineType: "Indian",
    dishNotes: "Spiced vegetable mash with buttered bread rolls.",
  },
  {
    name: "Biryani (Veg)",
    aliases: ["veg biryani", "vegetable biryani", "veg dum biryani", "sabzi biryani"],
    servingDescription: "1 plate (~300g)",
    calories: 380, protein: 8, carbs: 72, fat: 8, fiber: 3, sugar: 3, sodium: 480,
    cuisineType: "Indian",
    dishNotes: "Aromatic spiced rice with vegetables. Lower protein than chicken biryani.",
  },
  {
    name: "Chaat",
    aliases: ["chaat", "aloo chaat", "papdi chaat", "bhel puri", "sev puri",
              "dahi chaat", "dahi puri"],
    servingDescription: "1 plate (~150g)",
    calories: 200, protein: 5, carbs: 34, fat: 6, fiber: 3, sugar: 8, sodium: 420,
    cuisineType: "Indian",
    dishNotes: "Street food with tamarind chutney. Moderate calories but high in sodium.",
  },
  {
    name: "Lassi",
    aliases: ["lassi", "sweet lassi", "salted lassi", "mango lassi", "punjabi lassi", "dahi lassi"],
    servingDescription: "1 glass (~250ml)",
    calories: 180, protein: 6, carbs: 28, fat: 5, fiber: 0, sugar: 24, sodium: 80,
    cuisineType: "Indian",
    dishNotes: "Yogurt-based drink. High in sugar if sweet. Good source of probiotics.",
  },
  {
    name: "Chai (Milk Tea)",
    aliases: ["chai", "tea", "milk tea", "masala chai", "indian tea", "cutting chai", "doodh chai"],
    servingDescription: "1 cup (~150ml with milk and sugar)",
    calories: 60, protein: 2, carbs: 10, fat: 2, fiber: 0, sugar: 8, sodium: 20,
    cuisineType: "Indian",
    dishNotes: "One cup with 1 tsp sugar. Reduce sugar to cut calories.",
  },
  {
    name: "Raita",
    aliases: ["raita", "dahi raita", "boondi raita", "cucumber raita", "pudina raita"],
    servingDescription: "1 katori (~150ml)",
    calories: 70, protein: 4, carbs: 8, fat: 2, fiber: 0, sugar: 6, sodium: 150,
    cuisineType: "Indian",
    dishNotes: "Cooling yogurt side dish. Good source of probiotics and calcium.",
  },
  {
    name: "Dhokla",
    aliases: ["dhokla", "khaman dhokla", "besan dhokla", "steamed dhokla"],
    servingDescription: "2 pieces (~120g)",
    calories: 150, protein: 6, carbs: 24, fat: 4, fiber: 2, sugar: 4, sodium: 320,
    cuisineType: "Indian",
    dishNotes: "Light Gujarati steamed snack. Low fat and high in protein.",
  },
  {
    name: "Medu Vada",
    aliases: ["medu vada", "vada", "urad dal vada", "south indian vada", "dal vada"],
    servingDescription: "1 piece (~60g)",
    calories: 110, protein: 4, carbs: 14, fat: 5, fiber: 2, sugar: 0, sodium: 180,
    cuisineType: "Indian",
    dishNotes: "Deep-fried lentil donut. Usually served with sambar and chutney.",
  },
  {
    name: "Paneer Tikka",
    aliases: ["paneer tikka", "grilled paneer", "tandoori paneer", "paneer seekh"],
    servingDescription: "4–5 pieces (~150g)",
    calories: 260, protein: 18, carbs: 8, fat: 18, fiber: 1, sugar: 3, sodium: 400,
    cuisineType: "Indian",
    dishNotes: "Grilled cottage cheese. High protein, good for fitness goals.",
  },
  {
    name: "Chicken Tikka",
    aliases: ["chicken tikka", "tandoori chicken tikka", "grilled chicken tikka"],
    servingDescription: "4–5 pieces (~150g)",
    calories: 220, protein: 28, carbs: 4, fat: 10, fiber: 0, sugar: 2, sodium: 450,
    cuisineType: "Indian",
    dishNotes: "Grilled marinated chicken. High protein, low carb — great for fitness.",
  },
  {
    name: "Tandoori Chicken",
    aliases: ["tandoori chicken", "whole tandoori", "half tandoori", "roasted chicken indian"],
    servingDescription: "1 piece leg+thigh (~200g)",
    calories: 290, protein: 36, carbs: 5, fat: 14, fiber: 0, sugar: 2, sodium: 520,
    cuisineType: "Indian",
    dishNotes: "Clay-oven roasted chicken. Low carb, very high protein.",
  },
  {
    name: "Naan",
    aliases: ["naan", "naan bread", "plain naan", "butter naan", "garlic naan"],
    servingDescription: "1 piece (~100g)",
    calories: 260, protein: 8, carbs: 46, fat: 5, fiber: 2, sugar: 2, sodium: 380,
    cuisineType: "Indian",
    dishNotes: "Leavened flatbread. Butter or garlic naan has extra 50–80 kcal.",
  },
  {
    name: "Matar Paneer",
    aliases: ["matar paneer", "peas paneer", "muttar paneer", "mutter paneer"],
    servingDescription: "1 katori (~150ml)",
    calories: 220, protein: 10, carbs: 16, fat: 14, fiber: 4, sugar: 4, sodium: 320,
    cuisineType: "Indian",
    dishNotes: "Peas and cottage cheese in tomato gravy. Good source of plant protein.",
  },
  {
    name: "Dal Makhani",
    aliases: ["dal makhani", "makhani dal", "black dal", "kaali dal", "daal makhani"],
    servingDescription: "1 katori (~150ml)",
    calories: 200, protein: 10, carbs: 24, fat: 8, fiber: 6, sugar: 3, sodium: 350,
    cuisineType: "Indian",
    dishNotes: "Slow-cooked black lentils in cream. Rich and filling.",
  },
  {
    name: "Thali (Veg)",
    aliases: ["veg thali", "vegetarian thali", "gujarati thali", "rajasthani thali", "full thali"],
    servingDescription: "1 full thali (dal, rice, 2 roti, sabzi, raita, papad)",
    calories: 750, protein: 22, carbs: 130, fat: 18, fiber: 12, sugar: 8, sodium: 800,
    cuisineType: "Indian",
    dishNotes: "Complete Indian meal. Calories vary widely by restaurant and components.",
  },
  {
    name: "Gulab Jamun",
    aliases: ["gulab jamun", "gulaab jamun", "fried milk balls", "khoya gulab jamun"],
    servingDescription: "2 pieces (~80g)",
    calories: 200, protein: 3, carbs: 36, fat: 6, fiber: 0, sugar: 28, sodium: 60,
    cuisineType: "Indian",
    dishNotes: "Deep-fried milk dumplings in sugar syrup. High in sugar — enjoy occasionally.",
  },
  {
    name: "Kheer",
    aliases: ["kheer", "rice kheer", "chawal ki kheer", "payasam", "phirni"],
    servingDescription: "1 katori (~150ml)",
    calories: 180, protein: 5, carbs: 28, fat: 6, fiber: 0, sugar: 18, sodium: 50,
    cuisineType: "Indian",
    dishNotes: "Rice pudding cooked in milk. Moderate calorie dessert.",
  },
];

// ── Hinglish quantity parsing ─────────────────────────────────────────────────

/** Converts common Hindi/Hinglish quantity words to a multiplier */
function parseHinglishQuantity(query: string): { cleanQuery: string; multiplier: number } {
  const lower = query.toLowerCase().trim();

  // Map of Hindi number words to numeric values
  const numberWords: Record<string, number> = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "half": 0.5, "aadha": 0.5, "adha": 0.5,
  };

  let multiplier = 1;
  let cleanQuery = lower;

  // Match patterns like "2 roti", "ek plate dal chawal", "do samosa"
  for (const [word, val] of Object.entries(numberWords)) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(cleanQuery)) {
      multiplier = val;
      cleanQuery = cleanQuery.replace(pattern, "").trim();
      break;
    }
  }

  // Match numeric patterns like "2 " at the start
  const numMatch = cleanQuery.match(/^(\d+(?:\.\d+)?)\s+/);
  if (numMatch) {
    multiplier = parseFloat(numMatch[1]);
    cleanQuery = cleanQuery.slice(numMatch[0].length).trim();
  }

  // Strip filler words
  cleanQuery = cleanQuery
    .replace(/\b(plate|katori|glass|cup|piece|pieces|serving|servings|ka|ki|ke|with|aur|and|ek|se|mera|meri)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { cleanQuery, multiplier };
}

// ── Fuzzy search ──────────────────────────────────────────────────────────────

/**
 * Search the local Indian food database.
 * Returns a FoodAnalysisResult if a match is found, null otherwise.
 */
export function searchIndianFoodDB(rawQuery: string): FoodAnalysisResult | null {
  if (!rawQuery || rawQuery.trim().length < 2) return null;

  const { cleanQuery, multiplier } = parseHinglishQuantity(rawQuery);
  const query = cleanQuery.toLowerCase().trim();

  if (!query) return null;

  // Find best matching entry
  let bestMatch: IndianFoodEntry | null = null;
  let bestScore = 0;

  for (const entry of INDIAN_FOOD_DB) {
    for (const alias of entry.aliases) {
      // Exact match — highest priority
      if (alias === query || alias.includes(query) || query.includes(alias)) {
        const score = alias === query ? 100 : alias.includes(query) ? 80 : 60;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }

      // Word-level partial match
      const aliasWords = alias.split(" ");
      const queryWords = query.split(" ").filter((w) => w.length > 2);
      const matchCount = queryWords.filter((qw) =>
        aliasWords.some((aw) => aw.includes(qw) || qw.includes(aw))
      ).length;

      if (matchCount > 0 && queryWords.length > 0) {
        const score = (matchCount / queryWords.length) * 50;
        if (score > bestScore && score >= 30) {
          bestScore = score;
          bestMatch = entry;
        }
      }
    }
  }

  if (!bestMatch || bestScore < 30) return null;

  // Apply multiplier to nutritional values
  const m = Math.max(0.25, Math.min(multiplier, 5)); // clamp between 0.25x and 5x

  return {
    name: bestMatch.name,
    servingDescription:
      m === 1
        ? bestMatch.servingDescription
        : `${m}x ${bestMatch.servingDescription}`,
    calories: Math.round(bestMatch.calories * m),
    protein: Math.round(bestMatch.protein * m),
    carbs: Math.round(bestMatch.carbs * m),
    fat: Math.round(bestMatch.fat * m),
    fiber: Math.round(bestMatch.fiber * m),
    sugar: Math.round(bestMatch.sugar * m),
    sodium: Math.round(bestMatch.sodium * m),
    confidence: "high",
    noFoodDetected: false,
    cuisineType: bestMatch.cuisineType,
    dishNotes: bestMatch.dishNotes,
    source: "local-db",
  };
}

/** Returns all database entry names for display in the quick-chip section */
export const INDIAN_FOOD_QUICK_CHIPS = [
  { emoji: "🍚", label: "Dal Chawal",       query: "Dal Chawal" },
  { emoji: "🫓", label: "Roti",             query: "2 roti" },
  { emoji: "🥘", label: "Rajma Chawal",     query: "Rajma Chawal" },
  { emoji: "🍗", label: "Chicken Biryani",  query: "Chicken Biryani" },
  { emoji: "🥗", label: "Paneer Sabzi",     query: "Paneer Sabzi" },
  { emoji: "🫔", label: "Paratha",          query: "Aloo Paratha" },
  { emoji: "🥣", label: "Poha",             query: "Poha" },
  { emoji: "🍜", label: "Upma",             query: "Upma" },
  { emoji: "🧆", label: "Samosa",           query: "Samosa" },
  { emoji: "🥞", label: "Dosa",             query: "Plain Dosa" },
  { emoji: "🍲", label: "Kadhi Chawal",     query: "Kadhi Chawal" },
  { emoji: "🥙", label: "Chole Bhature",    query: "Chole Bhature" },
];
