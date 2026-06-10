/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * - POST /api/gemini → server-side Gemini proxy (key never sent to client)
 * - POST /api/analyze-activity → server-side activity analysis backed by Gemini
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Robust zero-dependency .env parser (BUG-05)
try {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join("=").trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (err) {
  console.warn("Could not load .env file:", err.message);
}

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
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

async function handleGeminiProxy(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Gemini API key not configured on server." }));
    return;
  }

  try {
    const body = await readBody(req, 10 * 1024 * 1024);
    const { model, payload } = JSON.parse(body);
    const targetModel = model || "gemini-2.5-flash";
    const upstream = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
      { "Content-Type": "application/json" },
      JSON.stringify(payload)
    );

    if (upstream.status === 400 || upstream.status === 401 || upstream.status === 403) {
      console.error(`[GeminiProxy] Auth error ${upstream.status}:`, upstream.body.slice(0, 500));
      res.writeHead(upstream.status, { "content-type": "application/json" });
      res.end(JSON.stringify({
        error: "Food scanning is not working. This is usually caused by an invalid or missing API key. Please check your Gemini API key.",
        upstream_status: upstream.status,
      }));
      return;
    }

    res.writeHead(upstream.status, { "content-type": "application/json" });
    res.end(upstream.body);
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy error: " + err.message }));
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

// Serves landing page html
function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

function readBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) { reject(new Error("Request body too large")); return; }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleAnalyzeActivity(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Gemini API key not configured on server" }));
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid request body" }));
    return;
  }

  const { sport, duration, intensity, weightKg, age } = body;

  const sportStr = String(sport ?? "").trim().slice(0, 100);
  const durationNum = Math.min(Math.max(Math.round(Number(duration)), 1), 600);
  const safeIntensity = ["light", "moderate", "intense"].includes(intensity) ? intensity : null;
  const weightNum = Math.min(Math.max(Number(weightKg) || 70, 20), 300);
  const ageNum = Math.min(Math.max(Math.round(Number(age) || 25), 10), 120);

  if (!sportStr || !safeIntensity || !durationNum) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid required fields" }));
    return;
  }

  const prompt = `You are a professional sports nutritionist and fitness coach.
Activity: ${sportStr}
Duration: ${durationNum}
Intensity: ${safeIntensity}
User weight: ${weightNum} kg
User age: ${ageNum} years

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

  try {
    const upstream = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { "Content-Type": "application/json" },
      JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    );

    res.writeHead(upstream.status, { "content-type": "application/json" });
    res.end(upstream.body);
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "AI request failed: " + err.message }));
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/api/gemini" && req.method === "POST") {
    return handleGeminiProxy(req, res);
  }

  if (req.method === "POST" && pathname === "/api/analyze-activity") {
    return handleAnalyzeActivity(req, res);
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
