import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { SplatMesh } from '@sparkjsdev/spark'

// ─── Config ──────────────────────────────────────────────────────────────────

const SPLAT_URL = '/benchmark/test-gemini-20260315065249/world.spz'

// ─── Photo Hotspots ──────────────────────────────────────────────────────────
// Real photos anchored at positions inside the 3D world.
// When you walk within PHOTO_SHOW_DIST metres the photo fades in as a floating
// framed print; a white glowing dot marks the spot from further away.
//
// To add your own photos: drop image files into benchmark/tokyo-shibuya/photos/
// and update the `url` paths below.  Positions are (x, y, z) in world-space
// metres — y ≈ 1.4 keeps the frame at roughly eye-height.

const PHOTO_HOTSPOTS = [
  {
    position: new THREE.Vector3(3,  1.4, -4),
    url: '/benchmark/test-gemini-20260315065249/panorama_raw.png',
    label: 'Shibuya – raw capture',
  },
  {
    position: new THREE.Vector3(-3, 1.4, -3),
    url: '/benchmark/test-gemini-20260315065249/panorama.png',
    label: 'Shibuya – AI refined',
  },
  {
    position: new THREE.Vector3(0,  1.4,  4),
    url: '/benchmark/test-gemini-20260315000644/panorama_raw.png',
    label: 'Earlier take',
  },
  {
    position: new THREE.Vector3(-2.5, 1.4, 3),
    url: '/benchmark/test-gemini-20260315000644/panorama.png',
    label: 'World model source',
  },
]

const PHOTO_SHOW_DIST  = 3.5  // metres – fully visible inside this radius
const PHOTO_FADE_START = 6.0  // metres – start fading in

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

// ─── Photo frame builder ─────────────────────────────────────────────────────

const photoObjects = []

function makeLabel(text) {
  const cv  = document.createElement('canvas')
  cv.width  = 512
  cv.height = 64
  const ctx = cv.getContext('2d')
  ctx.clearRect(0, 0, 512, 64)
  // semi-transparent dark pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.roundRect(4, 4, 504, 56, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 34)
  return new THREE.CanvasTexture(cv)
}

function createPhotoHotspot({ position, url, label }) {
  const group = new THREE.Group()
  group.position.copy(position)

  // ── Glowing white dot (visible from distance) ──
  const dotGeo = new THREE.SphereGeometry(0.13, 10, 10)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 })
  const dot    = new THREE.Mesh(dotGeo, dotMat)
  group.add(dot)

  // ── White backing / frame ──
  const bgGeo = new THREE.PlaneGeometry(1.84, 1.02)
  const bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  const bg    = new THREE.Mesh(bgGeo, bgMat)
  bg.position.set(0, 0.1, -0.003)
  group.add(bg)

  // ── Photo plane ──
  const loader = new THREE.TextureLoader()
  const tex    = loader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  const photoGeo = new THREE.PlaneGeometry(1.8, 0.9)   // 2:1 matches panorama AR
  const photoMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 })
  const photoMesh = new THREE.Mesh(photoGeo, photoMat)
  photoMesh.position.set(0, 0.1, 0)
  group.add(photoMesh)

  // ── Label strip below the photo ──
  const labelTex = makeLabel(label)
  const labelGeo = new THREE.PlaneGeometry(1.8, 0.22)
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, opacity: 0, depthWrite: false })
  const labelMesh = new THREE.Mesh(labelGeo, labelMat)
  labelMesh.position.set(0, -0.42, 0)
  group.add(labelMesh)

  scene.add(group)
  photoObjects.push({ group, photoMat, bgMat, labelMat, dotMat })
}

PHOTO_HOTSPOTS.forEach(createPhotoHotspot)

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

  // ── Photo hotspot proximity + billboard ───────────────────────────────────
  const camWorld = new THREE.Vector3()
  camera.getWorldPosition(camWorld)

  for (const obj of photoObjects) {
    const dist = camWorld.distanceTo(obj.group.position)

    // Billboard: rotate group to face camera, keeping upright on Y
    obj.group.lookAt(camWorld.x, obj.group.position.y, camWorld.z)

    // Fade in as player approaches
    const t = THREE.MathUtils.clamp(
      (PHOTO_FADE_START - dist) / (PHOTO_FADE_START - PHOTO_SHOW_DIST),
      0, 1
    )
    const eased = t * t * (3 - 2 * t)  // smoothstep

    obj.photoMat.opacity  = eased
    obj.bgMat.opacity     = eased
    obj.labelMat.opacity  = eased
    // Dot: visible far away, fades out when photo appears
    obj.dotMat.opacity    = 1 - eased * 0.85
  }

  renderer.render(scene, camera)
})
