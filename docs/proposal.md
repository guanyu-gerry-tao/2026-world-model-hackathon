# CityWalk — 项目提案
> *走进一座城市，留下你的记忆。*

**活动：** Worlds in Action Hack San Francisco · 2026年3月14–15日
**地点：** Founders Inc. · 主办方：SensAI Hackademy
**参赛赛道：** Best Filmmaking, Entertainment & Simulation App · Best World Models Implementation with PICO

---

## 一、问题陈述

你去过东京、巴黎、京都，拍了一堆照片。然后呢？照片躺在相册里，城市变成了一个名字。

现有的记忆类应用，要么是把照片做成立体视差效果供你观看（ScopeVR、immerGallery），要么是在拍摄时用 LiDAR 传感器实时采集3D信息，供你事后重游（Wist）。这两种方式都没有解决核心问题：**你的记忆和那座城市之间缺少联系。**

CityWalk 的立场：**记忆不该独立存在，它应该长在城市里。**

---

## 二、核心概念

CityWalk 有两种创建方式：

**模式 A — 城市模板 + 记忆融合（主打）**
选择一个预制城市街道（如东京涩谷、京都小巷），上传自己的照片，照片被自然嵌入街道场景中——贴在墙壁上、浮现在橱窗里、悬挂在路灯下。每个人对同一座城市的记忆不同，生成的世界也不同。

**模式 B — 从头生成**
不选模板，直接上传照片 + 一句描述，AI 从零生成一个全新世界。适合没有对应城市模板的场景，或者想要完全个性化的体验。

两种模式生成的世界都可以被其他人拜访。

**社交性是核心：**
- 你可以创建「我的东京」，朋友可以来逛
- 同一条街道，不同人的版本完全不同
- 城市是共享的，记忆是私人的，体验是社交的

> "不是把照片放进一个空间，而是把记忆种进一座城市。"

---

## 三、差异化分析

| | CityWalk | Wist | Memory House（World Labs） | ScopeVR |
|---|---|---|---|---|
| 输入 | 任意旧照片（可选城市模板或从头生成） | 必须用 App 实时录制 | 艺术家手工策划 | 现有照片/视频 |
| 处理方式 | 照片融入城市 / 照片直接生成世界 | LiDAR 3D 重建原始场景 | Marble Composer 手动拼接 | 深度估计 |
| 输出 | 承载个人记忆的可分享世界 | 还原原始场景 | 固定叙事艺术装置 | 立体照片展示 |
| 社交性 | ✅ 互相拜访彼此的城市 | ❌ 个人独享 | ❌ 艺术家作品 | ❌ 个人独享 |
| 使用 World Model | ✅ Marble API | ❌ | ✅ Marble Composer（仅 UI） | ❌ |
| 支持旧照片 | ✅ | ❌ | ✅ | ✅ |
| 可行走 VR | ✅ PICO | ✅ Quest | ✅（浏览器） | ✅ Quest |

**核心洞察：** 其他产品让你看自己的照片。CityWalk 让你走进别人的城市，看到他们的记忆。这是一个社交平台，不是一个相册工具。

---

## 四、完整技术管道

```
第一步 — 选择创建方式
  A) 城市模板：选择预制城市（如东京涩谷），上传照片融入
  B) 从头生成：上传照片 + 一句描述，AI 直接生成世界

第二步 — 上传照片
用户上传个人照片（建议3–8张）
  模板模式例：「2019年在东京拍的照片」
  从头生成例：「2019年和大学朋友在京都的夏天」

第三步 — 全景图生成
Nano Banana Pro (Google Gemini 3 Pro Image)
  A) 模板模式：城市全景图 + 用户照片 → 融合全景图
     照片自然嵌入城市场景（墙壁海报、橱窗展示、路灯悬挂）
  B) 从头生成：多张照片 → 全新 360° 超现实全景图
     照片控制空间结构，文字描述控制视觉风格

第四步 — 世界生成
World Labs Marble API
  输入：全景图（is_pano: true）
  输出：Gaussian Splat（.spz）

第五步 — VR 体验（PICO 头显）
WebXR（SparkJS 2.0 / Three.js）
  渲染 Gaussian Splat
  叠加粒子系统（花瓣 / 光晕）
  近距离触发交互 → 原始照片浮现
  背景音乐 + 环境音
```

---

## 五、技术栈

