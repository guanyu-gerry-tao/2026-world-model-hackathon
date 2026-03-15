# CityWalk — Backend Documentation

> Version: v0.2 · Last updated: 2026-03-15

---

## For Frontend Developers

The pipeline is split into **two independent steps**. Call them in order:

```
Step 1: POST /pipeline/panorama  →  Gemini generates 360° panorama (+ auto-refine)
Step 2: POST /pipeline/world     →  Marble converts panorama to 3D Gaussian Splat
```

Both return a `jobId` immediately. Poll `GET /pipeline/status/:jobId` until `status === "done"`.

---

### Step 1 — Generate Panorama

```http
POST /pipeline/panorama
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photos` | File × 1–8 | ✅ | User's personal photos (JPG / PNG / WebP, max 20 MB each) |
| `template` | File × 1 | No | A real 360° panorama as base template (Mode A) |
| `description` | string | No | Style description, e.g. `"Rainy Tokyo alley, neon reflections"` |
| `cityId` | string | No | Output folder name — auto-generated if omitted |
| `quality` | `"fast"` \| `"pro"` | No | Gemini model quality, default `"fast"` |
| `provider` | `"gemini"` \| `"openai"` | No | Image generation provider, default `"gemini"` |

> **Mode A (template):** provide `photos` + `template` — photos are fused into the template scene
>
> **Mode B (scratch):** provide only `photos` — Gemini generates a new world from your photos

**Response:**
```json
{ "jobId": "abc123" }
```

**Poll until done. Result:**
```json
{
  "status": "done",
  "result": {
    "cityId": "city-abc123",
    "panoramaUrl": "/output/city-abc123/panorama.png",
    "panoramaRawUrl": "/output/city-abc123/panorama_raw.png"
  }
}
```

| Field | Description |
|-------|-------------|
| `cityId` | Use this in Step 2 |
| `panoramaUrl` | Refined panorama (2048×1024, used by Marble) |
| `panoramaRawUrl` | Raw Gemini output before refinement (for comparison) |

**Status values during panorama generation:**

| Status | Meaning |
|--------|---------|
| `generating_panorama` / `progress: "Calling Gemini..."` | Gemini generating panorama |
| `generating_panorama` / `progress: "Refining panorama..."` | Auto-refinement pass |
| `generating_panorama` / `progress: "Resizing to equirectangular..."` | Resizing to 2048×1024 |
| `done` | Panorama ready — proceed to Step 2 |
| `error` | Failed — check `error` field |

---

### Step 2 — Generate 3D World

```http
POST /pipeline/world
Content-Type: application/json
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cityId` | string | ✅ | `cityId` from Step 1 result |
| `marbleModel` | `"Marble 0.1-mini"` \| `"Marble 0.1-plus"` | No | Default `"Marble 0.1-mini"` |
| `textPrompt` | string | No | Style prompt for the 3D world, e.g. `"Cinematic city, golden hour, empty streets"` |

**Response:**
```json
{ "jobId": "xyz789" }
```

