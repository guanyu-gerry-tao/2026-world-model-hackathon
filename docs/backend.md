# CityWalk — Backend Documentation

> Version: v0.1 · Last updated: 2026-03-13

---

## Overview

The backend is a **Node.js + Express** server that handles the image generation pipeline:

```
User photos
  → Gemini API (Nano Banana Pro) — generate 360° panorama
  → Marble API (World Labs) — convert panorama to Gaussian Splat (.spz)
  → Output saved to output/ directory for PICO WebXR frontend to load
```

All generation runs as **async jobs**: submit and immediately receive a `jobId`, then poll for status.

---

## Quick Start

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env — fill in API keys, or keep USE_MOCK=true to skip real API calls

# 3. Start server (dev mode, auto-restart on file changes)
npm run dev

# 4. Verify server is running
curl http://localhost:3001/health
# → {"ok":true}
```

---

## Environment Variables (.env)

| Variable | Description | Required |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google AI Studio API Key | Required in real mode |
| `MARBLE_API_KEY` | World Labs API Key | Required in real mode |
| `PORT` | Server port, default `3001` | No |
| `USE_MOCK` | When `true`, skips all real API calls — no keys needed | No |

**Mock mode (for development / testing):**
```env
USE_MOCK=true
```
Full pipeline logic executes normally, but Gemini and Marble return fake data. Completes in ~5 seconds.

**Real mode:**
```env
USE_MOCK=false
GEMINI_API_KEY=AIza...
MARBLE_API_KEY=wlt_...
```

---

## API Reference

### Health Check

```http
GET /health
```

**Response:**
```json
{ "ok": true }
```

---

### Start Generation Job

```http
POST /pipeline/generate
Content-Type: multipart/form-data
```

**Request fields (multipart form):**

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `photos` | File (up to 8) | ✅ | User personal photos, JPG/PNG |
| `template` | File (up to 1) | No | City template panorama (Mode A) |
| `description` | string | No | World description, e.g. `"Tokyo Shibuya at night"` |
| `cityId` | string | No | Output directory name, e.g. `"tokyo-shibuya"` |
| `quality` | `"fast"` \| `"pro"` | No | Gemini model quality, default `"fast"` |
| `marbleModel` | `"Marble 0.1-mini"` \| `"Marble 0.1-plus"` | No | Default `"Marble 0.1-mini"` |

> **Mode A (template fusion):** Provide both `photos` and `template` — photos are naturally embedded into the city scene
>
> **Mode B (from scratch):** Provide only `photos` (+ optional `description`) — generates a brand-new world

**Response:**
```json
{ "jobId": "mmpy4giqt1au" }
```

Returns immediately without waiting for generation to complete.

**curl examples:**
```bash
# Mode B — from scratch
curl -X POST http://localhost:3001/pipeline/generate \
  -F "photos=@photo1.jpg" \
  -F "photos=@photo2.jpg" \
  -F "description=Tokyo Shibuya night street" \
  -F "cityId=tokyo-shibuya" \
  -F "marbleModel=Marble 0.1-mini"

# Mode A — city template + photo fusion
curl -X POST http://localhost:3001/pipeline/generate \
  -F "photos=@my_photo.jpg" \
  -F "template=@shibuya_template.png" \
  -F "description=Tokyo Shibuya" \
  -F "cityId=tokyo-shibuya"
```

---

### Poll Job Status

```http
GET /pipeline/status/:jobId
```

**Response (in progress):**
```json
{
  "id": "mmpy4giqt1au",
  "status": "generating_world",
  "progress": "Marble: processing",
  "result": null,
  "error": null
}
```

**Status flow:**

```
pending → generating_panorama → generating_world → downloading → done
                                                               ↘ error
