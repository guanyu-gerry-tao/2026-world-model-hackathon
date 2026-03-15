#!/usr/bin/env node
/**
 * CityWalk — Ambient Sound Generation Pipeline (ElevenLabs)
 *
 * Usage:
 *   node scripts/generate_music.js
 *   node scripts/generate_music.js --city tokyo-shibuya
 *
 * Output:
 *   assets/cities/<city-id>/music.mp3
 *
 * Requires:
 *   ELEVENLABS_API_KEY in .env
 *
 * Note: ElevenLabs Sound Generation max duration is 22 seconds.
 *       MusicController loops the file automatically.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── City definitions ────────────────────────────────────────────────────────
const CITIES = {
  'tokyo-shibuya': {
    name: '东京涩谷',
    prompt:
      'busy tokyo shibuya crossing at night, crowds of people walking, ' +
      'distant city traffic, neon lights buzz, urban energy, rain on pavement',
    duration: 22,
  },
  'kyoto-alley': {
    name: '京都小巷',
    prompt:
      'quiet japanese temple alley, gentle rain dripping, ' +
      'distant temple bell echo, wind through bamboo, peaceful night atmosphere',
    duration: 22,
  },
  'paris-street': {
    name: '巴黎街头',
    prompt:
      'parisian street cafe at evening, light traffic passing, ' +
      'distant chatter and laughter, cobblestone street ambience, warm city sounds',
    duration: 22,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function generateAmbient(cityId, city) {
  const outDir = path.join(ROOT, 'assets', 'cities', cityId)
  const outPath = path.join(outDir, 'music.mp3')

  ensureDir(outDir)

  if (fs.existsSync(outPath)) {
    console.log(`[${cityId}] Already exists, skipping. Delete to regenerate.`)
    return outPath
  }

  console.log(`\n[${cityId}] Generating ambient sound for: ${city.name}`)
  console.log(`[${cityId}] Prompt: "${city.prompt}"`)

  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: city.prompt,
      duration_seconds: city.duration,
      prompt_influence: 0.3,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(outPath, Buffer.from(buffer))

  const stats = fs.statSync(outPath)
  console.log(`[${cityId}] Saved to: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`)

  return outPath
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Error: ELEVENLABS_API_KEY not found in environment.')
    console.error('Create a .env file with: ELEVENLABS_API_KEY=sk_...')
    process.exit(1)
  }

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

  console.log('CityWalk — Ambient Sound Generator (ElevenLabs)')
  console.log(`Generating ${Object.keys(toGenerate).length} city track(s)...\n`)

  const results = []
  for (const [cityId, city] of Object.entries(toGenerate)) {
    try {
      const outPath = await generateAmbient(cityId, city)
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
