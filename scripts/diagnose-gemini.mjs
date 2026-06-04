/**
 * Gemini API Diagnostic Script
 * Run: node scripts/diagnose-gemini.mjs
 *
 * Tests:
 *  1. .env file loading
 *  2. API key validity (text-only ping — no image needed)
 *  3. Exact HTTP status + full error body from Gemini
 *  4. Network reachability to generativelanguage.googleapis.com
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..");

// ─── 1. Read and parse .env file ─────────────────────────────────────────────
console.log("\n════════════════════════════════════════════════════");
console.log("  GEMINI API DIAGNOSTICS");
console.log("════════════════════════════════════════════════════\n");

const envPath = resolve(ROOT, ".env");
console.log(`[1] .env file check`);
console.log(`    Path : ${envPath}`);
console.log(`    Exists: ${existsSync(envPath)}`);

let envVars = {};
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    envVars[key] = val;
  }
  console.log(`    Lines parsed: ${lines.length}`);
  console.log(`    Variables found: ${Object.keys(envVars).join(", ")}`);
} else {
  console.log("    ❌ .env file NOT FOUND");
}

// ─── 2. Identify keys ─────────────────────────────────────────────────────────
const SERVER_KEY  = envVars["GEMINI_API_KEY"]         || process.env.GEMINI_API_KEY         || "";
const CLIENT_KEY  = envVars["EXPO_PUBLIC_GEMINI_API_KEY"] || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const PROXY_URL   = envVars["EXPO_PUBLIC_DEV_PROXY_URL"] || "";
const DOMAIN      = envVars["EXPO_PUBLIC_DOMAIN"]     || "";

function maskKey(k) {
  if (!k) return "(empty / not set)";
  if (k.length < 10) return "(too short: " + k + ")";
  return k.slice(0, 8) + "..." + k.slice(-4) + ` [length: ${k.length}]`;
}

function keyFormat(k) {
  if (!k) return "❌ MISSING";
  if (k.startsWith("AIzaSy")) return "✅ Valid Gemini format (starts with AIzaSy)";
  if (k.startsWith("AQ."))    return "⚠️  Non-standard format (starts with AQ.) — likely invalid";
  return "⚠️  Unknown format — may not be a valid Gemini key";
}

console.log("\n[2] API Key Status");
console.log(`    GEMINI_API_KEY (server)         : ${maskKey(SERVER_KEY)}`);
console.log(`    Format check                    : ${keyFormat(SERVER_KEY)}`);
console.log(`    EXPO_PUBLIC_GEMINI_API_KEY (client): ${maskKey(CLIENT_KEY)}`);
console.log(`    Format check                    : ${keyFormat(CLIENT_KEY)}`);
console.log(`    EXPO_PUBLIC_DEV_PROXY_URL       : ${PROXY_URL || "(not set — direct API calls will be used)"}`);
console.log(`    EXPO_PUBLIC_DOMAIN              : ${DOMAIN || "(not set)"}`);

// ─── 3. Route resolution ──────────────────────────────────────────────────────
console.log("\n[3] Request routing in app");
if (PROXY_URL) {
  console.log(`    → Proxy mode: requests go to ${PROXY_URL}/api/gemini`);
  console.log(`       then server/serve.js uses GEMINI_API_KEY to call Gemini`);
} else if (DOMAIN) {
  console.log(`    → Proxy mode via domain: https://${DOMAIN}/api/gemini`);
} else {
  console.log(`    → Direct mode: app calls Gemini directly using EXPO_PUBLIC_GEMINI_API_KEY`);
  console.log(`       Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`);
}

// ─── 4. Live API tests ────────────────────────────────────────────────────────
const MODEL = "gemini-1.5-flash";
const ENDPOINT = `/v1beta/models/${MODEL}:generateContent`;

function httpsPost(apiKey, body) {
  return new Promise((resolve) => {
    const bodyBuf = Buffer.from(body, "utf-8");
    const req = https.request(
      {
        hostname: "generativelanguage.googleapis.com",
        path: `${ENDPOINT}?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": bodyBuf.length,
        },
        timeout: 12000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf-8") })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: null, body: "TIMEOUT after 12s" });
    });
    req.on("error", (err) => resolve({ status: null, body: "NETWORK ERROR: " + err.message }));
    req.write(bodyBuf);
    req.end();
  });
}

const TEST_PAYLOAD = JSON.stringify({
  contents: [{ parts: [{ text: "Say exactly: OK" }] }],
  generationConfig: { maxOutputTokens: 10, temperature: 0 },
});

async function testKey(label, key) {
  console.log(`\n[4] Live API test — ${label}`);
  console.log(`    Key    : ${maskKey(key)}`);
  console.log(`    Format : ${keyFormat(key)}`);
  console.log(`    URL    : https://generativelanguage.googleapis.com${ENDPOINT}?key=<key>`);

  if (!key) {
    console.log("    Result : ❌ SKIPPED — key is empty");
    return;
  }

  console.log("    Sending test prompt: 'Say exactly: OK'");
  const result = await httpsPost(key, TEST_PAYLOAD);

  console.log(`    HTTP Status : ${result.status ?? "N/A (network/timeout)"}`);

  let parsed = null;
  try { parsed = JSON.parse(result.body); } catch {}

  if (result.status === 200 && parsed?.candidates) {
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log(`    ✅ SUCCESS — Gemini responded: "${text.trim()}"`);
    console.log(`    → Key is valid, endpoint is reachable, API is working`);
    return;
  }

  // Error diagnostics
  const errMsg = parsed?.error?.message ?? "";
  const errCode = parsed?.error?.code ?? result.status;
  const errStatus = parsed?.error?.status ?? "";

  console.log(`    ❌ FAILED`);
  console.log(`    Full response body:\n${JSON.stringify(parsed ?? result.body, null, 4)}`);

  if (result.status === null) {
    console.log(`    Diagnosis: NETWORK ISSUE — cannot reach Gemini servers`);
    console.log(`               Check internet connection or firewall settings`);
  } else if (result.status === 400) {
    if (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID")) {
      console.log(`    Diagnosis: ❌ INVALID API KEY — key rejected by Google`);
      console.log(`               The key format or value is wrong`);
      console.log(`               Get a valid key at: https://aistudio.google.com/app/apikey`);
    } else {
      console.log(`    Diagnosis: Bad request (400) — ${errMsg}`);
    }
  } else if (result.status === 401) {
    console.log(`    Diagnosis: ❌ UNAUTHORIZED (401) — key is missing or malformed`);
  } else if (result.status === 403) {
    if (errMsg.includes("billing") || errMsg.includes("quota")) {
      console.log(`    Diagnosis: ❌ BILLING / QUOTA ISSUE (403)`);
      console.log(`               Key is valid but billing may be disabled or quota exceeded`);
    } else {
      console.log(`    Diagnosis: ❌ FORBIDDEN (403) — key may lack required permissions`);
      console.log(`               Error: ${errMsg}`);
    }
  } else if (result.status === 404) {
    console.log(`    Diagnosis: ❌ MODEL NOT FOUND (404) — "${MODEL}" may be unavailable in your region`);
    console.log(`               Try: gemini-1.5-flash-latest or gemini-pro`);
  } else if (result.status === 429) {
    console.log(`    Diagnosis: ⚠️  RATE LIMITED (429) — too many requests, key is valid but quota exceeded temporarily`);
  } else if (result.status === 503) {
    console.log(`    Diagnosis: ⚠️  SERVICE UNAVAILABLE (503) — Gemini API temporarily down`);
  } else {
    console.log(`    Diagnosis: Unknown error ${result.status}: ${errStatus} — ${errMsg}`);
  }
}

// Test both keys
await testKey("SERVER KEY (GEMINI_API_KEY)", SERVER_KEY);
await testKey("CLIENT KEY (EXPO_PUBLIC_GEMINI_API_KEY)", CLIENT_KEY);

// ─── 5. Summary ───────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════════════════");
console.log("  SUMMARY");
console.log("════════════════════════════════════════════════════");
console.log(`  .env file found      : ${existsSync(envPath) ? "Yes ✅" : "No ❌"}`);
console.log(`  SERVER_KEY format    : ${keyFormat(SERVER_KEY)}`);
console.log(`  CLIENT_KEY format    : ${keyFormat(CLIENT_KEY)}`);
console.log(`  App routing in dev   : ${PROXY_URL ? "Via proxy → " + PROXY_URL : "Direct → generativelanguage.googleapis.com"}`);
console.log(`  Key the app will use : ${PROXY_URL ? "GEMINI_API_KEY (server)" : "EXPO_PUBLIC_GEMINI_API_KEY (client)"}`);
console.log("════════════════════════════════════════════════════\n");
