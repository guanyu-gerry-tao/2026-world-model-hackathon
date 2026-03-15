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
// Each entry = one two-page spread: [left photo, right photo]
const SPREADS = [
  [
    { url: '/benchmark/input-photos/pexels-nickkwanhk-2614818.jpg',   caption: 'Tokyo streets'           },
    { url: '/benchmark/input-photos/pexels-agk42-2816904.jpg',        caption: 'City lights at dusk'     },
  ],
  [
    { url: '/benchmark/input-photos/pexels-dsd-143941-1829980.jpg',   caption: 'Urban exploration'       },
    { url: '/benchmark/input-photos/pexels-pixabay-209798.jpg',       caption: 'Street scene'            },
  ],
  [
    { url: '/benchmark/input-photos/image.jpg',                        caption: 'Shibuya crossing'        },
    { url: '/benchmark/input-photos/2025-07-12-IMG_6945.jpeg',         caption: 'Summer trip memory'      },
  ],
  [
    { url: '/benchmark/input-photos/L1001707-copy.jpg',                caption: 'Captured on film'        },
    { url: '/benchmark/test-gemini-20260315000644/panorama_raw.png',   caption: 'World model – earlier'   },
  ],
  [
    { url: '/benchmark/test-gemini-20260315065249/panorama_raw.png',  caption: 'World model – raw scan'  },
    { url: '/benchmark/test-gemini-20260315065249/panorama.png',      caption: 'World model – AI refined'},
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

// ─── Background Music ─────────────────────────────────────────────────────────
const bgMusic = new THREE.Audio(audioListener)
new THREE.AudioLoader().load('/music.mp3', buffer => {
  bgMusic.setBuffer(buffer)
  bgMusic.setLoop(true)
  bgMusic.setVolume(0.25)
})
renderer.xr.addEventListener('sessionstart', () => {
  if (audioListener.context.state === 'suspended') audioListener.context.resume()
  if (!bgMusic.isPlaying) bgMusic.play()
})

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

// (3D book removed — photos are shown via the HTML overlay only)

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

// ─── Demo Journal Orb (hardcoded) ────────────────────────────────────────────
// Sai's journal entry — pinned to the lantern window on the LEFT side.
// POSITION: (-3, 1.3, -2) — turn left from start, walk toward the warm lantern.
// Voice triggers only when within 1.5m (tight radius — must be right next to it).
const DEMO_ORB_TRIGGER = 1.5  // tighter than default so it only plays up close

;(function spawnDemoOrb() {
  const geo = new THREE.SphereGeometry(0.14, 16, 16)
  const mat = new THREE.MeshBasicMaterial({ color: 0x7c8cf8, transparent: true, opacity: 0.85 })
  const orb = new THREE.Mesh(geo, mat)
  orb.position.set(-3, 1.3, -2)

  const labelTex = makeLabel('Sai')
  const labelGeo = new THREE.PlaneGeometry(1.0, 0.18)
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false })
  const labelMesh = new THREE.Mesh(labelGeo, labelMat)
  labelMesh.position.set(0, 0.28, 0)
  orb.add(labelMesh)
  scene.add(orb)

  const audio = new THREE.PositionalAudio(audioListener)
  audio.setRefDistance(1.5)
  audio.setVolume(1.0)
  orb.add(audio)

  new THREE.AudioLoader().load('/benchmark/journal-sai.mp3', buffer => audio.setBuffer(buffer))

  // Use DEMO_ORB_TRIGGER (not the global JOURNAL_TRIGGER_DIST) for proximity check
  journalOrbs.push({ orb, audio, entry: { author: 'Sai', avatarUrl: '/benchmark/avatar-sai.png' }, labelMat, triggerDist: DEMO_ORB_TRIGGER })
})()

// ─── Photographer NPC ────────────────────────────────────────────────────────
// A simple humanoid figure standing in the world holding a camera.
// Click / tap them → full-screen photobook overlay opens.

// NPC_GROUND_Y: vertical offset so the sprite's feet sit on the visible ground.
// y=0 is the panorama capture eye-level; tweak this until feet touch the floor.
const NPC_GROUND_Y   = -1.2

