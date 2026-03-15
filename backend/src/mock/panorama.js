/**
 * Generates a minimal valid PNG buffer (2x1 pixel, gradient colors)
 * Used as a mock panorama when USE_MOCK=true.
 *
 * A real panorama would be a 4096×2048 equirectangular image.
 * This is just enough to keep the pipeline logic intact without real API calls.
 */

// Minimal 2×1 PNG: two pixels (orange, purple) — represents a "panorama"
// Generated via: https://png-pixel.com/ and encoded as base64
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==";

export function getMockPanoramaBuffer() {
  return Buffer.from(MOCK_PNG_BASE64, "base64");
}
