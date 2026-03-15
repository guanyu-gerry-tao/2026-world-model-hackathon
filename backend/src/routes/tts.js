import express from "express";
import { textToSpeech } from "../services/elevenlabs-tts.js";

const router = express.Router();

/**
 * POST /tts
 *
 * 日记/感想文字转语音（ElevenLabs）
 *
 * Body: { "text": "要朗读的日记内容" }
 * Optional: { "languageCode": "zh" } 用于中文等
 *
 * Returns: audio/mpeg 流（MP3）
 */
router.post("/", async (req, res) => {
  try {
    const { text, languageCode } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid body.text" });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return res.status(400).json({ error: "body.text cannot be empty" });
    }

    const buffer = await textToSpeech(trimmed, {
      ...(languageCode && { languageCode }),
    });

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    if (err.message?.includes("ELEVENLABS_API_KEY")) {
      return res.status(503).json({ error: "TTS not configured (missing ELEVENLABS_API_KEY)" });
    }
    console.error("[tts]", err);
    res.status(500).json({ error: err.message ?? "TTS failed" });
  }
});

export default router;
