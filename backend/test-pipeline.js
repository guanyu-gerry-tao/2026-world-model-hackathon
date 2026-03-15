/**
 * Quick end-to-end test for the pipeline API.
 * Run with: node test-pipeline.js
 *
 * Prerequisites:
 *   1. npm install
 *   2. cp .env.example .env   (USE_MOCK=true is the default)
 *   3. node server.js         (in another terminal)
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";

// Create a tiny sample photo to upload (just a copy of the mock PNG)
const MOCK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==",
  "base64"
);
const SAMPLE_PHOTO = path.resolve("uploads/_test_sample.png");
fs.writeFileSync(SAMPLE_PHOTO, MOCK_PNG);

async function main() {
  console.log("── CityWalk Pipeline Test ──\n");

  // ── Health check ────────────────────────────────────────────────────────
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log("✓ Health:", health);

  // ── POST /pipeline/generate ──────────────────────────────────────────────
  console.log("\n→ Submitting generation job...");
  const form = new FormData();

  // Attach sample photo as a Blob
  const blob = new Blob([MOCK_PNG], { type: "image/png" });
  form.append("photos", blob, "sample.png");
  form.append("description", "Tokyo Shibuya nighttime street — test run");
  form.append("cityId", "test-city-" + Date.now().toString(36));
  form.append("marbleModel", "Marble 0.1-mini");

  const startRes = await fetch(`${BASE}/pipeline/generate`, {
    method: "POST",
    body: form,
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    console.error("✗ Generate failed:", startRes.status, text);
    process.exit(1);
  }

  const { jobId } = await startRes.json();
  console.log(`✓ Job started: ${jobId}`);

  // ── Poll until done ──────────────────────────────────────────────────────
  console.log("\n→ Polling status...");
  let job;
  while (true) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await fetch(`${BASE}/pipeline/status/${jobId}`);
    job = await statusRes.json();
    console.log(`  status=${job.status}  progress=${job.progress ?? "-"}`);

    if (job.status === "done" || job.status === "error") break;
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (job.status === "error") {
    console.error("\n✗ Pipeline failed:", job.error);
    process.exit(1);
  }

  console.log("\n✓ Pipeline complete!");
  console.log("  cityId   :", job.result.cityId);
  console.log("  panorama :", job.result.files.panorama);
  console.log("  spz      :", job.result.files.spz);
  console.log("  spz URLs :", job.result.remoteUrls.spz500k ?? "(mock — no real URL)");

  // Verify files exist on disk
  const panoExists = fs.existsSync(job.result.files.panorama);
  const spzExists  = fs.existsSync(job.result.files.spz);
  console.log(`\n  panorama.png on disk : ${panoExists ? "✓" : "✗"}`);
  console.log(`  world.spz on disk    : ${spzExists  ? "✓" : "✗"}`);

  if (!panoExists || !spzExists) {
    console.error("\n✗ Output files missing!");
    process.exit(1);
  }

  console.log("\n All checks passed. Backend is working correctly.\n");
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err.message);
  process.exit(1);
}).finally(() => {
  fs.rmSync(SAMPLE_PHOTO, { force: true });
});
