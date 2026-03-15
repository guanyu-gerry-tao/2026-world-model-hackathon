# CityWalk — Walk into a city, leave your memory

> **Worlds in Action Hack San Francisco · March 14–15, 2026**
> Founders Inc. · Organized by: SensAI Hackademy
> Track: Best World Models Implementation with PICO

---

## Navigation

### Docs

| Document | Contents |
|------|------|
| [docs/proposal.md](docs/proposal.md) | Project proposal: problem statement, core concept, differentiation analysis, Demo scope |
| [docs/architecture.md](docs/architecture.md) | Technical architecture: system overview, module breakdown, data flow, development plan |
| [docs/api-reference.md](docs/api-reference.md) | API reference: Marble API + Gemini (Nano Banana Pro) interface documentation |
| [docs/backend.md](docs/backend.md) | Backend usage guide: how to start, API endpoints, Mock testing |
| [benchmark/README.md](benchmark/README.md) | Benchmark assets guide: origin and purpose of standard Demo files |

### Code

| Directory | Contents |
|------|------|
| [backend/](backend/) | Node.js/Express backend: Gemini + Marble generation pipeline |
| [citywalk/](citywalk/) | WebXR frontend: Gaussian Splat experience on PICO headset |
| [benchmark/](benchmark/) | Shared team Demo assets: photos, panoramas, .spz files |

---

## Project Overview

CityWalk lets you plant your personal photos inside a real city.

1. Upload old photos → **Gemini** (Nano Banana Pro) blends them into a street-level panorama of Tokyo Shibuya
2. Panorama → **World Labs Marble API** generates a walkable 3D Gaussian Splat world
3. Put on a **PICO 4** headset, walk down that street, and your photos emerge from the city as you approach the walls

---

## Quick Start

### Backend (generation pipeline)

```bash
cd backend
npm install
cp .env.example .env   # Fill in API keys, or keep USE_MOCK=true
npm run dev            # Starts at http://localhost:3001
```

See → [docs/backend.md](docs/backend.md)

### Frontend (WebXR experience)

```bash
cd citywalk
npm install
npm run dev            # Starts at https://localhost:3000
```

Open that address in the PICO 4 browser to enter the immersive WebXR experience.

---

## Tech Stack

| Layer | Technology |
|------|------|
| Panorama generation | Gemini (Nano Banana Pro / `gemini-3-pro-image`) |
| World generation | World Labs Marble API (`marble-0.1-plus`) |
| Backend | Node.js + Express |
| Frontend | Three.js + SparkJS 2.0 + WebXR |
| Runtime platform | PICO 4 headset (Android, built-in browser) |
