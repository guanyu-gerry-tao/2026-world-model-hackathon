import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { SplatMesh } from '@sparkjsdev/spark'

// ─── Config ──────────────────────────────────────────────────────────────────

const SPLAT_URL = '/benchmark/test-gemini-20260315065249/world.spz'

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

  renderer.render(scene, camera)
})
