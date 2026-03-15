/**
 * 测试 ElevenLabs 日记 TTS
 *
 * 用法:
 *   node test-tts.js "今天在涩谷的回忆，永远留在心里。"
 *   node test-tts.js "Hello, this is a diary entry." --lang en
 *
 * 需在 .env 中设置 ELEVENLABS_API_KEY。
 * 会请求 POST /tts（需先 npm run dev 起服务）或直接调服务。
 */

import "dotenv/config";
import { textToSpeech } from "./src/services/elevenlabs-tts.js";
import fs from "node:fs";

const text = process.argv[2] || "这是一段日记内容，用来测试文字转语音。";
const lang = process.argv.includes("--lang")
  ? process.argv[process.argv.indexOf("--lang") + 1]
  : "zh";
const useServer = process.argv.includes("--server");

async function main() {
  if (useServer) {
    const base = process.env.BACKEND_URL || "http://localhost:3001";
    const res = await fetch(`${base}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode: lang }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("TTS failed:", res.status, err);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const out = "output/tts-test.mp3";
    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync(out, buf);
    console.log("Saved to", out);
    return;
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error("Set ELEVENLABS_API_KEY in .env");
    process.exit(1);
  }
  const buffer = await textToSpeech(text, { languageCode: lang });
  const out = "output/tts-test.mp3";
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(out, buffer);
  console.log("Saved to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
