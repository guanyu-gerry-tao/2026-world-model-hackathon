# CityWalk — Walk into a city, leave your memory

> **Worlds in Action Hack San Francisco · 2026年3月14–15日**
> Founders Inc. · 主办方：SensAI Hackademy
> 赛道：Best World Models Implementation with PICO

---

## 导航

### 文档

| 文档 | 内容 |
|------|------|
| [docs/proposal.md](docs/proposal.md) | 项目提案：问题陈述、核心概念、差异化分析、Demo 范围 |
| [docs/architecture.md](docs/architecture.md) | 技术架构：系统总览、模块分解、数据流、开发计划 |
| [docs/api-reference.md](docs/api-reference.md) | API 参考：Marble API + Gemini（Nano Banana Pro）接口说明 |
| [docs/backend.md](docs/backend.md) | 后端使用指南：启动方法、API 接口、Mock 测试 |
| [benchmark/README.md](benchmark/README.md) | Benchmark 资产说明：Demo 标准文件的来源与用途 |

### 代码

| 目录 | 内容 |
|------|------|
| [backend/](backend/) | Node.js/Express 后端：Gemini + Marble 生成 pipeline |
| [citywalk/](citywalk/) | WebXR 前端：PICO 头显上的 Gaussian Splat 体验 |
| [benchmark/](benchmark/) | 团队共享 Demo 资产：照片、全景图、.spz 文件 |

---

## 项目概述

CityWalk 让你把个人照片种进一座真实城市里。

1. 上传旧照片 → **Gemini**（Nano Banana Pro）将它们融合进东京涩谷的街道全景图
2. 全景图 → **World Labs Marble API** 生成可行走的 3D Gaussian Splat 世界
3. 戴上 **PICO 4** 头显，走在那条街道上，走近墙壁时你的照片从城市里浮现出来

---

## 快速开始

### 后端（生成 pipeline）

```bash
cd backend
npm install
cp .env.example .env   # 填入 API keys，或保持 USE_MOCK=true
npm run dev            # 启动在 http://localhost:3001
```

详见 → [docs/backend.md](docs/backend.md)

### 前端（WebXR 体验）

```bash
cd citywalk
npm install
npm run dev            # 启动在 https://localhost:3000
```

用 PICO 4 浏览器访问该地址，进入沉浸式 WebXR 体验。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 全景图生成 | Gemini（Nano Banana Pro / `gemini-3-pro-image`） |
| 世界生成 | World Labs Marble API（`marble-0.1-plus`） |
| 后端 | Node.js + Express |
| 前端 | Three.js + SparkJS 2.0 + WebXR |
| 运行平台 | PICO 4 头显（Android，内置浏览器） |
