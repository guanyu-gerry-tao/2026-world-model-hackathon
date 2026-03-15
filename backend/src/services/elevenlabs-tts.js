/**
 * ElevenLabs Text-to-Speech — 日记/感想文字转语音
 * API: https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // Rachel, multilingual
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

/**
 * 将文本转为语音，返回 MP3 Buffer
 * @param {string} text - 要朗读的文本（如日记内容）
 * @param {object} options - { voiceId?, modelId?, outputFormat?, languageCode? }
 * @returns {Promise<Buffer>} - 音频二进制
 */
export async function textToSpeech(text, options = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const voiceId = options.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const outputFormat = options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
  const languageCode = options.languageCode; // e.g. "zh" for Chinese

  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`;
  const body = {
    text: String(text).trim(),
    model_id: modelId,
    ...(languageCode && { language_code: languageCode }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText;
    try {
      const j = JSON.parse(errText);
      detail = j.detail?.message ?? j.message ?? errText;
    } catch (_) {}
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
