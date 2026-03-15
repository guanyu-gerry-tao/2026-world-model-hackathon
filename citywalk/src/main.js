import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { SplatMesh } from '@sparkjsdev/spark'

// ─── Config ──────────────────────────────────────────────────────────────────

const params  = new URLSearchParams(location.search)
const cityId  = params.get('cityId') ?? null
const BACKEND = 'http://localhost:3001'

const SPLAT_URL = cityId
  ? `${BACKEND}/output/${cityId}/world.spz`
  : '/benchmark/test-gemini-20260315065249/world.spz'

// ─── Photobook ────────────────────────────────────────────────────────────────
// A floating photo album anchored inside the 3D world.
// Walk within BOOK_OPEN_DIST metres → book opens like a real photobook.
// Press Q / E (or left/right VR trigger) to flip between spreads.
//
// To use real trip photos: add images to benchmark/tokyo-shibuya/photos/ and
// update the `url` fields in SPREADS below.

const BOOK_POSITION   = new THREE.Vector3(0, 1.35, -3)
const BOOK_OPEN_DIST  = 3.2   // metres → opens
const BOOK_CLOSE_DIST = 5.5   // metres → closes

// Each entry = one two-page spread: [left photo, right photo]
const SPREADS = [
  [
    { url: '/benchmark/test-gemini-20260315065249/panorama_raw.png', caption: 'Shibuya – raw capture' },
    { url: '/benchmark/test-gemini-20260315065249/panorama.png',     caption: 'Shibuya – AI refined'  },
  ],
  [
    { url: '/benchmark/test-gemini-20260315000644/panorama_raw.png', caption: 'Earlier take'          },
    { url: '/benchmark/test-gemini-20260315000644/panorama.png',     caption: 'World model source'    },
  ],
]

// ─── Renderer ────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.xr.enabled = true
renderer.xr.setReferenceSpaceType('local-floor')
document.body.appendChild(renderer.domElement)
document.body.appendChild(VRButton.createButton(renderer))

// ─── Scene + Camera ──────────────────────────────────────────────────────────

const scene  = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 500)

// Player rig: in XR the headset drives camera rotation, so we move this group
// for locomotion instead of the camera directly.
const playerRig = new THREE.Group()
playerRig.add(camera)
scene.add(playerRig)

// Panorama splat: start at the capture origin
camera.position.set(0, 0, 0)
camera.lookAt(0, 0, -1)

// Audio listener — must be on the camera for positional audio to work
const audioListener = new THREE.AudioListener()
camera.add(audioListener)

// ─── Shared canvas-texture helper ────────────────────────────────────────────

function makeCanvasTex(w, h, draw) {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  draw(cv.getContext('2d'))
  return new THREE.CanvasTexture(cv)
}

// ─── makeLabel — also used by journal orbs ────────────────────────────────────

function makeLabel(text) {
  return makeCanvasTex(512, 64, ctx => {
    ctx.clearRect(0, 0, 512, 64)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    ctx.roundRect(4, 4, 504, 56, 10)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font      = 'bold 26px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 34)
  })
}

// ─── Photobook scene object ───────────────────────────────────────────────────

const PAGE_W = 0.65   // metres per page
const PAGE_H = 0.43

