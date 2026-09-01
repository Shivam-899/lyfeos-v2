/**
 * Local Indian Food Database (LyfeOS)
 * Instant offline nutrition lookup for 138 common Indian foods, meals, and snacks.
 * Searched BEFORE making external network calls for text queries.
 *
 * All values represent standard cooked / ready-to-consume household portions.
 * Nutrition values referenced from standard ICMR-NIN (IFCT) Indian food tables.
 */

import { FoodAnalysisResult } from "./analyzeFoodImage";

// ── Database Schema ───────────────────────────────────────────────────────────

export interface IndianFoodEntry {
  /** Canonical English name shown to user */
  name: string;
  /** All name variants + common Hindi/Hinglish spellings (lowercase) */
  aliases: string[];
  /** Standard household portion shown to user (cooked basis) */
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

  // Optional notable micronutrients (only populated when biologically significant)
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

export const INDIAN_FOOD_DB: IndianFoodEntry[] = [
  {
    name: "Dal Chawal",
    aliases: ["dal chawal","daal chawal","dhal chawal","dal rice","daal rice","dhal rice","dal chaawal","dal-chawal","dal + rice","rice and dal","dal aur chawal","rice dal","chawal dal","dal chawal plate"],
    servingDescription: "1 plate (1 katori dal ~150ml + 1 cup cooked rice ~200g)",
    calories: 450, protein: 15, carbs: 82, fat: 6, fiber: 8, sugar: 3, sodium: 380,
    potassium: 380, iron: 2.8,
    cuisineType: "Indian",
    dishNotes: "Classic Indian comfort meal. 1 katori ≈ 150ml. Adjust portion if your serving was larger.",
  },
  {
    name: "Roti (Chapati)",
    aliases: ["roti","chapati","chapatti","chappati","phulka","ek roti","1 roti","plain roti","whole wheat roti","gehu ki roti","fulka","rotli"],
    servingDescription: "1 medium roti (~40g)",
    calories: 100, protein: 3, carbs: 18, fat: 2, fiber: 2, sugar: 0, sodium: 90,
    iron: 0.9, magnesium: 32,
    cuisineType: "Indian",
    dishNotes: "One medium roti ≈ 40g. A typical meal has 2–3 rotis.",
  },
  {
    name: "Paratha",
    aliases: ["paratha","parantha","parauntha","plain paratha","tawa paratha","sada paratha"],
    servingDescription: "1 paratha with butter (~80g)",
    calories: 200, protein: 4, carbs: 28, fat: 8, fiber: 2, sugar: 0, sodium: 180,
    iron: 1.1,
    cuisineType: "Indian",
    dishNotes: "Plain paratha with light butter. Stuffed versions (aloo, paneer) have higher calories.",
  },
  {
    name: "Aloo Paratha",
    aliases: ["aloo paratha","alu paratha","potato paratha","aloo parantha","stuffed paratha","alu parantha"],
    servingDescription: "1 aloo paratha with butter (~120g)",
    calories: 260, protein: 6, carbs: 38, fat: 10, fiber: 3, sugar: 1, sodium: 220,
    potassium: 240, iron: 1.5,
    cuisineType: "Indian",
    dishNotes: "Potato-stuffed flatbread. Commonly served with curd and pickle.",
  },
  {
    name: "Chicken Biryani",
    aliases: ["chicken biryani","biryani","murgh biryani","chicken briyani","hyderabadi biryani","dum biryani","chicken dum biryani","chicken biriyani"],
    servingDescription: "1 plate (~350g, 1.5 cups rice + chicken pieces)",
    calories: 550, protein: 32, carbs: 68, fat: 14, fiber: 2, sugar: 2, sodium: 620,
    iron: 2.2, zinc: 2.5, vitaminB12: 0.7,
    cuisineType: "Indian",
    dishNotes: "One plate biryani typically has 1.5 cups cooked rice + 100–120g chicken.",
  },
  {
    name: "Rajma Chawal",
    aliases: ["rajma chawal","rajma rice","red kidney beans rice","rajma dal chawal","rajma","rajma curry with rice"],
    servingDescription: "1 plate (1 katori rajma + 1 cup rice)",
    calories: 480, protein: 18, carbs: 88, fat: 5, fiber: 10, sugar: 3, sodium: 420,
    potassium: 540, iron: 3.6, magnesium: 70,
    cuisineType: "Indian",
    dishNotes: "High-fiber, high-protein North Indian staple. Great for muscle building.",
  },
  {
    name: "Paneer Butter Masala",
    aliases: ["paneer butter masala","paneer makhani","butter paneer","paneer makhanwala","paneer masala"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 280, protein: 14, carbs: 12, fat: 20, fiber: 2, sugar: 4, sodium: 380,
    calcium: 260, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Rich, creamy paneer dish. Best paired with 2 rotis or 1 cup rice.",
  },
  {
    name: "Palak Paneer",
    aliases: ["palak paneer","spinach paneer","palak ki sabzi with paneer","saag paneer","palak paneer curry"],
    servingDescription: "1 katori (~150ml)",
    calories: 240, protein: 12, carbs: 10, fat: 18, fiber: 3, sugar: 2, sodium: 320,
    calcium: 280, iron: 2.8, vitaminA: 320,
    cuisineType: "Indian",
    dishNotes: "Iron-rich dish. Spinach provides iron, folate, and vitamin A.",
  },
  {
    name: "Butter Chicken",
    aliases: ["butter chicken","murgh makhani","chicken makhani","chicken makhanwala","chicken in butter sauce"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 290, protein: 24, carbs: 10, fat: 18, fiber: 1, sugar: 5, sodium: 450,
    iron: 1.8, zinc: 1.9, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Mild, creamy tomato-based chicken curry. High in protein.",
  },
  {
    name: "Samosa",
    aliases: ["samosa","samose","fried samosa","aloo samosa","potato samosa","samosa 1","ek samosa"],
    servingDescription: "1 piece (~100g)",
    calories: 180, protein: 4, carbs: 24, fat: 8, fiber: 2, sugar: 1, sodium: 240,
    potassium: 160,
    cuisineType: "Indian",
    dishNotes: "Deep-fried pastry with spiced potato filling. Standard halwai samosa ≈ 180 kcal.",
  },
  {
    name: "Idli",
    aliases: ["idli","idly","rice idli","steam idli","plain idli","ek idli","1 idli","do idli","2 idli"],
    servingDescription: "1 piece (~60g)",
    calories: 40, protein: 2, carbs: 8, fat: 0, fiber: 0, sugar: 0, sodium: 80,
    calcium: 12, iron: 0.4,
    cuisineType: "Indian",
    dishNotes: "Steamed rice cake. Very light — a typical serving is 3–4 idlis.",
  },
  {
    name: "Plain Dosa",
    aliases: ["dosa","plain dosa","sada dosa","rice dosa","ek dosa","1 dosa","crispy dosa"],
    servingDescription: "1 plain dosa (~80g)",
    calories: 120, protein: 3, carbs: 22, fat: 2, fiber: 1, sugar: 0, sodium: 160,
    iron: 0.8,
    cuisineType: "Indian",
    dishNotes: "Crispy fermented rice crepe. Masala dosa has ~180 kcal with filling.",
  },
  {
    name: "Masala Dosa",
    aliases: ["masala dosa","masala dose","stuffed dosa","aloo dosa","masala dosai"],
    servingDescription: "1 masala dosa with potato filling (~180g)",
    calories: 180, protein: 5, carbs: 32, fat: 5, fiber: 2, sugar: 1, sodium: 220,
    potassium: 210, iron: 1.4,
    cuisineType: "Indian",
    dishNotes: "Crispy dosa filled with spiced potato. Often served with sambar and chutney.",
  },
  {
    name: "Poha",
    aliases: ["poha","aloo poha","batata poha","kanda poha","flattened rice","beaten rice","pohe","chivda poha"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 250, protein: 5, carbs: 48, fat: 4, fiber: 2, sugar: 2, sodium: 250,
    iron: 2.4, vitaminC: 8,
    cuisineType: "Indian",
    dishNotes: "Light breakfast dish made from flattened rice. Squeezed lemon enhances iron absorption.",
  },
  {
    name: "Upma",
    aliases: ["upma","upuma","semolina upma","rava upma","sooji upma","suji upma"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 220, protein: 6, carbs: 38, fat: 5, fiber: 2, sugar: 2, sodium: 300,
    iron: 1.2, magnesium: 26,
    cuisineType: "Indian",
    dishNotes: "Savory semolina porridge. Light and filling South Indian breakfast.",
  },
  {
    name: "Chole (Chana Masala)",
    aliases: ["chole","chhole","chana masala","chole masala","chickpea curry","kabuli chana","white chana","chana gravy"],
    servingDescription: "1 katori (~150ml)",
    calories: 180, protein: 10, carbs: 28, fat: 4, fiber: 7, sugar: 2, sodium: 360,
    potassium: 420, iron: 3.2, magnesium: 55,
    cuisineType: "Indian",
    dishNotes: "High in plant protein and fiber. Excellent for weight management.",
  },
  {
    name: "Chole Bhature",
    aliases: ["chole bhature","chhole bhature","chole bhatoore","bhature chole","chole with bhature","bhatura chole"],
    servingDescription: "1 serving (1 katori chole + 2 bhature)",
    calories: 520, protein: 15, carbs: 72, fat: 20, fiber: 7, sugar: 3, sodium: 580,
    potassium: 450, iron: 3.8,
    cuisineType: "Indian",
    dishNotes: "Popular Punjabi dish. Bhature are deep-fried and calorie dense.",
  },
  {
    name: "Kadhi Chawal",
    aliases: ["kadhi chawal","kadhi rice","dahi kadhi rice","kadhi pakora rice","kadhi with rice","punjabi kadhi","besan kadhi chawal"],
    servingDescription: "1 plate (1 katori kadhi + 1 cup rice)",
    calories: 380, protein: 10, carbs: 72, fat: 6, fiber: 2, sugar: 4, sodium: 400,
    potassium: 280, calcium: 140,
    cuisineType: "Indian",
    dishNotes: "Tangy yogurt-based curry with rice. A complete North Indian meal.",
  },
  {
    name: "Pulao",
    aliases: ["pulao","pilaf","veg pulao","vegetable pulao","matar pulao","peas pulao"],
    servingDescription: "1 plate (~200g cooked)",
    calories: 320, protein: 6, carbs: 62, fat: 5, fiber: 2, sugar: 1, sodium: 350,
    potassium: 180,
    cuisineType: "Indian",
    dishNotes: "Mildly spiced rice dish. Lower calorie than biryani.",
  },
  {
    name: "Khichdi",
    aliases: ["khichdi","khichri","khichadi","dal khichdi","rice khichdi","moong khichdi"],
    servingDescription: "1 plate (~250g cooked)",
    calories: 280, protein: 10, carbs: 52, fat: 4, fiber: 4, sugar: 1, sodium: 280,
    potassium: 260, iron: 1.8,
    cuisineType: "Indian",
    dishNotes: "Easy-to-digest one-pot meal of rice and lentils. High in nutrients.",
  },
  {
    name: "Egg Bhurji",
    aliases: ["egg bhurji","anda bhurji","scrambled eggs indian","masala eggs","masala scrambled eggs","2 egg bhurji","do ande ka bhurji"],
    servingDescription: "2 eggs scrambled (~120g)",
    calories: 180, protein: 14, carbs: 4, fat: 12, fiber: 1, sugar: 1, sodium: 280,
    iron: 1.8, zinc: 1.4, vitaminB12: 1.1,
    cuisineType: "Indian",
    dishNotes: "Spiced scrambled eggs. Excellent high-protein breakfast option.",
  },
  {
    name: "Puri",
    aliases: ["puri","poori","fried puri","plain puri","ek puri","1 puri"],
    servingDescription: "1 piece (~50g)",
    calories: 90, protein: 2, carbs: 13, fat: 4, fiber: 1, sugar: 0, sodium: 80,
    iron: 0.6,
    cuisineType: "Indian",
    dishNotes: "Deep-fried whole wheat bread. Often served with bhaji or chole.",
  },
  {
    name: "Halwa",
    aliases: ["halwa","sooji halwa","rava halwa","gajar halwa","carrot halwa","suji ka halwa","semolina halwa"],
    servingDescription: "1 katori (~150g)",
    calories: 320, protein: 4, carbs: 48, fat: 14, fiber: 1, sugar: 22, sodium: 80,
    calcium: 60,
    cuisineType: "Indian",
    dishNotes: "Sweet dish high in sugar and ghee. Best enjoyed in small portions.",
  },
  {
    name: "Uttapam",
    aliases: ["uttapam","utthappam","uthappam","rice uttapam","vegetable uttapam","onion uttapam"],
    servingDescription: "1 piece (~120g)",
    calories: 150, protein: 4, carbs: 26, fat: 3, fiber: 1, sugar: 2, sodium: 200,
    potassium: 140,
    cuisineType: "Indian",
    dishNotes: "Thick rice pancake with vegetable toppings. Healthier than dosa.",
  },
  {
    name: "Mutton Curry",
    aliases: ["mutton curry","gosht","mutton masala","lamb curry","keema","mutton gravy","gosht curry","mutton korma"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 320, protein: 28, carbs: 8, fat: 20, fiber: 1, sugar: 2, sodium: 480,
    iron: 3.5, zinc: 4.2, vitaminB12: 1.6,
    cuisineType: "Indian",
    dishNotes: "High-protein red meat curry. Good source of iron and zinc.",
  },
  {
    name: "Fish Curry",
    aliases: ["fish curry","machli curry","machi curry","fish gravy","fish masala","machhi ka salan","bengali fish curry","meen curry"],
    servingDescription: "1 katori (~150ml, ~180g)",
    calories: 240, protein: 26, carbs: 6, fat: 14, fiber: 1, sugar: 2, sodium: 380,
    iron: 1.2, zinc: 1.1, vitaminB12: 2.4,
    cuisineType: "Indian",
    dishNotes: "Rich in omega-3 fatty acids and lean protein.",
  },
  {
    name: "Paneer Sabzi",
    aliases: ["paneer sabzi","paneer ki sabzi","paneer stir fry","cottage cheese curry","paneer curry"],
    servingDescription: "1 katori (~150ml)",
    calories: 240, protein: 14, carbs: 8, fat: 18, fiber: 2, sugar: 3, sodium: 300,
    calcium: 260, vitaminB12: 0.5,
    cuisineType: "Indian",
    dishNotes: "Cottage cheese vegetable dish. Rich in calcium and protein.",
  },
  {
    name: "Aloo Sabzi",
    aliases: ["aloo sabzi","potato sabzi","aloo ki sabzi","jeera aloo","potato curry","aloo masala","sukhi aloo sabzi"],
    servingDescription: "1 katori (~150ml)",
    calories: 150, protein: 3, carbs: 28, fat: 4, fiber: 3, sugar: 2, sodium: 200,
    potassium: 380, vitaminC: 12,
    cuisineType: "Indian",
    dishNotes: "Simple potato vegetable dish. Often paired with roti or paratha.",
  },
  {
    name: "Dal Tadka",
    aliases: ["dal","daal","dhal","dal tadka","tadka dal","yellow dal","moong dal tadka","toor dal tadka","daal tadka","plain dal","dal fry","arhar dal","peeli dal","katori dal"],
    servingDescription: "1 katori (~150ml)",
    calories: 140, protein: 8, carbs: 22, fat: 4, fiber: 5, sugar: 2, sodium: 280,
    potassium: 320, iron: 2.2,
    cuisineType: "Indian",
    dishNotes: "One katori = ~150ml. Dal is high in plant protein and fiber.",
  },
  {
    name: "Sambhar",
    aliases: ["sambhar","sambar","lentil vegetable stew","idli sambar","south indian sambar"],
    servingDescription: "1 katori (~150ml)",
    calories: 90, protein: 5, carbs: 14, fat: 2, fiber: 4, sugar: 3, sodium: 320,
    potassium: 240, vitaminC: 8,
    cuisineType: "Indian",
    dishNotes: "Low calorie lentil and vegetable stew. Great source of fiber and vitamins.",
  },
  {
    name: "Vada Pav",
    aliases: ["vada pav","wada pav","batata vada pav","mumbai vada pav","wada pao"],
    servingDescription: "1 piece (1 pav bun + 1 vada)",
    calories: 280, protein: 6, carbs: 42, fat: 10, fiber: 3, sugar: 4, sodium: 380,
    potassium: 210,
    cuisineType: "Indian",
    dishNotes: "Mumbai street food. Best enjoyed occasionally due to deep-frying.",
  },
  {
    name: "Pav Bhaji",
    aliases: ["pav bhaji","pao bhaji","bhaji pav","mumbai pav bhaji"],
    servingDescription: "1 serving (2 pav buns + bhaji)",
    calories: 420, protein: 10, carbs: 64, fat: 14, fiber: 5, sugar: 6, sodium: 640,
    potassium: 460, vitaminC: 18,
    cuisineType: "Indian",
    dishNotes: "Spiced vegetable mash with buttered bread rolls.",
  },
  {
    name: "Biryani (Veg)",
    aliases: ["veg biryani","vegetable biryani","veg dum biryani","sabzi biryani","veg biriyani"],
    servingDescription: "1 plate (~300g)",
    calories: 380, protein: 8, carbs: 72, fat: 8, fiber: 3, sugar: 3, sodium: 480,
    potassium: 280,
    cuisineType: "Indian",
    dishNotes: "Aromatic spiced rice with vegetables. Lower protein than chicken biryani.",
  },
  {
    name: "Chaat",
    aliases: ["chaat","aloo chaat","papdi chaat","bhel puri chaat","sev puri","dahi chaat","dahi puri"],
    servingDescription: "1 plate (~150g)",
    calories: 200, protein: 5, carbs: 34, fat: 6, fiber: 3, sugar: 8, sodium: 420,
    potassium: 220,
    cuisineType: "Indian",
    dishNotes: "Street food with tamarind chutney. Moderate calories but high in sodium.",
  },
  {
    name: "Lassi",
    aliases: ["lassi","sweet lassi","salted lassi","mango lassi","punjabi lassi","dahi lassi","mithi lassi"],
    servingDescription: "1 glass (~250ml)",
    calories: 180, protein: 6, carbs: 28, fat: 5, fiber: 0, sugar: 24, sodium: 80,
    calcium: 180, vitaminB12: 0.5,
    cuisineType: "Indian",
    dishNotes: "Yogurt-based drink. High in sugar if sweet. Good source of probiotics.",
  },
  {
    name: "Chai (Milk Tea)",
    aliases: ["chai","tea","milk tea","masala chai","indian tea","cutting chai","doodh chai","adrak chai","ginger tea"],
    servingDescription: "1 cup (~150ml with milk and sugar)",
    calories: 60, protein: 2, carbs: 10, fat: 2, fiber: 0, sugar: 8, sodium: 20,
    calcium: 65,
    cuisineType: "Indian",
    dishNotes: "One cup with 1 tsp sugar. Reduce sugar to cut calories.",
  },
  {
    name: "Raita",
    aliases: ["raita","dahi raita","boondi raita","cucumber raita","pudina raita","kheera raita"],
    servingDescription: "1 katori (~150ml)",
    calories: 70, protein: 4, carbs: 8, fat: 2, fiber: 0, sugar: 6, sodium: 150,
    calcium: 120,
    cuisineType: "Indian",
    dishNotes: "Cooling yogurt side dish. Good source of probiotics and calcium.",
  },
  {
    name: "Dhokla",
    aliases: ["dhokla","khaman dhokla","besan dhokla","steamed dhokla","khaman"],
    servingDescription: "2 pieces (~120g)",
    calories: 150, protein: 6, carbs: 24, fat: 4, fiber: 2, sugar: 4, sodium: 320,
    iron: 1.4, magnesium: 30,
    cuisineType: "Indian",
    dishNotes: "Light Gujarati steamed snack. Low fat and moderate in protein.",
  },
  {
    name: "Medu Vada",
    aliases: ["medu vada","vada","urad dal vada","south indian vada","dal vada","medu vadai"],
    servingDescription: "1 piece (~60g)",
    calories: 110, protein: 4, carbs: 14, fat: 5, fiber: 2, sugar: 0, sodium: 180,
    iron: 1.1,
    cuisineType: "Indian",
    dishNotes: "Deep-fried lentil donut. Usually served with sambar and chutney.",
  },
  {
    name: "Paneer Tikka",
    aliases: ["paneer tikka","grilled paneer","tandoori paneer","paneer seekh","tandoori paneer tikka"],
    servingDescription: "4–5 pieces (~150g)",
    calories: 260, protein: 18, carbs: 8, fat: 18, fiber: 1, sugar: 3, sodium: 400,
    calcium: 280, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Grilled cottage cheese. High protein, good for fitness goals.",
  },
  {
    name: "Chicken Tikka",
    aliases: ["chicken tikka","tandoori chicken tikka","grilled chicken tikka","murgh tikka"],
    servingDescription: "4–5 pieces (~150g)",
    calories: 220, protein: 28, carbs: 4, fat: 10, fiber: 0, sugar: 2, sodium: 450,
    iron: 1.6, zinc: 2.1, vitaminB12: 0.7,
    cuisineType: "Indian",
    dishNotes: "Grilled marinated chicken. High protein, low carb — great for fitness.",
  },
  {
    name: "Tandoori Chicken",
    aliases: ["tandoori chicken","whole tandoori","half tandoori","roasted chicken indian","tandoori murgh"],
    servingDescription: "1 piece leg+thigh (~200g)",
    calories: 290, protein: 36, carbs: 5, fat: 14, fiber: 0, sugar: 2, sodium: 520,
    iron: 1.8, zinc: 2.4, vitaminB12: 0.8,
    cuisineType: "Indian",
    dishNotes: "Clay-oven roasted chicken. Low carb, very high protein.",
  },
  {
    name: "Naan",
    aliases: ["naan","naan bread","plain naan","butter naan","garlic naan","tandoori naan"],
    servingDescription: "1 piece (~100g)",
    calories: 260, protein: 8, carbs: 46, fat: 5, fiber: 2, sugar: 2, sodium: 380,
    iron: 1.4,
    cuisineType: "Indian",
    dishNotes: "Leavened flatbread. Butter or garlic naan has extra 50–80 kcal.",
  },
  {
    name: "Matar Paneer",
    aliases: ["matar paneer","peas paneer","muttar paneer","mutter paneer","mutter paneer curry"],
    servingDescription: "1 katori (~150ml)",
    calories: 220, protein: 10, carbs: 16, fat: 14, fiber: 4, sugar: 4, sodium: 320,
    calcium: 200, vitaminC: 10,
    cuisineType: "Indian",
    dishNotes: "Peas and cottage cheese in tomato gravy. Good source of plant protein.",
  },
  {
    name: "Dal Makhani",
    aliases: ["dal makhani","makhani dal","black dal","kaali dal","daal makhani","maa ki dal"],
    servingDescription: "1 katori (~150ml)",
    calories: 200, protein: 10, carbs: 24, fat: 8, fiber: 6, sugar: 3, sodium: 350,
    potassium: 360, calcium: 90, iron: 2.8,
    cuisineType: "Indian",
    dishNotes: "Slow-cooked black lentils in cream and butter. Rich and filling.",
  },
  {
    name: "Thali (Veg)",
    aliases: ["veg thali","vegetarian thali","gujarati thali","rajasthani thali","full thali","north indian thali"],
    servingDescription: "1 full thali (dal, rice, 2 roti, sabzi, raita, papad)",
    calories: 750, protein: 22, carbs: 130, fat: 18, fiber: 12, sugar: 8, sodium: 800,
    potassium: 750, calcium: 220, iron: 4.5,
    cuisineType: "Indian",
    dishNotes: "Complete Indian meal. Calories vary widely by restaurant and components.",
  },
  {
    name: "Gulab Jamun",
    aliases: ["gulab jamun","gulaab jamun","fried milk balls","khoya gulab jamun"],
    servingDescription: "2 pieces (~80g)",
    calories: 200, protein: 3, carbs: 36, fat: 6, fiber: 0, sugar: 28, sodium: 60,
    calcium: 70,
    cuisineType: "Indian",
    dishNotes: "Deep-fried milk dumplings in sugar syrup. High in sugar — enjoy occasionally.",
  },
  {
    name: "Kheer",
    aliases: ["kheer","rice kheer","chawal ki kheer","payasam","phirni"],
    servingDescription: "1 katori (~150ml)",
    calories: 180, protein: 5, carbs: 28, fat: 6, fiber: 0, sugar: 18, sodium: 50,
    calcium: 150, vitaminB12: 0.4,
    cuisineType: "Indian",
    dishNotes: "Rice pudding cooked in milk. Moderate calorie dessert.",
  },
  {
    name: "Dahi (Plain Curd)",
    aliases: ["dahi","curd","plain dahi","yogurt","plain yogurt","desi dahi","homemade dahi","1 katori dahi","curd bowl"],
    servingDescription: "1 katori (~150g)",
    calories: 90, protein: 5, carbs: 6, fat: 5, fiber: 0, sugar: 6, sodium: 60,
    calcium: 180, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Whole milk curd. Rich in natural probiotics and bioavailable calcium.",
  },
  {
    name: "Chaas (Buttermilk)",
    aliases: ["chaas","buttermilk","mattha","masala chaas","spiced buttermilk","mor","ghol","1 glass chaas"],
    servingDescription: "1 glass (~250ml)",
    calories: 45, protein: 3, carbs: 4, fat: 2, fiber: 0, sugar: 4, sodium: 180,
    potassium: 160, calcium: 120,
    cuisineType: "Indian",
    dishNotes: "Diluted churned yogurt with spices. Excellent digestive drink, low in calories.",
  },
  {
    name: "Boiled Egg",
    aliases: ["boiled egg","hard boiled egg","1 boiled egg","2 boiled eggs","anda","boiled anda","egg boiled","2 eggs boiled"],
    servingDescription: "1 large egg (~50g)",
    calories: 75, protein: 6, carbs: 1, fat: 5, fiber: 0, sugar: 0, sodium: 70,
    iron: 0.9, zinc: 0.6, vitaminD: 1.1, vitaminB12: 0.5,
    cuisineType: "Indian",
    dishNotes: "High biological value protein. Contains essential amino acids and choline.",
  },
  {
    name: "Egg Curry",
    aliases: ["egg curry","anda curry","dim kosha","egg gravy","muttai curry","anda masala curry","egg masala"],
    servingDescription: "2 eggs with gravy (~200g)",
    calories: 220, protein: 14, carbs: 8, fat: 15, fiber: 1, sugar: 2, sodium: 380,
    iron: 2.1, zinc: 1.4, vitaminB12: 1.1,
    cuisineType: "Indian",
    dishNotes: "Hard-boiled eggs simmered in onion-tomato gravy. High quality protein.",
  },
  {
    name: "Home-Style Chicken Curry",
    aliases: ["chicken curry","home chicken curry","tari wali chicken","chicken gravy","desi chicken curry","murgh curry"],
    servingDescription: "1 katori (~150ml, ~180g with 2 pieces)",
    calories: 240, protein: 26, carbs: 6, fat: 12, fiber: 1, sugar: 2, sodium: 400,
    potassium: 320, iron: 1.9, zinc: 2.2, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Light home-style chicken curry cooked with minimal oil.",
  },
  {
    name: "Bhindi Masala",
    aliases: ["bhindi","bhindi masala","okra sabzi","bhindi fry","bhindi ki sabzi","ladyfinger sabzi","okra"],
    servingDescription: "1 katori (~150g)",
    calories: 120, protein: 3, carbs: 14, fat: 6, fiber: 4, sugar: 2, sodium: 220,
    calcium: 80, magnesium: 45, vitaminC: 16,
    cuisineType: "Indian",
    dishNotes: "Spiced sautéed okra. Rich in dietary fiber, folate, and antioxidants.",
  },
  {
    name: "Baingan Bharta",
    aliases: ["baingan bharta","baingan ka bharta","eggplant mash","roasted eggplant sabzi","vangi bharta"],
    servingDescription: "1 katori (~150g)",
    calories: 130, protein: 3, carbs: 14, fat: 7, fiber: 5, sugar: 4, sodium: 240,
    potassium: 290,
    cuisineType: "Indian",
    dishNotes: "Fire-roasted mashed eggplant cooked with onions, tomatoes, and peas.",
  },
  {
    name: "Aloo Gobi",
    aliases: ["aloo gobi","alu gobi","potato cauliflower","aloo gobhi","gobi aloo sabzi","aloo gobi dry"],
    servingDescription: "1 katori (~150g)",
    calories: 140, protein: 3, carbs: 22, fat: 5, fiber: 4, sugar: 2, sodium: 230,
    potassium: 360, vitaminC: 32,
    cuisineType: "Indian",
    dishNotes: "Classic spiced potato and cauliflower dry curry.",
  },
  {
    name: "Lauki Sabzi",
    aliases: ["lauki","lauki sabzi","lauki ki sabzi","bottle gourd curry","ghiya sabzi","doodhi sabzi","dudhi"],
    servingDescription: "1 katori (~150g)",
    calories: 80, protein: 2, carbs: 10, fat: 3, fiber: 3, sugar: 2, sodium: 180,
    potassium: 220, vitaminC: 10,
    cuisineType: "Indian",
    dishNotes: "Light and hydrating bottle gourd curry. Very low in calories, great for weight loss.",
  },
  {
    name: "Gobi Matar",
    aliases: ["gobi matar","cauliflower peas","gobhi matar","gobi matar sabzi","patta gobi matar"],
    servingDescription: "1 katori (~150g)",
    calories: 110, protein: 4, carbs: 16, fat: 4, fiber: 4, sugar: 3, sodium: 210,
    potassium: 280, vitaminC: 28,
    cuisineType: "Indian",
    dishNotes: "Cauliflower and green peas stir fry. High in vitamin C and fiber.",
  },
  {
    name: "Karela Sabzi",
    aliases: ["karela","karela sabzi","karela fry","bitter gourd sabzi","karela ki sabzi","bharwa karela"],
    servingDescription: "1 katori (~120g)",
    calories: 100, protein: 2, carbs: 12, fat: 5, fiber: 3, sugar: 1, sodium: 200,
    iron: 1.2, vitaminC: 45,
    cuisineType: "Indian",
    dishNotes: "Bitter gourd cooked with spices. Known for blood sugar regulation benefits.",
  },
  {
    name: "Mix Veg Sabzi",
    aliases: ["mix veg","mixed vegetable","mix vegetable sabzi","mix sabzi","milan veg curry"],
    servingDescription: "1 katori (~150g)",
    calories: 130, protein: 4, carbs: 18, fat: 5, fiber: 4, sugar: 3, sodium: 250,
    potassium: 310, vitaminA: 180, vitaminC: 22,
    cuisineType: "Indian",
    dishNotes: "Assorted vegetables (beans, carrots, peas, potatoes) in mild masala gravy.",
  },
  {
    name: "Moong Dal",
    aliases: ["moong dal","mung dal","yellow moong dal","dhuli moong dal","moong dal soup","moong daal","ek katori dal"],
    servingDescription: "1 katori (~150ml)",
    calories: 130, protein: 8, carbs: 20, fat: 2, fiber: 4, sugar: 1, sodium: 240,
    potassium: 310, iron: 1.8, magnesium: 42,
    cuisineType: "Indian",
    dishNotes: "Light yellow split moong dal. Easily digestible protein source.",
  },
  {
    name: "Masoor Dal",
    aliases: ["masoor dal","red lentil dal","lal dal","masoor daal","malka dal"],
    servingDescription: "1 katori (~150ml)",
    calories: 140, protein: 9, carbs: 22, fat: 2, fiber: 5, sugar: 1, sodium: 250,
    potassium: 330, iron: 2.4,
    cuisineType: "Indian",
    dishNotes: "Split red lentil curry. Rich in dietary iron and plant protein.",
  },
  {
    name: "Chana Dal",
    aliases: ["chana dal","bengal gram dal","chana daal","split chickpea dal"],
    servingDescription: "1 katori (~150ml)",
    calories: 160, protein: 9, carbs: 24, fat: 3, fiber: 6, sugar: 1, sodium: 260,
    potassium: 340, iron: 2.6, magnesium: 48,
    cuisineType: "Indian",
    dishNotes: "Bengal gram lentils. Low glycemic index and rich in complex carbs.",
  },
  {
    name: "Moong Dal Khichdi",
    aliases: ["moong dal khichdi","light khichdi","yellow khichdi","moong rice khichdi","daliya khichdi"],
    servingDescription: "1 plate (~250g cooked)",
    calories: 260, protein: 9, carbs: 48, fat: 3, fiber: 4, sugar: 1, sodium: 260,
    potassium: 240, iron: 1.7,
    cuisineType: "Indian",
    dishNotes: "Mild khichdi cooked with split yellow moong and rice. Soothing comfort meal.",
  },
  {
    name: "Bajra Roti",
    aliases: ["bajra roti","bajre ki roti","pearl millet roti","bajra bhakri","kambu roti","1 bajra roti"],
    servingDescription: "1 medium roti (~50g)",
    calories: 120, protein: 3, carbs: 24, fat: 2, fiber: 3, sugar: 0, sodium: 40,
    iron: 1.6, magnesium: 46,
    cuisineType: "Indian",
    dishNotes: "Gluten-free pearl millet flatbread. High in iron, zinc, and fiber.",
  },
  {
    name: "Jowar Roti",
    aliases: ["jowar roti","jowar bhakri","sorghum roti","jowar ki roti","jola rotti","1 jowar roti"],
    servingDescription: "1 medium roti (~50g)",
    calories: 110, protein: 3, carbs: 23, fat: 1, fiber: 3, sugar: 0, sodium: 30,
    potassium: 120, iron: 1.4,
    cuisineType: "Indian",
    dishNotes: "Gluten-free sorghum flatbread. Low GI staple ideal for diabetic diets.",
  },
  {
    name: "Ragi Roti",
    aliases: ["ragi roti","finger millet roti","nachni roti","ragi bhakri","ragi rotti","1 ragi roti"],
    servingDescription: "1 medium roti (~50g)",
    calories: 115, protein: 3, carbs: 24, fat: 1, fiber: 4, sugar: 0, sodium: 30,
    calcium: 160, iron: 1.5,
    cuisineType: "Indian",
    dishNotes: "Finger millet flatbread. Exceptionally rich in natural calcium and fiber.",
  },
  {
    name: "Missi Roti",
    aliases: ["missi roti","besan roti","chana flour roti","rajasthani missi roti","1 missi roti"],
    servingDescription: "1 medium roti (~50g)",
    calories: 130, protein: 5, carbs: 22, fat: 3, fiber: 3, sugar: 1, sodium: 110,
    iron: 1.6, magnesium: 36,
    cuisineType: "Indian",
    dishNotes: "Whole wheat and chickpea flour flatbread with spices. Higher protein than regular roti.",
  },
  {
    name: "Thepla",
    aliases: ["thepla","methi thepla","gujarati thepla","methi roti","masala thepla","1 thepla"],
    servingDescription: "1 piece (~40g)",
    calories: 110, protein: 3, carbs: 16, fat: 4, fiber: 2, sugar: 0, sodium: 120,
    iron: 1.2, vitaminA: 90,
    cuisineType: "Indian",
    dishNotes: "Spiced flatbread with fenugreek leaves. Long shelf-life Gujarati staple.",
  },
  {
    name: "Besan Chilla",
    aliases: ["besan chilla","besan cheela","chickpea pancake","besan puda","gram flour pancake","besan dosa"],
    servingDescription: "1 chilla (~80g)",
    calories: 140, protein: 6, carbs: 18, fat: 5, fiber: 3, sugar: 1, sodium: 180,
    iron: 1.8, magnesium: 38,
    cuisineType: "Indian",
    dishNotes: "Savory spiced chickpea flour pancake. High protein vegetarian breakfast.",
  },
  {
    name: "Moong Dal Chilla",
    aliases: ["moong dal chilla","moonglet","moong chilla","pudla","moong dal cheela","green gram chilla"],
    servingDescription: "1 chilla (~80g)",
    calories: 130, protein: 7, carbs: 18, fat: 3, fiber: 3, sugar: 1, sodium: 170,
    potassium: 220, iron: 1.9,
    cuisineType: "Indian",
    dishNotes: "Yellow/green moong batter pancake. High protein and low in fat.",
  },
  {
    name: "Sabudana Khichdi",
    aliases: ["sabudana khichdi","sago khichdi","tapioca pearl khichdi","vrat khichdi","upvas khichdi"],
    servingDescription: "1 plate (~200g)",
    calories: 340, protein: 4, carbs: 64, fat: 8, fiber: 2, sugar: 2, sodium: 190,
    potassium: 160,
    cuisineType: "Indian",
    dishNotes: "Tapioca pearls cooked with roasted peanuts and potatoes. Popular fasting dish.",
  },
  {
    name: "Pongal (Ven Pongal)",
    aliases: ["pongal","ven pongal","ghee pongal","khara pongal","south indian pongal"],
    servingDescription: "1 plate (~200g)",
    calories: 290, protein: 7, carbs: 48, fat: 8, fiber: 3, sugar: 1, sodium: 280,
    potassium: 190, iron: 1.4,
    cuisineType: "Indian",
    dishNotes: "South Indian comfort dish of rice and moong dal tempered with ghee, cumin, and black pepper.",
  },
  {
    name: "Appam",
    aliases: ["appam","kerala appam","palappam","hopper","rice appam","vellayappam"],
    servingDescription: "1 piece (~60g)",
    calories: 80, protein: 1, carbs: 16, fat: 1, fiber: 0, sugar: 1, sodium: 40,
    potassium: 60,
    cuisineType: "Indian",
    dishNotes: "Fermented rice pancake with soft center and crispy lacy edges. Usually paired with stew.",
  },
  {
    name: "Rasam",
    aliases: ["rasam","tomato rasam","pepper rasam","saaru","south indian rasam","charu"],
    servingDescription: "1 katori (~150ml)",
    calories: 50, protein: 2, carbs: 8, fat: 1, fiber: 1, sugar: 2, sodium: 340,
    potassium: 180, vitaminC: 14,
    cuisineType: "Indian",
    dishNotes: "Spicy and tangy South Indian tamarind-tomato soup. Excellent for digestion.",
  },
  {
    name: "Coconut Chutney",
    aliases: ["coconut chutney","nariyal chutney","white chutney","south indian chutney","idli chutney"],
    servingDescription: "2 tbsp (~30g)",
    calories: 60, protein: 1, carbs: 2, fat: 6, fiber: 1, sugar: 1, sodium: 110,
    potassium: 80,
    cuisineType: "Indian",
    dishNotes: "Fresh grated coconut ground with green chilies and roasted chana dal.",
  },
  {
    name: "Green Chutney",
    aliases: ["green chutney","mint chutney","pudina chutney","dhaniya chutney","coriander chutney","hari chutney"],
    servingDescription: "2 tbsp (~30g)",
    calories: 20, protein: 1, carbs: 3, fat: 0, fiber: 1, sugar: 1, sodium: 120,
    iron: 0.8, vitaminC: 12,
    cuisineType: "Indian",
    dishNotes: "Fresh mint and coriander leaves chutney. Rich in vitamin C and chlorophyll.",
  },
  {
    name: "Roasted Makhana",
    aliases: ["roasted makhana","makhana","fox nuts","phool makhana","roasted fox nuts","lotus seeds","makhane"],
    servingDescription: "1 cup / bowl (~30g)",
    calories: 110, protein: 3, carbs: 20, fat: 2, fiber: 2, sugar: 0, sodium: 50,
    calcium: 35, magnesium: 20,
    cuisineType: "Indian",
    dishNotes: "Lightly roasted lotus seeds in minimal ghee/oil. Low calorie healthy snack.",
  },
  {
    name: "Roasted Chana",
    aliases: ["roasted chana","bhuna chana","roasted black gram","chana snack","roasted chickpeas","sukha chana"],
    servingDescription: "1 fistful / small bowl (~30g)",
    calories: 120, protein: 6, carbs: 18, fat: 2, fiber: 5, sugar: 1, sodium: 30,
    iron: 2.1, magnesium: 34,
    cuisineType: "Indian",
    dishNotes: "Dry-roasted unpeeled black chickpeas. High satiety, high fiber portable snack.",
  },
  {
    name: "Bhel Puri",
    aliases: ["bhel puri","bhelpuri","mumbai bhel","sukha bhel","geela bhel","bhel"],
    servingDescription: "1 plate (~150g)",
    calories: 180, protein: 4, carbs: 32, fat: 4, fiber: 3, sugar: 5, sodium: 340,
    potassium: 180, iron: 1.5,
    cuisineType: "Indian",
    dishNotes: "Puffed rice tossed with vegetables, chutneys, and sev. Light street food snack.",
  },
  {
    name: "Pani Puri",
    aliases: ["pani puri","golgappe","gol gappe","puchka","batashe","gupchup","pani ke batashe","6 pani puri"],
    servingDescription: "6 pieces with spiced water (~150g)",
    calories: 150, protein: 3, carbs: 26, fat: 4, fiber: 2, sugar: 2, sodium: 380,
    iron: 1.1, vitaminC: 8,
    cuisineType: "Indian",
    dishNotes: "Hollow crisp puris filled with spiced mint water and potato/chickpea mash.",
  },
  {
    name: "Masala Omelette",
    aliases: ["masala omelette","masala omelet","indian omelette","egg omelette","2 egg omelette","desi omelette"],
    servingDescription: "2 eggs with veggies (~140g)",
    calories: 190, protein: 14, carbs: 4, fat: 13, fiber: 1, sugar: 1, sodium: 320,
    iron: 1.9, zinc: 1.3, vitaminB12: 1.1,
    cuisineType: "Indian",
    dishNotes: "Beaten eggs with chopped onions, tomatoes, green chilies, and cilantro.",
  },
  {
    name: "Paneer Bhurji",
    aliases: ["paneer bhurji","scrambled paneer","masala paneer bhurji","cottage cheese bhurji"],
    servingDescription: "1 katori (~150g)",
    calories: 260, protein: 16, carbs: 6, fat: 20, fiber: 1, sugar: 2, sodium: 340,
    calcium: 310, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Crumbled cottage cheese sautéed with onions, tomatoes, and spices. Very high protein.",
  },
  {
    name: "Soya Chunks Curry",
    aliases: ["soya chunks","soya chunks curry","soya bean curry","mealmaker curry","soya vadi","soya bhurji","soya"],
    servingDescription: "1 katori (~150g, ~40g dry soya)",
    calories: 180, protein: 20, carbs: 12, fat: 4, fiber: 6, sugar: 2, sodium: 360,
    calcium: 110, iron: 4.8, magnesium: 65,
    cuisineType: "Indian",
    dishNotes: "Textured vegetable protein in spiced curry. Outstanding vegetarian protein density.",
  },
  {
    name: "Fish Fry",
    aliases: ["fish fry","tawa fish fry","rava fish fry","fried fish indian","surmai fry","pomfret fry"],
    servingDescription: "1 medium piece (~100g)",
    calories: 180, protein: 22, carbs: 4, fat: 8, fiber: 0, sugar: 0, sodium: 360,
    zinc: 1.2, vitaminB12: 2.1,
    cuisineType: "Indian",
    dishNotes: "Marinated fish fillet shallow fried on tawa. Lean protein with omega-3 fatty acids.",
  },
  {
    name: "Keema Curry",
    aliases: ["keema curry","mutton keema","chicken keema","minced meat curry","keema matar"],
    servingDescription: "1 katori (~150g)",
    calories: 280, protein: 24, carbs: 6, fat: 18, fiber: 1, sugar: 2, sodium: 420,
    iron: 3.2, zinc: 3.8, vitaminB12: 1.4,
    cuisineType: "Indian",
    dishNotes: "Spiced minced meat curry with herbs and peas.",
  },
  {
    name: "Steamed Rice",
    aliases: ["steamed rice","white rice","boiled rice","plain rice","bhaat","chawal","1 cup rice","cooked rice"],
    servingDescription: "1 cup cooked (~150g)",
    calories: 195, protein: 4, carbs: 43, fat: 0, fiber: 1, sugar: 0, sodium: 5,
    potassium: 45,
    cuisineType: "Indian",
    dishNotes: "Plain boiled white rice. Standard staple for dals, curries, and rasam.",
  },
  {
    name: "Brown Rice",
    aliases: ["brown rice","cooked brown rice","brown chawal","unpolished rice","1 cup brown rice"],
    servingDescription: "1 cup cooked (~150g)",
    calories: 180, protein: 4, carbs: 38, fat: 2, fiber: 3, sugar: 0, sodium: 5,
    potassium: 110, magnesium: 55,
    cuisineType: "Indian",
    dishNotes: "Whole grain rice with bran intact. Higher fiber and micronutrients than white rice.",
  },
  {
    name: "Jeera Rice",
    aliases: ["jeera rice","cumin rice","zeera rice","ghee jeera rice"],
    servingDescription: "1 cup cooked (~150g)",
    calories: 220, protein: 4, carbs: 44, fat: 4, fiber: 1, sugar: 0, sodium: 180,
    iron: 0.8,
    cuisineType: "Indian",
    dishNotes: "Basmati rice tempered with cumin seeds and light ghee.",
  },
  {
    name: "Haldi Doodh",
    aliases: ["haldi doodh","turmeric milk","golden milk","haldi milk","hot turmeric milk"],
    servingDescription: "1 cup (~200ml)",
    calories: 140, protein: 6, carbs: 14, fat: 6, fiber: 0, sugar: 12, sodium: 80,
    calcium: 220, vitaminB12: 0.8,
    cuisineType: "Indian",
    dishNotes: "Warm milk with ground turmeric and black pepper. Traditional immunity booster.",
  },
  {
    name: "Coconut Water",
    aliases: ["coconut water","nariyal pani","daab","fresh coconut water","tender coconut water","1 coconut water"],
    servingDescription: "1 glass / tender coconut (~250ml)",
    calories: 45, protein: 2, carbs: 9, fat: 0, fiber: 2, sugar: 6, sodium: 60,
    potassium: 600, magnesium: 25,
    cuisineType: "Indian",
    dishNotes: "Natural isotonic electrolyte drink. High in potassium and very hydrating.",
  },
  {
    name: "Aamras",
    aliases: ["aamras","mango ras","mango pulp","fresh aamras","keri no ras"],
    servingDescription: "1 katori (~150ml)",
    calories: 160, protein: 1, carbs: 38, fat: 1, fiber: 2, sugar: 32, sodium: 10,
    potassium: 240, vitaminA: 420, vitaminC: 38,
    cuisineType: "Indian",
    dishNotes: "Pureed ripe mango pulp, traditionally served chilled with hot puris.",
  },
  {
    name: "Rasgulla",
    aliases: ["rasgulla","rosogolla","rasgulle","bengali rasgulla","chhena rasgulla","2 rasgulla"],
    servingDescription: "2 pieces (~80g)",
    calories: 160, protein: 4, carbs: 32, fat: 2, fiber: 0, sugar: 26, sodium: 30,
    calcium: 90,
    cuisineType: "Indian",
    dishNotes: "Spongy cottage cheese balls in light sugar syrup. Lower fat than gulab jamun.",
  },
  {
    name: "Makki Ki Roti",
    aliases: ["makki ki roti","makki roti","cornmeal flatbread","makke di roti","makka roti","1 makki ki roti"],
    servingDescription: "1 medium roti (~50g)",
    calories: 130, protein: 3, carbs: 26, fat: 2, fiber: 3, sugar: 0, sodium: 30,
    magnesium: 38, vitaminA: 60,
    cuisineType: "Indian",
    dishNotes: "Punjabi winter flatbread made from maize flour. Classically paired with Sarson Ka Saag and jaggery.",
  },
  {
    name: "Sarson Ka Saag",
    aliases: ["sarson ka saag","sarson saag","mustard greens curry","sarson da saag","mustard leaves sabzi"],
    servingDescription: "1 katori (~150g)",
    calories: 120, protein: 4, carbs: 10, fat: 7, fiber: 4, sugar: 2, sodium: 280,
    calcium: 180, iron: 3.2, vitaminA: 340,
    cuisineType: "Indian",
    dishNotes: "Traditional slow-cooked mustard and spinach greens curry tempered with garlic, ginger, and ghee.",
  },
  {
    name: "Kadai Paneer",
    aliases: ["kadai paneer","karahi paneer","kadhai paneer","capsicum paneer","kadai paneer gravy"],
    servingDescription: "1 katori (~150ml)",
    calories: 260, protein: 14, carbs: 10, fat: 18, fiber: 2, sugar: 3, sodium: 360,
    calcium: 260, vitaminC: 18,
    cuisineType: "Indian",
    dishNotes: "Cottage cheese and bell peppers cooked in a spicy freshly ground kadai coriander-chili masala.",
  },
  {
    name: "Shahi Paneer",
    aliases: ["shahi paneer","royal paneer","mughlai paneer","creamy paneer curry","shahi paneer masala"],
    servingDescription: "1 katori (~150ml)",
    calories: 290, protein: 12, carbs: 14, fat: 22, fiber: 2, sugar: 5, sodium: 350,
    calcium: 250, vitaminB12: 0.5,
    cuisineType: "Indian",
    dishNotes: "Rich Mughlai curry with paneer cubes in a fragrant, creamy nut and tomato-onion gravy.",
  },
  {
    name: "Sattu Sharbat (Namkeen)",
    aliases: ["sattu sharbat","sattu drink","namkeen sattu","sattu pani","bihari sattu","sattu juice"],
    servingDescription: "1 glass (~300ml, 30g sattu flour)",
    calories: 120, protein: 7, carbs: 18, fat: 2, fiber: 5, sugar: 1, sodium: 260,
    potassium: 280, iron: 2.2, magnesium: 36,
    cuisineType: "Indian",
    dishNotes: "Traditional roasted gram flour drink seasoned with roasted cumin, black salt, lemon, and green chilies.",
  },
  {
    name: "Sattu Paratha",
    aliases: ["sattu paratha","sattu ka paratha","bihari sattu paratha","sattu stuffed paratha","1 sattu paratha"],
    servingDescription: "1 paratha (~100g)",
    calories: 240, protein: 8, carbs: 36, fat: 7, fiber: 4, sugar: 1, sodium: 220,
    iron: 2.4, magnesium: 42,
    cuisineType: "Indian",
    dishNotes: "Whole wheat flatbread stuffed with spiced roasted gram flour mixture. High protein and fiber.",
  },
  {
    name: "Misal Pav",
    aliases: ["misal pav","kolhapuri misal","puneri misal","spicy misal pav","maharashtrian misal"],
    servingDescription: "1 serving (1 bowl sprouted misal + 2 pav)",
    calories: 380, protein: 12, carbs: 62, fat: 10, fiber: 8, sugar: 4, sodium: 580,
    potassium: 380, iron: 3.4,
    cuisineType: "Indian",
    dishNotes: "Spicy Maharashtrian sprouted moth bean curry topped with farsan, chopped onions, and served with pav.",
  },
  {
    name: "Pithla Bhakri",
    aliases: ["pithla bhakri","pitla bhakri","pithla","besan pithla","jhunka bhakri","zunkha bhakar"],
    servingDescription: "1 plate (1 katori besan pithla + 1 jowar bhakri)",
    calories: 320, protein: 11, carbs: 48, fat: 9, fiber: 7, sugar: 2, sodium: 360,
    iron: 2.8, magnesium: 55,
    cuisineType: "Indian",
    dishNotes: "Savory gram flour porridge seasoned with mustard, green chilies, and garlic, served with sorghum flatbread.",
  },
  {
    name: "Undhiyu",
    aliases: ["undhiyu","gujarati undhiyu","surti undhiyu","undhiyu sabzi","matka undhiyu"],
    servingDescription: "1 katori (~150g)",
    calories: 220, protein: 5, carbs: 26, fat: 11, fiber: 5, sugar: 4, sodium: 310,
    potassium: 320, vitaminC: 16,
    cuisineType: "Indian",
    dishNotes: "Gujarati mixed vegetable casserole with surti papdi, root veggies, and fenugreek muthiyas.",
  },
  {
    name: "Methi Muthiya",
    aliases: ["methi muthiya","muthiya","steamed muthiya","gujarati muthiya","methi dumplings","muthia"],
    servingDescription: "3 pieces steamed/sautéed (~90g)",
    calories: 140, protein: 5, carbs: 22, fat: 4, fiber: 3, sugar: 2, sodium: 240,
    iron: 1.8, vitaminA: 110,
    cuisineType: "Indian",
    dishNotes: "Steamed fenugreek and whole wheat/gram flour dumplings tempered with mustard and sesame seeds.",
  },
  {
    name: "Arbi Masala",
    aliases: ["arbi masala","arbi sabzi","sukhi arbi","colocasia curry","taro root sabzi","arvi masala"],
    servingDescription: "1 katori (~150g)",
    calories: 160, protein: 2, carbs: 28, fat: 5, fiber: 4, sugar: 1, sodium: 220,
    potassium: 340, vitaminC: 8,
    cuisineType: "Indian",
    dishNotes: "Spiced colocasia/taro root cooked with ajwain (carom seeds) and tangy amchur.",
  },
  {
    name: "Tindora Sabzi",
    aliases: ["tindora sabzi","tindora fry","ivy gourd sabzi","kundru sabzi","dondakaya fry","tindoora"],
    servingDescription: "1 katori (~150g)",
    calories: 110, protein: 2, carbs: 12, fat: 6, fiber: 3, sugar: 2, sodium: 200,
    calcium: 40, vitaminC: 14,
    cuisineType: "Indian",
    dishNotes: "Sautéed ivy gourd stir-fry cooked with cumin, coriander, and turmeric.",
  },
  {
    name: "Tori Sabzi",
    aliases: ["tori sabzi","tori ki sabzi","ridge gourd curry","turai sabzi","gilki sabzi","turai"],
    servingDescription: "1 katori (~150g)",
    calories: 85, protein: 2, carbs: 10, fat: 4, fiber: 3, sugar: 2, sodium: 180,
    potassium: 210, vitaminC: 12,
    cuisineType: "Indian",
    dishNotes: "Light and soothing ridge gourd curry cooked in mild tomato-onion gravy. Very low calorie.",
  },
  {
    name: "Sem Aloo Sabzi",
    aliases: ["sem aloo","sem ki sabzi","flat beans potato","valor aloo","sem aloo sabzi","chhitmi aloo"],
    servingDescription: "1 katori (~150g)",
    calories: 130, protein: 3, carbs: 20, fat: 5, fiber: 4, sugar: 2, sodium: 210,
    iron: 1.6, vitaminC: 15,
    cuisineType: "Indian",
    dishNotes: "Indian broad flat beans and diced potato stir-fry with home-style spices.",
  },
  {
    name: "Aloo Methi",
    aliases: ["aloo methi","alu methi","fenugreek potato sabzi","aloo methi dry","sukhi aloo methi"],
    servingDescription: "1 katori (~150g)",
    calories: 140, protein: 3, carbs: 22, fat: 5, fiber: 4, sugar: 1, sodium: 220,
    potassium: 320, iron: 2.4, vitaminA: 180,
    cuisineType: "Indian",
    dishNotes: "Nutritious dry stir-fry combining fresh bitter fenugreek leaves with diced potatoes.",
  },
  {
    name: "Paneer Roll / Frankie",
    aliases: ["paneer roll","paneer frankie","paneer wrap","paneer kathi roll","cottage cheese roll"],
    servingDescription: "1 roll (~180g)",
    calories: 340, protein: 15, carbs: 38, fat: 14, fiber: 3, sugar: 3, sodium: 480,
    calcium: 220, iron: 1.8,
    cuisineType: "Indian",
    dishNotes: "Spiced sautéed paneer chunks and crunchy salad wrapped in a roti with tangy mint chutney.",
  },
  {
    name: "Chicken Roll / Frankie",
    aliases: ["chicken roll","chicken frankie","chicken kathi roll","chicken wrap indian","murgh kathi roll"],
    servingDescription: "1 roll (~180g)",
    calories: 320, protein: 22, carbs: 36, fat: 10, fiber: 2, sugar: 2, sodium: 520,
    iron: 1.8, zinc: 1.9,
    cuisineType: "Indian",
    dishNotes: "Grilled marinated chicken pieces rolled in flatbread with sliced onions and chaat masala.",
  },
  {
    name: "Egg Roll",
    aliases: ["egg roll","kolkata egg roll","anda roll","single egg roll","egg frankie","egg wrap indian"],
    servingDescription: "1 roll with 1 egg (~150g)",
    calories: 280, protein: 11, carbs: 34, fat: 11, fiber: 2, sugar: 2, sodium: 440,
    iron: 1.5, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Layered paratha lined with an egg omelette and rolled with sliced cucumber, onions, and lemon.",
  },
  {
    name: "Dahi Vada",
    aliases: ["dahi vada","dahi bhalla","dahi bare","dahi wada","curd vada","dahi pakodi"],
    servingDescription: "2 pieces with curd and chutneys (~180g)",
    calories: 240, protein: 8, carbs: 34, fat: 8, fiber: 3, sugar: 12, sodium: 320,
    potassium: 220, calcium: 140,
    cuisineType: "Indian",
    dishNotes: "Lentil fritters soaked in creamy whisked curd topped with tamarind-jaggery chutney and roasted cumin.",
  },
  {
    name: "Aloo Tikki",
    aliases: ["aloo tikki","alu tikki","potato cutlet indian","aloo patties","crispy aloo tikki"],
    servingDescription: "2 pieces (~120g)",
    calories: 200, protein: 4, carbs: 32, fat: 7, fiber: 3, sugar: 1, sodium: 290,
    potassium: 280,
    cuisineType: "Indian",
    dishNotes: "Shallow-fried spiced potato patties served with mint and tamarind chutneys.",
  },
  {
    name: "Kachori (Dal / Pyaaz)",
    aliases: ["kachori","dal kachori","pyaaz kachori","khasta kachori","rajasthani kachori","1 kachori"],
    servingDescription: "1 piece (~80g)",
    calories: 220, protein: 4, carbs: 26, fat: 11, fiber: 2, sugar: 1, sodium: 260,
    iron: 1.2,
    cuisineType: "Indian",
    dishNotes: "Crisp flaky deep-fried pastry stuffed with spiced lentil or onion mixture.",
  },
  {
    name: "Jalebi",
    aliases: ["jalebi","jilapi","crispy jalebi","hot jalebi","desi ghee jalebi","3 jalebi"],
    servingDescription: "3 pieces (~60g)",
    calories: 220, protein: 2, carbs: 44, fat: 5, fiber: 0, sugar: 32, sodium: 40,
    cuisineType: "Indian",
    dishNotes: "Deep-fried spiral fermented flour batter soaked in saffron sugar syrup.",
  },
  {
    name: "Besan Ladoo",
    aliases: ["besan ladoo","besan laddu","gram flour ladoo","besan ke laddu","1 besan ladoo"],
    servingDescription: "1 piece (~40g)",
    calories: 180, protein: 4, carbs: 22, fat: 9, fiber: 1, sugar: 14, sodium: 20,
    iron: 1.1,
    cuisineType: "Indian",
    dishNotes: "Sweet confection made from roasted chickpea flour, ghee, sugar, and cardamom.",
  },
  {
    name: "Rasmalai",
    aliases: ["rasmalai","rossomalai","ras malai","kesar rasmalai","2 rasmalai"],
    servingDescription: "2 pieces in saffron milk (~120g)",
    calories: 240, protein: 7, carbs: 32, fat: 9, fiber: 0, sugar: 26, sodium: 80,
    calcium: 180, vitaminB12: 0.5,
    cuisineType: "Indian",
    dishNotes: "Flattened cottage cheese patties soaked in sweetened, thickened saffron-pistachio milk.",
  },
  {
    name: "Kaju Katli",
    aliases: ["kaju katli","kaju barfi","cashew fudge","kaju katli sweet","2 kaju katli"],
    servingDescription: "2 pieces (~30g)",
    calories: 130, protein: 3, carbs: 16, fat: 6, fiber: 1, sugar: 12, sodium: 10,
    magnesium: 24, zinc: 0.6,
    cuisineType: "Indian",
    dishNotes: "Diamond-shaped cashew nut confection made with finely ground cashews and sugar syrup.",
  },
  {
    name: "Moong Dal Halwa",
    aliases: ["moong dal halwa","moong halwa","yellow lentil halwa","shadi wala halwa"],
    servingDescription: "1 small katori (~100g)",
    calories: 280, protein: 6, carbs: 34, fat: 14, fiber: 2, sugar: 22, sodium: 50,
    potassium: 180, iron: 1.6,
    cuisineType: "Indian",
    dishNotes: "Rich Rajasthani dessert made by slow roasting split moong dal in ghee, milk, and sugar.",
  },
  {
    name: "Jaljeera",
    aliases: ["jaljeera","jal jeera","cumin water","jaljira","spicy jaljeera","1 glass jaljeera"],
    servingDescription: "1 glass (~250ml)",
    calories: 25, protein: 1, carbs: 5, fat: 0, fiber: 1, sugar: 2, sodium: 380,
    iron: 1.2, vitaminC: 10,
    cuisineType: "Indian",
    dishNotes: "Refreshing digestive drink flavored with roasted cumin, mint, dried mango, and black salt.",
  },
  {
    name: "Thandai",
    aliases: ["thandai","kesar thandai","badaam thandai","holi thandai","1 glass thandai"],
    servingDescription: "1 glass (~200ml)",
    calories: 190, protein: 6, carbs: 24, fat: 8, fiber: 1, sugar: 20, sodium: 70,
    calcium: 160, magnesium: 28,
    cuisineType: "Indian",
    dishNotes: "Traditional festive drink prepared with milk, almonds, fennel seeds, poppy seeds, and saffron.",
  },
  {
    name: "Solkadhi",
    aliases: ["solkadhi","sol kadhi","kokum curry","kokum coconut drink","konkani solkadhi"],
    servingDescription: "1 small glass (~150ml)",
    calories: 70, protein: 1, carbs: 4, fat: 6, fiber: 1, sugar: 2, sodium: 160,
    potassium: 140,
    cuisineType: "Indian",
    dishNotes: "Konkani digestive drink made from kokum extract and freshly pressed coconut milk tempered with garlic.",
  },
  {
    name: "Prawn Curry",
    aliases: ["prawn curry","jhinga curry","shrimp curry indian","goan prawn curry","malabar prawn curry","chingri curry"],
    servingDescription: "1 katori (~150ml, ~5–6 prawns)",
    calories: 210, protein: 20, carbs: 6, fat: 12, fiber: 1, sugar: 2, sodium: 420,
    zinc: 1.6, vitaminB12: 1.8,
    cuisineType: "Indian",
    dishNotes: "Succulent prawns simmered in a coconut-tamarind coastal gravy with aromatic spices.",
  },
  {
    name: "Machher Jhol",
    aliases: ["machher jhol","bengali fish stew","macher jhol","fish jhol","patla macher jhol","rohu jhol"],
    servingDescription: "1 bowl with 1 piece fish (~200g)",
    calories: 190, protein: 22, carbs: 6, fat: 9, fiber: 1, sugar: 1, sodium: 360,
    iron: 1.4, vitaminB12: 2.2,
    cuisineType: "Indian",
    dishNotes: "Light Bengali fish curry with potatoes and ridge gourd in a mild cumin-ginger gravy.",
  },
  {
    name: "Kosha Mangsho",
    aliases: ["kosha mangsho","bengali mutton curry","kasha mangsho","slow cooked mutton","spicy mutton kosha"],
    servingDescription: "1 katori (~150g, mutton)",
    calories: 340, protein: 26, carbs: 7, fat: 23, fiber: 1, sugar: 2, sodium: 460,
    iron: 3.6, zinc: 4.4, vitaminB12: 1.7,
    cuisineType: "Indian",
    dishNotes: "Rich, slow-cooked dark Bengali mutton curry packed with intense roasted spice flavors.",
  },
  {
    name: "Chicken Sukka",
    aliases: ["chicken sukka","kori sukka","chicken chukka","dry chicken roast","mangalorean chicken sukka"],
    servingDescription: "1 katori dry roasted (~150g)",
    calories: 260, protein: 28, carbs: 5, fat: 14, fiber: 2, sugar: 1, sodium: 410,
    iron: 1.9, zinc: 2.2, vitaminB12: 0.6,
    cuisineType: "Indian",
    dishNotes: "Mangalorean dry spiced chicken dish cooked with freshly grated roasted coconut and spices.",
  },
  {
    name: "Akki Rotti",
    aliases: ["akki rotti","akki roti","karnataka rice roti","rice flour flatbread","1 akki roti"],
    servingDescription: "1 piece (~80g)",
    calories: 160, protein: 3, carbs: 32, fat: 2, fiber: 2, sugar: 1, sodium: 140,
    potassium: 90, iron: 0.9,
    cuisineType: "Indian",
    dishNotes: "Karnataka specialty rice flour flatbread with onions, dill leaves, carrots, and green chilies.",
  },
  {
    name: "Bisi Bele Bath",
    aliases: ["bisi bele bath","bisi bele bhath","karnataka sambar rice","hot lentil rice","bbb rice"],
    servingDescription: "1 plate (~250g)",
    calories: 320, protein: 9, carbs: 54, fat: 7, fiber: 5, sugar: 3, sodium: 380,
    potassium: 290, iron: 2.2,
    cuisineType: "Indian",
    dishNotes: "Spicy Karnataka one-pot meal made of rice, toor dal, assorted vegetables, and special spice powder.",
  },
  {
    name: "Ragi Mudde",
    aliases: ["ragi mudde","ragi ball","ragi kali","finger millet ball","1 ragi mudde"],
    servingDescription: "1 ball (~150g)",
    calories: 170, protein: 4, carbs: 36, fat: 1, fiber: 5, sugar: 0, sodium: 20,
    calcium: 280, iron: 2.1,
    cuisineType: "Indian",
    dishNotes: "Traditional Karnataka staple made of cooked finger millet flour rolled into smooth, soft balls.",
  },
  {
    name: "Puttu with Kadala Curry",
    aliases: ["puttu with kadala curry","puttu kadala curry","puttu kadala","kerala puttu","steamed rice cylinder","puttu and chana","puttu","puttu curry"],
    servingDescription: "1 serving (1 cup puttu + 1 katori kadala)",
    calories: 380, protein: 12, carbs: 68, fat: 6, fiber: 8, sugar: 2, sodium: 360,
    potassium: 380, iron: 3.2,
    cuisineType: "Indian",
    dishNotes: "Kerala breakfast staple of steamed cylindrical ground rice layered with coconut, served with black chickpea curry.",
  },
  {
    name: "Idiyappam",
    aliases: ["idiyappam","string hoppers","noolappam","sevai","steamed rice noodles indian","3 idiyappam"],
    servingDescription: "3 pieces (~100g)",
    calories: 120, protein: 2, carbs: 26, fat: 1, fiber: 1, sugar: 0, sodium: 30,
    cuisineType: "Indian",
    dishNotes: "Delicate steamed rice flour noodles pressed into disc shapes. Popular in Kerala and Tamil Nadu.",
  },
  {
    name: "Curd Rice / Thayir Sadam",
    aliases: ["curd rice","thayir sadam","daddojanam","bagala bath","dahi bhat","dahi chawal"],
    servingDescription: "1 plate (~200g)",
    calories: 240, protein: 6, carbs: 38, fat: 7, fiber: 1, sugar: 4, sodium: 220,
    calcium: 160, vitaminB12: 0.4,
    cuisineType: "Indian",
    dishNotes: "Comforting South Indian dish of soft cooked rice mixed with curd, tempered with mustard, curry leaves, and ginger.",
  },
  {
    name: "Lemon Rice / Chitranna",
    aliases: ["lemon rice","chitranna","elamichai sadam","nimmakaya annam","turmeric lemon rice"],
    servingDescription: "1 plate (~200g)",
    calories: 280, protein: 5, carbs: 48, fat: 8, fiber: 2, sugar: 1, sodium: 280,
    iron: 1.1, vitaminC: 14,
    cuisineType: "Indian",
    dishNotes: "Tangy South Indian rice flavored with fresh lemon juice, turmeric, crunchy peanuts, and mustard seeds.",
  },
  {
    name: "Tamarind Rice / Puliyodharai",
    aliases: ["tamarind rice","puliyodharai","pulihora","puliyogare","temple tamarind rice"],
    servingDescription: "1 plate (~200g)",
    calories: 310, protein: 6, carbs: 52, fat: 9, fiber: 3, sugar: 3, sodium: 360,
    potassium: 190, iron: 1.8,
    cuisineType: "Indian",
    dishNotes: "Traditional South Indian spiced tangy rice tempered with tamarind paste, sesame oil, and peanuts.",
  },
  {
    name: "Bhatura",
    aliases: ["bhatura","bhatoora","single bhatura","plain bhatura","fried bhature","1 bhatura"],
    servingDescription: "1 piece (~80g)",
    calories: 230, protein: 5, carbs: 32, fat: 10, fiber: 1, sugar: 1, sodium: 210,
    cuisineType: "Indian",
    dishNotes: "Deep-fried leavened sourdough bread. High calorie and best paired with spiced chole.",
  },
  {
    name: "Kulcha",
    aliases: ["kulcha","amritsari kulcha","plain kulcha","matar kulcha bread","tawa kulcha","1 kulcha"],
    servingDescription: "1 piece (~100g)",
    calories: 220, protein: 6, carbs: 42, fat: 3, fiber: 2, sugar: 2, sodium: 280,
    iron: 1.3,
    cuisineType: "Indian",
    dishNotes: "Soft leavened North Indian flatbread baked in a tandoor or tawa.",
  },
  {
    name: "Luchi",
    aliases: ["luchi","bengali luchi","maida puri","fried luchi","2 luchi"],
    servingDescription: "2 pieces (~60g)",
    calories: 170, protein: 3, carbs: 22, fat: 8, fiber: 1, sugar: 0, sodium: 110,
    cuisineType: "Indian",
    dishNotes: "Deep-fried puffed flatbread made of refined flour (maida), popular in Bengali and Assamese cuisine.",
  },
  {
    name: "Masala Oats (Indian)",
    aliases: ["masala oats","indian oats","veggie oats","curry oats","saffola masala oats","oats khichdi bowl"],
    servingDescription: "1 bowl cooked (~200g, 40g oats + veggies)",
    calories: 170, protein: 6, carbs: 28, fat: 4, fiber: 5, sugar: 2, sodium: 320,
    potassium: 210, iron: 2.1, magnesium: 52,
    cuisineType: "Indian",
    dishNotes: "Rolled oats cooked with carrots, peas, tomatoes, and Indian savory spices. High soluble fiber.",
  },
];

// ── Hinglish quantity parsing ─────────────────────────────────────────────────

/** Converts common Hindi/Hinglish quantity words to a multiplier */
export function parseHinglishQuantity(query: string): { cleanQuery: string; multiplier: number } {
  const lower = query.toLowerCase().trim();

  // Map of Hindi/English number words to numeric values
  const numberWords: Record<string, number> = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "half": 0.5, "aadha": 0.5, "adha": 0.5,
  };

  let multiplier = 1;
  let cleanQuery = lower;

  // Match patterns like "2 roti", "ek plate dal chawal", "do samosa", "1 glass chaas"
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

    // Propagate notable micronutrients when present
    potassium: bestMatch.potassium !== undefined ? Math.round(bestMatch.potassium * m) : undefined,
    calcium: bestMatch.calcium !== undefined ? Math.round(bestMatch.calcium * m) : undefined,
    iron: bestMatch.iron !== undefined ? parseFloat((bestMatch.iron * m).toFixed(1)) : undefined,
    magnesium: bestMatch.magnesium !== undefined ? Math.round(bestMatch.magnesium * m) : undefined,
    zinc: bestMatch.zinc !== undefined ? parseFloat((bestMatch.zinc * m).toFixed(1)) : undefined,
    vitaminA: bestMatch.vitaminA !== undefined ? Math.round(bestMatch.vitaminA * m) : undefined,
    vitaminC: bestMatch.vitaminC !== undefined ? Math.round(bestMatch.vitaminC * m) : undefined,
    vitaminD: bestMatch.vitaminD !== undefined ? parseFloat((bestMatch.vitaminD * m).toFixed(1)) : undefined,
    vitaminB12: bestMatch.vitaminB12 !== undefined ? parseFloat((bestMatch.vitaminB12 * m).toFixed(1)) : undefined,
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
