# API 参考文档

> 最后更新：2026-03-13

---

## 一、World Labs Marble API

### 基本信息

- **Base URL：** `https://api.worldlabs.ai/marble/v1`
- **认证方式：** 请求 Header 中加 `WLT-Api-Key: YOUR_API_KEY`
- **Content-Type：** `application/json`

### 模型选择

| 模型 | 用途 | 生成时间 | 费用 |
|------|------|----------|------|
| `Marble 0.1-plus` | 高质量，Demo 用 | ~5 分钟 | 1500–1600 credits |
| `Marble 0.1-mini` | 快速草稿，测试用 | 30–45 秒 | 150–330 credits |

### Step 1：上传媒体文件

```http
POST /marble/v1/media-assets:prepare_upload
WLT-Api-Key: YOUR_KEY
Content-Type: application/json

{}
```

返回：
```json
{
  "upload_url": "https://storage.googleapis.com/...",
  "asset_id": "asset_abc123"
}
```

然后 PUT 图片到 `upload_url`（直接上传二进制，Content-Type: image/png）。

### Step 2：生成世界

```http
POST /marble/v1/worlds:generate
WLT-Api-Key: YOUR_KEY
Content-Type: application/json

{
  "display_name": "tokyo-shibuya-demo",
  "world_prompt": {
    "type": "image",
    "image_prompt": {
      "image_url": "https://storage.googleapis.com/...",
      "is_pano": true
    }
  },
  "model": "Marble 0.1-plus"
}
```

返回：
```json
{
  "operation_id": "op_xyz789",
  "done": false
}
```

> `is_pano: true`：告诉 Marble 输入是等距柱状投影全景图（360°），精度更高。

### Step 3：轮询状态

```http
GET /marble/v1/operations/{operation_id}
WLT-Api-Key: YOUR_KEY
```

- `done: false` → 继续等待（建议每 15 秒轮询一次）
- `done: true` → 生成完成

### Step 4：获取下载链接

生成完成后响应体包含：

```json
{
  "done": true,
  "response": {
    "assets": {
      "splats": {
        "spz_urls": {
          "500k": "https://...",
          "100k": "https://...",
          "full_res": "https://..."
        }
      },
      "mesh": {
        "collider_mesh_url": "https://...glb"
      },
      "imagery": {
        "pano_url": "https://...png"
      }
    }
  }
}
```

### 限制

- 速率限制：每分钟最多 6 次 generate 请求（429 = 超额）
- Demo 使用 `500k` 分辨率的 `.spz`，平衡质量与 PICO 性能

---

## 二、Nano Banana Pro（Google Gemini 图像生成）

### 基本信息

- **"Nano Banana Pro"** = Gemini 3 Pro Image 的官方昵称
- **SDK：** `@google/genai`（注意不是 `@google/generative-ai`）
- **认证：** 环境变量 `GEMINI_API_KEY`

```bash
npm install @google/genai
```

### 模型选项

| 模型名 | 昵称 | 质量 | 速度 |
|--------|------|------|------|
| `gemini-3-pro-image` | Nano Banana Pro | 最高 | 慢 |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | 高 | 快（8–12s） |

### 调用示例：多图 → 全景图

```javascript
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 读取用户照片
const photos = ["photo1.jpg", "photo2.jpg"].map(f => ({
  inlineData: {
    mimeType: "image/jpeg",
    data: fs.readFileSync(f).toString("base64")
  }
}));

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: [
    {
      text: `你是一个全景图生成专家。
请将这些照片自然融合成一张 360° 等距柱状投影全景图（equirectangular panorama）。
场景风格：东京涩谷夜晚街道。
要求：宽高比 2:1，照片作为场景元素嵌入（墙上海报、橱窗展示、路灯装饰）。
输出：仅输出图片，无文字。`
    },
    ...photos
  ]
});

// 保存图片
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("panorama.png", buffer);
  }
}
```

### 模式 A（城市模板 + 照片融合）

```
Prompt 方向：
- 提供城市街道模板全景图（base image）
- 提供用户照片（3–8 张）
- 要求：将照片嵌入城市场景的自然位置
  · 左侧墙壁：照片 1
  · 正前方橱窗：照片 2
  · 右侧路灯下：照片 3
- 保持城市全景图的整体风格和透视
```

### 模式 B（纯照片 → 全新世界）

```
Prompt 方向：
- 仅提供用户照片 + 一句描述
- 要求：从零生成全新 360° 全景图
- 照片控制空间结构和视觉元素
- 文字描述控制整体风格和氛围
```

### 注意事项

- Gemini **不原生支持**真正的 360° 球面全景图生成
- 输出是普通宽幅图片（2:1 比例），需要作为 equirectangular 传入 Marble
- Marble 的 `is_pano: true` 会正确处理 2:1 比例图片作为全景图

---

## 三、Pipeline 完整流程

```
用户照片（input/photos/）
      │
      ▼
[Step 1] Gemini API
  · 模式 A：城市模板 + 照片 → 融合全景图
  · 模式 B：照片 + 描述 → 全新全景图
      │
      ▼ panorama.png（2:1，equirectangular）
      │
[Step 2] Marble API - 上传
  · prepare_upload → 获取 signed URL
  · PUT panorama.png 到 signed URL
      │
      ▼ image_url
      │
[Step 3] Marble API - 生成
  · POST worlds:generate（is_pano: true, model: Marble 0.1-plus）
  · 返回 operation_id
      │
      ▼ 轮询（每15s）
      │
[Step 4] Marble API - 下载
  · done: true → 获取 spz_urls.500k
  · 下载 .spz 到 citywalk/assets/cities/tokyo-shibuya/world.spz
      │
      ▼
citywalk/assets/cities/tokyo-shibuya/
  ├── world.spz       ← Gaussian Splat（PICO 渲染用）
  ├── panorama.png    ← 融合全景图（备用）
  └── config.json     ← 热点坐标（手动标注）
```

---

## 四、环境变量

```bash
# .env
GEMINI_API_KEY=your_gemini_key
MARBLE_API_KEY=your_worldlabs_key
```

---

## 五、参考链接

- Marble API 文档：https://docs.worldlabs.ai/api
- Marble 导出说明：https://docs.worldlabs.ai/marble/export/gaussian-splat/unreal
- Gemini 图像生成：https://ai.google.dev/gemini-api/docs/image-generation
- Gemini 模型列表：https://ai.google.dev/gemini-api/docs/models
- Nano Banana API：https://nanobananaapi.ai/