// Pre-load all photo textures; crop centre of 2:1 panoramas to fill the page
const texLoader = new THREE.TextureLoader()
const spreadTextures = SPREADS.map(spread => spread.map(({ url }) => {
  const t = texLoader.load(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  // Page AR = 0.65/0.43 ≈ 1.51 ; panorama AR = 2.0 → show central 75.7 % width
  t.repeat.set(0.757, 1.0)
  t.offset.set(0.1215, 0)
  return t
}))

const bookGroup = new THREE.Group()
bookGroup.position.copy(BOOK_POSITION)
scene.add(bookGroup)

// ── Cover (visible when closed) ──────────────────────────────────────────────
const coverTex = makeCanvasTex(680, 440, ctx => {
  const g = ctx.createLinearGradient(0, 0, 680, 440)
  g.addColorStop(0, '#0d1b2a'); g.addColorStop(1, '#1b2838')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 680, 440)
  ctx.strokeStyle = '#c9a96e'; ctx.lineWidth = 5
  ctx.strokeRect(14, 14, 652, 412)
  ctx.fillStyle = '#c9a96e'
  ctx.font = 'bold 72px serif'; ctx.textAlign = 'center'
  ctx.fillText('CityWalk', 340, 190)
  ctx.fillStyle = '#c9a96eaa'
  ctx.font = '28px serif'
  ctx.fillText('Tokyo  ·  Shibuya  ·  2026', 340, 248)
  ctx.fillStyle = '#c9a96e66'
  ctx.font = 'italic 22px serif'
  ctx.fillText('walk closer to open', 340, 400)
})
const coverMat  = new THREE.MeshBasicMaterial({ map: coverTex, transparent: true, opacity: 1 })
const coverMesh = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 2 + 0.03, PAGE_H + 0.03), coverMat)
bookGroup.add(coverMesh)

// ── Spine (shown when open) ───────────────────────────────────────────────────
const spineMat  = new THREE.MeshBasicMaterial({ color: 0x1b2838, transparent: true, opacity: 0 })
const spineMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.026, PAGE_H), spineMat)
spineMesh.position.z = 0.001
bookGroup.add(spineMesh)

// ── Page caption helper ───────────────────────────────────────────────────────
function makeCaption(text) {
  return makeCanvasTex(512, 48, ctx => {
    ctx.clearRect(0, 0, 512, 48)
    ctx.fillStyle = '#3d2b1f'
    ctx.font = 'italic 24px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 26)
  })
}

// ── Left page (group pivots around its right edge = the spine) ────────────────
const leftGroup  = new THREE.Group()
bookGroup.add(leftGroup)

const leftBgMat  = new THREE.MeshBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0 })
const leftBg     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), leftBgMat)
leftBg.position.x = -PAGE_W / 2
leftGroup.add(leftBg)

const leftPhotoMat  = new THREE.MeshBasicMaterial({ map: spreadTextures[0][0], transparent: true, opacity: 0 })
const leftPhoto     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 0.87, PAGE_H * 0.80), leftPhotoMat)
leftPhoto.position.set(-PAGE_W / 2, PAGE_H * 0.055, 0.001)
leftGroup.add(leftPhoto)

const leftCapMat  = new THREE.MeshBasicMaterial({ map: makeCaption(SPREADS[0][0].caption), transparent: true, opacity: 0, depthWrite: false })
const leftCap     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 0.85, 0.055), leftCapMat)
leftCap.position.set(-PAGE_W / 2, -PAGE_H * 0.38, 0.001)
leftGroup.add(leftCap)

// ── Right page ────────────────────────────────────────────────────────────────
const rightGroup  = new THREE.Group()
bookGroup.add(rightGroup)

const rightBgMat  = new THREE.MeshBasicMaterial({ color: 0xf5f0e8, transparent: true, opacity: 0 })
const rightBg     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), rightBgMat)
rightBg.position.x = PAGE_W / 2
rightGroup.add(rightBg)

const rightPhotoMat  = new THREE.MeshBasicMaterial({ map: spreadTextures[0][1], transparent: true, opacity: 0 })
const rightPhoto     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 0.87, PAGE_H * 0.80), rightPhotoMat)
rightPhoto.position.set(PAGE_W / 2, PAGE_H * 0.055, 0.001)
rightGroup.add(rightPhoto)

const rightCapMat  = new THREE.MeshBasicMaterial({ map: makeCaption(SPREADS[0][1].caption), transparent: true, opacity: 0, depthWrite: false })
const rightCap     = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 0.85, 0.055), rightCapMat)
rightCap.position.set(PAGE_W / 2, -PAGE_H * 0.38, 0.001)
rightGroup.add(rightCap)

