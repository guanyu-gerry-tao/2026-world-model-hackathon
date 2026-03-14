# CityWalk — Project Proposal
> *Walk into a city. Leave your memories behind.*

**Event:** Worlds in Action Hack San Francisco · March 14–15, 2026
**Venue:** Founders Inc. · Organizer: SensAI Hackademy
**Tracks:** Best Filmmaking, Entertainment & Simulation App · Best World Models Implementation with PICO

---

## 1. Problem Statement

You've been to Tokyo, Paris, Kyoto. You took a hundred photos. Then what? The photos sit in your camera roll, and the city becomes just a name.

Existing memory apps either turn photos into parallax 3D effects for passive viewing (ScopeVR, immerGallery), or require you to record scenes in real-time with LiDAR to revisit them later (Wist). Neither solves the core problem: **your memories have no connection to the city itself.**

CityWalk's position: **memories shouldn't exist in isolation — they should live inside cities.**

---

## 2. Core Concept

CityWalk offers two creation modes:

**Mode A — City Template + Memory Fusion (primary)**
Choose a pre-built city street (Tokyo Shibuya, Kyoto alley), upload your photos, and they are naturally embedded into the scene — posted on walls, appearing in shop windows, hanging from lampposts. Same city, different memories for every person.

**Mode B — Generate from Scratch**
Skip the template. Upload photos + a one-line description, and AI builds an entirely new world from nothing. For places that don't have a city template yet, or when you want a fully personalized experience.

Worlds created in either mode can be visited by other people.

**Social is core:**
- You create "my Tokyo" — friends can come walk through it
- Same street, completely different versions for different people
- The city is shared, the memories are personal, the experience is social

> "Not putting photos in a space, but planting memories inside a city."

---

## 3. Competitive Analysis

| | CityWalk | Wist | Memory House (World Labs) | ScopeVR |
|---|---|---|---|---|
| Input | Any existing photos (+ optional city template or generate from scratch) | Must record with app in real-time | Artist-curated, hand-assembled | Existing photos/video |
| Processing | Photos fused into city / photos generate world | LiDAR 3D reconstruction of original scene | Marble Composer manual assembly | Depth estimation |
| Output | Shareable world carrying personal memories | Reconstruction of original scene | Fixed narrative art installation | Stereoscopic photo viewer |
| Social | ✅ Visit each other's cities | ❌ Personal only | ❌ Artist's work | ❌ Personal only |
| Uses World Model | ✅ Marble API | ❌ | ✅ Marble Composer (UI only) | ❌ |
| Supports old photos | ✅ | ❌ | ✅ | ✅ |
| Walkable VR | ✅ PICO | ✅ Quest | ✅ (browser) | ✅ Quest |

**Core insight:** Other products let you look at your own photos. CityWalk lets you walk through someone else's city and see their memories. It's a social platform, not a photo album.

---

## 4. Full Technical Pipeline

```
Step 1 — Choose creation mode
  A) City template: select a pre-built city (e.g., Tokyo Shibuya), upload photos to fuse
  B) From scratch: upload photos + one-line description, AI generates the world

Step 2 — Upload photos
User uploads personal photos (3–8 recommended)
  Template example: "Photos I took in Tokyo in 2019"
  From scratch example: "Summer in Kyoto with college friends, 2019"

Step 3 — Panorama generation
Nano Banana Pro (Google Gemini 3 Pro Image)
  A) Template mode: city panorama + user photos → fused panorama
     Photos naturally embedded in city scene (wall posters, shop windows, lamppost decorations)
  B) From scratch: multiple photos → new 360° surreal panorama
     Photos control spatial structure, text description controls visual style

Step 4 — World generation
World Labs Marble API
  Input: panorama (is_pano: true)
  Output: Gaussian Splat (.spz)

Step 5 — VR experience (PICO headset)
WebXR (SparkJS 2.0 / Three.js)
  Render Gaussian Splat
  Overlay particle system (petals / glow)
  Proximity trigger interaction → original photos reveal
  Background music + ambient audio
```

---

