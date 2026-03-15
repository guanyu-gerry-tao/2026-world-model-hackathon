import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMockPanoramaBuffer } from "../mock/panorama.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROMPTS_MD = fs.readFileSync(path.join(__dirname, "../prompts/panorama.md"), "utf-8");

function extractPrompt(tag) {
  const match = PROMPTS_MD.match(new RegExp(`${tag}_START\\r?\\n([\\s\\S]*?)\\r?\\n${tag}_END`));
  if (!match) throw new Error(`Prompt block ${tag} not found in panorama.md`);
  return match[1].trim();
}

const PROMPT_B = extractPrompt("PROMPT_B");

/**
 * Generate a 360° equirectangular panorama using OpenAI gpt-image-1.
 *
 * Step 1: Use gpt-4o to analyze input photos and produce a rich scene description.
 * Step 2: Use gpt-image-1 with the photos + crafted prompt to generate the panorama.
 *
 * @param {object} options
 * @param {string[]} options.userPhotoPaths  - paths to user photos (1–8)
 * @param {string}   [options.description]  - optional style hint
 * @returns {Buffer} PNG image buffer
 */
export async function generatePanorama({ userPhotoPaths, description = "" }) {
  if (process.env.USE_MOCK === "true") {
    console.log("[openai] MOCK mode — returning fake panorama buffer");
    await new Promise((r) => setTimeout(r, 1000));
    return getMockPanoramaBuffer();
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // ── Step 1: Analyze photos with gpt-4o ──────────────────────────────────
  console.log(`[openai] Step 1: Analyzing ${userPhotoPaths.length} photos with gpt-4o...`);

  const visionMessages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `You are analyzing reference photos for a 360° panorama generation task.
Study these photos and describe in detail:
1. Architectural styles, building types, and structural elements present
2. Color palette — dominant colors, accent colors, lighting quality
3. Cultural and environmental context (e.g. Japanese street, temple, urban commercial)
4. Atmosphere and mood
5. Specific visual elements worth incorporating (signs, lanterns, trees, shop fronts, etc.)

Be specific and descriptive. This description will be used to generate a new panorama inspired by these photos.`,
        },
        ...userPhotoPaths.map((p) => ({
          type: "image_url",
          image_url: {
            url: `data:${getMime(p)};base64,${fs.readFileSync(p).toString("base64")}`,
            detail: "low",
          },
        })),
      ],
    },
  ];

  const analysisRes = await client.chat.completions.create({
    model: "gpt-4o",
    messages: visionMessages,
    max_tokens: 800,
  });

  const sceneDescription = analysisRes.choices[0].message.content;
  console.log("[openai] Scene analysis complete.");

  // ── Step 2: Generate panorama with gpt-image-1 ──────────────────────────
  console.log("[openai] Step 2: Generating panorama with gpt-image-1...");

  const finalPrompt = PROMPT_B.replace(
    "{{DESCRIPTION}}",
    description || "A bright vivid daytime street scene, photorealistic, full of color, empty of people"
  ) + `\n\nScene reference extracted from input photos:\n${sceneDescription}`;

  const imageRes = await client.images.generate({
    model: "gpt-image-1",
    prompt: finalPrompt,
    size: "1536x1024",
    quality: "high",
  });

  const b64 = imageRes.data[0].b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  console.log("[openai] Panorama generated successfully.");
  return Buffer.from(b64, "base64");
}

function getMime(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext] ?? "image/jpeg";
}
