/**
 * CityWalk — MusicController
 *
 * Handles background music and hotspot-triggered volume changes in the WebXR scene.
 *
 * Usage:
 *   const music = new MusicController(camera)
 *   await music.load('assets/cities/tokyo-shibuya/music.mp3')
 *   music.play()
 *
 *   // In the per-frame loop:
 *   music.setHotspotProximity(normalizedDistance) // 0 = at hotspot, 1 = far away
 */

import * as THREE from 'three'

const BASE_VOLUME = 0.25      // default background volume
const HOTSPOT_VOLUME = 0.6    // volume when standing at a hotspot
const FADE_SPEED = 0.02       // volume change per frame (~1.2s to full transition at 60fps)

export class MusicController {
  /**
   * @param {THREE.Camera} camera - The WebXR camera (AudioListener attaches here)
   */
  constructor(camera) {
    this.listener = new THREE.AudioListener()
    camera.add(this.listener)

    this.bgMusic = new THREE.Audio(this.listener)
    this.audioLoader = new THREE.AudioLoader()

    this._targetVolume = BASE_VOLUME
    this._loaded = false
  }

  /**
   * Load a music file. Returns a Promise that resolves when audio is ready.
   * @param {string} url - Path to the .mp3 file
   */
  load(url) {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        url,
        (buffer) => {
          this.bgMusic.setBuffer(buffer)
          this.bgMusic.setLoop(true)
          this.bgMusic.setVolume(0)   // start silent, fade in on play()
          this._loaded = true
          resolve()
        },
        undefined,
        (err) => reject(err)
      )
    })
  }

  /**
   * Start playback. Music fades in from silence.
   * Must be called from a user gesture (WebXR session start counts).
   */
  play() {
    if (!this._loaded) return
    if (!this.bgMusic.isPlaying) {
      this.bgMusic.play()
    }
    this._targetVolume = BASE_VOLUME
  }

  /**
   * Stop playback immediately.
   */
  stop() {
    if (this.bgMusic.isPlaying) {
      this.bgMusic.stop()
    }
  }

  /**
   * Call this from the hotspot manager each frame.
   * @param {number} proximity - 0 means player is AT a hotspot, 1 means far away
   */
  setHotspotProximity(proximity) {
    // Lerp between BASE_VOLUME and HOTSPOT_VOLUME based on proximity
    this._targetVolume = BASE_VOLUME + (1 - proximity) * (HOTSPOT_VOLUME - BASE_VOLUME)
  }

  /**
   * Call this once per frame in your render loop.
   */
  update() {
    if (!this._loaded || !this.bgMusic.isPlaying) return

    const current = this.bgMusic.getVolume()
    const diff = this._targetVolume - current

    if (Math.abs(diff) < 0.001) return

    // Smooth fade
    this.bgMusic.setVolume(current + diff * FADE_SPEED * 60)
  }

  /**
   * Clean up audio resources.
   */
  dispose() {
    this.stop()
    if (this.bgMusic.buffer) {
      this.bgMusic.buffer = null
    }
  }
}