## 5. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Image fusion | Nano Banana Pro (Gemini 3 Pro Image) | Template fusion / generate 360° panorama from scratch |
| World generation | World Labs Marble API `marble-0.1-plus` | `is_pano: true` for highest spatial accuracy |
| Render engine | SparkJS 2.0 + Three.js + WebXR | Runs in PICO built-in browser, no app install |
| Particle effects | Three.js `BufferGeometry` Points | Max ~500 particles, maintains PICO frame rate |
| Interaction trigger | Proximity detection | Per-frame player position vs hotspot distance check |
| Photo reveal | Three.js `Sprite` / `PlaneGeometry` | Fade-in animated overlay panel |
| Background music | Suno / Udio API | Pre-generated per city atmosphere |
| Target platform | PICO 4 headset | Standalone Android device, no PC required |

---

## 6. Interaction Design

### Core interaction: discovering memories on the street

The user walks down a city street. Approaching a wall, a shop window, or a lamppost causes the photo embedded there to sharpen from a blur — the original hi-res photo appears in front of them. The interaction is spatial and embodied: you're not operating a UI, you're encountering memories in a city.

```javascript
// Per-frame check
const distance = player.position.distanceTo(hotspot.position)
if (distance < 0.5) {
    fadeInPhoto(hotspot.photoId)
    raiseMusic()
}
if (distance > 1.0) {
    fadeOutPhoto()
    lowerMusic()
}
```

### Hotspot coordinate system

The panorama is in equirectangular projection, coordinates in lat/lon:
- Horizontal: 0°–360° (yaw)
- Vertical: -90°–90° (pitch)

**Hackathon version (manual):** Walk through the pre-generated world, manually annotate which area corresponds to which photo, hard-code hotspot coordinates.

**Full product version:**

Step 1: Gemini prompt actively defines where each photo is embedded in the city
```
Left wall: photo 1 (Shibuya crossing selfie)
Front window: photo 2 (ramen shop)
Right lamppost: photo 3 (night view)
```

Step 2: VLM (Claude / GPT-4V) analyzes the generated panorama, returns hotspot coordinate JSON
```json
{
  "hotspots": [
    { "photo_id": "shibuya_001.jpg", "yaw": 45, "pitch": -10, "label": "Shibuya wall" },
    { "photo_id": "ramen_002.jpg", "yaw": 180, "pitch": 0, "label": "Ramen shop window" }
  ]
}
```

Step 3: Convert to 3D world coordinates
```javascript
const x = Math.cos(pitch) * Math.sin(yaw) * radius
const y = Math.sin(pitch) * radius
const z = Math.cos(pitch) * Math.cos(yaw) * radius
```

---

## 7. Atmosphere Layer

**Particle effects (lamppost glow / petal drift):**
- `BufferGeometry` with random particle positions
- Y-axis sine animation simulating float
- City-themed: Tokyo uses cherry blossom petals, Paris uses light points
- Performance target: ≤500 particles, stable PICO frame rate

**Background music + ambient audio:**
- City ambient layer underneath (street sounds, distant traffic)
- Volume rises when approaching hotspots, personalized score fades in
- One unique soundtrack per city, matching city atmosphere

---

## 8. Full Product Architecture

```
Mobile (input)              Cloud (processing)               PICO headset (experience)

Choose city template   →   Gemini fuses photos into city   →   WebXR loads .spz
Select photos from              panorama
gallery                             ↓
                            Marble generates                    Render Gaussian Splat
                            personalized world
                                    ↓
                            .spz stored in                      Particle overlay
                            user account
                                    ↓
Share link with friends ←  Generate shareable world URL  →   Friends walk through your city
                                                              Photos reveal
                                                              Music plays
```

**Business value:**
- City templates as IP partnerships (brand streets, landmark digital twins)
- UGC worlds as paid access
- City × memory = infinite content, user-generated

---

## 9. Competitive Moat

**vs. Wist:** Wist depends on real-time LiDAR capture — it only works for scenes you're recording right now. CityWalk accepts any photo; a travel roll from 2003 shot on film works just as well.

**vs. Memory House:** Memory House is an artist's fixed installation — users can't create their own versions. CityWalk is a platform where anyone can leave their memories in the same city.

