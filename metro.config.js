const { getDefaultConfig } = require("expo/metro-config");
const https = require("https");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyBuf = Buffer.from(body, "utf-8");
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: { ...headers, "Content-Length": bodyBuf.length },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf-8") })
        );
      }
    );
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

async function geminiProxy(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, { error: "GEMINI_API_KEY not configured on server." });
  }
  try {
    const body = await readBody(req);
    const { model, payload } = JSON.parse(body);
    const targetModel = model || "gemini-flash-latest";
    const upstream = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
      { "Content-Type": "application/json" },
      JSON.stringify(payload)
    );
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(upstream.body);
  } catch (err) {
    sendJson(res, 500, { error: "Proxy error: " + err.message });
  }
}

async function analyzeActivityProxy(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, { error: "OPENAI_API_KEY not configured on server." });
  }
  try {
    const raw = await readBody(req);
    const { sport, duration, intensity, weightKg, age } = JSON.parse(raw);
    const sportStr = String(sport ?? "").trim().slice(0, 100);
    const durationNum = Math.min(Math.max(Math.round(Number(duration)), 1), 600);
    const safeIntensity = ["light", "moderate", "intense"].includes(intensity) ? intensity : null;
    const weightNum = Math.min(Math.max(Number(weightKg) || 70, 20), 300);
    const ageNum = Math.min(Math.max(Math.round(Number(age) || 25), 10), 120);
    if (!sportStr || !safeIntensity || !durationNum) {
      return sendJson(res, 400, { error: "Missing or invalid required fields" });
    }
    const prompt = `You are a professional sports nutritionist and fitness coach.\nActivity: ${sportStr}\nDuration: ${durationNum}\nIntensity: ${safeIntensity}\nUser weight: ${weightNum} kg\nUser age: ${ageNum} years\n\nCalculate and return ONLY a valid JSON object with no markdown and no explanation:\n{"calories_burned":<number>,"hydration_needed_ml":<number>,"hydration_glasses":<number>,"protein_needed_g":<number>,"carbs_needed_g":<number>,"recovery_time_hours":<number>,"heart_rate_zone":"fat burn","intensity_level":"","health_benefits":["","",""],"tips":["",""],"post_activity_meal":"","sport_category":"cardio"}`;
    const upstream = await httpsPost(
      "https://api.openai.com/v1/chat/completions",
      { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 500, temperature: 0.3 })
    );
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(upstream.body);
  } catch (err) {
    sendJson(res, 500, { error: "Proxy error: " + err.message });
  }
}

async function weeklyInsightProxy(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, { error: "OPENAI_API_KEY not configured on server." });
  }
  try {
    const raw = await readBody(req);
    const { activitySummary } = JSON.parse(raw);
    if (!activitySummary || typeof activitySummary !== "string") {
      return sendJson(res, 400, { error: "Missing activitySummary" });
    }
    const upstream = await httpsPost(
      "https://api.openai.com/v1/chat/completions",
      { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: `You are a personal fitness coach. Based on this week's activity data, write ONE short (2-3 sentence) personalized coaching insight. Be specific, encouraging, and actionable. Data: ${activitySummary.slice(0, 2000)}` }], max_tokens: 150, temperature: 0.7 })
    );
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(upstream.body);
  } catch (err) {
    sendJson(res, 500, { error: "Proxy error: " + err.message });
  }
}

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url === "/api/gemini" && req.method === "POST") {
        return geminiProxy(req, res);
      }
      if (req.url === "/api/analyze-activity" && req.method === "POST") {
        return analyzeActivityProxy(req, res);
      }
      if (req.url === "/api/weekly-insight" && req.method === "POST") {
        return weeklyInsightProxy(req, res);
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
