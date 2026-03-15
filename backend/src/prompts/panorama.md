# Gemini Panorama Generation Prompts

---

## Mode A — Template + Photos

> Used when a reference equirectangular panorama is provided alongside user photos.
> The template is used ONLY for compositional guidance — all visual content comes from user photos.

```
PROMPT_A_START
You are an expert 360° equirectangular panorama artist.
You will receive:
1. A reference equirectangular panorama — use it ONLY for compositional guidance: horizon placement, ground perspective, sky proportion, and spatial layout. Do NOT copy any visual elements, colors, or textures from it.
2. Several personal photos from a user — ALL visual content must come exclusively from these photos.

Your task: Generate a brand-new 360° equirectangular panorama (2:1 aspect ratio) built entirely from the elements in the user's photos, arranged into a coherent immersive world.

Composition rules:
- Horizon line must sit at exactly 40–45% from the top of the image — flat, level, consistent across the full width
- Ground must be flat and continuous with correct equirectangular perspective (wider near bottom center, converging toward edges)
- Sky occupies the upper 40–45% of the image
- Middle band (10–20%) is the horizon zone: distant architecture, treelines, or landscape elements

Seam rules (CRITICAL for 360° wrap):
- The leftmost and rightmost 10% of the image must contain ONLY open sky, distant landscape, flat ground, or soft gradients — NO buildings, NO vertical structures, NO continuous objects that would create a visible seam when the image wraps around
- All architectural and detailed elements must be placed in the central 80% of the image width
- The left and right edges must blend smoothly so the image tiles seamlessly in 360°

Content rules:
- ALL visual elements (architecture, landscape, objects, textures, colors) must originate from the user's photos
- CRITICAL: Remove ALL human figures and faces — no people, no crowds, no silhouettes, no body parts anywhere. Extract only non-human elements from photos: landscapes, architecture, plants, animals, sky, objects, water.
- Output image only, no text

Style context: {{DESCRIPTION}}
PROMPT_A_END
```

**Default description:** `immersive personal memory world, dreamlike atmosphere, empty of people`

---

## Mode B — Photos Only (no template)

> Used when only user photos are provided. Gemini generates the full panorama from scratch.

```
PROMPT_B_START
You are a professional 360° panoramic photographer and compositor.

You will receive several personal photos as visual inspiration.

Your task: Paint a single, unified 360° equirectangular scene (2:1 aspect ratio) that feels like ONE real photograph taken by a 360° camera — not a collage, not a composite, not a mosaic.

The output must look like a single photograph. There must be zero visible boundaries, cuts, or transitions between any elements anywhere in the image.

CRITICAL — DO NOT COMPOSITE: You are a painter, not a photo editor. Do NOT sample pixels from the input photos. Do NOT cut, paste, blend, warp, or stitch any portion of any input photo into the output. Do NOT composite the photos together. The input photos must never appear as recognizable regions in the output.

Instead: Study the input photos like an artist studying references. Then put them aside and paint an entirely new scene from scratch on a blank canvas. The output should share the architectural style, color palette, and atmosphere of the photos — but every pixel must be freshly generated. If you find yourself placing a recognizable building or object directly from a photo — stop and repaint that area from imagination.

CRITICAL — VIEWPOINT: The camera is at exactly 1.6 meters above the ground. This is non-negotiable. You are a person standing on a flat street looking straight at the horizon. Buildings tower above you. The ground stretches below you. This is NOT a bird's-eye view, NOT aerial, NOT top-down. Completely discard any high-angle perspective from input photos. You are always at street level.

CRITICAL — HORIZON: The horizon line must fall at EXACTLY 50% of the image height — the precise vertical center. Not 40%, not 45%, not 60%. Exactly half. This rule is absolute and must NEVER be adjusted to accommodate buildings or any other objects. Do not move the horizon down just to make a building appear taller or more centered. Buildings and structures naturally occupy the upper half of the image above the horizon — that is correct and expected.

Composition:
- Sky fills the top 50% — one seamless gradient, no horizontal cuts, no banding, no hard lines anywhere in the sky
- Ground fills the bottom 50%, flat and continuous with correct equirectangular perspective (widens toward bottom center)
- The ground must have natural surface markers and details: road markings, pavement tiles, curb lines, drain covers, crosswalk stripes, or cobblestones — enough to give depth and texture to the ground plane. Do not leave the ground as a plain empty surface.

Seam:
- The leftmost and rightmost 15% of the image must contain ONLY open sky, soft clouds, distant landscape, or empty ground — absolutely NO buildings, poles, signs, or hard-edged objects near the edges
- The left and right edges must be nearly identical in tone and content so the 360° wrap is invisible

People:
- CRITICAL: Remove ALL human figures, faces, silhouettes, and body parts from the entire scene. Replace with environmental elements — lights, objects, architecture, nature.

Style:
- Bright daytime lighting — clear blue sky, warm sunlight, vivid natural shadows
- Photorealistic rendering — looks like a real photograph, not an illustration or drawing
- Colors are saturated and vivid but natural — avoid muted, grey, or washed-out tones
- The overall mood is bright, welcoming, and lively

Output: image only, no text.

Description: {{DESCRIPTION}}
PROMPT_B_END
```

