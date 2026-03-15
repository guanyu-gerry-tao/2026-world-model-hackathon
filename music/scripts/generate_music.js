#!/usr/bin/env node
/**
 * CityWalk — Text-to-Music Generation Pipeline
 *
 * Usage:
 *   node scripts/generate_music.js
 *   node scripts/generate_music.js --city tokyo-shibuya
 *
 * Output:
 *   assets/cities/<city-id>/music.mp3
 *
 * Requires:
 *   REPLICATE_API_TOKEN in .env
 */

import Replicate from 'replicate'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── City definitions ────────────────────────────────────────────────────────
// Each city has a text prompt that MusicGen will use to generate the music.
// Tweak these prompts to get different vibes.
const CITIES = {
  'tokyo-shibuya': {
    name: '东京涩谷',
    prompt:
      'ambient japanese city night, lo-fi beats, neon lights atmosphere, ' +
      'warm synth pads, subtle distant crowd, 85bpm, nostalgic, dreamy, ' +
      'city walk background music, no vocals',
    duration: 60,
  },
  'kyoto-alley': {
    name: '京都小巷',
    prompt:
      'traditional japanese ambient, koto and shakuhachi, gentle rain, ' +
      'peaceful temple bells in distance, slow 60bpm, zen atmosphere, ' +
      'ancient city walk, no vocals',
    duration: 60,
  },
  'paris-street': {
    name: '巴黎街头',
    prompt:
      'french cafe ambient, soft accordion, parisian street atmosphere, ' +
      'gentle piano, warm evening, 75bpm, romantic city stroll, no vocals',
    duration: 60,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    const protocol = url.startsWith('https') ? https : http

    protocol
      .get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close()
          fs.unlinkSync(destPath)
          return downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject)
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close(resolve)
        })
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
  })
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function generateMusic(cityId, city) {
  const outDir = path.join(ROOT, 'assets', 'cities', cityId)
  const outPath = path.join(outDir, 'music.mp3')

  ensureDir(outDir)

  // Skip if already generated
  if (fs.existsSync(outPath)) {
    console.log(`[${cityId}] Already exists, skipping. Delete to regenerate.`)
    return outPath
  }

  console.log(`\n[${cityId}] Generating music for: ${city.name}`)
  console.log(`[${cityId}] Prompt: "${city.prompt}"`)

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  // MusicGen by Meta — the most reliable text-to-music model on Replicate
  // Model: meta/musicgen
  // Docs: https://replicate.com/meta/musicgen
  const output = await replicate.run('meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb', {
    input: {
      prompt: city.prompt,
      duration: city.duration,
      model_version: 'stereo-large',   // best quality, stereo output
      output_format: 'mp3',
      normalization_strategy: 'peak',
    },
  })

  // output is a URL string pointing to the generated audio
  const audioUrl = typeof output === 'string' ? output : output[0]

  console.log(`[${cityId}] Generated. Downloading from: ${audioUrl}`)
  await downloadFile(audioUrl, outPath)

  const stats = fs.statSync(outPath)
  console.log(`[${cityId}] Saved to: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`)

  return outPath
}

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('Error: REPLICATE_API_TOKEN not found in environment.')
    console.error('Create a .env file with: REPLICATE_API_TOKEN=r8_...')
    process.exit(1)
  }

  // Allow --city <id> flag to generate only one city
  const cityArg = process.argv.indexOf('--city')
  const targetCity = cityArg !== -1 ? process.argv[cityArg + 1] : null

  const toGenerate = targetCity
    ? { [targetCity]: CITIES[targetCity] }
    : CITIES

  if (targetCity && !CITIES[targetCity]) {
    console.error(`Unknown city: ${targetCity}`)
    console.error(`Available cities: ${Object.keys(CITIES).join(', ')}`)
    process.exit(1)
  }

  console.log('CityWalk — Text-to-Music Generator')
  console.log(`Generating ${Object.keys(toGenerate).length} city track(s)...\n`)

  const results = []
  for (const [cityId, city] of Object.entries(toGenerate)) {
    try {
      const outPath = await generateMusic(cityId, city)
      results.push({ cityId, status: 'ok', path: outPath })
    } catch (err) {
      console.error(`[${cityId}] Failed: ${err.message}`)
      results.push({ cityId, status: 'error', error: err.message })
    }
  }

  console.log('\n─── Summary ───────────────────────────────')
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : '✗'
    const detail = r.status === 'ok' ? r.path : r.error
    console.log(`${icon} ${r.cityId}: ${detail}`)
  }
}

main()
