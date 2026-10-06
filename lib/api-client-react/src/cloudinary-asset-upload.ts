import type { ProductImageUploadResponse } from "./generated/api.schemas";

export async function uploadCloudinaryAsset(
  file: File,
  plan: Pick<ProductImageUploadResponse, "uploadURL" | "uploadFields">,
): Promise<{ publicId: string; secureUrl: string }> {
  if (!plan.uploadFields?.public_id || !plan.uploadFields.upload_preset) {
    throw new Error("Cloudinary upload settings are incomplete");
  }
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(plan.uploadFields)) form.append(key, value);
  const response = await fetch(plan.uploadURL, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json().catch(() => null) as {
    public_id?: string;
    secure_url?: string;
  } | null;
  if (!response.ok || result?.public_id !== plan.uploadFields.public_id || !result.secure_url) {
    throw new Error("Cloudinary upload failed");
  }
  return { publicId: result.public_id, secureUrl: result.secure_url };
}