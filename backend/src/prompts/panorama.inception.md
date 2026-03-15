# Gemini Panorama Generation Prompts

---

## Photo Description (for music generation)

```
PROMPT_DESCRIBE_START
You are analyzing a photo to generate a description for music composition.

Describe this photo in 2-3 sentences focusing on:
- The mood and emotional atmosphere
- Time of day, lighting, weather
- The setting (urban, nature, indoor, etc.)
- Energy level (calm, busy, melancholic, joyful, etc.)

Be evocative and sensory. Do not describe people or faces. Output plain text only, no labels or formatting.
PROMPT_DESCRIBE_END
```

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
You are creating a 360° equirectangular panorama of a dreamworld — a surreal, impossible space that feels like a memory collapsing in on itself. The visual language is that of Inception: photorealistic in every detail, but physically impossible as a whole.

You will receive several personal photos. These are memory fragments. Embed them into the dreamworld as portals, reflections, cracked windows, or architectural surfaces — not as flat pasted images, but as living parts of the space.

DREAM SPACE CONCEPT:
- The space is a grand, impossible plaza where the laws of gravity and geometry have been rewritten
- Different environments from the input photos exist simultaneously in the same space: a street curves upward and becomes a ceiling, a building from one photo grows out of the side of a building from another, a landscape is reflected upside-down in a mirrored floor
- The viewer stands at the center of this folded world, surrounded by architecture that curves, folds, and mirrors itself in every direction
- Massive scale: columns, arches, and structures tower far above the viewer, making them feel small

MEMORY FRAGMENTS — HOW TO USE EACH PHOTO:
- Each input photo becomes one distinct embedded element in the space: a giant cracked mirror showing that scene, a window in a curved wall looking into that world, a floor or ceiling panel reflecting that environment, or architectural surfaces textured with that scene
- Distribute them evenly around the 360° so each photo has equal visual presence
- They should feel like glimpses into other dream layers — recognizable but distorted, as if seen through glass, water, or fractured light

VISUAL LANGUAGE:
- Photorealistic rendering throughout — every surface has real texture, real light, real shadow
- Lighting is dramatic and mysterious: multiple light sources of different colors and temperatures, long shadows, god-rays through impossible skylights, reflections multiplied across mirror surfaces
- Atmosphere: a fine mist or dust in the air, giving depth and a sense of unreality
- Color palette: deep rich tones — midnight blue, warm amber, cold silver — with moments of saturated color from the memory fragments
- The mood is melancholic, vast, and cinematic — like the Paris fold scene, the mirror maze, or the limbo city of Inception

IMPOSSIBLE GEOMETRY (encouraged):
- Streets or corridors that visibly curve upward into the sky at the edges of the scene
- Buildings reflected overhead in curved mirrored ceilings or inverted above the horizon
- Staircases that loop back on themselves
- A ground that transitions from stone to water to glass, each section reflecting a different memory

TECHNICAL RULES (required for 3D reconstruction):
- Viewpoint: camera at 1.6 meters above the ground, standing in the center, looking straight ahead
- Horizon: at exactly 50% of the image height — flat and level. The impossible architecture lives above AND below this line
- Ground: a continuous floor plane visible below the horizon with equirectangular perspective (wider toward bottom center) — it can be mirrored, cracked, flooded, or textured, but must be flat and readable as ground
- Sky/upper half: fills the top 50% — can show inverted architecture, a dreamlike sky, or reflected cityscapes, but no hard horizontal banding
- Seam: leftmost and rightmost 15% must be soft and compatible in tone — use mist, open space, or distant architecture — so the 360° wrap is invisible
- One seamless continuous image — the impossible geometry is painted in, not composited

People:
- No human figures, faces, or silhouettes anywhere. The world is empty, waiting.

Output: image only, no text.

Description: {{DESCRIPTION}}
PROMPT_B_END
```

**Default description:** `A surreal dreamworld, vast and melancholic, empty of people`

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
- Incorrect horizon line — if the horizon sits above or below 50% of the image height, shift the entire scene vertically until the horizon lands at exactly 50%; fill any exposed strip at the top or bottom by extending the sky or ground content naturally to match the adjacent pixels
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
