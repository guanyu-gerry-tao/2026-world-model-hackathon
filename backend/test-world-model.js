/**
 * Generate a 3D world from a panorama that was already produced by /pipeline/panorama.
 *
 * Pass the cityId returned by test-panorama.js (or any prior panorama job).
 * world.spz lands in the same output/<cityId>/ folder as the panorama.
 *
 * Prerequisites:
 *   1. MARBLE_API_KEY set in .env
 *   2. node server.js running in another terminal
 *   3. A completed panorama job (output/<cityId>/panorama.png must exist)
 *
 * Usage:
 *   node test-world-model.js --city test-gemini-20260314T120000
 *   node test-world-model.js --city test-gemini-20260314T120000 --marble-model "Marble 0.1-plus"
 *   node test-world-model.js --city test-gemini-20260314T120000 --text-prompt "Cinematic city, golden hour, empty streets"
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const POLL_INTERVAL_MS = 5000;

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const cityId      = argValue("--city");
const marbleModel = argValue("--marble-model") ?? "Marble 0.1-mini";
const textPrompt  = argValue("--text-prompt")  ?? "";

if (!cityId) {
  console.error("Usage: node test-world-model.js --city <cityId>");
  console.error("  cityId is printed at the end of test-panorama.js");
  process.exit(1);
}

const panoramaPath = path.resolve("output", cityId, "panorama.png");
if (!fs.existsSync(panoramaPath)) {
  console.error(`✗ Panorama not found: ${panoramaPath}`);
  console.error("  Run test-panorama.js first to generate the panorama.");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function poll(jobId) {
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE}/pipeline/status/${jobId}`);
    const job = await res.json();
    console.log(`  status=${job.status}  progress=${job.progress ?? "-"}`);
    if (job.status === "done" || job.status === "error") return job;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("── World Model Test ──\n");
  console.log(`  cityId       : ${cityId}`);
  console.log(`  panorama     : ${panoramaPath}`);
  console.log(`  marble-model : ${marbleModel}`);
  if (textPrompt) console.log(`  text-prompt  : ${textPrompt}`);
  console.log();

  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error("✗ Server not reachable at", BASE, "— start with: node server.js");
    process.exit(1);
  }
  console.log("✓ Server is up\n");

  console.log("→ POST /pipeline/world ...");
  const res = await fetch(`${BASE}/pipeline/world`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cityId, marbleModel, textPrompt }),
  });
  if (!res.ok) {
    console.error("✗ Failed:", res.status, await res.text());
    process.exit(1);
  }
  const { jobId } = await res.json();
  console.log(`  jobId: ${jobId}\n`);
  console.log("→ Polling...");

  const job = await poll(jobId);
  if (job.status === "error") {
    console.error("\n✗ World generation failed:", job.error);
    process.exit(1);
  }

  const { spzPath, remoteUrls, operationId, worldUrl, caption, thumbnailUrl } = job.result;
  const spzSizeMB = fs.existsSync(spzPath) ? (fs.statSync(spzPath).size / 1024 / 1024).toFixed(1) : "0";

  console.log(`\n✓ Done! All files in: output/${cityId}/`);
  console.log(`  panorama_raw.png  ← Gemini original`);
  console.log(`  panorama.png      ← Gemini refined`);
  console.log(`  world.spz         ← Marble 3D world  (${spzSizeMB} MB)`);
  console.log(`\n  operation  : ${operationId}`);
  if (worldUrl)            console.log(`  world url  : ${worldUrl}`);
  if (thumbnailUrl)        console.log(`  thumbnail  : ${thumbnailUrl}`);
  if (remoteUrls.spz500k)  console.log(`  spz 500k   : ${remoteUrls.spz500k}`);
  if (remoteUrls.collider) console.log(`  collider   : ${remoteUrls.collider}`);
  if (remoteUrls.pano)     console.log(`  pano       : ${remoteUrls.pano}`);
  if (caption)             console.log(`\n  caption:\n  ${caption}`);
  console.log();
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err.message);
  process.exit(1);
});
