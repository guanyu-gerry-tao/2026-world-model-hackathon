import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { generatePanorama as generatePanoramaGemini, describePhotos } from "../services/gemini-panorama.js";
import { generatePanorama as generatePanoramaOpenAI } from "../services/openai-panorama.js";
import { runMarblePipeline, downloadSpz } from "../services/marble.js";

// Resize buffer to exact 2:1 equirectangular (4096x2048) for Marble
async function toEquirectangular(buffer) {
  return sharp(buffer).resize(4096, 2048, { fit: "fill" }).png().toBuffer();
}

const router = express.Router();

// Multer: store uploads in /uploads, keep original extension
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
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
 * POST /pipeline/panorama
 *
 * Step 1: Generate panorama with Gemini only.
 *
 * Multipart form fields:
 *   photos       - 1–8 image files (required)
 *   template     - city template panorama (optional, triggers Mode A)
 *   description  - text description (optional)
 *   cityId       - output folder name, e.g. "tokyo-shibuya" (optional)
 *   quality      - "fast" | "pro" (optional, default "fast")
 *
 * Returns: { jobId }
 * Poll GET /pipeline/status/:jobId
 * Result: { cityId, panoramaUrl, panoramaPath }
 */
router.post(
  "/panorama",
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
      provider = "gemini",
      describe = "false",
    } = req.body;

    runPanoramaJob({ jobId, photos, template: req.files?.template?.[0], description, cityId, quality, provider, describe: describe === "true" });

    res.json({ jobId });
  }
);

/**
 * POST /pipeline/world
 *
 * Step 2: Generate 3D world from panorama with Marble.
 *
 * JSON body:
 *   cityId       - must match the cityId from the panorama step (required)
 *   marbleModel  - "Marble 0.1-mini" | "Marble 0.1-plus" (optional, default "Marble 0.1-mini")
 *
 * Returns: { jobId }
 * Poll GET /pipeline/status/:jobId
 * Result: { cityId, operationId, spzPath, remoteUrls }
 */
router.post("/world", async (req, res) => {
  const { cityId, marbleModel = "Marble 0.1-mini", textPrompt = "" } = req.body;
  if (!cityId) {
    return res.status(400).json({ error: "cityId is required" });
  }

  const panoramaPath = path.resolve("output", cityId, "panorama.png");
  if (!fs.existsSync(panoramaPath)) {
    return res.status(404).json({ error: `Panorama not found for cityId: ${cityId}. Run /pipeline/panorama first.` });
  }

  const jobId = createJob();
  runWorldJob({ jobId, cityId, panoramaPath, marbleModel, textPrompt });

  res.json({ jobId });
});

/**
 * GET /pipeline/status/:jobId
 */
router.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ---------------------------------------------------------------------------
// Async workers
// ---------------------------------------------------------------------------

async function runPanoramaJob({ jobId, photos, template, description, cityId, quality, provider = "gemini", describe = false }) {
  const uploadedPaths = photos.map((f) => f.path);
  const templatePath = template?.path ?? null;

  try {
    // Describe each photo for music generation (opt-in via describe=true)
    let photoDescriptions = null;
    if (describe) {
      updateJob(jobId, { status: "generating_panorama", progress: "Describing photos..." });
      photoDescriptions = await describePhotos(uploadedPaths);
    }

    updateJob(jobId, { status: "generating_panorama", progress: `Calling ${provider === "openai" ? "OpenAI" : "Gemini"}...` });

    const rawBuffer = provider === "openai"
      ? await generatePanoramaOpenAI({ userPhotoPaths: uploadedPaths, description })
      : await generatePanoramaGemini({ userPhotoPaths: uploadedPaths, templatePath, description, quality });

    const outputDir = path.resolve("output", cityId);
    fs.mkdirSync(outputDir, { recursive: true });

    // Save raw (pre-refinement) for comparison
    const rawPath = path.join(outputDir, "panorama_raw.png");
    fs.writeFileSync(rawPath, rawBuffer);
    console.log(`[pipeline] Raw panorama saved → ${rawPath}`);

    // Auto-refine disabled
    let panoramaBuffer = rawBuffer;

    // Resize to exact 2:1 equirectangular (2048x1024) so Marble treats it as a full 360°
    updateJob(jobId, { progress: "Resizing to equirectangular..." });
    panoramaBuffer = await toEquirectangular(panoramaBuffer);

    const panoramaPath = path.join(outputDir, "panorama.png");
    fs.writeFileSync(panoramaPath, panoramaBuffer);
    console.log(`[pipeline] Panorama saved (2048x1024) → ${panoramaPath}`);

    const descriptionsPath = path.join(outputDir, "photo_descriptions.json");
    fs.writeFileSync(descriptionsPath, JSON.stringify(photoDescriptions, null, 2));
    console.log(`[pipeline] Photo descriptions saved → ${descriptionsPath}`);

    updateJob(jobId, {
      status: "done",
      progress: null,
      result: {
        cityId,
        panoramaPath,
        panoramaUrl: `/output/${cityId}/panorama.png`,
        panoramaRawUrl: `/output/${cityId}/panorama_raw.png`,
        descriptionsUrl: `/output/${cityId}/photo_descriptions.json`,
        photoDescriptions,
      },
    });
  } catch (err) {
    console.error(`[pipeline] Panorama job ${jobId} failed:`, err.message);
    updateJob(jobId, { status: "error", error: err.message });
  } finally {
    for (const p of uploadedPaths) fs.rmSync(p, { force: true });
    if (templatePath) fs.rmSync(templatePath, { force: true });
  }
}

async function runWorldJob({ jobId, cityId, panoramaPath, marbleModel, textPrompt = "" }) {
  try {
    updateJob(jobId, { status: "generating_world", progress: "Uploading to Marble..." });

    const panoramaBuffer = await toEquirectangular(fs.readFileSync(panoramaPath));

    const { spzUrls, colliderUrl, panoUrl, operationId, worldId, worldUrl, caption, thumbnailUrl } = await runMarblePipeline(panoramaBuffer, {
      displayName: cityId,
      model: marbleModel,
      textPrompt,
      onProgress: (stage) => updateJob(jobId, { progress: `Marble: ${stage}` }),
    });

    updateJob(jobId, { status: "downloading", progress: "Downloading .spz..." });

    const outputDir = path.resolve("output", cityId);
    const spzPath = path.join(outputDir, "world.spz");
    if (spzUrls["500k"]) {
      await downloadSpz(spzUrls["500k"], spzPath);
    } else {
      fs.writeFileSync(spzPath, Buffer.alloc(0));
      console.log("[pipeline] MOCK: wrote empty world.spz placeholder");
    }

    updateJob(jobId, {
      status: "done",
      progress: null,
      result: {
        cityId,
        operationId,
        worldId,
        worldUrl,
        caption,
        thumbnailUrl,
        spzPath,
        remoteUrls: {
          spz500k: spzUrls["500k"],
          spzFullRes: spzUrls["full_res"],
          collider: colliderUrl,
          pano: panoUrl,
        },
      },
    });

    console.log(`[pipeline] World job ${jobId} complete.`);
  } catch (err) {
    console.error(`[pipeline] World job ${jobId} failed:`, err.message);
    updateJob(jobId, { status: "error", error: err.message });
  }
}

export default router;