| 层级 | 技术 | 备注 |
|------|------|------|
| 图像融合 | Nano Banana Pro (Gemini 3 Pro Image) | 模板融合 / 从头生成 360° 全景图 |
| 世界生成 | World Labs Marble API `marble-0.1-plus` | `is_pano: true` 空间精度最高 |
| 渲染引擎 | SparkJS 2.0 + Three.js + WebXR | 跑在 PICO 内置浏览器，无需安装 App |
| 粒子效果 | Three.js `BufferGeometry` Points | 最多 ~500 粒子，保证 PICO 帧率 |
| 交互触发 | 近距离检测（Proximity） | 每帧检测玩家位置与热点距离 |
| 照片浮现 | Three.js `Sprite` / `PlaneGeometry` | 淡入动画浮层面板 |
| 背景音乐 | Suno / Udio API | 按城市氛围预生成 |
| 运行平台 | PICO 4 头显 | 独立 Android 设备，无需连接电脑 |

---

## 六、交互设计

### 核心交互：在街道上发现记忆

用户走在城市街道上。当走近某面墙壁、某个橱窗、某盏路灯时，嵌入其中的照片从模糊变清晰，原始高清照片在眼前浮现。交互是空间性的、具身的——你不是在操作界面，你是在城市里偶遇记忆。

```javascript
// 每帧检测
const distance = player.position.distanceTo(hotspot.position)
if (distance < 0.5) {
    fadeInPhoto(hotspot.photoId)
    raiseMusic()
}
if (distance > 1.0) {
    fadeOutPhoto()
    lowerMusic()
}
```

### 热点坐标系统

全景图是等距柱状投影，坐标系为经纬度：
- 水平方向：0°–360°（yaw）
- 垂直方向：-90°–90°（pitch）

**Hackathon 版本（手动）：** 走完预生成的世界，人工标注哪个区域对应哪张照片，手写热点坐标。

**完整产品版本：**

第一步：Gemini Prompt 主动定义照片在城市中的嵌入位置
```
左侧墙壁：照片1（涩谷十字路口自拍）
正前方橱窗：照片2（拉面店）
右侧路灯下：照片3（夜景）
```

第二步：VLM（Claude / GPT-4V）分析生成的全景图，返回热点坐标 JSON
```json
{
  "hotspots": [
    { "photo_id": "shibuya_001.jpg", "yaw": 45, "pitch": -10, "label": "涩谷墙壁" },
    { "photo_id": "ramen_002.jpg", "yaw": 180, "pitch": 0, "label": "拉面店橱窗" }
  ]
}
```

第三步：坐标换算为 3D 世界坐标
```javascript
const x = Math.cos(pitch) * Math.sin(yaw) * radius
const y = Math.sin(pitch) * radius
const z = Math.cos(pitch) * Math.cos(yaw) * radius
```

---

## 七、氛围层

**粒子效果（路灯光晕 / 花瓣飘落）：**
- `BufferGeometry` 随机分布粒子位置
- Y 轴正弦动画模拟漂浮
- 城市主题化：东京用樱花花瓣，巴黎用光点
- 性能目标：≤500 粒子，保持 PICO 稳定帧率

**背景音乐 + 环境音：**
- 城市环境音底层（街道人声、远处车流）
- 走近热点时音量渐强，个性化配乐淡入
- 每个城市一首专属配乐，匹配城市氛围

---

## 八、完整产品架构

```
手机端（输入）              云端（处理）                 PICO 头显（体验）

选择城市模板          →   Gemini 融合照片到城市全景   →   WebXR 加载 .spz
从相册选照片                    ↓
                          Marble 生成个性化世界          渲染 Gaussian Splat
                                ↓
                          .spz 存入用户账号              粒子系统叠加
                                ↓
分享链接给朋友        ←   生成可访问的世界 URL      →   朋友走进你的城市
                                                        照片浮现
                                                        音乐响起
```

**商业价值：**
- 城市模板可以做成 IP 合作（品牌街道、景区数字孪生）
- UGC 世界可以收费访问
- 城市 × 记忆 = 无限内容，用户自己生产

---

## 九、竞争壁垒

**对比 Wist：** Wist 依赖 LiDAR 传感器实时采集，只支持拍摄当下的场景。CityWalk 的输入是任意照片，2003年用胶卷拍的旅行照同样有效。

**对比 Memory House：** Memory House 是艺术家的固定装置，用户无法创作自己的版本。CityWalk 是一个平台，每个人都能在同一座城市里留下自己的记忆。

**对比 2D/3D 照片查看器：** 那些产品把照片放进一个空间容器里供你观看。我们把照片种进城市里，输出物不是照片，而是一条属于你的街道。

