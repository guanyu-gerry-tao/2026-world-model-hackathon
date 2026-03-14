# CityWalk 后端文档

> 版本：v0.1 · 最后更新：2026-03-13

---

## 一、概述

后端是一个 **Node.js + Express** 服务器，负责处理图片生成流水线：

```
用户照片
  → Gemini API（Nano Banana Pro）生成 360° 全景图
  → Marble API（World Labs）将全景图转换为 Gaussian Splat (.spz)
  → 产物保存到 output/ 目录，供 PICO WebXR 前端加载
```

所有生成都是**异步 job**：提交后立即返回 `jobId`，然后轮询状态。

---

## 二、快速启动

```bash
cd backend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 API keys（或保持 USE_MOCK=true 跳过真实调用）

# 3. 启动服务器（开发模式，文件变化自动重启）
npm run dev

# 4. 确认服务正常
curl http://localhost:3001/health
# → {"ok":true}
```

---

## 三、环境变量（.env）

| 变量 | 说明 | 必填 |
|------|------|------|
| `GEMINI_API_KEY` | Google AI Studio API Key | 真实模式必填 |
| `MARBLE_API_KEY` | World Labs API Key | 真实模式必填 |
| `PORT` | 服务器端口，默认 `3001` | 否 |
| `USE_MOCK` | `true` 时跳过所有真实 API 调用，无需 key | 否 |

**Mock 模式（开发/测试用）：**
```env
USE_MOCK=true
```
整个 pipeline 逻辑正常执行，但 Gemini 和 Marble 返回假数据，约 5 秒完成。

**真实模式：**
```env
USE_MOCK=false
GEMINI_API_KEY=AIza...
MARBLE_API_KEY=wlt_...
```

---

## 四、API 接口

### 4.1 健康检查

```http
GET /health
```

**响应：**
```json
{ "ok": true }
```

---

### 4.2 发起生成任务

```http
POST /pipeline/generate
Content-Type: multipart/form-data
```

**请求字段（multipart form）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `photos` | File（最多 8 个） | ✅ | 用户个人照片，JPG/PNG |
| `template` | File（最多 1 个） | 否 | 城市模板全景图（Mode A） |
| `description` | string | 否 | 世界描述，如 `"东京涩谷夜晚"` |
| `cityId` | string | 否 | 输出目录名，如 `"tokyo-shibuya"` |
| `quality` | `"fast"` \| `"pro"` | 否 | Gemini 模型质量，默认 `"fast"` |
| `marbleModel` | `"Marble 0.1-mini"` \| `"Marble 0.1-plus"` | 否 | 默认 `"Marble 0.1-mini"` |

> **Mode A（模板融合）：** 同时提供 `photos` 和 `template`，照片被自然嵌入城市场景
>
> **Mode B（从头生成）：** 只提供 `photos`（+ 可选 `description`），生成全新世界

**响应：**
```json
{ "jobId": "mmpy4giqt1au" }
```

立即返回，不等待生成完成。

**curl 示例：**
```bash
# Mode B — 从头生成
curl -X POST http://localhost:3001/pipeline/generate \
  -F "photos=@photo1.jpg" \
  -F "photos=@photo2.jpg" \
  -F "description=东京涩谷夜晚街道" \
  -F "cityId=tokyo-shibuya" \
  -F "marbleModel=Marble 0.1-mini"

# Mode A — 城市模板 + 照片融合
curl -X POST http://localhost:3001/pipeline/generate \
  -F "photos=@my_photo.jpg" \
  -F "template=@shibuya_template.png" \
  -F "description=东京涩谷" \
  -F "cityId=tokyo-shibuya"
```

---

### 4.3 查询任务状态

```http
GET /pipeline/status/:jobId
```

**响应（进行中）：**
```json
{
  "id": "mmpy4giqt1au",
  "status": "generating_world",
  "progress": "Marble: processing",
  "result": null,
  "error": null
}
```

**status 状态流转：**

```
pending → generating_panorama → generating_world → downloading → done
                                                               ↘ error
```

