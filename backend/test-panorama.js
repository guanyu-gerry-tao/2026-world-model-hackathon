/**
 * Test script for POST /pipeline/panorama (Gemini only)
 *
 * Prerequisites:
 *   1. GEMINI_API_KEY set in .env
 *   2. node server.js (in another terminal)
 *
 * Usage:
 *   node test-panorama.js --dir uploads/tokyomock
 *   node test-panorama.js --photo a.jpg --photo b.jpg
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";

// Minimal valid PNG (2x2 pixels) used when no --photo is given
const DUMMY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==",
  "base64"
);

// Parse args
const args = process.argv.slice(2);
const qualityIdx = args.indexOf("--quality");
const quality = qualityIdx !== -1 ? args[qualityIdx + 1] : "pro";
const providerIdx = args.indexOf("--provider");
const provider = providerIdx !== -1 ? args[providerIdx + 1] : "gemini";

// --photo a.jpg --photo b.jpg  OR  --dir /path/to/folder
const photoPaths = [];
const dirIdx = args.indexOf("--dir");
if (dirIdx !== -1) {
  const dir = args[dirIdx + 1];
  const files = fs.readdirSync(dir)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .slice(0, 8)
    .map((f) => path.join(dir, f));
  photoPaths.push(...files);
} else {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--photo" && args[i + 1]) photoPaths.push(args[++i]);
  }
}

async function main() {
  console.log("── Gemini Panorama API Test ──\n");

  // Health check
  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error("✗ Server not reachable at", BASE);
    console.error("  Start it with: node server.js");
    process.exit(1);
  }
  console.log("✓ Server is up");

  // Build form
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const cityId = "test-gemini-" + timestamp;
  const form = new FormData();

  if (photoPaths.length > 0) {
    for (const p of photoPaths) {
      const buf = fs.readFileSync(p);
      const mime = p.match(/\.(jpg|jpeg)$/i) ? "image/jpeg" : p.match(/\.webp$/i) ? "image/webp" : "image/png";
      form.append("photos", new Blob([buf], { type: mime }), path.basename(p));
    }
    console.log(`✓ Using ${photoPaths.length} photo(s): ${photoPaths.join(", ")}`);
  } else {
    form.append("photos", new Blob([DUMMY_PNG], { type: "image/png" }), "dummy.png");
    console.log("✓ Using dummy photo (no --photo provided)");
  }
  form.append("cityId", cityId);
  form.append("quality", quality);
  form.append("provider", provider);

  console.log(`  cityId: ${cityId}\n`);

  // POST /pipeline/panorama
  console.log("→ Calling POST /pipeline/panorama ...");
  const startRes = await fetch(`${BASE}/pipeline/panorama`, {
    method: "POST",
    body: form,
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    console.error("✗ Request failed:", startRes.status, text);
    process.exit(1);
  }

  const { jobId } = await startRes.json();
  console.log(`✓ Job started: ${jobId}\n`);

  // Poll status
  console.log("→ Polling status...");
  let job;
  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`${BASE}/pipeline/status/${jobId}`);
    job = await statusRes.json();
    console.log(`  status=${job.status}  progress=${job.progress ?? "-"}`);
    if (job.status === "done" || job.status === "error") break;
  }

  // Result
  if (job.status === "error") {
    console.error("\n✗ Gemini failed:", job.error);
    process.exit(1);
  }

  const { panoramaPath, panoramaUrl, panoramaRawUrl } = job.result;
  const exists = fs.existsSync(panoramaPath);
  const sizeKB = exists ? (fs.statSync(panoramaPath).size / 1024).toFixed(1) : 0;
  const rawPath = panoramaPath.replace("panorama.png", "panorama_raw.png");
  const rawExists = fs.existsSync(rawPath);
  const rawSizeKB = rawExists ? (fs.statSync(rawPath).size / 1024).toFixed(1) : 0;

  console.log("\n✓ Panorama generated!");
  if (rawExists) {
    console.log(`  raw  : ${rawPath}  (${rawSizeKB} KB)`);
    console.log(`         http://localhost:3001${panoramaRawUrl}`);
  }
  console.log(`  refined : ${panoramaPath}  (${sizeKB} KB)`);
  console.log(`            http://localhost:3001${panoramaUrl}`);

  if (!exists || sizeKB < 1) {
    console.error("\n✗ Output file missing or empty!");
    process.exit(1);
  }

  console.log("\n  All checks passed. Gemini API is working.\n");
  console.log(`  Next step: POST /pipeline/world with { "cityId": "${cityId}" }\n`);
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err.message);
  process.exit(1);
});
