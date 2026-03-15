import * as THREE from 'three'
import { SplatMesh } from '@sparkjsdev/spark'

// ─── Config ──────────────────────────────────────────────────────────────────

const SPLAT_URL = '/benchmark/test-gemini-20260315000644/world.spz'

// ─── Renderer ────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// ─── Scene + Camera ──────────────────────────────────────────────────────────

const scene  = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 500)

// Panorama splat: camera starts at origin (the capture point)
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

// WASD + arrow keys movement
const keys = {}
window.addEventListener('keydown', e => { keys[e.code] = true })
window.addEventListener('keyup',   e => { keys[e.code] = false })

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
const SPEED   = 0.01

renderer.setAnimationLoop(() => {
  // Apply look rotation
  euler.set(pitch, yaw, 0)
  camera.quaternion.setFromEuler(euler)

  // WASD movement in camera-facing direction (ignore vertical tilt for movement)
  const flatYaw = new THREE.Euler(0, yaw, 0, 'YXZ')
  forward.set(0, 0, -1).applyEuler(flatYaw)
  right.set(1, 0, 0).applyEuler(flatYaw)

  if (keys['KeyW'] || keys['ArrowUp'])    camera.position.addScaledVector(forward,  SPEED)
  if (keys['KeyS'] || keys['ArrowDown'])  camera.position.addScaledVector(forward, -SPEED)
  if (keys['KeyA'] || keys['ArrowLeft'])  camera.position.addScaledVector(right,   -SPEED)
  if (keys['KeyD'] || keys['ArrowRight']) camera.position.addScaledVector(right,    SPEED)

  // Clamp to splat bounds so the user can't walk out of the city
  if (boundary) camera.position.clamp(boundary.min, boundary.max)

  renderer.render(scene, camera)
})