| status | 含义 |
|--------|------|
| `pending` | 任务已创建，等待开始 |
| `generating_panorama` | 正在调用 Gemini 生成全景图（~10s） |
| `generating_world` | 正在调用 Marble 生成 3D 世界（mini: 30-45s，plus: ~5min） |
| `downloading` | 正在下载 .spz 文件到本地 |
| `done` | 完成，result 字段包含产物信息 |
| `error` | 失败，error 字段包含错误信息 |

**响应（完成）：**
```json
{
  "id": "mmpy4giqt1au",
  "status": "done",
  "progress": null,
  "result": {
    "cityId": "tokyo-shibuya",
    "operationId": "op_abc123",
    "files": {
      "panorama": "/path/to/output/tokyo-shibuya/panorama.png",
      "spz": "/path/to/output/tokyo-shibuya/world.spz"
    },
    "remoteUrls": {
      "spz500k": "https://cdn.worldlabs.ai/...500k.spz",
      "spzFullRes": "https://cdn.worldlabs.ai/...full.spz",
      "collider": "https://cdn.worldlabs.ai/....glb",
      "pano": "https://cdn.worldlabs.ai/....png"
    }
  },
  "error": null
}
```

**轮询建议：每 2 秒查询一次，直到 status 为 `done` 或 `error`。**

---

### 4.4 访问生成文件

```http
GET /output/:cityId/:filename
```

生成完成后，产物通过 HTTP 直接访问：

```
GET /output/tokyo-shibuya/panorama.png   # 生成的全景图
GET /output/tokyo-shibuya/world.spz      # Gaussian Splat 文件
```

PICO WebXR 前端可以直接用这个 URL 加载 `.spz`：
```javascript
// citywalk 前端加载示例
const spzUrl = "http://localhost:3001/output/tokyo-shibuya/world.spz";
```

---

## 五、目录结构

```
backend/
├── server.js                    # Express 入口，端口 3001
├── package.json
├── .env                         # 本地环境变量（不提交 git）
├── .env.example                 # 环境变量模板
├── test-pipeline.js             # 端到端测试脚本
├── uploads/                     # 临时上传目录（自动清理）
├── output/                      # 生成产物
│   └── {cityId}/
│       ├── panorama.png         # 融合全景图
│       └── world.spz            # Gaussian Splat
└── src/
    ├── services/
    │   ├── gemini.js            # Gemini API（全景图生成）
    │   └── marble.js            # Marble API（世界生成 + 轮询 + 下载）
    ├── routes/
    │   └── pipeline.js          # /pipeline 路由 + job 管理
    └── mock/
        └── panorama.js          # Mock 全景图（USE_MOCK=true 时使用）
```

---

## 六、端对端测试

```bash
# 终端 1：启动服务器
npm run dev

# 终端 2：运行测试（USE_MOCK=true 无需真实 API）
node test-pipeline.js
```

**预期输出：**
```
── CityWalk Pipeline Test ──

✓ Health: { ok: true }
→ Submitting generation job...
✓ Job started: mmpy4giqt1au
→ Polling status...
  status=generating_world  progress=Marble: uploading
  status=generating_world  progress=Marble: processing
  status=done  progress=-

✓ Pipeline complete!
  panorama.png on disk : ✓
  world.spz on disk    : ✓

 All checks passed. Backend is working correctly.
```

---

## 七、从 Mock 切换到真实 API

1. 获取 API keys：
   - Gemini：[Google AI Studio](https://aistudio.google.com/)
   - Marble：[World Labs](https://www.worldlabs.ai/)

2. 编辑 `.env`：
   ```env
   USE_MOCK=false
   GEMINI_API_KEY=AIza...
   MARBLE_API_KEY=wlt_...
   ```

3. 测试时建议先用 `Marble 0.1-mini`（30-45 秒，便宜），确认 pipeline 通了再换 `Marble 0.1-plus`（5 分钟，高质量）

---

## 八、注意事项

- `jobs` 存在内存里，服务器重启后丢失（Hackathon 够用）
- Marble API 限速：每分钟最多 6 次 generate 请求，超额返回 429
- 上传图片大小限制：每张 20 MB
- `.spz` 文件较大（500k 版约 50-100 MB），`/output` 端点直接静态服务
- 生成完成后 `remoteUrls` 里有 Marble CDN 的直链，也可以直接用这个 URL 给 PICO 前端加载，不必经过本地服务器