// ── Navigation hint (shown below the open book) ───────────────────────────────
const hintMat  = new THREE.MeshBasicMaterial({
  map: makeCanvasTex(512, 48, ctx => {
    ctx.clearRect(0, 0, 512, 48)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.beginPath(); ctx.roundRect(0, 4, 512, 40, 8); ctx.fill()
    ctx.fillStyle = '#ffffffcc'; ctx.font = '19px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Q ◀  prev page   next page  ▶ E', 256, 24)
  }),
  transparent: true, opacity: 0, depthWrite: false,
})
const hintMesh = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W * 2 + 0.03, 0.05), hintMat)
hintMesh.position.set(0, -(PAGE_H / 2 + 0.052), 0.001)
bookGroup.add(hintMesh)

// ── Book state ────────────────────────────────────────────────────────────────
let bookOpenProgress = 0   // 0 = fully closed, 1 = fully open
let bookIsOpen       = false
let currentSpread    = 0
let pageCooldown     = 0

// Page flip: fold pages briefly, swap textures at the halfway point
let flipProgress = 0       // counts 1 → 0 when active
let flipPending  = -1      // spread index to load at halfway

function triggerFlip(nextIndex) {
  if (flipProgress > 0) return
  flipPending  = (nextIndex + SPREADS.length) % SPREADS.length
  flipProgress = 1.0
  pageCooldown = 30
}

// Keydown for page navigation (Q/E)
window.addEventListener('keydown', e => {
  if (!bookIsOpen || pageCooldown > 0) return
  if (e.code === 'KeyQ') triggerFlip(currentSpread - 1)
  if (e.code === 'KeyE') triggerFlip(currentSpread + 1)
})

// ─── Travel Journal Orbs ─────────────────────────────────────────────────────
// Glowing orbs mark where each person left a journal entry.
// Walk within JOURNAL_TRIGGER_DIST metres → their voice plays automatically.

const JOURNAL_TRIGGER_DIST = 2.0  // metres
const JOURNAL_ORB_PALETTE   = [0x7c8cf8, 0xf87c8c, 0x8cf87c, 0xf8c87c, 0xc87cf8, 0x7cf8f8]

function orbColorForAuthor(name) {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return JOURNAL_ORB_PALETTE[Math.abs(h) % JOURNAL_ORB_PALETTE.length]
}

const journalOrbs = []  // { orb, audio, entry }

async function loadJournalEntries() {
  if (!cityId) return
  try {
    const res = await fetch(`${BACKEND}/journal/${cityId}`)
    if (!res.ok) return
    const entries = await res.json()
    const audioLoader = new THREE.AudioLoader()

    for (const entry of entries) {
      // Glowing sphere
      const geo  = new THREE.SphereGeometry(0.14, 16, 16)
      const mat  = new THREE.MeshBasicMaterial({
        color: orbColorForAuthor(entry.author),
        transparent: true,
        opacity: 0.85,
      })
      const orb = new THREE.Mesh(geo, mat)
      orb.position.set(entry.position.x, 1.3, entry.position.z)

      // Author label above the orb
      const labelTex = makeLabel(entry.author)
      const labelGeo = new THREE.PlaneGeometry(1.0, 0.18)
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false })
      const labelMesh = new THREE.Mesh(labelGeo, labelMat)
      labelMesh.position.set(0, 0.28, 0)
      orb.add(labelMesh)

      scene.add(orb)

      // Positional audio attached to the orb
      const audio = new THREE.PositionalAudio(audioListener)
      audio.setRefDistance(2)
      audio.setVolume(1.0)
      orb.add(audio)

      audioLoader.load(`${BACKEND}${entry.audioUrl}`, buffer => {
        audio.setBuffer(buffer)
      })

      journalOrbs.push({ orb, audio, entry, labelMat })
    }
  } catch (err) {
    console.warn('[journal] Could not load entries:', err.message)
  }
}

loadJournalEntries()

