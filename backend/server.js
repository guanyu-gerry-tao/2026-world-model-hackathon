import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pipelineRouter from "./src/routes/pipeline.js";
import ttsRouter from "./src/routes/tts.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Parse JSON bodies
app.use(express.json());

// CORS — allow citywalk frontend (localhost:3000) during development
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Serve generated output files (panorama.png, world.spz, etc.)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/output", express.static(path.join(__dirname, "output")));

// Pipeline routes
app.use("/pipeline", pipelineRouter);
// Text-to-speech (ElevenLabs) — 日记朗读
app.use("/tts", ttsRouter);

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[server] CityWalk backend running on http://localhost:${PORT}`);
  console.log(`[server] Endpoints:`);
  console.log(`         POST /pipeline/generate   — start generation job`);
  console.log(`         GET  /pipeline/status/:id — poll job status`);
  console.log(`         GET  /output/:cityId/*    — serve generated files`);
  console.log(`         POST /tts                — diary text to speech (ElevenLabs)`);
});
