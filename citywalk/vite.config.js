import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Serve ../benchmark/ at /benchmark/ so the splat URL stays portable
function serveBenchmark() {
  return {
    name: 'serve-benchmark',
    configureServer(server) {
      server.middlewares.use('/benchmark', (req, res, next) => {
        const filePath = path.join(__dirname, '..', 'benchmark', req.url)
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase()
          const mime = ext === '.spz' ? 'application/octet-stream'
            : ext === '.png' ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.json' ? 'application/json'
            : 'application/octet-stream'
          res.setHeader('Content-Type', mime)
          res.setHeader('Access-Control-Allow-Origin', '*')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    basicSsl(),       // self-signed cert — WebXR requires HTTPS on PICO
    serveBenchmark(),
  ],
  server: {
    host: true,       // expose on LAN so PICO headset can reach it
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: {
      allow: ['..'],  // allow importing from ../music/src/audio/
    },
  },
})