// ─── Photographer NPC ────────────────────────────────────────────────────────
// A simple humanoid figure standing in the world holding a camera.
// Click / tap them → full-screen photobook overlay opens.

const npcGroup = new THREE.Group()
npcGroup.position.set(1.5, 0, -3.5)
scene.add(npcGroup)

const npcMeshes = []   // collected for raycasting
function npcPart(geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }))
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  npcGroup.add(m)
  npcMeshes.push(m)
  return m
}

const SKIN  = 0xf5c5a3
const COAT  = 0x1e3a5c   // dark navy jacket
const PANTS = 0x2a2a2a
const SHOE  = 0x111111
const CAM   = 0x222222

// shoes
npcPart(new THREE.BoxGeometry(0.09, 0.045, 0.15), SHOE, -0.075, 0.022, 0.06)
npcPart(new THREE.BoxGeometry(0.09, 0.045, 0.15), SHOE,  0.075, 0.022, 0.06)
// legs
npcPart(new THREE.CylinderGeometry(0.055, 0.06, 0.50), PANTS, -0.075, 0.295, 0)
npcPart(new THREE.CylinderGeometry(0.055, 0.06, 0.50), PANTS,  0.075, 0.295, 0)
// torso
npcPart(new THREE.CylinderGeometry(0.115, 0.135, 0.44), COAT, 0, 0.77, 0)
// neck
npcPart(new THREE.CylinderGeometry(0.045, 0.045, 0.10), SKIN, 0, 1.04, 0)
// head
npcPart(new THREE.SphereGeometry(0.135, 12, 10), SKIN, 0, 1.20, 0)
// hair (dark cap sitting on top)
npcPart(new THREE.SphereGeometry(0.142, 12, 7),  0x1a0a00, 0, 1.26, -0.01)
// left arm — relaxed at side
npcPart(new THREE.CylinderGeometry(0.038, 0.038, 0.38), COAT, -0.20, 0.77, 0, 0, 0,  0.14)
npcPart(new THREE.SphereGeometry(0.042, 6, 6), SKIN, -0.23, 0.58, 0)  // left hand
// right arm — raised, angled forward to hold camera
npcPart(new THREE.CylinderGeometry(0.038, 0.038, 0.36), COAT,  0.20, 0.85, -0.08, -0.9, 0, -0.22)
npcPart(new THREE.SphereGeometry(0.042, 6, 6), SKIN,  0.29, 1.01, -0.24)  // right hand

// camera body
npcPart(new THREE.BoxGeometry(0.13, 0.09, 0.08), CAM,   0.29, 1.02, -0.30)
// camera lens (cylinder pointing forward)
npcPart(new THREE.CylinderGeometry(0.026, 0.030, 0.06), 0x334455,
        0.29, 1.02, -0.34, Math.PI / 2, 0, 0)
// tiny viewfinder bump on top of camera
npcPart(new THREE.BoxGeometry(0.04, 0.025, 0.025), 0x111111, 0.29, 1.073, -0.295)

// Rotate so NPC faces roughly toward the player spawn (origin)
npcGroup.rotation.y = Math.atan2(
  0 - npcGroup.position.x,
  0 - npcGroup.position.z,
)

// Floating "click me" hint label above head
const hintTex = makeCanvasTex(400, 52, ctx => {
  ctx.clearRect(0, 0, 400, 52)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath(); ctx.roundRect(0, 4, 400, 44, 10); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('📷  Click to view photos', 200, 26)
})
const hintBillboard = new THREE.Mesh(
  new THREE.PlaneGeometry(0.72, 0.094),
  new THREE.MeshBasicMaterial({ map: hintTex, transparent: true, opacity: 0, depthWrite: false }),
)
hintBillboard.position.set(0, 1.55, 0)
npcGroup.add(hintBillboard)

// ─── Photobook overlay controller ────────────────────────────────────────────

