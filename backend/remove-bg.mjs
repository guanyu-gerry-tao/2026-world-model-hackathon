/**
 * remove-bg.mjs  —  background removal for the NPC sprite
 *
 * Technique:
 *   1. BFS flood-fill from every image edge, growing into pixels whose
 *      colour is "close" to their BFS parent (catches the dark sky gradient).
 *   2. Colour-range pass that zaps any remaining teal/cyan grid pixels
 *      (highly saturated blue-green) that weren't reached by the flood.
 *   3. Light alpha feather (1-px blur on the mask) to soften jagged edges.
 */

import sharp from 'sharp'
import path  from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC  = path.join(__dirname, '..', 'citywalk', 'public', 'npc.png')
const DEST = SRC   // overwrite in-place

// ── Load as raw RGBA ──────────────────────────────────────────────────────────
const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height } = info
const CH = 4
const pixels = new Uint8Array(data)

console.log(`Image: ${width}×${height}`)

// ── Helpers ───────────────────────────────────────────────────────────────────

function rgb(i) {
  const p = i * CH
  return [pixels[p], pixels[p + 1], pixels[p + 2]]
}

function rgbDist(i, j) {
  const [ar, ag, ab] = rgb(i)
  const [br, bg, bb] = rgb(j)
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2)
}

// Convert RGB → HSL  (h: 0-360, s: 0-1, l: 0-1)
function toHSL(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else                h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

// ── 1. BFS flood-fill from image edges ───────────────────────────────────────
const FLOOD_TOL = 42          // RGB distance threshold (conservative)

const isBg = new Uint8Array(width * height)   // 1 = background
const queue = new Int32Array(width * height)  // pixel indices
let head = 0, tail = 0

function seed(idx) {
  if (isBg[idx]) return
  isBg[idx] = 1
  queue[tail++] = idx
}

// Seed the four edges
for (let x = 0; x < width;  x++) { seed(x);                    seed((height - 1) * width + x) }
for (let y = 1; y < height - 1; y++) { seed(y * width);         seed(y * width + width - 1) }

const DX = [-1, 1,  0, 0]
const DY = [ 0, 0, -1, 1]

while (head < tail) {
  const idx = queue[head++]
  const x = idx % width
  const y = (idx - x) / width

  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d], ny = y + DY[d]
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
    const nidx = ny * width + nx
    if (isBg[nidx]) continue
    if (rgbDist(idx, nidx) < FLOOD_TOL) {
      isBg[nidx] = 1
      queue[tail++] = nidx
    }
  }
}

console.log(`Flood-fill: ${tail} background pixels found`)

// ── 2. Colour-range pass — zap remaining teal/cyan grid pixels ────────────────
let extra = 0
for (let i = 0; i < width * height; i++) {
  if (isBg[i]) continue
  const [r, g, b] = rgb(i)
  const [h, s, l] = toHSL(r, g, b)

  // Teal/cyan: hue 155–215°, saturation > 30%, not too dark
  if (h >= 155 && h <= 215 && s > 0.30 && l > 0.08) { isBg[i] = 1; extra++ }

  // Residual dark purple-grey sky that flood missed (very desaturated, dark)
  if (l < 0.12 && s < 0.30) { isBg[i] = 1; extra++ }
}
console.log(`Colour-range pass: ${extra} additional pixels removed`)

// ── 3. Apply alpha ────────────────────────────────────────────────────────────
for (let i = 0; i < width * height; i++) {
  pixels[i * CH + 3] = isBg[i] ? 0 : 255
}

// ── 4. Feather — 1-px Gaussian blur on the alpha then re-threshold ───────────
//   Achieved cheaply by blurring the whole image then blending alpha only
const blurred = await sharp(Buffer.from(pixels), { raw: { width, height, channels: CH } })
  .blur(1.2)
  .raw()
  .toBuffer()

const blurredArr = new Uint8Array(blurred)

for (let i = 0; i < width * height; i++) {
  const origAlpha   = pixels[i * CH + 3]
  const blurAlpha   = blurredArr[i * CH + 3]
  // Soft edge: blend original and blurred alpha
  pixels[i * CH + 3] = origAlpha === 0 ? 0 : Math.min(255, Math.round((origAlpha + blurAlpha) / 2))
}

// ── 5. Save ───────────────────────────────────────────────────────────────────
await sharp(Buffer.from(pixels), { raw: { width, height, channels: CH } })
  .png({ compressionLevel: 9 })
  .toFile(DEST)

console.log(`✓ Saved to ${DEST}`)
