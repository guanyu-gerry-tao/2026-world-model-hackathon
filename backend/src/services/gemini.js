import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import { getMockPanoramaBuffer } from "../mock/panorama.js";

const MODEL_FAST = "gemini-3.1-flash-image-preview";   // Nano Banana 2, 8-12s
const MODEL_PRO  = "gemini-3-pro-image";                // Nano Banana Pro, slower

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
 * @returns {Buffer} PNG image buffer of the generated panorama
 */
export async function generatePanorama({ userPhotoPaths, templatePath, description = "", quality = "fast" }) {
  if (process.env.USE_MOCK === "true") {
    console.log("[gemini] MOCK mode — returning fake panorama buffer");
    await new Promise((r) => setTimeout(r, 1000)); // simulate latency
    return getMockPanoramaBuffer();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = quality === "pro" ? MODEL_PRO : MODEL_FAST;

  const isTemplateMode = !!templatePath;
  const parts = [];

  // Build the prompt
  if (isTemplateMode) {
    parts.push({
      text: `You are an expert panorama compositor.
You will receive:
1. A 360° equirectangular city street panorama (the base scene)
2. Several personal photos taken by a user

Your task: Naturally embed the user's photos into the city scene as if they belong there.
Placement ideas:
- Posters on walls or shop fronts
- Displays in shop windows
- Hanging decorations near lamp posts
- Billboards or signage

Rules:
- Maintain the original city scene's perspective, lighting, and style
- Photos should look like they belong in the scene, not like cutouts
- CRITICAL: Remove ALL human figures and faces from the entire scene — no people, no crowds, no silhouettes, no body parts. Replace them with environmental elements (lights, signs, objects, textures).
- When processing user photos: if a photo contains people or faces, extract ONLY the background and non-human elements — landscapes, animals, plants, architecture, sky, ground, water, objects. Discard all human subjects entirely. A group photo at a beach becomes just the beach. A selfie in front of a temple becomes just the temple.
- Output a single 360° equirectangular panorama image (2:1 aspect ratio)
- Output image only, no text

City description context: ${description || "Tokyo Shibuya crossing, nighttime, neon lights, empty streets"}`,
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
      text: `You are an expert at creating immersive 360° panoramic worlds.
You will receive several personal photos from a user.

Your task: Generate a brand-new 360° equirectangular panoramic scene (2:1 aspect ratio) that incorporates the visual elements, colors, and mood from these photos.

The photos control the visual content and structure of the world.
The user's description controls the overall style and atmosphere.

Rules:
- Output must be a proper equirectangular projection (2:1 aspect ratio)
- The scene should be immersive and walkable
- Incorporate the user's photos as natural elements in the scene
- CRITICAL: Remove ALL human figures and faces — no people, no crowds, no silhouettes, no body parts anywhere in the scene.
- When processing user photos: if a photo contains people or faces, extract ONLY the non-human elements — landscapes, animals, plants, architecture, sky, ground, water, objects. Discard all human subjects entirely. Use only the scenery, colors, and mood from those photos.
- Output image only, no text

Description: ${description || "A dreamlike memory world blending personal moments, empty of people"}`,
    });
  }

  // Add user photos
  for (const photoPath of userPhotoPaths) {
    const data = fs.readFileSync(photoPath).toString("base64");
    const ext = photoPath.split(".").pop().toLowerCase();
    parts.push({
      inlineData: {
        mimeType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
        data,
      },
    });
  }

  console.log(`[gemini] Generating panorama (${isTemplateMode ? "Mode A: template" : "Mode B: scratch"}) with ${userPhotoPaths.length} photos...`);

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
  });

  // Extract image from response
  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      console.log(`[gemini] Panorama generated successfully.`);
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  // If no image was returned, Gemini may have returned text explaining a refusal
  const textPart = candidate.content.parts.find((p) => p.text);
  throw new Error(`Gemini did not return an image. Response: ${textPart?.text ?? "unknown"}`);
}