const pbOverlay  = document.getElementById('pb-overlay')
const pbImgL     = document.getElementById('pb-img-left')
const pbImgR     = document.getElementById('pb-img-right')
const pbCapL     = document.getElementById('pb-cap-left')
const pbCapR     = document.getElementById('pb-cap-right')
const pbNumL     = document.getElementById('pb-num-left')
const pbNumR     = document.getElementById('pb-num-right')
const pbSpread   = document.getElementById('pb-spread')
const pbDotsEl   = document.getElementById('pb-dots')

// Build dots
SPREADS.forEach((_, i) => {
  const d = document.createElement('div')
  d.className = 'pb-dot' + (i === 0 ? ' active' : '')
  d.addEventListener('click', () => pbGoTo(i))
  pbDotsEl.appendChild(d)
})

let pbCurrentSpread = 0
let pbOpen = false

function pbPopulate(index) {
  const spread = SPREADS[index]
  pbImgL.src  = spread[0].url;  pbCapL.textContent = spread[0].caption
  pbImgR.src  = spread[1].url;  pbCapR.textContent = spread[1].caption
  pbNumL.textContent = String(index * 2 + 1)
  pbNumR.textContent = String(index * 2 + 2)
  pbDotsEl.querySelectorAll('.pb-dot').forEach((d, i) =>
    d.classList.toggle('active', i === index))
}

function pbGoTo(index, dir = 1) {
  pbCurrentSpread = (index + SPREADS.length) % SPREADS.length
  pbSpread.classList.remove('flip-in')
  pbSpread.classList.add('flip-out')
  setTimeout(() => {
    pbPopulate(pbCurrentSpread)
    pbSpread.classList.remove('flip-out')
    void pbSpread.offsetWidth   // reflow to restart animation
    pbSpread.classList.add('flip-in')
  }, 220)
}

function openPhotobookOverlay() {
  pbCurrentSpread = 0
  pbPopulate(0)
  pbSpread.classList.remove('flip-out', 'flip-in')
  pbOverlay.classList.add('open')
  pbOpen = true
}

function closePhotobookOverlay() {
  pbOverlay.classList.remove('open')
  pbOpen = false
}

document.getElementById('pb-prev').addEventListener('click',  () => pbGoTo(pbCurrentSpread - 1, -1))
document.getElementById('pb-next').addEventListener('click',  () => pbGoTo(pbCurrentSpread + 1,  1))
document.getElementById('pb-close').addEventListener('click', closePhotobookOverlay)
window.addEventListener('keydown', e => { if (e.code === 'Escape' && pbOpen) closePhotobookOverlay() })

// ─── Raycaster for NPC click ──────────────────────────────────────────────────

const raycaster  = new THREE.Raycaster()
const mousePick  = new THREE.Vector2()

// Track mouse-down position to distinguish clicks from drags
let mouseDownX = 0, mouseDownY = 0

renderer.domElement.addEventListener('mousedown', e => { mouseDownX = e.clientX; mouseDownY = e.clientY })

renderer.domElement.addEventListener('click', e => {
  // Ignore if this was actually a drag
  if (Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY) > 6) return
  // Ignore if photobook overlay is already open
  if (pbOpen) return

  mousePick.x = (e.clientX / window.innerWidth)  *  2 - 1
  mousePick.y = (e.clientY / window.innerHeight) * -2 + 1
  raycaster.setFromCamera(mousePick, camera)
  if (raycaster.intersectObjects(npcMeshes).length > 0) openPhotobookOverlay()
})

// Change cursor to pointer when hovering over NPC
renderer.domElement.addEventListener('mousemove', e => {
  if (pbOpen || dragging) return
  mousePick.x = (e.clientX / window.innerWidth)  *  2 - 1
  mousePick.y = (e.clientY / window.innerHeight) * -2 + 1
  raycaster.setFromCamera(mousePick, camera)
  const hit = raycaster.intersectObjects(npcMeshes).length > 0
  document.body.classList.toggle('npc-hover', hit)
  hintBillboard.material.opacity = hit ? 1 : 0
})

// ─── Mouse-drag look + WASD move ─────────────────────────────────────────────

