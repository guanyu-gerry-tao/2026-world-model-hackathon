import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { SplatLoader } from './scene/SplatLoader.js'

// ─── Config ──────────────────────────────────────────────────────────────────

const SPLAT_URL = '/benchmark/test-gemini-20260315000644/world.spz'

// Starting camera position — slightly above ground, facing into the scene
const INITIAL_CAMERA_POS = new THREE.Vector3(0, 1.6, 3)
const INITIAL_LOOK_AT    = new THREE.Vector3(0, 1.0, 0)

// ─── Renderer ────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.xr.enabled = true
document.body.appendChild(renderer.domElement)
document.body.appendChild(VRButton.createButton(renderer))

// ─── Scene + Camera ──────────────────────────────────────────────────────────

const scene  = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
)
camera.position.copy(INITIAL_CAMERA_POS)
camera.lookAt(INITIAL_LOOK_AT)

// ─── Desktop controls (inactive in XR) ──────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.copy(INITIAL_LOOK_AT)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.update()

// ─── Splat loader ────────────────────────────────────────────────────────────

const splatLoader = new SplatLoader({ renderer, scene, camera })

const loadingEl  = document.getElementById('loading')
const loadingTxt = document.getElementById('loading-text')
const loadingBar = document.getElementById('loading-bar')

splatLoader
  .load(SPLAT_URL, (pct) => {
    if (loadingBar) loadingBar.style.width = `${Math.round(pct * 100)}%`
    if (loadingTxt) loadingTxt.textContent = `Loading city… ${Math.round(pct * 100)}%`
  })
  .then(() => {
    if (loadingEl) loadingEl.style.display = 'none'
    console.log('[CityWalk] splat ready')
  })
  .catch((err) => {
    console.error('[CityWalk] splat load failed', err)
    if (loadingTxt) loadingTxt.textContent = `Load failed: ${err.message}`
  })

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Render loop ─────────────────────────────────────────────────────────────

renderer.setAnimationLoop(() => {
  // OrbitControls only meaningful outside XR
  if (!renderer.xr.isPresenting) controls.update()

  splatLoader.update()
  splatLoader.render()
})
