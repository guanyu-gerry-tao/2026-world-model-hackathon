# CityWalk — Text-to-Music Pipeline

## Overview

```
City Description (text prompt)
        │
        │  music/scripts/generate_music.js
        ▼
┌─────────────────────────────────┐
│  ElevenLabs Sound Generation    │
│  POST /v1/sound-generation      │
│  · duration_seconds: 22         │
│  · prompt_influence: 0.3        │
│  · returns audio binary         │
└────────────┬────────────────────┘
             │ write binary to disk
             ▼
        save as .mp3
             │
             ▼
   music/assets/cities/<city-id>/music.mp3
             │
             │  (hardcoded into project at hackathon)
             │
             ▼
┌─────────────────────────────────┐
│  WebXR Runtime                  │
│  music/src/audio/MusicController.js   │
│  · THREE.AudioListener          │
│  · fade in on scene entry       │
│  · volume boost near hotspots   │
└─────────────────────────────────┘
```

## Steps

1. **Prompt → Replicate** (`generate_music.js:67–83`)
   Each city has a hand-written text prompt describing its atmosphere. The script calls the Replicate API with that prompt and waits for the model to finish generating.

2. **Download mp3** (`generate_music.js:85–89`)
   Replicate returns a URL to the generated audio file. The script downloads it and saves it as `music/assets/cities/<city-id>/music.mp3`.

3. **Load & play in WebXR** (`MusicController.js:44–52`)
   At runtime, `MusicController` loads the mp3 into Three.js's `AudioListener` system. Music fades in when the scene starts and gets louder when the player approaches a memory hotspot.

## Usage

```bash
# Enter music folder first
cd music

# Pre-generate all city tracks (run before hackathon)
npm run generate-music

# Generate a single city
npm run generate-music:tokyo
```

Requires `ELEVENLABS_API_KEY` in `music/.env`. See `music/.env.example`.

## City Prompts

| City ID | Name | Prompt Style |
|---|---|---|
| `tokyo-shibuya` | Tokyo Shibuya | lo-fi beats, neon night, warm synth pads |
| `kyoto-alley` | Kyoto Alley | koto & shakuhachi, gentle rain, zen |
| `paris-street` | Paris Street | accordion, café, romantic evening |

## Key Files

| File | Role |
|---|---|
| `music/scripts/generate_music.js` | Pre-generation script (run offline) |
| `music/src/audio/MusicController.js` | WebXR runtime audio controller |
| `music/assets/cities/<id>/music.mp3` | Generated output (committed to repo) |
