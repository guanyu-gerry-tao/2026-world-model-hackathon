# CityWalk — WebXR Gaussian Splat Viewer

Walk through AI-generated 3D city scenes in your browser or on a Pico VR headset. Built with Three.js + WebXR, rendering [Gaussian Splats](https://github.com/sparkjsdev/spark) for photorealistic environments.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Pico 4 headset (for VR) **or** any modern desktop browser
- PC and Pico on the **same Wi-Fi network**

---

## Quick Start

```bash
cd citywalk
npm install
npm run dev
```

The server starts at `https://localhost:3000`.

---

## Running on Pico 4

WebXR requires HTTPS. The Vite config already handles this with a self-signed certificate.

**Steps:**

1. Start the dev server on your PC:
   ```bash
   npm run dev
   ```

2. Note your PC's local IP address (shown in the Vite output, e.g. `https://192.168.1.x:3000`).

3. On the Pico 4, open the built-in browser and navigate to:
   ```
   https://<your-pc-ip>:3000
   ```

4. Accept the self-signed certificate warning (tap **Advanced → Proceed**).

5. Tap the **Enter VR** button to start the immersive session.

---

## Controls

### Pico 4 (VR)
| Input | Action |
|---|---|
| Left thumbstick | Move forward / strafe |
| Right thumbstick (left/right) | Snap-turn 45° |
| Left/right trigger | Flip photobook pages |

### Desktop (flat-screen)
| Input | Action |
|---|---|
| Mouse drag | Look around |
| W / A / S / D or arrow keys | Move |
| Q / E | Flip photobook pages |

---

## Features

- **Gaussian Splat rendering** — photorealistic `.spz` scene files via `@sparkjsdev/spark`
- **Photobook** — a floating photo album in the scene; walk within ~3m to open it, showing raw vs AI-refined panoramas
- **Positional audio** — 3D spatial audio attached to the camera
- **Desktop fallback** — mouse/touch controls when not in VR

---

## Loading a Specific City

The backend serves generated city scenes. Pass a `cityId` URL parameter to load one:

```
https://<your-pc-ip>:3000/?cityId=<city-id>
```

Without a `cityId`, the viewer falls back to the local benchmark scene at `/benchmark/test-gemini-20260315065249/world.spz`.

The backend is expected at `http://localhost:3001`. See the `backend/` folder for setup.

---

## Project Structure

```
citywalk/
├── src/
│   └── main.js          # All scene, WebXR, and controller logic
├── index.html           # Entry point + photobook overlay HTML/CSS
├── vite.config.js       # Dev server: HTTPS, LAN hosting, benchmark assets
└── package.json
```

---

## Why HTTPS?

WebXR's immersive-vr API requires a secure context. The `@vitejs/plugin-basic-ssl` plugin generates a self-signed certificate automatically — no manual cert setup needed. The Pico browser will show a warning on first visit; accept it to proceed.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Pico can't reach the server | Confirm PC and Pico are on the same Wi-Fi; check your firewall allows port 3000 |
| "Enter VR" button missing | WebXR not detected — make sure you're on HTTPS, not HTTP |
| Certificate error on Pico | Tap **Advanced → Proceed to site** to accept the self-signed cert |
| Black screen / splat not loading | Check the browser console; the `.spz` file path or `cityId` may be wrong |
| Controllers not responding | Pico OpenXR exposes thumbstick axes at indices 2 and 3 — if axes differ, check `readThumbstick()` in `main.js:535` |