**vs. 2D/3D photo viewers:** Those products put photos inside a spatial container for passive viewing. We plant photos inside a city. The output isn't photos — it's a street that belongs to you.

**Social moat:** The only product that lets you walk through someone else's memories. Not viewing photos — walking into their city.

---

## 10. Demo Scope

### ✅ Real implementation (must ship)

| Feature | Description |
|---------|-------------|
| Gaussian Splat rendering | SparkJS loads `.spz` inside PICO browser |
| Free walking in headset | WebXR 6DoF, real physical movement through city streets |
| Particle effects | Three.js petals / glow overlaid on Splat |
| Proximity trigger interaction | Approach wall/window hotspot → photo reveals |
| Photo reveal panel | Three.js Sprite fade-in animation |
| Background music | Auto-plays on world entry |

### 🔴 Hardcoded / Verbal pitch only

| Feature | Handling |
|---------|---------|
| User photo upload | Photos pre-built in; describe mobile upload flow during pitch |
| Real-time Gemini fusion | Fused panorama pre-generated |
| Real-time Marble generation | `.spz` pre-generated and hardcoded |
| VLM auto hotspot positioning | Manual coordinate annotation after world walkthrough |
| Social sharing / visiting | Architecture diagram + verbal pitch |
| Multi-city template selection | One hardcoded default city |
| User accounts / cloud storage | Architecture diagram verbal description |
| AI music real-time generation | Audio file pre-generated, static load |

**Core principle:** Everything the judges experience in the headset must be real — walking the city street, petals falling, photos emerging from walls. The rest of the pipeline can be faked. The moment of entering the world cannot.

---

## 11. Team

| Member | Role |
|--------|------|
| Gerry (core dev) | Full pipeline: Gemini fusion → Marble → WebXR render + particle system + proximity interaction |
| Teammate (music) | AI music generation + audio integration into WebXR scene |

**Background:** SCI-Arc M.Arch, currently CS grad in Silicon Valley. Previous: Gensler Technical Designer, solo-published Unreal VR game. Primary stack: Node.js, JS / Three.js. XR and WebXR are new territory — learning on-site.

---

## 12. 24-Hour Schedule

> **Reality constraint:** Day 2 is mostly debugging, video recording, social, and awards. All core features must be done on Day 1. Non-essential features are all faked.

### Saturday Day 1 (the only real dev day)

| Time | Task |
|------|------|
| 9:00–11:00 | Environment setup, team formation, tooling |
| 11:00–14:00 | SparkJS + WebXR scaffold, load pre-generated .spz |
| 14:00–17:00 | Proximity hotspot system + photo reveal panel |
| 17:00–19:00 | Particle system (petals / glow) |
| 19:00–23:00 | Music integration + full end-to-end integration |

### Sunday Day 2 (debug + submit)

| Time | Task |
|------|------|
| 8:00–10:00 | Bug fixes + PICO device testing |
| 10:00–12:00 | Final tuning + record 45s demo video |
| 1:00 PM | Submission deadline |
| 2:00–5:00 PM | Judging + Showcase + Awards |

---

## 13. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| SparkJS performance insufficient on PICO | Medium | Pre-test on device; lower splat resolution if needed |
| Fused panorama quality below bar | Medium | Pre-generate multiple prompt variations, pick best |
| WebXR proximity detection latency | Low | Standard Three.js per-frame distance check, well-documented |
| Demo crashes during judging | Low | All assets hardcoded, no real-time API calls, zero network dependency |
| On-site PICO headset unavailable | Low | Organizers confirmed Quest 3 available; WebXR runs on Quest too |

---

## 14. References

- World Labs Marble API: https://api.worldlabs.ai/marble/v1
- Memory House case study: https://www.worldlabs.ai/case-studies/memory-house
- SensAI WebXR Kit: https://github.com/V4C38/sensai-webxr-worldmodels
- SensAI Knowledge Hub: https://xrbootcamp.notion.site/SensAI-Knowledge-Hub
- Wist Labs (competitor reference): https://wistlabs.com

---

*Last updated: March 13, 2026*
