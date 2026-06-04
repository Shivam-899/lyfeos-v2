// Quick inline test of the Hinglish/Indian food parsing logic
// Simulates what indianFoodDatabase.ts does

const INDIAN_FOOD_DB = [
  { name: "Dal Chawal",       aliases: ["dal chawal","daal chawal","dal rice","dal chaawal","dal-chawal","dal + rice","rice and dal","dal aur chawal"], servingDescription: "1 plate", calories: 450, protein: 15, carbs: 82, fat: 6, fiber: 8, sugar: 3, sodium: 380, dishNotes: "Classic meal." },
  { name: "Roti (Chapati)",   aliases: ["roti","chapati","chapatti","chappati","phulka","plain roti","whole wheat roti"], servingDescription: "1 medium roti", calories: 100, protein: 3, carbs: 18, fat: 2, fiber: 2, sugar: 0, sodium: 90, dishNotes: "40g per roti." },
  { name: "Aloo Sabzi",       aliases: ["aloo sabzi","potato sabzi","aloo ki sabzi","jeera aloo","aloo gobi","potato curry","aloo masala"], servingDescription: "1 katori", calories: 150, protein: 3, carbs: 28, fat: 4, fiber: 3, sugar: 2, sodium: 200, dishNotes: "Simple potato dish." },
  { name: "Samosa",           aliases: ["samosa","samose","fried samosa","aloo samosa","potato samosa"], servingDescription: "1 piece", calories: 130, protein: 3, carbs: 18, fat: 6, fiber: 2, sugar: 1, sodium: 200, dishNotes: "130 kcal per piece." },
  { name: "Chicken Biryani",  aliases: ["chicken biryani","biryani","murgh biryani","hyderabadi biryani","dum biryani"], servingDescription: "1 plate", calories: 550, protein: 32, carbs: 68, fat: 14, fiber: 2, sugar: 2, sodium: 620, dishNotes: "~350g plate." },
  { name: "Chole Bhature",    aliases: ["chole bhature","chhole bhature","chole bhatoore","bhature chole"], servingDescription: "1 serving", calories: 480, protein: 14, carbs: 68, fat: 18, fiber: 7, sugar: 3, sodium: 580, dishNotes: "High calorie street food." },
  { name: "Poha",             aliases: ["poha","aloo poha","batata poha","kanda poha","flattened rice","beaten rice","pohe"], servingDescription: "1 plate", calories: 250, protein: 5, carbs: 48, fat: 4, fiber: 2, sugar: 2, sodium: 250, dishNotes: "Light breakfast." },
  { name: "Rajma Chawal",     aliases: ["rajma chawal","rajma rice","rajma dal chawal","rajma","rajma curry with rice"], servingDescription: "1 plate", calories: 480, protein: 18, carbs: 88, fat: 5, fiber: 10, sugar: 3, sodium: 420, dishNotes: "High fiber." },
];

const numberWords = { "ek":1,"do":2,"teen":3,"char":4,"paanch":5,"one":1,"two":2,"three":3,"four":4,"five":5,"half":0.5,"aadha":0.5 };

function parseHinglishQuantity(query) {
  let lower = query.toLowerCase().trim();
  let multiplier = 1;
  let cleanQuery = lower;
  for (const [word, val] of Object.entries(numberWords)) {
    if (new RegExp(`\\b${word}\\b`,"i").test(cleanQuery)) {
      multiplier = val;
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${word}\\b`,"i"),"").trim();
      break;
    }
  }
  const numMatch = cleanQuery.match(/^(\d+(?:\.\d+)?)\s+/);
  if (numMatch) { multiplier = parseFloat(numMatch[1]); cleanQuery = cleanQuery.slice(numMatch[0].length).trim(); }
  cleanQuery = cleanQuery.replace(/\b(plate|katori|glass|cup|piece|pieces|serving|servings|ka|ki|ke|with|aur|and|ek|se|mera|meri)\b/gi,"").replace(/\s+/g," ").trim();
  return { cleanQuery, multiplier };
}

function searchIndianFoodDB(rawQuery) {
  if (!rawQuery || rawQuery.trim().length < 2) return null;
  const { cleanQuery, multiplier } = parseHinglishQuantity(rawQuery);
  const query = cleanQuery.toLowerCase().trim();
  if (!query) return null;
  let bestMatch = null, bestScore = 0;
  for (const entry of INDIAN_FOOD_DB) {
    for (const alias of entry.aliases) {
      if (alias === query || alias.includes(query) || query.includes(alias)) {
        const score = alias === query ? 100 : alias.includes(query) ? 80 : 60;
        if (score > bestScore) { bestScore = score; bestMatch = entry; }
      }
      const aliasWords = alias.split(" ");
      const queryWords = query.split(" ").filter(w => w.length > 2);
      const matchCount = queryWords.filter(qw => aliasWords.some(aw => aw.includes(qw)||qw.includes(aw))).length;
      if (matchCount > 0 && queryWords.length > 0) {
        const score = (matchCount / queryWords.length) * 50;
        if (score > bestScore && score >= 30) { bestScore = score; bestMatch = entry; }
      }
    }
  }
  if (!bestMatch || bestScore < 30) return null;
  const m = Math.max(0.25, Math.min(multiplier, 5));
  return { name: bestMatch.name, calories: Math.round(bestMatch.calories*m), confidence: "high", source: "local-db" };
}

const tests = [
  "ek plate dal chawal",
  "2 roti sabzi",
  "Samosa",
  "chicken biryani",
  "Chole Bhature",
  "poha",
  "daal rice",
  "do samosa",
  "rajma",
  "aloo gobi",
];

console.log("=== Indian Food DB Test ===\n");
for (const t of tests) {
  const r = searchIndianFoodDB(t);
  if (r) console.log(`✅ "${t}" => ${r.name} (${r.calories} kcal)`);
  else    console.log(`❌ "${t}" => NO MATCH`);
}