```

| Status | Meaning |
|--------|---------|
| `pending` | Job created, waiting to start |
| `generating_panorama` | Calling Gemini to generate panorama (~10s) |
| `generating_world` | Calling Marble to generate 3D world (mini: 30-45s, plus: ~5min) |
| `downloading` | Downloading .spz file to local disk |
| `done` | Complete — `result` field contains output info |
| `error` | Failed — `error` field contains error message |

**Response (complete):**
```json
{
  "id": "mmpy4giqt1au",
  "status": "done",
  "progress": null,
  "result": {
    "cityId": "tokyo-shibuya",
    "operationId": "op_abc123",
    "files": {
      "panorama": "/path/to/output/tokyo-shibuya/panorama.png",
      "spz": "/path/to/output/tokyo-shibuya/world.spz"
    },
    "remoteUrls": {
      "spz500k": "https://cdn.worldlabs.ai/...500k.spz",
      "spzFullRes": "https://cdn.worldlabs.ai/...full.spz",
      "collider": "https://cdn.worldlabs.ai/....glb",
      "pano": "https://cdn.worldlabs.ai/....png"
    }
  },
  "error": null
}
```

**Recommended polling interval: every 2 seconds until status is `done` or `error`.**

---

### Access Generated Files

```http
GET /output/:cityId/:filename
```

After generation completes, output files are served directly over HTTP:

```
GET /output/tokyo-shibuya/panorama.png   # generated panorama
GET /output/tokyo-shibuya/world.spz      # Gaussian Splat file
```

The PICO WebXR frontend can load `.spz` directly from this URL:
```javascript
const spzUrl = "http://localhost:3001/output/tokyo-shibuya/world.spz";
```

---

## Directory Structure

```
backend/
├── server.js                    # Express entry point, port 3001
├── package.json
├── .env                         # Local env vars (not committed)
├── .env.example                 # Env var template
├── test-pipeline.js             # End-to-end test script
├── test_gemini.py               # Standalone Gemini test (Python)
├── uploads/                     # Temp upload directory (auto-cleaned)
├── output/                      # Generated output
│   └── {cityId}/
│       ├── panorama.png         # Fused panorama
│       └── world.spz            # Gaussian Splat
└── src/
    ├── services/
    │   ├── gemini.js            # Gemini API (panorama generation)
    │   └── marble.js            # Marble API (world gen + polling + download)
    ├── routes/
    │   └── pipeline.js          # /pipeline routes + job management
    └── mock/
        └── panorama.js          # Mock panorama (used when USE_MOCK=true)
```

---

## End-to-End Test

```bash
# Terminal 1: start server
npm run dev

# Terminal 2: run test (USE_MOCK=true, no real API needed)
node test-pipeline.js
```

**Expected output:**
```
── CityWalk Pipeline Test ──

✓ Health: { ok: true }
→ Submitting generation job...
✓ Job started: mmpy4giqt1au
→ Polling status...
  status=generating_world  progress=Marble: uploading
  status=generating_world  progress=Marble: processing
  status=done  progress=-

✓ Pipeline complete!
  panorama.png on disk : ✓
  world.spz on disk    : ✓

 All checks passed. Backend is working correctly.
```

---

## Standalone Gemini Test (Python)

Tests only the Gemini panorama step, no server required:

```bash
pip install google-genai
export GEMINI_API_KEY=your_key

# Mode B — quickest, no photos needed
python test_gemini.py --mode b --desc "Tokyo neon street at night, empty"

# Mode B — with your own photos
python test_gemini.py --mode b --photos photo1.jpg photo2.jpg --desc "Shanghai alley"

# Mode A — template + photos
python test_gemini.py --mode a --template panorama.jpg --photos photo1.jpg
```

Output saved to `output/gemini-test/panorama_modeB_<timestamp>.png`.

---

## Switching from Mock to Real API

1. Get API keys:
   - Gemini: [Google AI Studio](https://aistudio.google.com/)
   - Marble: [World Labs](https://www.worldlabs.ai/)

2. Edit `.env`:
   ```env
   USE_MOCK=false
   GEMINI_API_KEY=AIza...
   MARBLE_API_KEY=wlt_...
   ```

3. Start with `Marble 0.1-mini` (30-45 seconds, cheaper) to confirm pipeline works end-to-end before switching to `Marble 0.1-plus` (5 minutes, higher quality)

---

## Notes

- `jobs` are stored in memory — lost on server restart (sufficient for hackathon)
- Marble API rate limit: max 6 generate requests per minute; returns 429 if exceeded
- Upload size limit: 20 MB per photo
- `.spz` files are large (500k version ~50-100 MB); `/output` endpoint serves them as static files
- After generation completes, `remoteUrls` contains direct Marble CDN links — these can be used directly in the PICO frontend without routing through the local server
