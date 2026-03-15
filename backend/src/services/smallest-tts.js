// Smallest.ai Lightning v3.1 TTS
// Docs: https://waves-docs.smallest.ai/v4.0.0/content/text-to-speech/quickstart

const ENDPOINT  = 'https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech'
const MAX_CHARS = 240  // API limit per call

// Voices verified to work with lightning-v3.1
// Female: jessica, sophia, kavya, kiran
// Male:   lucas, alex, jordan
const VOICES = ['jessica', 'lucas', 'sophia', 'alex', 'kavya', 'jordan', 'kiran']

/**
 * Deterministic voice per author — same name always gets same voice.
 */
export function getVoiceForAuthor(author) {
  let hash = 0
  for (const c of String(author)) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return VOICES[Math.abs(hash) % VOICES.length]
}

/**
 * Split text into sentence-boundary chunks under MAX_CHARS each.
 */
function chunkText(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const chunks = []
  let current = ''
  for (const s of sentences) {
    const trimmed = s.trim()
    if (!trimmed) continue
    if ((current + ' ' + trimmed).trim().length > MAX_CHARS) {
      if (current) chunks.push(current.trim())
      current = trimmed
    } else {
      current = (current + ' ' + trimmed).trim()
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

/**
 * Call Smallest.ai for one chunk, returns MP3 buffer.
 */
async function ttsChunk(text, voiceId) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SMALLEST_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      output_format: 'mp3',
      sample_rate: 24000,
      speed: 1.0,
    }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || contentType.includes('application/json')) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Smallest.ai TTS error ${res.status}: ${errText}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`[tts] "${text.slice(0, 40)}..." → ${buf.length} bytes`)
  return buf
}

/**
 * Convert text → MP3 buffer using Smallest.ai lightning-v3.1.
 * Long texts are split at sentence boundaries and MP3 chunks concatenated.
 *
 * @param {string} text
 * @param {string} voiceId  e.g. "arman"
 * @returns {Promise<Buffer>}  MP3 buffer
 */
export async function synthesizeSpeech(text, voiceId = 'emily') {
  if (!process.env.SMALLEST_API_KEY) {
    throw new Error('SMALLEST_API_KEY is not set in environment')
  }

  const chunks = chunkText(text)
  console.log(`[tts] ${chunks.length} chunk(s) for ${text.length} chars, voice: ${voiceId}`)

  // Sequential calls to avoid rate-limiting
  const parts = []
  for (const chunk of chunks) {
    parts.push(await ttsChunk(chunk, voiceId))
  }

  return Buffer.concat(parts)
}