**社交壁垒：** 这是唯一一个让你走进别人记忆的产品。不是看照片，是走进他们的城市。

---

## 十、Demo 范围

### ✅ 真实实现（必须完成）

| 功能 | 说明 |
|------|------|
| Gaussian Splat 渲染 | SparkJS 在 PICO 浏览器内加载 `.spz` 文件 |
| 头显内自由行走 | WebXR 6DoF，可真实移动探索城市街道 |
| 粒子效果 | Three.js 花瓣 / 光晕叠加在 Splat 上 |
| 近距离触发交互 | 走近墙壁/橱窗热点区域 → 照片浮现 |
| 照片浮现面板 | Three.js Sprite 淡入动画 |
| 背景音乐播放 | 进入世界后自动播放城市氛围音乐 |

### 🔴 Hardcode / Pitch 口头描述

| 功能 | 处理方式 |
|------|------|
| 用户选图上传 | 照片提前内置，pitch 时说明手机端上传流程 |
| Gemini 实时融合 | 融合全景图提前生成好 |
| Marble API 实时生成 | `.spz` 文件提前跑好，hardcode 进项目 |
| VLM 自动热点定位 | 热点位置走完世界后手动标注 |
| 社交分享 / 互相拜访 | 架构图 + 口头 pitch |
| 多城市模板选择 | hardcode 一个默认城市 |
| 用户账号 / 云存储 | 架构图口头描述 |
| AI 音乐实时生成 | 音频文件提前生成，静态加载 |

**核心原则：** 评委在头显里感受到的一切必须是真实的——走在城市街道上、花瓣飘落、照片从墙壁浮现。管道其他部分可以 fake，但进入城市的那一刻不能 fake。

---

## 十一、团队

| 成员 | 职责 |
|------|------|
| Gerry（核心开发） | 完整管道：Gemini 融合 → Marble → WebXR 渲染 + 粒子系统 + 近距离交互 |
| 队友（音乐方向） | AI 音乐生成 + 音频集成进 WebXR 场景 |

**背景：** SCI-Arc 建筑学硕士，现为硅谷 CS 研究生。前职业经历：Gensler Technical Designer，曾独立发布 Unreal VR 游戏。主要技术栈：Node.js、JS / Three.js。XR 与 WebXR 是新领域，在现场边学边做。

---

## 十二、24小时时间表

> **现实约束：** Day 2 主要是调试、录视频、social 和颁奖。所有核心功能必须在 Day 1 完成。非必要功能全部 fake。

### 周六 Day 1（唯一开发日）

| 时间 | 任务 |
|------|------|
| 9:00–11:00 | 环境配置、团队组建、工具准备 |
| 11:00–14:00 | SparkJS + WebXR 脚手架搭建，加载预生成 .spz |
| 14:00–17:00 | 近距离热点系统 + 照片浮现面板 |
| 17:00–19:00 | 粒子系统（花瓣 / 光晕）实现 |
| 19:00–23:00 | 音乐集成 + 整体联调 |

### 周日 Day 2（调试 + 提交）

| 时间 | 任务 |
|------|------|
| 8:00–10:00 | Bug 修复 + PICO 设备实机测试 |
| 10:00–12:00 | 最终调参 + 录制 Demo 视频（45秒） |
| 13:00 | 提交截止 |
| 14:00–17:00 | 评审 + Showcase + 颁奖 |

---

## 十三、风险与应对

| 风险 | 可能性 | 应对方案 |
|------|--------|---------|
| SparkJS 在 PICO 上性能不足 | 中 | 提前在设备上测试；必要时降低 Splat 分辨率 |
| 融合全景图质量不达标 | 中 | 多组 Prompt 预生成多版本，选最佳 |
| WebXR 近距离检测延迟 | 低 | 标准 Three.js 每帧距离检测，有大量文档可参考 |
| Demo 评审时崩溃 | 低 | 所有资产 hardcode，无实时 API 调用，零网络依赖 |
| 现场 PICO 头显不可用 | 低 | 主办方确认提供 Quest 3，WebXR 在 Quest 上同样可运行 |

---

## 十四、参考资料

- World Labs Marble API：https://api.worldlabs.ai/marble/v1
- Memory House 案例研究：https://www.worldlabs.ai/case-studies/memory-house
- SensAI WebXR Kit：https://github.com/V4C38/sensai-webxr-worldmodels
- SensAI Knowledge Hub：https://xrbootcamp.notion.site/SensAI-Knowledge-Hub
- Wist Labs（竞品参考）：https://wistlabs.com

---

*最后更新：2026年3月13日*
