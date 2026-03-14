# API Reference

> Last updated: 2026-03-13

---

## 1. World Labs Marble API

### Basic Info

- **Base URL:** `https://api.worldlabs.ai/marble/v1`
- **Authentication:** Add `WLT-Api-Key: YOUR_API_KEY` to request headers
- **Content-Type:** `application/json`

### Model Selection

| Model | Use case | Generation time | Cost |
|-------|---------|-----------------|------|
| `Marble 0.1-plus` | High quality, use for demo | ~5 minutes | 1500–1600 credits |
| `Marble 0.1-mini` | Quick drafts, testing | 30–45 seconds | 150–330 credits |

### Step 1: Upload media file

```http
POST /marble/v1/media-assets:prepare_upload
WLT-Api-Key: YOUR_KEY
Content-Type: application/json

{}
```

Returns:
```json
{
  "upload_url": "https://storage.googleapis.com/...",
  "asset_id": "asset_abc123"
}
```

Then PUT the image to `upload_url` (upload raw binary, Content-Type: image/png).

### Step 2: Generate world

```http
POST /marble/v1/worlds:generate
WLT-Api-Key: YOUR_KEY
Content-Type: application/json

{
  "display_name": "tokyo-shibuya-demo",
  "world_prompt": {
    "type": "image",
    "image_prompt": {
      "image_url": "https://storage.googleapis.com/...",
      "is_pano": true
    }
  },
  "model": "Marble 0.1-plus"
}
```

Returns:
```json
{
  "operation_id": "op_xyz789",
  "done": false
}
```

> `is_pano: true` tells Marble the input is an equirectangular panorama (360°), enabling higher spatial accuracy.

### Step 3: Poll status

```http
GET /marble/v1/operations/{operation_id}
WLT-Api-Key: YOUR_KEY
```

- `done: false` → keep waiting (recommended poll interval: every 15 seconds)
- `done: true` → generation complete

### Step 4: Get download links

When complete, the response body includes:

```json
{
  "done": true,
  "response": {
    "assets": {
      "splats": {
        "spz_urls": {
          "500k": "https://...",
          "100k": "https://...",
          "full_res": "https://..."
        }
      },
      "mesh": {
        "collider_mesh_url": "https://...glb"
      },
      "imagery": {
        "pano_url": "https://...png"
      }
    }
  }
}
```

### Limits

- Rate limit: max 6 generate requests per minute (429 = exceeded)
- Use `500k` resolution `.spz` for demo — balances quality and PICO performance

---

## 2. Nano Banana Pro (Google Gemini Image Generation)

### Basic Info

- **"Nano Banana Pro"** = official nickname for Gemini 3 Pro Image
- **SDK:** `@google/genai` (not `@google/generative-ai`)
- **Authentication:** Environment variable `GEMINI_API_KEY`

```bash
npm install @google/genai
```

### Model Options

| Model name | Nickname | Quality | Speed |
|-----------|---------|---------|-------|
| `gemini-3-pro-image` | Nano Banana Pro | Highest | Slow |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | High | Fast (8–12s) |

### Example: multiple photos → panorama

```javascript
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const photos = ["photo1.jpg", "photo2.jpg"].map(f => ({
  inlineData: {
    mimeType: "image/jpeg",
    data: fs.readFileSync(f).toString("base64")
  }
}));

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    {
      text: `You are an expert panorama compositor.
Naturally fuse these photos into a single 360° equirectangular panorama.
Scene style: Tokyo Shibuya at night.
Requirements: 2:1 aspect ratio, photos embedded as scene elements (wall posters, shop windows, lamppost decorations).
CRITICAL: Remove ALL human figures and faces from the entire output — no people, no crowds, no silhouettes.
Output: image only, no text.`
    },
    ...photos
  ]
});

for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("panorama.png", buffer);
  }
}
```

### Mode A (city template + photo fusion)

```
Prompt direction:
- Provide city street template panorama (base image)
- Provide user photos (3–8)
- Task: embed photos into natural positions in the city scene
  · Left wall: photo 1
  · Front window: photo 2
  · Right lamppost: photo 3
- Maintain the city panorama's overall style and perspective
- CRITICAL: remove ALL human figures and faces everywhere
```

### Mode B (photos only → new world)

```
Prompt direction:
- Provide only user photos + one-line description
- Task: generate a brand-new 360° panorama from scratch
- Photos control spatial structure and visual elements
- Text description controls overall style and atmosphere
- CRITICAL: remove ALL human figures and faces everywhere
```

### Human figure removal (critical)

Both modes must include this instruction in the prompt:

```
CRITICAL: Remove ALL human figures and faces from the entire scene — no people,
no crowds, no silhouettes, no body parts. Replace with environmental elements
(lights, signs, objects, textures).

When processing user photos: if a photo contains people or faces, extract ONLY
the non-human elements — landscapes, animals, plants, architecture, sky, ground,
water, objects. Discard all human subjects entirely.
A group photo at a beach becomes just the beach.
A selfie in front of a temple becomes just the temple.
```

> **Why:** Gaussian Splat renders human figures as ghostly blurry shapes — extremely uncanny and disturbing in VR. Removing all people at the panorama generation stage prevents this entirely.

### Notes

- Gemini does **not** natively generate true spherical 360° panoramas
- Output is a wide-format image (2:1 ratio) treated as equirectangular and passed into Marble
- Marble's `is_pano: true` correctly handles 2:1 images as panoramas

---

## 3. Full Pipeline Flow

```
User photos (input/photos/)
      │
      ▼
[Step 1] Gemini API
  · Mode A: city template + photos → fused panorama
  · Mode B: photos + description → new panorama
      │
      ▼  panorama.png (2:1, equirectangular)
      │
[Step 2] Marble API — Upload
  · prepare_upload → get signed URL
  · PUT panorama.png to signed URL
      │
      ▼  image_url
      │
[Step 3] Marble API — Generate
  · POST worlds:generate (is_pano: true, model: Marble 0.1-plus)
  · Returns operation_id
      │
      ▼  poll every 15s
      │
[Step 4] Marble API — Download
  · done: true → get spz_urls.500k
  · Download .spz to citywalk/assets/cities/tokyo-shibuya/world.spz
      │
      ▼
citywalk/assets/cities/tokyo-shibuya/
  ├── world.spz       ← Gaussian Splat (for PICO rendering)
  ├── panorama.png    ← Fused panorama (fallback)
  └── config.json     ← Hotspot coordinates (manually annotated)
```

---

## 4. Environment Variables

```bash
# .env
GEMINI_API_KEY=your_gemini_key
MARBLE_API_KEY=your_worldlabs_key
```

---

## 5. Reference Links

- Marble API docs: https://docs.worldlabs.ai/api
- Marble export docs: https://docs.worldlabs.ai/marble/export/gaussian-splat/unreal
- Gemini image generation: https://ai.google.dev/gemini-api/docs/image-generation
- Gemini model list: https://ai.google.dev/gemini-api/docs/models
- Nano Banana API: https://nanobananaapi.ai/