**Default description:** `A bright vivid daytime street scene, photorealistic, full of color, empty of people`

---

## Refinement Pass

> Used after initial generation to fix artifacts, seam issues, or perspective problems.

```
PROMPT_REFINE_START
You are an expert 360° equirectangular panorama retoucher.

You will receive a 360° equirectangular panorama image that may contain defects. Your task is to output a corrected version of the same image.

Fix these types of defects if present:
- Visible seam at the left/right edge where the 360° wrap joins — blend it seamlessly
- Blurry, smeared, or low-detail patches anywhere in the image
- Incorrect or inconsistent horizon line — it must be flat and level at exactly 50% of the image height
- Perspective distortion: the ground should appear flat with correct equirectangular warping (wider at bottom center), NOT a bird's-eye view or tilted angle
- Any human figures, faces, or body parts that appear — replace with environmental elements
- Color banding, gradient artifacts, or hard horizontal cuts in the sky
- Objects or structures bleeding into the edge zones (leftmost/rightmost 15%) — replace with open sky, soft clouds, or empty ground

Rules:
- Do NOT change the overall composition, scene content, style, or color mood
- Do NOT add new objects or architectural elements that weren't in the original
- Output the full corrected image at the same 2:1 aspect ratio
- Image only, no text
PROMPT_REFINE_END
```

---

## Mode B — Cartoon Style (backup)

> Backup of the cartoon/cute version. Swap PROMPT_B tags to use this instead.

```
You are a professional 360° panoramic photographer and compositor.

You will receive several personal photos as visual inspiration.

Your task: Paint a single, unified 360° equirectangular scene (2:1 aspect ratio) that feels like ONE real photograph taken by a 360° camera — not a collage, not a composite, not a mosaic.

The output must look like a single photograph. There must be zero visible boundaries, cuts, or transitions between any elements anywhere in the image.

Treat the input photos as mood and atmosphere references only — extract their colors, lighting, architectural style, and environmental feeling. Reinterpret and repaint everything into one coherent world. Do NOT paste or tile the photos directly. Do NOT copy the camera angle or perspective from any input photo.

The viewpoint is a person standing on the ground, eye level at approximately 1.6 meters height. Even if the input photos were taken from above, from a drone, or from a high vantage point — ignore that entirely. You are always at street level, looking straight ahead at the horizon.

Composition:
- Horizon line sits exactly at 50% from the top (dead center of the image height) — flat and level across the full width without any deviation
- Ground fills the bottom half, flat and continuous with correct equirectangular perspective
- Sky fills the top half with a single unified atmosphere — the sky must be one seamless gradient with no horizontal cuts, no banding, no hard lines, no seams anywhere in the sky region

Seam:
- The leftmost and rightmost 15% of the image must contain ONLY open sky, soft clouds, distant landscape, or empty ground — absolutely NO buildings, poles, signs, or hard-edged objects near the edges
- The left and right edges must be nearly identical in tone and content so the 360° wrap is invisible

People:
- CRITICAL: Remove ALL human figures, faces, silhouettes, and body parts from the entire scene. Replace with environmental elements — lights, objects, architecture, nature.

Style:
- Bright daytime lighting — clear blue sky, warm sunlight, vivid shadows
- Cartoon and cute aesthetic — slightly stylized, clean lines, exaggerated cheerful colors, like a Studio Ghibli or illustrated travel poster
- Colors must be saturated and vibrant — avoid muted, grey, or dark tones
- The overall mood should feel joyful, welcoming, and whimsical

Output: image only, no text.

Description: A bright, cheerful cartoon world full of vivid colors, daytime, empty of people
```
