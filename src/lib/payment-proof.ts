import { registerCloudinaryProof, registerCloudinaryPromotionProof, requestProofUpload, uploadCloudinaryAsset, type ProofUploadInput } from '@api-client';

const types = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const validPaymentProof = (file: File) => types.has(file.type) && file.size > 0 && file.size <= 5 * 1024 * 1024;

export async function uploadPaymentProof(file: File, purpose: 'order' | 'promotion'): Promise<string> {
  if (!validPaymentProof(file)) throw new Error('El comprobante debe ser JPG, PNG o WebP y pesar como máximo 5 MB.');
  const plan = await requestProofUpload({
    purpose, name: file.name, size: file.size,
    contentType: file.type as ProofUploadInput['contentType'],
  });
  const { uploadURL, objectPath } = plan;
  if (purpose === 'order') {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', 'vouchers_laureles');
    form.append('public_id', objectPath);
    const response = await fetch('https://api.cloudinary.com/v1_1/k9qevwzd/image/upload', {
      method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
    });
    const uploaded = await response.json().catch(() => null) as {
      secure_url?: string; public_id?: string; error?: { message?: string };
    } | null;
    if (!response.ok) {
      const detail = uploaded?.error?.message || '';
      if (/preset|unsigned|whitelist/i.test(detail)) {
        throw new Error('Cloudinary aún no permite esta carga. Configura vouchers_laureles como preset Unsigned y permite public_id.');
      }
      throw new Error('No se pudo subir el comprobante a Cloudinary. Inténtalo nuevamente.');
    }
    if (!uploaded?.secure_url || uploaded.public_id !== objectPath) {
      throw new Error('Cloudinary no devolvió la URL esperada. Revisa que el preset permita el public_id solicitado.');
    }
    const registered = await registerCloudinaryProof({ publicId: objectPath, secureUrl: uploaded.secure_url });
    return registered.proofPath;
  }
  if (purpose === 'promotion' && plan.uploadFields) {
    const match = /^\/api\/storage\/proofs\/promotion\/([0-9a-f-]{36})$/i.exec(plan.objectPath);
    if (!match) throw new Error('La carga no devolvió una ruta válida.');
    const uploaded = await uploadCloudinaryAsset(file, plan);
    const registered = await registerCloudinaryPromotionProof({
      imageId: match[1],
      publicId: uploaded.publicId,
      secureUrl: uploaded.secureUrl,
      contentType: file.type as ProofUploadInput['contentType'],
      size: file.size,
    });
    return registered.proofPath;
  }
  const response = await fetch(uploadURL, {
    method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
  });
  if (!response.ok) throw new Error('No se pudo subir la imagen. Inténtalo nuevamente.');
  return objectPath;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  }
  return error instanceof Error && error.name !== 'ApiError' ? error.message : fallback;
}