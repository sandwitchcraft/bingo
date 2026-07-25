/**
 * Client helpers for the two anonymous backend features:
 *
 *   - "report incorrect sort"  → `submitReport`, writes a row to `reports` (carries an
 *     anonymous per-device UUID). `report_type` splits a data bug (`wrong_bin`) from a model
 *     miss (`wrong_item`) and must be passed explicitly — the two are never conflated.
 *   - "help improve Bin-go"     → `submitTrainingImage`, writes a row to `training_images`.
 *     This flow carries **no device id and no other identifier of any kind**, by policy — do
 *     not add one. See `src/core/supabase.ts` for the client and the key it uses.
 *
 * Both are fire-and-forget from the UI's side: every function resolves with a
 * `{ success, error? }` and never throws, so a failed upload can't interrupt a scan.
 */
import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { StorageKeys, getString, setString } from "@/core/storage";
import { supabase } from "@/core/supabase";

const BUCKET = "scan-photos";

/**
 * Anonymous per-device identifier. Generated once, persisted locally, never tied to any real
 * identity. Its only purpose is to distinguish "5 different devices flagged this item" from
 * "one device flagged it 5 times". Goes through `StorageKeys` like every other persisted key.
 */
export async function getDeviceId(): Promise<string> {
  let id = await getString(StorageKeys.deviceId);
  if (!id) {
    id = Crypto.randomUUID();
    await setString(StorageKeys.deviceId, id);
  }
  return id;
}

/**
 * Compresses an image and uploads it to the private `scan-photos` bucket. Returns the storage
 * path on success or `null` on failure — shared by both flows, so keep it the only place this
 * logic lives.
 *
 * Two RN-specific notes: (1) the SDK-57 image-manipulator is the chainable context API
 * (`manipulate().resize().renderAsync()` → `saveAsync`), not the deprecated `manipulateAsync`.
 * (2) The upload body is an `ArrayBuffer`, not a `Blob` — `fetch(uri).blob()` frequently
 * produces a zero-byte upload on React Native, whereas `arrayBuffer()` is reliable.
 */
async function uploadImage(fileUri: string): Promise<string | null> {
  try {
    const image = await ImageManipulator.manipulate(fileUri)
      .resize({ width: 800 })
      .renderAsync();
    const compressed = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

    const fileName = `${Date.now()}-${Crypto.randomUUID()}.jpg`;
    const arrayBuffer = await (await fetch(compressed.uri)).arrayBuffer();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, arrayBuffer, { contentType: "image/jpeg" });

    if (error) {
      console.warn("[reports] image upload failed", error.message);
      return null;
    }
    return fileName;
  } catch (err) {
    console.warn("[reports] image compression/upload error", err);
    return null;
  }
}

/**
 * "Report incorrect sort". `reportType` is required and never defaulted here: the caller must
 * have asked the user which problem this is (wrong bin = data bug vs. wrong item = model miss)
 * before calling. The image is optional; a failed image upload still submits the report.
 */
export async function submitReport(params: {
  region: string;
  itemKey: string;
  reportedBin: string;
  reportType: "wrong_bin" | "wrong_item";
  userNote?: string;
  imageUri?: string;
}): Promise<{ success: boolean; error?: string }> {
  const deviceId = await getDeviceId();
  const imagePath = params.imageUri ? await uploadImage(params.imageUri) : null;

  const { error } = await supabase.from("reports").insert({
    device_id: deviceId,
    report_type: params.reportType,
    region: params.region,
    item_key: params.itemKey,
    reported_bin: params.reportedBin,
    user_note: params.userNote ?? null,
    image_path: imagePath,
  });

  return { success: !error, error: error?.message };
}

/**
 * "Help improve Bin-go" opt-in. Carries **no** device id and no other identifier — this is a
 * privacy-policy commitment, not a style choice, and must never change. The image is required
 * (the whole point is the picture); if its upload fails there is nothing to record.
 */
export async function submitTrainingImage(params: {
  region: string;
  imageUri: string;
  predictedItem?: string;
}): Promise<{ success: boolean; error?: string }> {
  const imagePath = await uploadImage(params.imageUri);
  if (!imagePath) return { success: false, error: "Image upload failed" };

  const { error } = await supabase.from("training_images").insert({
    image_path: imagePath,
    region: params.region,
    predicted_item: params.predictedItem ?? null,
  });

  return { success: !error, error: error?.message };
}
