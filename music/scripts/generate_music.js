#!/usr/bin/env node
/**
 * CityWalk — Ambient Sound Generation Pipeline (ElevenLabs)
 *
 * Usage:
 *   # From Gemini JSON (auto prompt synthesis):
 *   node scripts/generate_music.js --input photo_descriptions.json --city tokyo-shibuya
 *
 *   # From built-in city presets:
 *   node scripts/generate_music.js --city tokyo-shibuya
 *   node scripts/generate_music.js  (generates all presets)
 *
 * Output:
 *   assets/cities/<city-id>/music.mp3
 *
 * Requires:
 *   ELEVENLABS_API_KEY in .env
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── Built-in city presets (fallback when no --input JSON given) ──────────────
const CITY_PRESETS = {
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

// ─── Prompt synthesis from Gemini JSON ───────────────────────────────────────

// Keywords that map well to sound design
const SOUND_KEYWORDS = [
  'rain', 'wet', 'pavement', 'traffic', 'crowd', 'footstep', 'wind',
  'bell', 'temple', 'night', 'city', 'urban', 'street', 'bustling',
  'tranquil', 'serene', 'melancholic', 'vibrant', 'quiet', 'hum',
  'echo', 'distant', 'rhythm', 'heartbeat', 'pulse', 'buzz', 'glow',
  'cinematic', 'contemplative', 'peaceful', 'energetic', 'solemn',
]

/**
 * Extract sound-relevant phrases from a single description.
 * Picks sentences that contain sound/atmosphere keywords.
 */
function extractSoundPhrases(description) {
  const sentences = description.split(/[.,]/).map(s => s.trim()).filter(Boolean)
  return sentences.filter(sentence =>
    SOUND_KEYWORDS.some(kw => sentence.toLowerCase().includes(kw))
  )
}

/**
 * Synthesize a concise ElevenLabs prompt from Gemini photo descriptions.
 * Combines the most sound-relevant phrases across all photos into one prompt.
 */
function synthesizePrompt(descriptions) {
  const allPhrases = descriptions.flatMap(item =>
    extractSoundPhrases(item.description)
  )

  // Deduplicate and take the most varied phrases (up to 5)
  const seen = new Set()
  const selected = []
  for (const phrase of allPhrases) {
    const key = phrase.toLowerCase().slice(0, 20)
    if (!seen.has(key) && selected.length < 5) {
      seen.add(key)
      selected.push(phrase)
    }
  }

  // Build final prompt — ElevenLabs works best with concise, comma-separated descriptions
  const prompt = selected.join(', ').slice(0, 400)

  console.log('\n[synthesize] Extracted sound prompt:')
  console.log(`  "${prompt}"\n`)

  return prompt
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

// ─── Core generation ──────────────────────────────────────────────────────────

async function generateAmbient(cityId, prompt, duration = 22) {
  const outDir = path.join(ROOT, 'assets', 'cities', cityId)
  const outPath = path.join(outDir, 'music.mp3')

  ensureDir(outDir)

  if (fs.existsSync(outPath)) {
    console.log(`[${cityId}] Already exists, skipping. Delete to regenerate.`)
    return outPath
  }

  console.log(`[${cityId}] Calling ElevenLabs Sound Generation...`)

  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: duration,
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
  console.log(`[${cityId}] Saved: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`)

  return outPath
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Error: ELEVENLABS_API_KEY not found in .env')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const inputArg = args.indexOf('--input')
  const cityArg  = args.indexOf('--city')

  const inputFile = inputArg !== -1 ? args[inputArg + 1] : null
  const cityId    = cityArg  !== -1 ? args[cityArg  + 1] : null

  console.log('CityWalk — Ambient Sound Generator (ElevenLabs)\n')

  // ── Mode A: Gemini JSON → synthesize prompt ──────────────────────────────
  if (inputFile) {
    if (!cityId) {
      console.error('Error: --input requires --city <id>')
      console.error('Example: node scripts/generate_music.js --input photo_descriptions.json --city tokyo-shibuya')
      process.exit(1)
    }

    const jsonPath = path.resolve(inputFile)
    if (!fs.existsSync(jsonPath)) {
      console.error(`Error: File not found: ${jsonPath}`)
      process.exit(1)
    }

    const descriptions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    console.log(`[${cityId}] Loaded ${descriptions.length} photo descriptions from Gemini JSON`)

    const prompt = synthesizePrompt(descriptions)
    await generateAmbient(cityId, prompt)
    return
  }

  // ── Mode B: Built-in presets ─────────────────────────────────────────────
  const toGenerate = cityId
    ? { [cityId]: CITY_PRESETS[cityId] }
    : CITY_PRESETS

  if (cityId && !CITY_PRESETS[cityId]) {
    console.error(`Unknown city preset: ${cityId}`)
    console.error(`Available presets: ${Object.keys(CITY_PRESETS).join(', ')}`)
    process.exit(1)
  }

  const results = []
  for (const [id, city] of Object.entries(toGenerate)) {
    console.log(`[${id}] Using preset prompt for: ${city.name}`)
    try {
      const outPath = await generateAmbient(id, city.prompt, city.duration)
      results.push({ id, status: 'ok', path: outPath })
    } catch (err) {
      console.error(`[${id}] Failed: ${err.message}`)
      results.push({ id, status: 'error', error: err.message })
    }
  }

  console.log('\n─── Summary ───────────────────────────────')
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : '✗'
    console.log(`${icon} ${r.id}: ${r.status === 'ok' ? r.path : r.error}`)
  }
}

main()