**Poll until done. Result:**
```json
{
  "status": "done",
  "result": {
    "cityId": "city-abc123",
    "operationId": "fd6dfaf4-...",
    "worldId": "662ef1c9-...",
    "worldUrl": "https://marble.worldlabs.ai/world/662ef1c9-...",
    "caption": "A vibrant Japanese streetscape with wooden latticework...",
    "thumbnailUrl": "https://cdn.marble.worldlabs.ai/.../thumbnail.webp",
    "spzPath": "output/city-abc123/world.spz",
    "remoteUrls": {
      "spz500k": "https://cdn.marble.worldlabs.ai/.../500k.spz",
      "spzFullRes": "https://cdn.marble.worldlabs.ai/.../full.spz",
      "collider": "https://cdn.marble.worldlabs.ai/.../collider.glb",
      "pano": "https://cdn.marble.worldlabs.ai/.../pano.png"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `worldUrl` | Direct link to preview in Marble's web viewer |
| `caption` | AI-generated description of the world |
| `thumbnailUrl` | World thumbnail image |
| `remoteUrls.spz500k` | Gaussian Splat file (500k points) — load this in the frontend |
| `remoteUrls.spzFullRes` | Full resolution Gaussian Splat |
| `remoteUrls.collider` | Collision mesh (.glb) for physics |
| `spzPath` | Local file path on server (for reference) |

**Status values during world generation:**

| Status | Meaning |
|--------|---------|
| `generating_world` / `progress: "Uploading to Marble..."` | Uploading panorama |
| `generating_world` / `progress: "Marble: processing"` | Marble building the 3D world |
| `downloading` | Downloading .spz to local disk |
| `done` | World ready |
| `error` | Failed — check `error` field |

**Model comparison:**

| Model | Speed | Quality | Use case |
|-------|-------|---------|----------|
| `Marble 0.1-mini` | ~1–2 min | Good | Development, testing |
| `Marble 0.1-plus` | ~3–5 min | High | Final demo output |

---

### Poll Status

```http
GET /pipeline/status/:jobId
```

**In progress:**
```json
{
  "id": "abc123",
  "status": "generating_panorama",
  "progress": "Refining panorama...",
  "result": null,
  "error": null
}
```

**Recommended polling interval: 2–3 seconds.**

---

### Access Files

```http
GET /output/:cityId/:filename
```

Files served directly after generation:

```
GET /output/city-abc123/panorama.png        ← refined panorama (2048×1024)
GET /output/city-abc123/panorama_raw.png    ← original Gemini output
GET /output/city-abc123/world.spz           ← Gaussian Splat (local copy)
```

**To load the world in the frontend:**
```javascript
// Option A: use Marble CDN directly (recommended — faster, no local server needed)
const spzUrl = result.remoteUrls.spz500k;

// Option B: load from local server
const spzUrl = `http://localhost:3001/output/${cityId}/world.spz`;
```

---

### Health Check

```http
GET /health
→ { "ok": true }
```

---

## Quick Start

```bash
cd backend
cp .env.example .env        # fill in GEMINI_API_KEY and MARBLE_API_KEY
npm install
node server.js
```

**Test scripts:**
```bash
# Step 1 only — generate panorama
node test-panorama.js --photo photo.jpg
node test-panorama.js --dir /path/to/photos/

# Step 2 only — generate world from existing panorama
node test-world-model.js --city <cityId>
node test-world-model.js --city <cityId> --text-prompt "Cinematic city, golden hour" --marble-model "Marble 0.1-plus"
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google AI Studio key | Yes (real mode) |
| `MARBLE_API_KEY` | World Labs key (from worldlabs.ai platform) | Yes (real mode) |
| `PORT` | Server port, default `3001` | No |
| `USE_MOCK` | `true` = skip all real API calls, return fake data | No |

---

## Directory Structure

```
backend/
├── server.js
├── .env
├── .env.example
├── test-panorama.js              # test Step 1
├── test-world-model.js           # test Step 2
├── uploads/                      # temp uploads (auto-cleaned)
├── output/
│   └── {cityId}/
│       ├── panorama_raw.png      # Gemini original output
│       ├── panorama.png          # refined + resized to 2048×1024
│       └── world.spz             # Marble Gaussian Splat
└── src/
    ├── routes/
    │   └── pipeline.js           # all /pipeline routes + job management
    ├── services/
    │   ├── gemini-panorama.js    # Gemini image generation + refinement
    │   ├── marble.js             # Marble upload + world generation + polling
    │   └── openai-panorama.js    # OpenAI provider (fallback)
    ├── prompts/
    │   └── panorama.md           # Gemini prompts (Mode A, Mode B, Refine)
    └── mock/
        └── panorama.js           # mock panorama buffer (USE_MOCK=true)
```

---

## Notes

- Jobs are stored in memory — lost on server restart (fine for hackathon)
- Upload size limit: 20 MB per photo
- Marble rate limit: 6 requests/minute — returns 429 if exceeded
- `remoteUrls.spz500k` is the recommended file for the frontend (smaller, faster to load)
- `worldUrl` opens directly in Marble's web viewer for quick preview