// Proximity distances for the auto-popup photobook
const NPC_POPUP_OPEN  = 2.5   // metres → overlay opens automatically
const NPC_POPUP_CLOSE = 4.5   // metres → overlay closes automatically

const npcGroup = new THREE.Group()
npcGroup.position.set(1.5, NPC_GROUND_Y, -3.5)
scene.add(npcGroup)

const npcMeshes = []   // collected for raycasting

// Load the photographer photo as a billboard sprite.
// Aspect ratio is read from the image so the plane always matches it.
new THREE.TextureLoader().load('/npc.png', tex => {
  tex.colorSpace = THREE.SRGBColorSpace
  const aspect  = tex.image.width / tex.image.height
  const NPC_H   = 1.6                   // metres tall in the world
  const NPC_W   = NPC_H * aspect
  const sprite  = new THREE.Mesh(
    new THREE.PlaneGeometry(NPC_W, NPC_H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08 }),
  )
  sprite.position.y = NPC_H / 2        // feet on the ground
  npcGroup.add(sprite)
  npcMeshes.push(sprite)
})

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
const jpPopup    = document.getElementById('journal-popup')
const jpAvatar   = document.getElementById('jp-avatar')
const jpName     = document.getElementById('jp-name')

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

  const camWorld = new THREE.Vector3()
  camera.getWorldPosition(camWorld)

  // ── NPC billboard + idle animation ───────────────────────────────────────
  const t = Date.now() * 0.001
  // Always face the camera (billboard on Y axis)
  npcGroup.lookAt(camWorld.x, npcGroup.position.y, camWorld.z)
  // Subtle breathing bob — add to the ground base, don't replace it
  npcGroup.position.y = NPC_GROUND_Y + Math.sin(t * 0.9) * 0.007

  // hint label always faces camera
  hintBillboard.lookAt(camWorld.x, hintBillboard.getWorldPosition(new THREE.Vector3()).y, camWorld.z)

  // ── Proximity auto-popup ──────────────────────────────────────────────────
  const npcWorldPos = new THREE.Vector3(1.5, NPC_GROUND_Y, -3.5)
  const distToNpc   = camWorld.distanceTo(npcWorldPos)
  if (!pbOpen && distToNpc < NPC_POPUP_OPEN)   openPhotobookOverlay()
  if ( pbOpen && distToNpc > NPC_POPUP_CLOSE)  closePhotobookOverlay()

  // ── Journal orb proximity + auto-play + popup ────────────────────────────

  const tOrb = Date.now() * 0.003
  let nearestOrb = null
  let nearestDist = Infinity

  for (const item of journalOrbs) {
    const dist    = camWorld.distanceTo(item.orb.position)
    const trigger = item.triggerDist ?? JOURNAL_TRIGGER_DIST

    // Billboard: always face the camera
    item.orb.lookAt(camWorld.x, item.orb.position.y, camWorld.z)

    // Pulse scale when player is nearby
    const near  = dist < trigger * 2
    const pulse = near ? 1 + 0.2 * Math.sin(tOrb + item.orb.position.x) : 1
    item.orb.scale.setScalar(pulse)

    // Auto-play voice when player enters trigger radius
    if (dist < trigger && item.audio.buffer && !item.audio.isPlaying) {
      item.audio.play()
    }

    // Track closest orb within popup range
    if (dist < trigger && dist < nearestDist) {
      nearestDist = dist
      nearestOrb  = item
    }
  }

  // Show/hide popup for nearest orb
  if (nearestOrb) {
    const entry = nearestOrb.entry
    if (jpAvatar.dataset.author !== entry.author) {
      jpAvatar.src = entry.avatarUrl || ''
      jpAvatar.dataset.author = entry.author
      jpName.textContent = entry.author
    }
    jpPopup.classList.add('visible')
    jpPopup.classList.toggle('playing', nearestOrb.audio.isPlaying)
  } else {
    jpPopup.classList.remove('visible', 'playing')
  }

  renderer.render(scene, camera)
})
