#!/usr/bin/env node
/**
 * CityWalk — Music Generation Pipeline (ElevenLabs Music)
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

import { ElevenLabsClient } from 'elevenlabs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const MUSIC_LENGTH_MS = 60000  // 60 seconds

// ─── Built-in city presets (fallback when no --input JSON given) ──────────────
const CITY_PRESETS = {
  'tokyo-shibuya': {
    name: '东京涩谷',
    prompt:
      'ambient japanese city night, lo-fi beats, neon lights atmosphere, ' +
      'warm synth pads, subtle distant crowd, 85bpm, nostalgic, dreamy, ' +
      'city walk background music, no vocals',
  },
  'kyoto-alley': {
    name: '京都小巷',
    prompt:
      'traditional japanese ambient, koto and shakuhachi, gentle rain, ' +
      'peaceful temple bells in distance, slow 60bpm, zen atmosphere, ' +
      'ancient city walk, no vocals',
  },
  'paris-street': {
    name: '巴黎街头',
    prompt:
      'french cafe ambient, soft accordion, parisian street atmosphere, ' +
      'gentle piano, warm evening, 75bpm, romantic city stroll, no vocals',
  },
}

// ─── Prompt synthesis from Gemini JSON ───────────────────────────────────────

const SOUND_KEYWORDS = [
  'rain', 'wet', 'pavement', 'traffic', 'crowd', 'footstep', 'wind',
  'bell', 'temple', 'night', 'city', 'urban', 'street', 'bustling',
  'tranquil', 'serene', 'melancholic', 'vibrant', 'quiet', 'hum',
  'echo', 'distant', 'rhythm', 'heartbeat', 'pulse', 'buzz', 'glow',
  'cinematic', 'contemplative', 'peaceful', 'energetic', 'solemn',
]

function extractSoundPhrases(description) {
  const sentences = description.split(/[.,]/).map(s => s.trim()).filter(Boolean)
  return sentences.filter(sentence =>
    SOUND_KEYWORDS.some(kw => sentence.toLowerCase().includes(kw))
  )
}

function synthesizePrompt(descriptions) {
  const allPhrases = descriptions.flatMap(item =>
    extractSoundPhrases(item.description)
  )

  const seen = new Set()
  const selected = []
  for (const phrase of allPhrases) {
    const key = phrase.toLowerCase().slice(0, 20)
    if (!seen.has(key) && selected.length < 5) {
      seen.add(key)
      selected.push(phrase)
    }
  }

  const prompt = selected.join(', ').slice(0, 400)
  console.log('\n[synthesize] Extracted music prompt:')
  console.log(`  "${prompt}"\n`)
  return prompt
}

// ─── Core generation ──────────────────────────────────────────────────────────

async function generateMusic(cityId, prompt) {
  const outDir = path.join(ROOT, 'assets', 'cities', cityId)
  const outPath = path.join(outDir, 'music.mp3')

  fs.mkdirSync(outDir, { recursive: true })

  if (fs.existsSync(outPath)) {
    console.log(`[${cityId}] Already exists, skipping. Delete to regenerate.`)
    return outPath
  }

  console.log(`[${cityId}] Calling ElevenLabs Music...`)

  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

  const stream = await client.music.compose({
    prompt,
    musicLengthMs: MUSIC_LENGTH_MS,
  })

  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  fs.writeFileSync(outPath, Buffer.concat(chunks))

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

  console.log('CityWalk — Music Generator (ElevenLabs Music)\n')

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
    await generateMusic(cityId, prompt)
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
      const outPath = await generateMusic(id, city.prompt)
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
