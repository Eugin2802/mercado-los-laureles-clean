import { customFetch } from "./custom-fetch";
import type {
  CloudinaryProductImageRegistrationInput,
  CloudinaryProductImageRegistrationResponse,
  CloudinaryPromotionProofRegistrationInput,
  CloudinaryPromotionProofRegistrationResponse,
} from "./generated/api.schemas";

export function registerCloudinaryProductImage(
  input: CloudinaryProductImageRegistrationInput,
): Promise<CloudinaryProductImageRegistrationResponse> {
  return customFetch("/api/storage/product-images/cloudinary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function registerCloudinaryPromotionProof(
  input: CloudinaryPromotionProofRegistrationInput,
): Promise<CloudinaryPromotionProofRegistrationResponse> {
  return customFetch("/api/storage/proofs/cloudinary-promotion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}