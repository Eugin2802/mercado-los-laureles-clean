import {
  registerCloudinaryProductImage,
  requestProductImageUpload,
  type ProductImageUploadInput,
} from "@api-client";
import { uploadCloudinaryAsset } from "@api-client";

const imageIdFromPath = (path: string) => {
  const match = /^\/api\/storage\/objects\/uploads\/([0-9a-f-]{36})$/i.exec(path);
  return match?.[1] ?? null;
};

export async function uploadMarketplaceImage(file: File): Promise<string> {
  const plan = await requestProductImageUpload({
    name: file.name,
    size: file.size,
    contentType: file.type as ProductImageUploadInput["contentType"],
  });
  if (!plan.uploadFields) {
    const uploaded = await fetch(plan.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploaded.ok) throw new Error("No se pudo subir la imagen.");
    return plan.objectPath;
  }

  const imageId = imageIdFromPath(plan.objectPath);
  if (!imageId) throw new Error("La carga de imagen no devolvió una ruta válida.");
  const uploaded = await uploadCloudinaryAsset(file, plan);
  const registered = await registerCloudinaryProductImage({
    imageId,
    publicId: uploaded.publicId,
    secureUrl: uploaded.secureUrl,
    contentType: file.type as ProductImageUploadInput["contentType"],
    size: file.size,
  });
  return registered.objectPath;
}