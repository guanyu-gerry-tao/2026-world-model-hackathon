import fs from "node:fs";

const BASE_URL = "https://api.worldlabs.ai/marble/v1";
const POLL_INTERVAL_MS = 15_000; // 15 seconds

function headers() {
  return {
    "WLT-Api-Key": process.env.MARBLE_API_KEY,
    "Content-Type": "application/json",
  };
}

/**
 * Step 1: Get a signed upload URL from Marble
 * Returns { upload_url, asset_id }
 */
export async function prepareUpload() {
  const res = await fetch(`${BASE_URL}/media-assets:prepare_upload`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ file_name: "panorama.png", kind: "image" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Marble prepareUpload failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return {
    upload_url: data.upload_info.upload_url,
    asset_id: data.media_asset.media_asset_id,
  };
}

/**
 * Step 2: Upload the panorama image to the signed URL
 * @param {string} uploadUrl - signed GCS URL from prepareUpload
 * @param {Buffer} imageBuffer - panorama image buffer
 */
export async function uploadPanorama(uploadUrl, imageBuffer) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
      "x-goog-content-length-range": "0,104857600",
    },
    body: imageBuffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Marble upload failed ${res.status}: ${text}`);
  }
}

/**
 * Step 3: Trigger world generation from an uploaded media asset
 * @param {string} assetId - media_asset_id from prepareUpload
 * @param {string} displayName - name for this world
 * @param {"Marble 0.1-plus"|"Marble 0.1-mini"} model
 * Returns operation_id
 */
export async function generateWorld(assetId, displayName = "citywalk-world", model = "Marble 0.1-plus", textPrompt = "") {
  const world_prompt = {
    type: "image",
    image_prompt: { source: "media_asset", media_asset_id: assetId },
    is_pano: true,
  };
  if (textPrompt) world_prompt.text_prompt = textPrompt;

  const res = await fetch(`${BASE_URL}/worlds:generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ display_name: displayName, world_prompt, model }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Marble generateWorld failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.operation_id;
}

/**
 * Step 4: Poll until done, return the full response
 * @param {string} operationId
 * @param {(status: string) => void} onProgress - optional progress callback
 */
export async function pollUntilDone(operationId, onProgress) {
  console.log(`[marble] Polling operation ${operationId}...`);
  while (true) {
    const res = await fetch(`${BASE_URL}/operations/${operationId}`, {
      headers: headers(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Marble poll failed ${res.status}: ${text}`);
    }
    const data = await res.json();

    if (data.done) {
      console.log(`[marble] Generation complete.`);
      return data.response;
    }

    const status = data.metadata?.stage ?? "processing";
    console.log(`[marble] Status: ${status} — waiting ${POLL_INTERVAL_MS / 1000}s...`);
    onProgress?.(status);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * Step 5: Download a .spz file to disk
 * @param {string} spzUrl
 * @param {string} destPath - local file path to save to
 */
export async function downloadSpz(spzUrl, destPath) {
  console.log(`[marble] Downloading .spz → ${destPath}`);
  const res = await fetch(spzUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`[marble] Saved ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
}

/**
 * Full pipeline: upload panorama buffer → generate world → poll → return asset URLs
 * @param {Buffer} panoramaBuffer
 * @param {object} options
 * @returns {{ spzUrls, colliderUrl, panoUrl, operationId }}
 */
export async function runMarblePipeline(panoramaBuffer, options = {}) {
  const { displayName = "citywalk-world", model = "Marble 0.1-plus", textPrompt = "", onProgress } = options;

  if (process.env.USE_MOCK === "true") {
    console.log("[marble] MOCK mode — simulating world generation...");
    const stages = ["uploading", "processing", "finalizing"];
    for (const stage of stages) {
      onProgress?.(stage);
      console.log(`[marble] Mock stage: ${stage}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    console.log("[marble] MOCK generation complete.");
    return {
      operationId: "mock-op-" + Date.now(),
      spzUrls: { "500k": null, "100k": null, full_res: null },
      colliderUrl: null,
      panoUrl: null,
    };
  }

  // 1. Get signed upload URL
  const { upload_url, asset_id } = await prepareUpload();
  console.log(`[marble] Upload URL ready, asset_id=${asset_id}`);

  // 2. Upload panorama
  await uploadPanorama(upload_url, panoramaBuffer);
  console.log(`[marble] Panorama uploaded.`);

  // 3. Trigger generation using the uploaded asset ID
  const operationId = await generateWorld(asset_id, displayName, model, textPrompt);
  console.log(`[marble] Generation started, operation_id=${operationId}`);

  // 4. Poll until done
  const response = await pollUntilDone(operationId, onProgress);

  return {
    operationId,
    worldId: response.world_id,
    worldUrl: response.world_marble_url,
    caption: response.assets.splats.caption ?? null,
    thumbnailUrl: response.assets.thumbnail_url ?? null,
    spzUrls: response.assets.splats.spz_urls,
    colliderUrl: response.assets.mesh.collider_mesh_url,
    panoUrl: response.assets.imagery.pano_url,
  };
}