let yaw = 0, pitch = 0
let dragging = false, lastX = 0, lastY = 0

renderer.domElement.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY })
window.addEventListener('mouseup',   () => { dragging = false })
window.addEventListener('mousemove', e => {
  if (!dragging) return
  yaw   -= (e.clientX - lastX) * 0.003
  pitch -= (e.clientY - lastY) * 0.003
  pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
  lastX  = e.clientX; lastY = e.clientY
})

// ─── Touch look + Pinch-to-zoom FOV ─────────────────────────────────────────

const FOV_MIN = 30
const FOV_MAX = 120

let lastTouchX = 0, lastTouchY = 0
let lastPinchDist = null

function pinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

renderer.domElement.addEventListener('touchstart', e => {
  e.preventDefault()
  if (e.touches.length === 1) {
    lastTouchX = e.touches[0].clientX
    lastTouchY = e.touches[0].clientY
    lastPinchDist = null
  } else if (e.touches.length === 2) {
    lastPinchDist = pinchDist(e.touches)
  }
}, { passive: false })

renderer.domElement.addEventListener('touchmove', e => {
  e.preventDefault()
  if (e.touches.length === 1 && lastPinchDist === null) {
    // Single-finger drag to look around
    yaw   -= (e.touches[0].clientX - lastTouchX) * 0.003
    pitch -= (e.touches[0].clientY - lastTouchY) * 0.003
    pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
    lastTouchX = e.touches[0].clientX
    lastTouchY = e.touches[0].clientY
  } else if (e.touches.length === 2) {
    // Two-finger pinch to zoom (adjust FOV)
    const dist = pinchDist(e.touches)
    if (lastPinchDist !== null) {
      const delta = lastPinchDist - dist  // positive = pinch in = zoom out
      camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, camera.fov + delta * 0.1))
      camera.updateProjectionMatrix()
    }
    lastPinchDist = dist
  }
}, { passive: false })

renderer.domElement.addEventListener('touchend', e => {
  if (e.touches.length < 2) lastPinchDist = null
  if (e.touches.length === 0) { lastTouchX = 0; lastTouchY = 0 }
})

// WASD + arrow keys movement
const keys = {}
window.addEventListener('keydown', e => { keys[e.code] = true })
window.addEventListener('keyup',   e => { keys[e.code] = false })

// ─── XR Controller thumbstick helpers ────────────────────────────────────────

// Pico / OpenXR controllers expose axes [2]=thumbX, [3]=thumbY
function readThumbstick(inputSource, deadzone = 0.15) {
  const gp = inputSource?.gamepad
  if (!gp || gp.axes.length < 4) return { x: 0, y: 0 }
  const x = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0
  const y = Math.abs(gp.axes[3]) > deadzone ? gp.axes[3] : 0
  return { x, y }
}

const xrController0 = renderer.xr.getController(0)
const xrController1 = renderer.xr.getController(1)
scene.add(xrController0)
scene.add(xrController1)

// ─── Loading UI ──────────────────────────────────────────────────────────────

const loadingEl  = document.getElementById('loading')
const loadingTxt = document.getElementById('loading-text')

// ─── Debug overlay ───────────────────────────────────────────────────────────

const dbg = document.createElement('pre')
dbg.style.cssText = 'position:fixed;top:8px;left:8px;color:#0f0;font:11px monospace;z-index:99;pointer-events:none'
document.body.appendChild(dbg)

// ─── Splat ───────────────────────────────────────────────────────────────────

let boundary = null  // clamped XZ bounds set on load

const splat = new SplatMesh({
  url: SPLAT_URL,
  onLoad: () => {
    if (loadingEl) loadingEl.style.display = 'none'
    const box = splat.getBoundingBox()
    if (box) {
      // Shrink inward so the camera stays inside visible content
      const margin = 0.5
      boundary = new THREE.Box3(
        new THREE.Vector3(box.min.x + margin, -Infinity, box.min.z + margin),
        new THREE.Vector3(box.max.x - margin,  Infinity, box.max.z - margin),
      )
      const size = new THREE.Vector3()
      box.getSize(size)
      dbg.textContent = `numSplats: ${splat.numSplats} | bounds XZ: ${size.x.toFixed(1)} × ${size.z.toFixed(1)}`
    }
  },
})

