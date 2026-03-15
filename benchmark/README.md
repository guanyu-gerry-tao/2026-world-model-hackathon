# Benchmark Assets

团队共享的标准 Demo 资产。**所有文件都提交进 git，供全员同步使用。**

---

## 目录结构

```
benchmark/
└── tokyo-shibuya/               # 第一个 Demo 城市：东京涩谷
    ├── photos/                  # 原始用户照片（输入）
    │   ├── photo1.jpg
    │   └── ...
    ├── template.png             # 原始城市全景图模板（输入）
    ├── panorama-banana.png      # Gemini（Nano Banana Pro）处理后的全景图
    └── world.spz                # World Labs Marble 生成的 Gaussian Splat
```

---

## 每个文件是什么

| 文件 | 来源 | 用途 |
|------|------|------|
| `photos/*.jpg` | 团队拍摄或收集的照片 | 作为 pipeline 输入，上传给 Gemini |
| `template.png` | 网上找的涩谷街道 360° 全景图 | Mode A 的城市模板底图 |
| `panorama-banana.png` | Gemini API 输出 | 验证 Gemini 融合效果；也可直接送给 Marble |
| `world.spz` | Marble API 下载 | PICO WebXR 前端直接加载渲染 |

---

## 如何更新

生成新版本后，直接覆盖对应文件并 commit：

```bash
# 例：更新涩谷的 spz
cp ~/Downloads/new-world.spz benchmark/tokyo-shibuya/world.spz
git add benchmark/tokyo-shibuya/world.spz
git commit -m "chore: update tokyo-shibuya world.spz (Marble 0.1-plus)"
```

---

## 注意

- `world.spz` 文件较大（50–100 MB），如果 git push 报错可以考虑 git-lfs
- `panorama-banana.png` 是 2:1 等距柱状投影，宽度建议 4096px 以上
