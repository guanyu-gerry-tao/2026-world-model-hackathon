import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { synthesizeSpeech, getVoiceForAuthor } from '../services/smallest-tts.js'

const router = express.Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function journalsDir(cityId) {
  return path.resolve('output', cityId, 'journals')
}

function entriesFile(cityId) {
  return path.join(journalsDir(cityId), 'entries.json')
}

function loadEntries(cityId) {
  const file = entriesFile(cityId)
  if (!fs.existsSync(file)) return []
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function saveEntries(cityId, entries) {
  fs.mkdirSync(journalsDir(cityId), { recursive: true })
  fs.writeFileSync(entriesFile(cityId), JSON.stringify(entries, null, 2))
}

/**
 * Spread entries in a ring using the golden angle so they never overlap.
 * Each entry gets a unique XZ position ~3m from center.
 */
function autoPosition(index) {
  const radius = 3
  const angle = index * 137.508 * (Math.PI / 180) // golden angle
  return {
    x: parseFloat((Math.cos(angle) * radius).toFixed(2)),
    z: parseFloat((Math.sin(angle) * radius).toFixed(2)),
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /journal/:cityId
 * Returns all journal entries for a world.
 */
router.get('/:cityId', (req, res) => {
  res.json(loadEntries(req.params.cityId))
})

/**
 * POST /journal/:cityId
 * Body: { text, author?, voice_id? }
 * Generates TTS audio and saves the entry.
 */
router.post('/:cityId', async (req, res) => {
  const { cityId } = req.params
  const { text, author = 'Anonymous', voice_id } = req.body

  if (!text?.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }

  const entries = loadEntries(cityId)
  const id = crypto.randomUUID().slice(0, 8)
  const voiceId = voice_id || getVoiceForAuthor(author)
  const position = autoPosition(entries.length)
  const audioFile = `journal_${id}.mp3`
  const dir = journalsDir(cityId)

  fs.mkdirSync(dir, { recursive: true })

  // Generate TTS audio
  let audioBuffer
  try {
    if (process.env.USE_MOCK === 'true') {
      audioBuffer = Buffer.alloc(0)
      console.log(`[journal] MOCK: skipped TTS for entry ${id}`)
    } else {
      console.log(`[journal] TTS: "${author}" via voice "${voiceId}"`)
      audioBuffer = await synthesizeSpeech(text.trim(), voiceId)
    }
  } catch (err) {
    console.error(`[journal] TTS failed:`, err.message)
    return res.status(500).json({ error: `TTS failed: ${err.message}` })
  }

  fs.writeFileSync(path.join(dir, audioFile), audioBuffer)

  const entry = {
    id,
    author,
    voice_id: voiceId,
    text: text.trim(),
    position,
    audioFile,
    audioUrl: `/output/${cityId}/journals/${audioFile}`,
    timestamp: new Date().toISOString(),
  }

  try {
    entries.push(entry)
    saveEntries(cityId, entries)
    console.log(`[journal] Entry "${id}" by "${author}" saved to ${cityId}`)
    res.status(201).json(entry)
  } catch (err) {
    console.error(`[journal] Failed to save entry:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /journal/:cityId/:entryId
 */
router.delete('/:cityId/:entryId', (req, res) => {
  const { cityId, entryId } = req.params
  const entries = loadEntries(cityId)
  const idx = entries.findIndex(e => e.id === entryId)
  if (idx === -1) return res.status(404).json({ error: 'Entry not found' })

  const [removed] = entries.splice(idx, 1)
  saveEntries(cityId, entries)
  fs.rmSync(path.join(journalsDir(cityId), removed.audioFile), { force: true })

  res.json({ deleted: true })
})

export default router
