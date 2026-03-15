"""
Gemini Panorama Generation — Standalone Test Script

Usage:
  pip install google-genai
  export GEMINI_API_KEY=your_key

  # Mode A (template fusion)
  python test_gemini.py --mode a --template /path/to/panorama.jpg --photos p1.jpg p2.jpg

  # Mode B (generate from scratch)
  python test_gemini.py --mode b --photos p1.jpg p2.jpg --desc "Shanghai alley, afternoon sun"

  # Quick test (description only, no photos)
  python test_gemini.py --mode b --desc "Tokyo neon street at night"
"""

import argparse
import base64
import os
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Missing dependency. Run: pip install google-genai")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
MODEL_FAST = "gemini-2.0-flash-preview-image-generation"
MODEL_PRO  = "gemini-2.0-flash-preview-image-generation"  # swap to Pro when available

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
PROMPT_A = """You are an expert panorama compositor.
You will receive:
1. A 360 degree equirectangular city street panorama (the base scene)
2. Several personal photos taken by a user

Your task: Naturally embed the user's photos into the city scene as if they belong there.
Placement ideas:
- Posters on walls or shop fronts
- Displays in shop windows
- Hanging decorations near lamp posts
- Billboards or signage

Rules:
- Maintain the original city scene's perspective, lighting, and style
- Photos should look like they belong in the scene, not like cutouts
- CRITICAL: Remove ALL human figures and faces from the entire scene — no people, no crowds, no silhouettes, no body parts. Replace them with environmental elements (lights, signs, objects, textures).
- When processing user photos: if a photo contains people or faces, extract ONLY the background and non-human elements — landscapes, animals, plants, architecture, sky, ground, water, objects. Discard all human subjects entirely.
- Output a single 360 degree equirectangular panorama image (2:1 aspect ratio)
- Output image only, no text

City description context: {description}"""

PROMPT_B = """You are an expert at creating immersive 360 degree panoramic worlds.
{photo_note}

Your task: Generate a brand-new 360 degree equirectangular panoramic scene (2:1 aspect ratio) that incorporates the visual elements, colors, and mood from the provided content.

Rules:
- Output must be a proper equirectangular projection (2:1 aspect ratio)
- The scene should be immersive and walkable
- CRITICAL: Remove ALL human figures and faces — no people, no crowds, no silhouettes, no body parts anywhere in the scene.
- When processing user photos: if a photo contains people or faces, extract ONLY the non-human elements — landscapes, animals, plants, architecture, sky, ground, water, objects.
- Output image only, no text

Description: {description}"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_image_part(path: str):
    ext = Path(path).suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return types.Part(inline_data=types.Blob(mime_type=mime, data=data))


def save_output(image_data: bytes, mode: str) -> str:
    out_dir = Path(__file__).parent / "output" / "gemini-test"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"panorama_mode{mode.upper()}_{int(time.time())}.png"
    out_path = out_dir / filename
    out_path.write_bytes(image_data)
    return str(out_path)


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
def generate(mode: str, photos: list, template: str | None, description: str, quality: str):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    model = MODEL_PRO if quality == "pro" else MODEL_FAST
    parts = []

    if mode == "a":
        if not template:
            print("ERROR: Mode A requires --template")
            sys.exit(1)
        parts.append(types.Part(text=PROMPT_A.format(
            description=description or "Tokyo Shibuya crossing, nighttime, neon lights, empty streets"
        )))
        parts.append(load_image_part(template))
        print(f"  template: {template}")
    else:
        photo_note = (
            "You will receive several personal photos from a user."
            if photos else
            "No photos provided — generate purely from the description below."
        )
        parts.append(types.Part(text=PROMPT_B.format(
            photo_note=photo_note,
            description=description or "A dreamlike memory world, empty of people",
        )))

    for p in photos:
        parts.append(load_image_part(p))
        print(f"  photo: {p}")

    print(f"  model:       {model}")
    print(f"  mode:        {'A - template fusion' if mode == 'a' else 'B - generate from scratch'}")
    print(f"  description: {description or '(default)'}")
    print("\nGenerating, please wait...\n")

    t0 = time.time()
    response = client.models.generate_content(
        model=model,
        contents=[types.Content(parts=parts)],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )
    elapsed = time.time() - t0

    candidate = response.candidates[0] if response.candidates else None
    if not candidate:
        print("ERROR: Gemini returned no candidates")
        sys.exit(1)

    for part in candidate.content.parts:
        if part.inline_data and part.inline_data.data:
            img_bytes = base64.b64decode(part.inline_data.data)
            out_path = save_output(img_bytes, mode)
            print(f"SUCCESS  {elapsed:.1f}s")
            print(f"output:  {out_path}")
            print(f"size:    {len(img_bytes) / 1024:.1f} KB")
            return

    for part in candidate.content.parts:
        if part.text:
            print(f"WARNING: Gemini returned text instead of image:\n{part.text}")
    sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Gemini panorama generation test")
    parser.add_argument("--mode", choices=["a", "b"], default="b",
                        help="a=template fusion, b=from scratch (default: b)")
    parser.add_argument("--template", help="Mode A: city template panorama path")
    parser.add_argument("--photos", nargs="*", default=[], help="User photo paths")
    parser.add_argument("--desc", default="", help="Text description")
    parser.add_argument("--quality", choices=["fast", "pro"], default="fast",
                        help="fast=Flash, pro=Pro (default: fast)")
    args = parser.parse_args()

    print("=" * 50)
    print("  Gemini Panorama Generation Test")
    print("=" * 50)

    generate(
        mode=args.mode,
        photos=args.photos or [],
        template=args.template,
        description=args.desc,
        quality=args.quality,
    )


if __name__ == "__main__":
    main()
