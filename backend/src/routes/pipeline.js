import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { generatePanorama } from "../services/gemini.js";
import { runMarblePipeline, downloadSpz } from "../services/marble.js";

const router = express.Router();

// Multer: store uploads in /uploads, keep original extension
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// In-memory job store (good enough for hackathon)
const jobs = new Map();

function createJob() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  jobs.set(id, { id, status: "pending", progress: null, result: null, error: null });
  return id;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...patch });
}

/**
 * POST /pipeline/generate
 *
 * Multipart form fields:
 *   photos        - 1–8 image files (required)
 *   template      - city template panorama (optional, triggers Mode A)
 *   description   - text description of the world (optional)
 *   cityId        - output folder name, e.g. "tokyo-shibuya" (optional)
 *   quality       - "fast" | "pro" (optional, default "fast")
 *   marbleModel   - "Marble 0.1-mini" | "Marble 0.1-plus" (optional)
 *
 * Returns: { jobId }
 * Then poll GET /pipeline/status/:jobId
 */
router.post(
  "/generate",
  upload.fields([
    { name: "photos", maxCount: 8 },
    { name: "template", maxCount: 1 },
  ]),
  async (req, res) => {
    const photos = req.files?.photos;
    if (!photos || photos.length === 0) {
      return res.status(400).json({ error: "At least one photo is required" });
    }

    const jobId = createJob();
    const {
      description = "",
      cityId = "city-" + jobId,
      quality = "fast",
      marbleModel = "Marble 0.1-mini",
    } = req.body;

    // Run pipeline async, don't await here
    runPipeline({ jobId, photos, template: req.files?.template?.[0], description, cityId, quality, marbleModel });

    res.json({ jobId });
  }
);

/**
 * GET /pipeline/status/:jobId
 * Returns current job status and result when done.
 */
router.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

/**
 * The actual async pipeline
 */
async function runPipeline({ jobId, photos, template, description, cityId, quality, marbleModel }) {
  const uploadedPaths = photos.map((f) => f.path);
  const templatePath = template?.path ?? null;

  try {
    // ── Step 1: Generate panorama with Gemini ──────────────────────────────
    updateJob(jobId, { status: "generating_panorama", progress: "Calling Gemini..." });

    const panoramaBuffer = await generatePanorama({
      userPhotoPaths: uploadedPaths,
      templatePath,
      description,
      quality,
    });

    // Save panorama for inspection
    const outputDir = path.resolve("output", cityId);
    fs.mkdirSync(outputDir, { recursive: true });
    const panoramaPath = path.join(outputDir, "panorama.png");
    fs.writeFileSync(panoramaPath, panoramaBuffer);
    console.log(`[pipeline] Panorama saved → ${panoramaPath}`);

    // ── Step 2: Marble pipeline ────────────────────────────────────────────
    updateJob(jobId, { status: "generating_world", progress: "Uploading to Marble..." });

    const { spzUrls, colliderUrl, panoUrl, operationId } = await runMarblePipeline(panoramaBuffer, {
      displayName: cityId,
      model: marbleModel,
      onProgress: (stage) => updateJob(jobId, { progress: `Marble: ${stage}` }),
    });

    // ── Step 3: Download .spz ──────────────────────────────────────────────
    updateJob(jobId, { status: "downloading", progress: "Downloading .spz..." });

    const spzPath = path.join(outputDir, "world.spz");
    if (spzUrls["500k"]) {
      await downloadSpz(spzUrls["500k"], spzPath);
    } else {
      // Mock mode: write a placeholder file
      fs.writeFileSync(spzPath, Buffer.alloc(0));
      console.log("[pipeline] MOCK: wrote empty world.spz placeholder");
    }

    // ── Done ───────────────────────────────────────────────────────────────
    const result = {
      cityId,
      operationId,
      files: {
        panorama: panoramaPath,
        spz: spzPath,
      },
      remoteUrls: {
        spz500k: spzUrls["500k"],
        spzFullRes: spzUrls["full_res"],
        collider: colliderUrl,
        pano: panoUrl,
      },
    };

    updateJob(jobId, { status: "done", progress: null, result });
    console.log(`[pipeline] Job ${jobId} complete.`);
  } catch (err) {
    console.error(`[pipeline] Job ${jobId} failed:`, err.message);
    updateJob(jobId, { status: "error", error: err.message });
  } finally {
    // Clean up temp upload files
    for (const p of uploadedPaths) {
      fs.rmSync(p, { force: true });
    }
    if (templatePath) fs.rmSync(templatePath, { force: true });
  }
}

export default router;
