import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMockPanoramaBuffer } from "../mock/panorama.js";

const MODEL_FAST = "gemini-3.1-flash-image-preview";
const MODEL_PRO  = "gemini-3-pro-image-preview";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_MD = fs.readFileSync(path.join(__dirname, "../prompts/panorama.md"), "utf-8");

function extractPrompt(tag) {
  const match = PROMPTS_MD.match(new RegExp(`${tag}_START\\n([\\s\\S]*?)\\n${tag}_END`));
  if (!match) throw new Error(`Prompt block ${tag} not found in panorama.md`);
  return match[1].trim();
}

const PROMPT_A = extractPrompt("PROMPT_A");
const PROMPT_B = extractPrompt("PROMPT_B");
const PROMPT_REFINE = extractPrompt("PROMPT_REFINE");
const PROMPT_DESCRIBE = extractPrompt("PROMPT_DESCRIBE");

/**
 * Generate a 360° equirectangular panorama from user photos.
 *
 * Mode A — city template + photo fusion:
 *   Pass templateImagePath (city street panorama) + userPhotos (personal shots)
 *   → Gemini merges photos into the city scene (walls, windows, lamp posts)
 *
 * Mode B — from scratch:
 *   Pass only userPhotos + a text description
 *   → Gemini generates a brand-new 360° world
 *
 * @param {object} options
 * @param {string[]} options.userPhotoPaths    - paths to user's personal photos (3-8)
 * @param {string}   [options.templatePath]   - path to city template panorama (Mode A)
 * @param {string}   [options.description]    - text description of the desired world
 * @param {"fast"|"pro"} [options.quality]    - model quality (default: "fast")
 * @param {boolean}      [options.refine]     - run a refinement pass after generation (default: false)
 * @returns {Buffer} PNG image buffer of the generated panorama
 */
export async function generatePanorama({ userPhotoPaths, templatePath, description = "", quality = "fast", refine = false }) {
  if (process.env.USE_MOCK === "true") {
    console.log("[gemini] MOCK mode — returning fake panorama buffer");
    await new Promise((r) => setTimeout(r, 1000)); // simulate latency
    return getMockPanoramaBuffer();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
  const model = quality === "pro" ? MODEL_PRO : MODEL_FAST;

  const isTemplateMode = !!templatePath;
  const parts = [];

  // Build the prompt
  if (isTemplateMode) {
    parts.push({
      text: PROMPT_A.replace("{{DESCRIPTION}}", description || "immersive personal memory world, dreamlike atmosphere, empty of people"),
    });

    // Add city template as first image
    const templateData = fs.readFileSync(templatePath).toString("base64");
    const templateExt = templatePath.split(".").pop().toLowerCase();
    parts.push({
      inlineData: {
        mimeType: templateExt === "jpg" || templateExt === "jpeg" ? "image/jpeg" : "image/png",
        data: templateData,
      },
    });
  } else {
    parts.push({
      text: PROMPT_B.replace("{{DESCRIPTION}}", description || "A photorealistic street scene, empty of people"),
    });
  }

  // Add user photos
  for (const photoPath of userPhotoPaths) {
    const data = fs.readFileSync(photoPath).toString("base64");
    const ext = photoPath.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    parts.push({
      inlineData: {
        mimeType: mimeMap[ext] ?? "image/jpeg",
        data,
      },
    });
  }

  console.log(`[gemini] Generating panorama (${isTemplateMode ? "Mode A: template" : "Mode B: scratch"}) with ${userPhotoPaths.length} photos...`);

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  // Extract image from response
  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      const buffer = Buffer.from(part.inlineData.data, "base64");
      console.log(`[gemini] Panorama generated successfully.`);
      if (refine) {
        return refinePanorama({ buffer, ai, model });
      }
      return buffer;
    }
  }

  // If no image was returned, Gemini may have returned text explaining a refusal
  const textPart = candidate.content.parts.find((p) => p.text);
  throw new Error(`Gemini did not return an image. Response: ${textPart?.text ?? "unknown"}`);
}

/**
 * Run a refinement pass on an existing panorama buffer to fix artifacts.
 *
 * @param {object} options
 * @param {Buffer} options.buffer            - panorama image buffer to refine
 * @param {GoogleGenAI} [options.ai]         - reuse existing client (optional)
 * @param {string} [options.model]           - model ID (default: fast)
 * @returns {Buffer} refined PNG image buffer
 */
export async function refinePanorama({ buffer, ai, model }) {
  if (process.env.USE_MOCK === "true") {
    console.log("[gemini] MOCK mode — skipping refinement");
    return buffer;
  }

  const client = ai ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
  const targetModel = model ?? MODEL_FAST;

  console.log("[gemini] Running refinement pass...");

  const response = await client.models.generateContent({
    model: targetModel,
    contents: [{
      parts: [
        { text: PROMPT_REFINE },
        { inlineData: { mimeType: "image/png", data: buffer.toString("base64") } },
      ],
    }],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Gemini refinement returned no candidates");

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      console.log("[gemini] Refinement pass complete.");
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  const textPart = candidate.content.parts.find((p) => p.text);
  throw new Error(`Gemini refinement did not return an image. Response: ${textPart?.text ?? "unknown"}`);
}

/**
 * Describe each photo with a mood/atmosphere text for music generation.
 *
 * @param {string[]} photoPaths - paths to user photos
 * @returns {{ filename: string, description: string }[]}
 */
export async function describePhotos(photoPaths) {
  if (process.env.USE_MOCK === "true") {
    return photoPaths.map((p) => ({ filename: path.basename(p), description: "Mock description." }));
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });
  const results = [];

  for (const photoPath of photoPaths) {
    const data = fs.readFileSync(photoPath).toString("base64");
    const ext = photoPath.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: [{
        parts: [
          { text: PROMPT_DESCRIBE },
          { inlineData: { mimeType: mimeMap[ext] ?? "image/jpeg", data } },
        ],
      }],
      config: { responseModalities: ["TEXT"] },
    });

    const text = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";
    results.push({ filename: path.basename(photoPath), description: text });
    console.log(`[gemini] Described ${path.basename(photoPath)}: ${text.slice(0, 60)}...`);
  }

  return results;
}
