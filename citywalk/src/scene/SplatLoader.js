import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

/**
 * SplatLoader — wraps @mkkellogg/gaussian-splats-3d in "external Three.js" mode.
 *
 * Usage:
 *   const loader = new SplatLoader({ renderer, scene, camera })
 *   await loader.load('/benchmark/test-gemini-20260315000644/world.spz', onProgress)
 *
 *   // each frame:
 *   loader.update()
 *   loader.render()   ← calls renderer.render() internally; don't call it separately
 */
export class SplatLoader {
  /** @type {GaussianSplats3D.Viewer} */
  viewer = null
  loaded = false

  #renderer
  #scene
  #camera

  constructor({ renderer, scene, camera }) {
    this.#renderer = renderer
    this.#scene = scene
    this.#camera = camera

    this.viewer = new GaussianSplats3D.Viewer({
      renderer,
      camera,
      scene,
      // We drive the loop ourselves (WebXR setAnimationLoop)
      selfDrivenMode: false,
      useBuiltInControls: false,
      // Splat sort quality vs performance — good default for PICO
      gpuAcceleratedSort: true,
      halfPrecisionCovariancesOnGPU: true,
    })
  }

  /**
   * @param {string} url      — relative URL to the .spz file
   * @param {(pct: number) => void} [onProgress]  — called with 0–1
   */
  async load(url, onProgress) {
    await this.viewer.addSplatScene(url, {
      onProgress: onProgress
        ? (percent) => onProgress(percent / 100)
        : undefined,
      // Force SPZ format so the loader doesn't guess on odd servers
      format: GaussianSplats3D.SceneFormat.SPZ,
    })
    this.loaded = true
  }

  /** Call every frame — runs the splat sort pass */
  update() {
    if (this.loaded) this.viewer.update()
  }

  /**
   * Call every frame AFTER update() — renders the scene.
   * Falls back to a plain renderer.render() before the splat is ready.
   */
  render() {
    if (this.loaded) {
      this.viewer.render()
    } else {
      this.#renderer.render(this.#scene, this.#camera)
    }
  }

  /** Clean up GPU resources */
  dispose() {
    this.viewer?.dispose()
  }
}
