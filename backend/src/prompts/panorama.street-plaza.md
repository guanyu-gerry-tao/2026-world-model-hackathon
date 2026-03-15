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
THIS IS A 360° EQUIRECTANGULAR PANORAMA. THE OUTPUT MUST BE A FULL 360° EQUIRECTANGULAR IMAGE WITH 2:1 ASPECT RATIO. THIS IS NOT A REGULAR PHOTO. THE ENTIRE 360° SCENE MUST WRAP SEAMLESSLY FROM LEFT EDGE TO RIGHT EDGE.

Style: hand-painted anime — Studio Ghibli / Makoto Shinkai aesthetic. Strikingly beautiful, visually stunning, rich and lush. Colors must be vivid and highly saturated — deep blues, glowing golds, lush greens, dramatic skies. Every element should look like a frame from an award-winning anime film.

You will receive personal photos. ALL buildings, landmarks, and landscapes from the photos MUST appear in the output — do not ignore any photo.

CRITICAL — blend them organically: do NOT place each photo as its own isolated section. Instead, weave the architecture and scenery from all photos together into one continuous world. Buildings from different photos should coexist naturally in the same streetscape, with shared lighting and atmosphere. No hard vertical boundaries between elements from different photos.

CAMERA POSITION (critical):
- The camera is placed at the CENTER of a large open plaza or courtyard. The viewer stands in the middle of an open space.
- ALL buildings are at a DISTANCE — surrounding the plaza from the outside. No building is directly next to the camera.
- Because the camera is in the middle of an open space, a large empty ground plane fills the foreground in all directions.
- The horizon (where buildings meet sky) sits at roughly 45% from the top.
- The bottom 45% of the image is mostly open ground — plaza, cobblestone, or pavement — with buildings visible only in the distance above the horizon.

EDGES:
- Fill the entire width with buildings, architecture, and scenery — no empty zones at the edges
- Left and right edges must match in tone and content so the 360° wrap is seamless

STYLE: Hand-painted brushwork, intensely luminous and saturated colors, dramatic expressive anime clouds, warm golden light, depth haze. Mood: breathtakingly beautiful, nostalgic, warm, magical. No people.

Output: image only, no text.

Description: {{DESCRIPTION}}
PROMPT_B_END
```

**Default description:** `A magical anime world, golden hour light, lush and painterly, empty of people`

---

## Refinement Pass

> Used after initial generation to fix artifacts, seam issues, or perspective problems.

```
PROMPT_REFINE_START
THIS OUTPUT MUST BE A 360° EQUIRECTANGULAR PANORAMA with a 2:1 aspect ratio. The left and right edges must wrap seamlessly.

You will receive a panorama image. You MUST make ALL of the following changes unconditionally — do not skip any step even if the image looks acceptable to you.

THINK OF THE IMAGE AS A GRID. The image has a height H. The midpoint is at H/2 — this is the HARD DIVIDING LINE.

RULE 1 — THE DIVIDING LINE IS ABSOLUTE:
- Rows 0 to H/2 (TOP HALF): sky and buildings only
- Rows H/2 to H (BOTTOM HALF): flat ground only — no exceptions
- The dividing line at H/2 is the horizon. It must be a clean, flat, horizontal line across the full width.

STEP 1 — ENFORCE THE BOTTOM HALF (DO THIS FIRST):
Look at every row in the bottom half of the image (rows H/2 to H). If any row contains a building, wall, facade, window, door, or any man-made vertical structure — ERASE IT and replace with ground texture (pavement, stone, grass, or dirt) matching the surrounding ground. The bottom half must contain ONLY flat ground. Do this row by row until the entire bottom half is clean ground.

STEP 2 — ENFORCE THE HORIZON LINE:
The boundary between top half and bottom half must be a visible, clean, flat horizon line. Sky and buildings above. Ground below. No blending of buildings into the ground zone.

STEP 3 — VERTICAL CUTS (MANDATORY):
Find every hard vertical boundary, sharp edge, or abrupt transition between sections in the image. Repaint and blend all of them — extend textures, match lighting across the boundary, and make the full image look like one continuous scene with zero visible vertical seams.

STEP 4 — OTHER:
- Blend left/right edges so the 360° wrap is invisible
- Remove any human figures — replace with environment
- Fix sky banding, blurry patches, or color artifacts

Output: the full corrected image at the same 2:1 aspect ratio. Image only, no text.
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
