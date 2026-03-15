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

// ─── Mouse-drag look (panorama style) ────────────────────────────────────────

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

// ─── Loading UI ──────────────────────────────────────────────────────────────

const loadingEl  = document.getElementById('loading')
const loadingTxt = document.getElementById('loading-text')

// ─── Debug overlay ───────────────────────────────────────────────────────────

const dbg = document.createElement('pre')
dbg.style.cssText = 'position:fixed;top:8px;left:8px;color:#0f0;font:11px monospace;z-index:99;pointer-events:none'
document.body.appendChild(dbg)

// ─── Splat ───────────────────────────────────────────────────────────────────

const splat = new SplatMesh({
  url: SPLAT_URL,
  onLoad: () => {
    if (loadingEl) loadingEl.style.display = 'none'
    const box = splat.getBoundingBox()
    const center = new THREE.Vector3()
    const size   = new THREE.Vector3()
    if (box) { box.getCenter(center); box.getSize(size) }
    dbg.textContent = `numSplats: ${splat.numSplats}\ncenter: ${center.toArray().map(v=>v.toFixed(2))}\nsize: ${size.toArray().map(v=>v.toFixed(2))}`
  },
})

// Panorama splats from 360° capture: Y-axis needs flipping
splat.rotation.x = Math.PI
scene.add(splat)

splat.initialized.catch(err => {
  if (loadingTxt) loadingTxt.textContent = `Load failed: ${err.message}`
})

// ─── Orientation tweaks (arrow keys) ─────────────────────────────────────────

const ROT_STEP = Math.PI / 12
window.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    splat.rotation.x -= ROT_STEP; break
    case 'ArrowDown':  splat.rotation.x += ROT_STEP; break
    case 'ArrowLeft':  splat.rotation.y -= ROT_STEP; break
    case 'ArrowRight': splat.rotation.y += ROT_STEP; break
    case 'r': case 'R': splat.rotation.set(Math.PI, 0, 0); break
  }
  dbg.textContent = `rot: ${splat.rotation.x.toFixed(2)}, ${splat.rotation.y.toFixed(2)}, ${splat.rotation.z.toFixed(2)}`
})

// ─── Resize ──────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Render loop ─────────────────────────────────────────────────────────────

const euler = new THREE.Euler(0, 0, 0, 'YXZ')

renderer.setAnimationLoop(() => {
  euler.set(pitch, yaw, 0)
  camera.quaternion.setFromEuler(euler)
  renderer.render(scene, camera)
})