// Panorama splats from 360° capture: Y-axis needs flipping
splat.rotation.x = Math.PI
scene.add(splat)

splat.initialized.catch(err => {
  if (loadingTxt) loadingTxt.textContent = `Load failed: ${err.message}`
})


// ─── Resize ──────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Render loop ─────────────────────────────────────────────────────────────

const euler   = new THREE.Euler(0, 0, 0, 'YXZ')
const forward = new THREE.Vector3()
const right   = new THREE.Vector3()
const SPEED   = 0.03

renderer.setAnimationLoop(() => {
  if (renderer.xr.isPresenting) {
    // ── XR (Pico headset) mode ────────────────────────────────────────────
    // Headset pose drives camera rotation; we only handle locomotion here.
    const session = renderer.xr.getSession()
    const sources = session ? [...session.inputSources] : []

    const leftSrc  = sources.find(s => s.handedness === 'left')
    const rightSrc = sources.find(s => s.handedness === 'right')

    // Left thumbstick → forward/strafe, relative to where the player is looking
    if (leftSrc) {
      const { x: lx, y: ly } = readThumbstick(leftSrc)
      if (lx !== 0 || ly !== 0) {
        // Project head forward onto the horizontal plane for ground locomotion
        camera.getWorldDirection(forward)
        forward.y = 0
        forward.normalize()
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        playerRig.position.addScaledVector(forward, -ly * SPEED)
        playerRig.position.addScaledVector(right,    lx * SPEED)
      }
    }

    // Right thumbstick X → snap-turn (45° increments)
    if (rightSrc) {
      const { x: rx } = readThumbstick(rightSrc, 0.5)
      if (rx !== 0 && !rightSrc._snapUsed) {
        playerRig.rotateY(-Math.sign(rx) * (Math.PI / 4))
        rightSrc._snapUsed = true
      } else if (rx === 0) {
        if (rightSrc) rightSrc._snapUsed = false
      }
    }
  } else {
    // ── Desktop / flat-screen mode ────────────────────────────────────────
    euler.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(euler)

    // WASD movement in camera-facing direction (ignore vertical tilt)
    const flatYaw = new THREE.Euler(0, yaw, 0, 'YXZ')
    forward.set(0, 0, -1).applyEuler(flatYaw)
    right.set(1, 0, 0).applyEuler(flatYaw)

    if (keys['KeyW'] || keys['ArrowUp'])    playerRig.position.addScaledVector(forward,  SPEED)
    if (keys['KeyS'] || keys['ArrowDown'])  playerRig.position.addScaledVector(forward, -SPEED)
    if (keys['KeyA'] || keys['ArrowLeft'])  playerRig.position.addScaledVector(right,   -SPEED)
    if (keys['KeyD'] || keys['ArrowRight']) playerRig.position.addScaledVector(right,    SPEED)
  }

  // Clamp to splat bounds so the user can't walk out of the city
  if (boundary) playerRig.position.clamp(boundary.min, boundary.max)

  // ── Photobook ─────────────────────────────────────────────────────────────
  const camWorld = new THREE.Vector3()
  camera.getWorldPosition(camWorld)

  // Billboard: face camera on Y axis only
  bookGroup.lookAt(camWorld.x, bookGroup.position.y, camWorld.z)

  // Decide open/close based on proximity
  const distToBook = camWorld.distanceTo(bookGroup.position)
  if (!bookIsOpen && distToBook < BOOK_OPEN_DIST)   bookIsOpen = true
  if ( bookIsOpen && distToBook > BOOK_CLOSE_DIST)  bookIsOpen = false

  // Smoothly animate open progress
  const targetProgress = bookIsOpen ? 1 : 0
  bookOpenProgress += (targetProgress - bookOpenProgress) * 0.07
  const p = bookOpenProgress * bookOpenProgress * (3 - 2 * bookOpenProgress)  // smoothstep

  // ── Page flip animation (fold pages, swap textures at midpoint, unfold) ──
  let flipScale = 1  // X-axis scale applied to both page groups during flip
  if (flipProgress > 0) {
    flipProgress = Math.max(0, flipProgress - 0.08)
    // First half → fold in (scale collapses toward spine)
    // Second half → unfold out (scale expands from spine)
    const half = flipProgress >= 0.5
      ? (flipProgress - 0.5) * 2          // second half: 0→1 (expanding)
      : flipProgress * 2                  // first half:  1→0 (collapsing)
    flipScale = half

    // Swap textures at the midpoint (when pages are "behind" the spine)
    if (flipProgress < 0.5 && flipPending >= 0) {
      currentSpread = flipPending
      flipPending   = -1
      leftPhotoMat.map  = spreadTextures[currentSpread][0]; leftPhotoMat.needsUpdate  = true
      rightPhotoMat.map = spreadTextures[currentSpread][1]; rightPhotoMat.needsUpdate = true
      leftCapMat.map    = makeCaption(SPREADS[currentSpread][0].caption); leftCapMat.needsUpdate  = true
      rightCapMat.map   = makeCaption(SPREADS[currentSpread][1].caption); rightCapMat.needsUpdate = true
    }
  }
  if (pageCooldown > 0) pageCooldown--

  // Apply flip scale (squish along X relative to spine pivot)
  leftGroup.scale.x  = flipScale
  rightGroup.scale.x = flipScale

  // ── Page fold open/close (rotate around spine) ────────────────────────────
  // Closed: pages folded 90° in front of spine  |  Open: pages flat, spread out
  const foldAngle = (1 - p) * Math.PI / 2
  leftGroup.rotation.y  = -foldAngle   // folds from -90° (closed) → 0° (open)
  rightGroup.rotation.y =  foldAngle   // folds from +90° (closed) → 0° (open)

  // ── Material opacities ───────────────────────────────────────────────────
  coverMat.opacity   = 1 - p             // cover visible when closed
  spineMat.opacity   = p
  leftBgMat.opacity  = rightBgMat.opacity  = p
  leftPhotoMat.opacity = rightPhotoMat.opacity = p
  leftCapMat.opacity   = rightCapMat.opacity   = p
  hintMat.opacity    = p * (SPREADS.length > 1 ? 1 : 0)

  // ── NPC idle animation ────────────────────────────────────────────────────
  const t = Date.now() * 0.001
  // Subtle breathing bob + gentle camera-raise sway
  npcGroup.position.y = Math.sin(t * 0.9) * 0.008
  npcGroup.rotation.z = Math.sin(t * 0.6) * 0.012

  // hint label always faces camera (billboard on Y only)
  hintBillboard.lookAt(camWorld.x, hintBillboard.getWorldPosition(new THREE.Vector3()).y, camWorld.z)

  // ── Journal orb proximity + auto-play ────────────────────────────────────
  const tOrb = Date.now() * 0.003
  for (const item of journalOrbs) {
    const dist = camWorld.distanceTo(item.orb.position)

    // Billboard: always face the camera
    item.orb.lookAt(camWorld.x, item.orb.position.y, camWorld.z)

    // Pulse scale when player is nearby
    const near  = dist < JOURNAL_TRIGGER_DIST * 2
    const pulse = near ? 1 + 0.2 * Math.sin(tOrb + item.orb.position.x) : 1
    item.orb.scale.setScalar(pulse)

    // Auto-play voice when player enters trigger radius
    if (dist < JOURNAL_TRIGGER_DIST && item.audio.buffer && !item.audio.isPlaying) {
      item.audio.play()
    }
  }

  renderer.render(scene, camera)
})
